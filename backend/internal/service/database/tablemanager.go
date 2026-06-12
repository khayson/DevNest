package database

import (
	"database/sql"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	_ "modernc.org/sqlite"
)

var identRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// ColumnInfo describes one table column.
type ColumnInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
	Primary  bool   `json:"primary"`
	Default  string `json:"default,omitempty"`
}

// TableStructureResult is column metadata for one table.
type TableStructureResult struct {
	Engine   string       `json:"engine"`
	Database string       `json:"database"`
	Table    string       `json:"table"`
	Columns  []ColumnInfo `json:"columns"`
	Error    string       `json:"error,omitempty"`
}

// TableDataResult is paginated row data.
type TableDataResult struct {
	Engine   string     `json:"engine"`
	Database string     `json:"database"`
	Table    string     `json:"table"`
	Columns  []string   `json:"columns"`
	Rows     [][]string `json:"rows"`
	Total    int        `json:"total"`
	Limit    int        `json:"limit"`
	Offset   int        `json:"offset"`
	Error    string     `json:"error,omitempty"`
}

// QueryResult is returned for arbitrary SQL.
type QueryResult struct {
	Engine   string     `json:"engine"`
	Database string     `json:"database"`
	Columns  []string   `json:"columns,omitempty"`
	Rows     [][]string `json:"rows,omitempty"`
	Affected int64      `json:"affected,omitempty"`
	Message  string     `json:"message,omitempty"`
	Error    string     `json:"error,omitempty"`
}

// RowMutationResult is returned for insert/update/delete.
type RowMutationResult struct {
	Engine   string `json:"engine"`
	Database string `json:"database"`
	Table    string `json:"table"`
	Affected int64  `json:"affected"`
	Message  string `json:"message,omitempty"`
	Error    string `json:"error,omitempty"`
}

// TableTarget identifies a table inside an engine.
type TableTarget struct {
	Engine     string
	Database   string
	SQLitePath string
	Table      string
	PostgresUser string
}

func validateIdent(name string) error {
	if name == "" || !identRe.MatchString(name) {
		return fmt.Errorf("invalid identifier: %q", name)
	}
	return nil
}

