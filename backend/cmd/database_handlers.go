package cmd

import (
	"devnest/internal/service/database"
	"devnest/internal/service/mysql"
	"devnest/internal/service/postgres"
	"devnest/internal/service/redis"
	"devnest/internal/service/php"
	"devnest/internal/service/sqlite"
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

var globalSQLite *sqlite.Manager

type dbServiceInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	ConnStr     string `json:"conn_str"`
	Available   bool   `json:"available"`
	Binary      string `json:"binary,omitempty"`
	External    bool   `json:"external,omitempty"`
	RunningNote string `json:"running_note,omitempty"`
}

func registerDatabaseServices() {
	applyRuntimeOverridesFromConfig()

	mysqlBin, mysqlErr := database.ResolveMySQL()
	if mysqlErr != nil {
		log.Printf("[Daemon] MySQL not registered: binary not found (%v). Install MySQL or add mysqld to PATH.", mysqlErr)
	} else {
		log.Printf("[Daemon] MySQL binary: %s", mysqlBin)
		globalManager.Register(mysql.NewServer(mysqlBin, database.DefaultMySQLPort))
	}

	pgBin, pgErr := database.ResolvePostgreSQL()
	if pgErr != nil {
		log.Printf("[Daemon] PostgreSQL not registered: binary not found (%v).", pgErr)
	} else {
		log.Printf("[Daemon] PostgreSQL binary: %s", pgBin)
		globalManager.Register(postgres.NewServer(pgBin, database.DefaultPostgresPort))
	}

	redisBin, redisErr := database.ResolveRedis()
	if redisErr != nil {
		log.Printf("[Daemon] Redis not registered: binary not found (%v).", redisErr)
	} else {
		log.Printf("[Daemon] Redis binary: %s", redisBin)
		globalManager.Register(redis.NewServer(redisBin, database.DefaultRedisPort))
	}

	refreshSQLiteManager()
}

func refreshSQLiteManager() {
	phpBin := activePHPBinary()
	if phpBin == "" {
		globalSQLite = nil
		return
	}
	globalSQLite = sqlite.NewManager(phpBin)
}

func activePHPBinary() string {
	if cfgStore == nil {
		return ""
	}
	installs := php.DiscoverInstallations()
	if len(installs) == 0 {
		return ""
	}
	cfg := cfgStore.GetConfig()
	if inst, ok := php.PickInstallation(installs, cfg.ActivePHPVersion, cfgStore.GetActivePHPPath()); ok {
		return inst.Binary
	}
	return installs[0].Binary
}

