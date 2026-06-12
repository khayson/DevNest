package database

import (
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	_ "modernc.org/sqlite"
)

// SchemaDatabase is a logical database with optional table list.
type SchemaDatabase struct {
	Name   string        `json:"name"`
	Tables []SchemaTable `json:"tables,omitempty"`
}

// SchemaTable is a table inside a database.
type SchemaTable struct {
	Name string `json:"name"`
}

// SchemaResult is returned to the UI for browsing.
type SchemaResult struct {
	Engine    string           `json:"engine"`
	Database  string           `json:"database,omitempty"`
	Databases []SchemaDatabase `json:"databases"`
	Error     string           `json:"error,omitempty"`
}

var mysqlSystemDBs = map[string]bool{
	"information_schema": true,
	"mysql":              true,
	"performance_schema": true,
	"sys":                true,
}

var postgresSystemDBs = map[string]bool{
	"template0": true,
	"template1": true,
}

// ListMySQLSchema lists databases or tables for one database.
func ListMySQLSchema(mysqldPath string, port int, database string) SchemaResult {
	result := SchemaResult{Engine: "mysql", Database: database}
	client := mysqlClientPath(mysqldPath)
	if client == "" {
		result.Error = "mysql client not found next to mysqld"
		return result
	}

	if database == "" {
		names, err := runMySQLQuery(client, port, "", "SHOW DATABASES")
		if err != nil {
			result.Error = err.Error()
			return result
		}
		for _, name := range names {
			if mysqlSystemDBs[strings.ToLower(name)] {
				continue
			}
			result.Databases = append(result.Databases, SchemaDatabase{Name: name})
		}
		return result
	}

	tables, err := runMySQLQuery(client, port, database, fmt.Sprintf("SHOW TABLES FROM `%s`", escapeMySQLIdent(database)))
	if err != nil {
		result.Error = err.Error()
		return result
	}
	result.Databases = []SchemaDatabase{{
		Name:   database,
		Tables: toSchemaTables(tables),
	}}
	return result
}

// ListPostgresSchema lists databases or tables for one database.
func ListPostgresSchema(postgresPath string, port int, database, username string) SchemaResult {
	result := SchemaResult{Engine: "postgres", Database: database}
	psql := psqlClientPath(postgresPath)
	if psql == "" {
		result.Error = "psql client not found next to postgres"
		return result
	}
	if username == "" {
		username = "postgres"
	}

	if database == "" {
		names, err := runPsqlQuery(psql, port, "postgres", username, "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1")
		if err != nil {
			result.Error = err.Error()
			return result
		}
		for _, name := range names {
			if postgresSystemDBs[strings.ToLower(name)] {
				continue
			}
			result.Databases = append(result.Databases, SchemaDatabase{Name: name})
		}
		return result
	}

	targetDB := database
	if targetDB == "" {
		targetDB = "postgres"
	}
	tables, err := runPsqlQuery(psql, port, targetDB, username,
		"SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1")
	if err != nil {
		result.Error = err.Error()
		return result
	}
	result.Databases = []SchemaDatabase{{
		Name:   database,
		Tables: toSchemaTables(tables),
	}}
	return result
}

// ListSQLiteSchema lists tables inside a SQLite file.
func ListSQLiteSchema(phpBinary, dbPath string) SchemaResult {
	result := SchemaResult{Engine: "sqlite", Database: dbPath}
	if _, err := os.Stat(dbPath); err != nil {
		result.Error = "SQLite file not found"
		return result
	}

	tables, err := listSQLiteTablesNative(dbPath)
	if err != nil {
		// Fall back to PHP PDO when native driver fails (e.g. locked file).
		if phpBinary == "" {
			result.Error = err.Error()
			return result
		}
		return listSQLiteTablesPHP(phpBinary, dbPath)
	}

	dbName := filepath.Base(dbPath)
	result.Databases = []SchemaDatabase{{
		Name:   dbName,
		Tables: toSchemaTables(tables),
	}}
	return result
}

func listSQLiteTablesNative(dbPath string) ([]string, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

func listSQLiteTablesPHP(phpBinary, dbPath string) SchemaResult {
	result := SchemaResult{Engine: "sqlite", Database: dbPath}
	dsn := phpSQLiteDSN(dbPath)
	script := buildSQLiteIntrospectScript(dsn)
	cmd := exec.Command(phpBinary, "-r", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		result.Error = strings.TrimSpace(string(out))
		if result.Error == "" {
			result.Error = err.Error()
		}
		return result
	}

	lines := splitLines(string(out))
	dbName := filepath.Base(dbPath)
	result.Databases = []SchemaDatabase{{
		Name:   dbName,
		Tables: toSchemaTables(lines),
	}}
	return result
}

func phpSQLiteDSN(path string) string {
	path = filepath.ToSlash(filepath.Clean(path))
	return strings.ReplaceAll(path, `'`, `\'`)
}

func buildSQLiteIntrospectScript(dsn string) string {
	// NOTE: %% escapes literal % for fmt.Sprintf (required for LIKE 'sqlite_%').
	return fmt.Sprintf(
		`$db=new PDO('sqlite:%s');$rows=$db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);echo implode(chr(10),$rows);`,
		dsn,
	)
}

func mysqlClientPath(mysqldPath string) string {
	dir := filepath.Dir(mysqldPath)
	for _, name := range []string{toolName("mysql"), "mysql"} {
		p := filepath.Join(dir, name)
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	if p, err := exec.LookPath(toolName("mysql")); err == nil {
		return p
	}
	return ""
}

func psqlClientPath(postgresPath string) string {
	dir := filepath.Dir(postgresPath)
	p := filepath.Join(dir, toolName("psql"))
	if st, err := os.Stat(p); err == nil && !st.IsDir() {
		return p
	}
	if p, err := exec.LookPath(toolName("psql")); err == nil {
		return p
	}
	return ""
}

func toolName(base string) string {
	if runtime.GOOS == "windows" {
		return base + ".exe"
	}
	return base
}

func runMySQLQuery(client string, port int, database, query string) ([]string, error) {
	args := []string{"-u", "root", "-h", "127.0.0.1", "-P", fmt.Sprintf("%d", port), "-N", "-B", "-e", query}
	if database != "" {
		args = append(args, "-D", database)
	}
	cmd := exec.Command(client, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf(msg)
	}
	return splitLines(string(out)), nil
}

func runPsqlQuery(psql string, port int, database, username, query string) ([]string, error) {
	args := []string{
		"-h", "127.0.0.1",
		"-p", fmt.Sprintf("%d", port),
		"-U", username,
		"-d", database,
		"-t", "-A",
		"-c", query,
	}
	cmd := exec.Command(psql, args...)
	cmd.Env = append(os.Environ(), "PGPASSWORD=")
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf(msg)
	}
	return splitLines(string(out)), nil
}

func splitLines(text string) []string {
	lines := strings.Split(strings.TrimSpace(text), "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			out = append(out, line)
		}
	}
	return out
}

func toSchemaTables(names []string) []SchemaTable {
	out := make([]SchemaTable, 0, len(names))
	for _, name := range names {
		out = append(out, SchemaTable{Name: name})
	}
	return out
}

func escapeMySQLIdent(name string) string {
	return strings.ReplaceAll(name, "`", "``")
}
