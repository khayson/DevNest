package database

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
)

func sqliteTableStructure(dbPath, table string) ([]ColumnInfo, error) {
	if _, err := os.Stat(dbPath); err != nil {
		return nil, fmt.Errorf("SQLite file not found")
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", quoteSQLiteIdent(table)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols := make([]ColumnInfo, 0)
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var defaultVal sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &defaultVal, &pk); err != nil {
			return nil, err
		}
		cols = append(cols, ColumnInfo{
			Name:     name,
			Type:     colType,
			Nullable: notNull == 0,
			Primary:  pk > 0,
			Default:  nullString(defaultVal),
		})
	}
	return cols, rows.Err()
}

func sqliteTableData(dbPath, table string, limit, offset int) (rawTableData, error) {
	if _, err := os.Stat(dbPath); err != nil {
		return rawTableData{}, fmt.Errorf("SQLite file not found")
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return rawTableData{}, err
	}
	defer db.Close()

	tableIdent := quoteSQLiteIdent(table)
	var total int
	if err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", tableIdent)).Scan(&total); err != nil {
		return rawTableData{}, err
	}

	query := fmt.Sprintf("SELECT * FROM %s LIMIT %d OFFSET %d", tableIdent, limit, offset)
	rows, err := db.Query(query)
	if err != nil {
		return rawTableData{}, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return rawTableData{}, err
	}

	dataRows := make([][]string, 0)
	for rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return rawTableData{}, err
		}
		row := make([]string, len(columns))
		for i, v := range values {
			row[i] = sqliteCellString(v)
		}
		dataRows = append(dataRows, row)
	}
	return rawTableData{Columns: columns, Rows: dataRows, Total: total}, rows.Err()
}

func sqliteRunQuery(dbPath, sqlText string) QueryResult {
	result := QueryResult{Engine: "sqlite", Database: dbPath}
	if _, err := os.Stat(dbPath); err != nil {
		result.Error = "SQLite file not found"
		return result
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer db.Close()

	upper := strings.ToUpper(strings.TrimSpace(sqlText))
	isSelect := strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "WITH") || strings.HasPrefix(upper, "PRAGMA") || strings.HasPrefix(upper, "EXPLAIN")

	if isSelect {
		rows, err := db.Query(sqlText)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		defer rows.Close()
		columns, err := rows.Columns()
		if err != nil {
			result.Error = err.Error()
			return result
		}
		result.Columns = columns
		for rows.Next() {
			values := make([]interface{}, len(columns))
			ptrs := make([]interface{}, len(columns))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				result.Error = err.Error()
				return result
			}
			row := make([]string, len(columns))
			for i, v := range values {
				row[i] = sqliteCellString(v)
			}
			result.Rows = append(result.Rows, row)
		}
		result.Message = fmt.Sprintf("%d row(s)", len(result.Rows))
		return result
	}

	res, err := db.Exec(sqlText)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	affected, _ := res.RowsAffected()
	result.Affected = affected
	result.Message = fmt.Sprintf("%d row(s) affected", affected)
	return result
}

func sqliteMutateRow(dbPath, table, op string, values, keys map[string]string) (int64, error) {
	if _, err := os.Stat(dbPath); err != nil {
		return 0, fmt.Errorf("SQLite file not found")
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return 0, err
	}
	defer db.Close()

	tableIdent := quoteSQLiteIdent(table)
	switch op {
	case "insert":
		if len(values) == 0 {
			return 0, fmt.Errorf("no values provided")
		}
		cols := make([]string, 0, len(values))
		placeholders := make([]string, 0, len(values))
		args := make([]interface{}, 0, len(values))
		i := 1
		for col, val := range values {
			if err := validateIdent(col); err != nil {
				return 0, err
			}
			cols = append(cols, quoteSQLiteIdent(col))
			if val == "" {
				placeholders = append(placeholders, "NULL")
			} else {
				placeholders = append(placeholders, fmt.Sprintf("$%d", i))
				args = append(args, val)
				i++
			}
		}
		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", tableIdent, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
		res, err := db.Exec(query, args...)
		if err != nil {
			return 0, err
		}
		return res.RowsAffected()
	case "update":
		if len(values) == 0 {
			return 0, fmt.Errorf("no values provided")
		}
		if len(keys) == 0 {
			return 0, fmt.Errorf("primary key values required for update")
		}
		setParts := make([]string, 0, len(values))
		args := make([]interface{}, 0, len(values)+len(keys))
		i := 1
		for col, val := range values {
			if err := validateIdent(col); err != nil {
				return 0, err
			}
			if val == "" {
				setParts = append(setParts, fmt.Sprintf("%s=NULL", quoteSQLiteIdent(col)))
			} else {
				setParts = append(setParts, fmt.Sprintf("%s=$%d", quoteSQLiteIdent(col), i))
				args = append(args, val)
				i++
			}
		}
		where, whereArgs, err := sqliteWhereClause(keys, i)
		if err != nil {
			return 0, err
		}
		args = append(args, whereArgs...)
		query := fmt.Sprintf("UPDATE %s SET %s WHERE %s", tableIdent, strings.Join(setParts, ", "), where)
		res, err := db.Exec(query, args...)
		if err != nil {
			return 0, err
		}
		return res.RowsAffected()
	case "delete":
		if len(keys) == 0 {
			return 0, fmt.Errorf("primary key values required for delete")
		}
		where, whereArgs, err := sqliteWhereClause(keys, 1)
		if err != nil {
			return 0, err
		}
		query := fmt.Sprintf("DELETE FROM %s WHERE %s", tableIdent, where)
		res, err := db.Exec(query, whereArgs...)
		if err != nil {
			return 0, err
		}
		return res.RowsAffected()
	default:
		return 0, fmt.Errorf("unsupported operation")
	}
}

func sqliteWhereClause(keys map[string]string, start int) (string, []interface{}, error) {
	parts := make([]string, 0, len(keys))
	args := make([]interface{}, 0, len(keys))
	i := start
	for col, val := range keys {
		if err := validateIdent(col); err != nil {
			return "", nil, err
		}
		if val == "" {
			parts = append(parts, fmt.Sprintf("%s IS NULL", quoteSQLiteIdent(col)))
		} else {
			parts = append(parts, fmt.Sprintf("%s=$%d", quoteSQLiteIdent(col), i))
			args = append(args, val)
			i++
		}
	}
	return strings.Join(parts, " AND "), args, nil
}

func quoteSQLiteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func sqliteCellString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case []byte:
		return string(t)
	case string:
		return t
	default:
		return fmt.Sprint(v)
	}
}
