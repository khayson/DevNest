package cmd

import (
	"devnest/internal/config"
	"devnest/internal/service/database"
	"devnest/internal/service/stacks"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

func applyRuntimeOverridesFromConfig() {
	if cfgStore == nil {
		return
	}
	paths := cfgStore.GetRuntimePaths()
	database.SetPathOverrides(database.PathOverrides{
		MySQL:    paths.MySQL,
		Postgres: paths.Postgres,
		Redis:    paths.Redis,
	})
}

func buildStacksSyncPayload() map[string]interface{} {
	saved := []stacks.InstallScan{}
	if cfgStore != nil {
		for _, st := range cfgStore.GetInstalledStacks() {
			scan := stacks.ScanInstallRoot(st.RootPath)
			scan.ID = st.ID
			scan.Type = st.Type
			scan.Name = st.Name
			saved = append(saved, scan)
		}
	}

	suggested := suggestedInstallScans()

	paths := map[string]string{}
	if cfgStore != nil {
		p := cfgStore.GetRuntimePaths()
		if p.MySQL != "" {
			paths["mysql"] = p.MySQL
		}
		if p.Postgres != "" {
			paths["postgres"] = p.Postgres
		}
		if p.Redis != "" {
			paths["redis"] = p.Redis
		}
		if p.PHP != "" {
			paths["php"] = p.PHP
		}
		if p.Node != "" {
			paths["node"] = p.Node
		}
	}

	return map[string]interface{}{
		"saved":     saved,
		"suggested": suggested,
		"paths":     paths,
	}
}

func suggestedInstallScans() []stacks.InstallScan {
	var out []stacks.InstallScan
	for _, root := range []string{
		filepath.Join("C:", "xampp"),
		filepath.Join("C:", "laragon"),
	} {
		if stackAlreadySaved(root) {
			continue
		}
		scan := stacks.ScanInstallRoot(root)
		if len(scan.Binaries) > 0 {
			out = append(out, scan)
		}
	}

	pgRoot := filepath.Join("C:", "Program Files", "PostgreSQL")
	if entries, err := os.ReadDir(pgRoot); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			root := filepath.Join(pgRoot, entry.Name())
			if stackAlreadySaved(root) {
				continue
			}
			scan := stacks.ScanInstallRoot(root)
			if len(scan.Binaries) > 0 {
				out = append(out, scan)
			}
		}
	}
	return out
}

func stackAlreadySaved(root string) bool {
	if cfgStore == nil {
		return false
	}
	clean := filepath.Clean(root)
	for _, st := range cfgStore.GetInstalledStacks() {
		if filepath.Clean(st.RootPath) == clean {
			return true
		}
	}
	return false
}

func sendStacksSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event":  "stacks_sync",
		"stacks": buildStacksSyncPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastStacksSync() {
	broadcastEvent("stacks_sync", map[string]interface{}{
		"stacks": buildStacksSyncPayload(),
	})
}

func handleGetStacks(conn *websocket.Conn) {
	sendStacksSync(conn)
}

func handleScanStack(payload map[string]interface{}) {
	root, _ := payload["root_path"].(string)
	root = strings.TrimSpace(root)
	result := map[string]interface{}{
		"scan": stacks.InstallScan{RootPath: root},
	}
	if root != "" {
		result["scan"] = stacks.ScanInstallRoot(root)
	}
	broadcastEvent("stack_scan_result", result)
}

func handleAddStack(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	root, _ := payload["root_path"].(string)
	name, _ := payload["name"].(string)
	root = strings.TrimSpace(root)
	if root == "" {
		return
	}

	scan := stacks.ScanInstallRoot(root)
	if name != "" {
		scan.Name = name
	}
	id := fmt.Sprintf("stack-%d", time.Now().UnixNano())
	stack := config.InstalledStack{
		ID:       id,
		Name:     scan.Name,
		Type:     scan.Type,
		RootPath: scan.RootPath,
	}
	_ = cfgStore.AddInstalledStack(stack)

	paths := config.RuntimePaths{}
	for _, b := range scan.Binaries {
		switch b.Service {
		case "mysql":
			paths.MySQL = b.Path
		case "postgres":
			paths.Postgres = b.Path
		case "redis":
			paths.Redis = b.Path
		case "php":
			paths.PHP = b.Path
		case "node":
			paths.Node = b.Path
		}
	}
	_ = cfgStore.MergeRuntimePaths(paths)

	if paths.PHP != "" {
		_ = cfgStore.SetActivePHPPath("", paths.PHP)
	}
	if paths.Node != "" {
		_ = cfgStore.SetActiveNodePath("", paths.Node)
	}

	reloadDatabaseServices()
	broadcastStacksSync()
	broadcastDatabaseSync()
	broadcastAboutSync()
	log.Printf("[Stacks] Added install root: %s (%s)", scan.Name, scan.RootPath)
}

func handleRemoveStack(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	id, _ := payload["id"].(string)
	root, _ := payload["root_path"].(string)
	if id == "" && root != "" {
		for _, st := range cfgStore.GetInstalledStacks() {
			if filepath.Clean(st.RootPath) == filepath.Clean(root) {
				id = st.ID
				break
			}
		}
	}
	if id == "" {
		return
	}
	_ = cfgStore.RemoveInstalledStack(id)
	broadcastStacksSync()
}

func reloadDatabaseServices() {
	if globalManager == nil {
		return
	}
	applyRuntimeOverridesFromConfig()
	for _, id := range []string{"mysql", "postgres", "redis"} {
		globalManager.Unregister(id)
	}
	registerDatabaseServices()
}

func handleGetDBSchema(payload map[string]interface{}) {
	engine, _ := payload["engine"].(string)
	databaseName, _ := payload["database"].(string)
	sqlitePath, _ := payload["sqlite_path"].(string)

	result := database.SchemaResult{Engine: engine, Database: databaseName}

	switch engine {
	case "mysql":
		bin, err := database.ResolveMySQL()
		if err != nil {
			result.Error = "MySQL not installed"
			break
		}
		if !database.PortInUse("127.0.0.1", database.DefaultMySQLPort) {
			result.Error = "MySQL is not running on port 3306"
			break
		}
		result = database.ListMySQLSchema(bin, database.DefaultMySQLPort, databaseName)
	case "postgres":
		bin, err := database.ResolvePostgreSQL()
		if err != nil {
			result.Error = "PostgreSQL not installed"
			break
		}
		if !database.PortInUse("127.0.0.1", database.DefaultPostgresPort) {
			result.Error = "PostgreSQL is not running on port 5432"
			break
		}
		user := "devnest"
		if database.IsExternalPostgresBinary(bin) {
			user = "postgres"
		}
		result = database.ListPostgresSchema(bin, database.DefaultPostgresPort, databaseName, user)
	case "sqlite":
		result = database.ListSQLiteSchema(activePHPBinary(), sqlitePath)
	default:
		result.Error = "Unknown engine"
	}

	broadcastEvent("db_schema_sync", map[string]interface{}{
		"schema": result,
	})
}