func buildDatabaseSyncPayload() map[string]interface{} {
	mysqlBin, mysqlErr := database.ResolveMySQL()
	pgBin, pgErr := database.ResolvePostgreSQL()
	redisBin, redisErr := database.ResolveRedis()
	mariadbBin, mariadbErr := database.ResolveMariaDB()
	valkeyBin, valkeyErr := database.ResolveValkey()
	mysqlOK := mysqlErr == nil
	pgOK := pgErr == nil
	redisOK := redisErr == nil
	mariadbOK := mariadbErr == nil
	valkeyOK := valkeyErr == nil

	mysqlExternal := mysqlOK && database.PortInUse("127.0.0.1", database.DefaultMySQLPort)
	mysqlNote := ""
	if mysqlExternal {
		if database.IsExternalMySQLBinary(mysqlBin) {
			mysqlNote = "XAMPP/Laragon MySQL already running on port 3306"
		} else {
			mysqlNote = "Existing MySQL already running on port 3306"
		}
	}

	pgExternal := pgOK && database.PortInUse("127.0.0.1", database.DefaultPostgresPort)
	pgNote := ""
	if pgExternal {
		if database.IsExternalPostgresBinary(pgBin) {
			pgNote = "Existing PostgreSQL install already running on port 5432"
		} else {
			pgNote = "Existing PostgreSQL already running on port 5432"
		}
	}

	pgVersion := "16"
	if pgOK {
		pgVersion = database.PostgresVersionLabel(pgBin)
	}

	services := []dbServiceInfo{
		{
			ID: "mysql", Name: "MySQL Server", Version: "8.0",
			Port: database.DefaultMySQLPort, Username: "root",
			Password: "No password (local dev)", ConnStr: "mysql://root@127.0.0.1:3306/devnest",
			Available: mysqlOK, Binary: mysqlBin,
			External: mysqlExternal, RunningNote: mysqlNote,
		},
		{
			ID: "postgres", Name: "PostgreSQL", Version: pgVersion,
			Port: database.DefaultPostgresPort, Username: "devnest",
			Password: "No password (trust auth)", ConnStr: "postgresql://devnest@127.0.0.1:5432/devnest",
			Available: pgOK, Binary: pgBin,
			External: pgExternal, RunningNote: pgNote,
		},
		{
			ID: "redis", Name: "Redis", Version: "7.0",
			Port: database.DefaultRedisPort, Username: "N/A",
			Password: "No password (local dev)", ConnStr: "redis://127.0.0.1:6379",
			Available: redisOK, Binary: redisBin,
		},
		{
			ID: "mariadb", Name: "MariaDB Server", Version: "11",
			Port: database.DefaultMariaDBPort, Username: "root",
			Password: "No password (local dev)", ConnStr: "mysql://root@127.0.0.1:3307/devnest",
			Available: mariadbOK, Binary: mariadbBin,
		},
		{
			ID: "valkey", Name: "Valkey Server", Version: "8",
			Port: database.DefaultValkeyPort, Username: "N/A",
			Password: "No password (local dev)", ConnStr: "redis://127.0.0.1:6380",
			Available: valkeyOK, Binary: valkeyBin,
		},
	}

	sqliteFiles := []sqlite.ScannedDB{}
	if cfgStore != nil {
		sqliteFiles = sqlite.ScanSites(cfgStore.GetSites())
	}

	return map[string]interface{}{
		"services":     services,
		"sqlite_files": sqliteFiles,
		"php_available": activePHPBinary() != "",
	}
}

func sendDatabaseSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event":     "database_sync",
		"databases": buildDatabaseSyncPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastDatabaseSync() {
	broadcastEvent("database_sync", map[string]interface{}{
		"databases": buildDatabaseSyncPayload(),
	})
}

func handleScanDatabases() {
	broadcastDatabaseSync()
}

func handleRunMigration(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	fresh, _ := payload["fresh"].(bool)

	result := map[string]interface{}{
		"domain":  domain,
		"success": false,
	}

	if cfgStore == nil {
		result["message"] = "Config store unavailable"
		broadcastEvent("migration_result", result)
		return
	}

	projectPath, ok := sqlite.SitePathForDomain(cfgStore.GetSites(), domain)
	if !ok {
		result["message"] = "Site not found"
		broadcastEvent("migration_result", result)
		return
	}

	refreshSQLiteManager()
	if globalSQLite == nil {
		result["message"] = "PHP not available — install PHP to run artisan migrations"
		broadcastEvent("migration_result", result)
		return
	}

	if err := globalSQLite.EnsureDatabase(projectPath); err != nil {
		result["message"] = err.Error()
		broadcastEvent("migration_result", result)
		return
	}

	var err error
	if fresh {
		err = globalSQLite.MigrateFresh(projectPath)
	} else {
		err = globalSQLite.Migrate(projectPath)
	}

	if err != nil {
		result["message"] = err.Error()
		broadcastEvent("migration_result", result)
		return
	}

	if fresh {
		result["message"] = "Migration & seeding completed successfully"
	} else {
		result["message"] = "Migrations completed successfully"
	}
	result["success"] = true
	broadcastEvent("migration_result", result)
	broadcastDatabaseSync()
}