func clampPage(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// GetTableStructure returns column metadata.
func GetTableStructure(target TableTarget) TableStructureResult {
	result := TableStructureResult{
		Engine:   target.Engine,
		Database: targetDatabaseLabel(target),
		Table:    target.Table,
	}
	if err := validateIdent(target.Table); err != nil {
		result.Error = err.Error()
		return result
	}

	switch target.Engine {
	case "mysql":
		bin, err := ResolveMySQL()
		if err != nil {
			result.Error = "MySQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultMySQLPort) {
			result.Error = "MySQL is not running on port 3306"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		cols, err := mysqlTableStructure(bin, DefaultMySQLPort, target.Database, target.Table)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns = cols
	case "postgres":
		bin, err := ResolvePostgreSQL()
		if err != nil {
			result.Error = "PostgreSQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultPostgresPort) {
			result.Error = "PostgreSQL is not running on port 5432"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		user := target.PostgresUser
		if user == "" {
			user = "devnest"
			if IsExternalPostgresBinary(bin) {
				user = "postgres"
			}
		}
		cols, err := postgresTableStructure(bin, DefaultPostgresPort, target.Database, target.Table, user)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns = cols
	case "sqlite":
		path := target.SQLitePath
		if path == "" {
			path = target.Database
		}
		cols, err := sqliteTableStructure(path, target.Table)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns = cols
	default:
		result.Error = "unknown engine"
	}
	return result
}

// GetTableData returns paginated rows.
func GetTableData(target TableTarget, limit, offset int) TableDataResult {
	limit, offset = clampPage(limit, offset)
	result := TableDataResult{
		Engine:   target.Engine,
		Database: targetDatabaseLabel(target),
		Table:    target.Table,
		Limit:    limit,
		Offset:   offset,
	}
	if err := validateIdent(target.Table); err != nil {
		result.Error = err.Error()
		return result
	}

	switch target.Engine {
	case "mysql":
		bin, err := ResolveMySQL()
		if err != nil {
			result.Error = "MySQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultMySQLPort) {
			result.Error = "MySQL is not running on port 3306"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		data, err := mysqlTableData(bin, DefaultMySQLPort, target.Database, target.Table, limit, offset)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns, result.Rows, result.Total = data.Columns, data.Rows, data.Total
	case "postgres":
		bin, err := ResolvePostgreSQL()
		if err != nil {
			result.Error = "PostgreSQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultPostgresPort) {
			result.Error = "PostgreSQL is not running on port 5432"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		user := target.PostgresUser
		if user == "" {
			user = "devnest"
			if IsExternalPostgresBinary(bin) {
				user = "postgres"
			}
		}
		data, err := postgresTableData(bin, DefaultPostgresPort, target.Database, target.Table, user, limit, offset)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns, result.Rows, result.Total = data.Columns, data.Rows, data.Total
	case "sqlite":
		path := target.SQLitePath
		if path == "" {
			path = target.Database
		}
		data, err := sqliteTableData(path, target.Table, limit, offset)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns, result.Rows, result.Total = data.Columns, data.Rows, data.Total
	default:
		result.Error = "unknown engine"
	}
	return result
}

// RunQuery executes SQL and returns rows or affected count.
func RunQuery(target TableTarget, sqlText string) QueryResult {
	result := QueryResult{
		Engine:   target.Engine,
		Database: targetDatabaseLabel(target),
	}
	sqlText = strings.TrimSpace(sqlText)
	if sqlText == "" {
		result.Error = "SQL is required"
		return result
	}

	switch target.Engine {
	case "mysql":
		bin, err := ResolveMySQL()
		if err != nil {
			result.Error = "MySQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultMySQLPort) {
			result.Error = "MySQL is not running on port 3306"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		return mysqlRunQuery(bin, DefaultMySQLPort, target.Database, sqlText)
	case "postgres":
		bin, err := ResolvePostgreSQL()
		if err != nil {
			result.Error = "PostgreSQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultPostgresPort) {
			result.Error = "PostgreSQL is not running on port 5432"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		user := target.PostgresUser
		if user == "" {
			user = "devnest"
			if IsExternalPostgresBinary(bin) {
				user = "postgres"
			}
		}
		return postgresRunQuery(bin, DefaultPostgresPort, target.Database, user, sqlText)
	case "sqlite":
		path := target.SQLitePath
		if path == "" {
			path = target.Database
		}
		return sqliteRunQuery(path, sqlText)
	default:
		result.Error = "unknown engine"
	}
	return result
}

// MutateRow inserts, updates, or deletes a row.
func MutateRow(target TableTarget, operation string, values map[string]string, keys map[string]string) RowMutationResult {
	result := RowMutationResult{
		Engine:   target.Engine,
		Database: targetDatabaseLabel(target),
		Table:    target.Table,
	}
	if err := validateIdent(target.Table); err != nil {
		result.Error = err.Error()
		return result
	}
	op := strings.ToLower(strings.TrimSpace(operation))
	switch op {
	case "insert", "update", "delete":
	default:
		result.Error = "operation must be insert, update, or delete"
		return result
	}

	switch target.Engine {
	case "mysql":
		bin, err := ResolveMySQL()
		if err != nil {
			result.Error = "MySQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultMySQLPort) {
			result.Error = "MySQL is not running on port 3306"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		affected, err := mysqlMutateRow(bin, DefaultMySQLPort, target.Database, target.Table, op, values, keys)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Affected = affected
		result.Message = mutationMessage(op, affected)
	case "postgres":
		bin, err := ResolvePostgreSQL()
		if err != nil {
			result.Error = "PostgreSQL not installed"
			return result
		}
		if !PortInUse("127.0.0.1", DefaultPostgresPort) {
			result.Error = "PostgreSQL is not running on port 5432"
			return result
		}
		if target.Database == "" {
			result.Error = "database is required"
			return result
		}
		user := target.PostgresUser
		if user == "" {
			user = "devnest"
			if IsExternalPostgresBinary(bin) {
				user = "postgres"
			}
		}
		affected, err := postgresMutateRow(bin, DefaultPostgresPort, target.Database, target.Table, user, op, values, keys)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Affected = affected
		result.Message = mutationMessage(op, affected)
	case "sqlite":
		path := target.SQLitePath
		if path == "" {
			path = target.Database
		}
		affected, err := sqliteMutateRow(path, target.Table, op, values, keys)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Affected = affected
		result.Message = mutationMessage(op, affected)
	default:
		result.Error = "unknown engine"
	}
	return result
}

func mutationMessage(op string, affected int64) string {
	switch op {
	case "insert":
		if affected == 0 {
			return "Row inserted"
		}
		return fmt.Sprintf("%d row(s) inserted", affected)
	case "update":
		return fmt.Sprintf("%d row(s) updated", affected)
	case "delete":
		return fmt.Sprintf("%d row(s) deleted", affected)
	default:
		return "Done"
	}
}

func targetDatabaseLabel(target TableTarget) string {
	if target.Engine == "sqlite" {
		if target.SQLitePath != "" {
			return target.SQLitePath
		}
		return target.Database
	}
	return target.Database
}

type rawTableData struct {
	Columns []string
	Rows    [][]string
	Total   int
}

func nullString(v sql.NullString) string {
	if !v.Valid {
		return ""
	}
	return v.String
}

func sqlLiteral(v string) string {
	return "'" + strings.ReplaceAll(v, "'", "''") + "'"
}

func sqlNullLiteral(v string, nullable bool) string {
	if v == "" && nullable {
		return "NULL"
	}
	return sqlLiteral(v)
}

func parseCountLine(lines []string) (int, error) {
	if len(lines) == 0 {
		return 0, nil
	}
	return strconv.Atoi(strings.TrimSpace(lines[0]))
}
