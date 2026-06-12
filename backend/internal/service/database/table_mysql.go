package database

import (
	"fmt"
	"os/exec"
	"strings"
)

func mysqlTableStructure(client string, port int, database, table string) ([]ColumnInfo, error) {
	query := fmt.Sprintf("SHOW FULL COLUMNS FROM `%s`", escapeMySQLIdent(table))
	lines, err := runMySQLRaw(client, port, database, query)
	if err != nil {
		return nil, err
	}
	cols := make([]ColumnInfo, 0, len(lines))
	for i, line := range lines {
		if i == 0 && strings.HasPrefix(line, "Field\t") {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 6 {
			continue
		}
		cols = append(cols, ColumnInfo{
			Name:     parts[0],
			Type:     parts[1],
			Nullable: strings.EqualFold(parts[3], "YES"),
			Primary:  strings.EqualFold(parts[4], "PRI"),
			Default:  parts[5],
		})
	}
	return cols, nil
}

func mysqlTableData(client string, port int, database, table string, limit, offset int) (rawTableData, error) {
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", escapeMySQLIdent(table))
	countVal, err := runMySQLScalar(client, port, database, countQuery)
	if err != nil {
		return rawTableData{}, err
	}
	total, err := parseCountLine([]string{countVal})
	if err != nil {
		return rawTableData{}, err
	}

	dataQuery := fmt.Sprintf("SELECT * FROM `%s` LIMIT %d OFFSET %d", escapeMySQLIdent(table), limit, offset)
	lines, err := runMySQLRaw(client, port, database, dataQuery)
	if err != nil {
		return rawTableData{}, err
	}
	if len(lines) == 0 {
		return rawTableData{Total: total}, nil
	}

	columns := strings.Split(lines[0], "\t")
	rows := make([][]string, 0, len(lines)-1)
	for _, line := range lines[1:] {
		rows = append(rows, strings.Split(line, "\t"))
	}
	return rawTableData{Columns: columns, Rows: rows, Total: total}, nil
}

func mysqlRunQuery(client string, port int, database, sqlText string) QueryResult {
	result := QueryResult{Engine: "mysql", Database: database}
	upper := strings.ToUpper(strings.TrimSpace(sqlText))
	isSelect := strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "SHOW") || strings.HasPrefix(upper, "DESCRIBE") || strings.HasPrefix(upper, "EXPLAIN")

	if isSelect {
		lines, err := runMySQLRaw(client, port, database, sqlText)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		if len(lines) == 0 {
			return result
		}
		result.Columns = strings.Split(lines[0], "\t")
		for _, line := range lines[1:] {
			result.Rows = append(result.Rows, strings.Split(line, "\t"))
		}
		result.Message = fmt.Sprintf("%d row(s)", len(result.Rows))
		return result
	}

	affected, err := runMySQLExec(client, port, database, sqlText)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	result.Affected = affected
	result.Message = fmt.Sprintf("%d row(s) affected", affected)
	return result
}

func mysqlMutateRow(client string, port int, database, table, op string, values, keys map[string]string) (int64, error) {
	tableIdent := fmt.Sprintf("`%s`", escapeMySQLIdent(table))
	switch op {
	case "insert":
		if len(values) == 0 {
			return 0, fmt.Errorf("no values provided")
		}
		cols := make([]string, 0, len(values))
		vals := make([]string, 0, len(values))
		for col, val := range values {
			if err := validateIdent(col); err != nil {
				return 0, err
			}
			cols = append(cols, fmt.Sprintf("`%s`", escapeMySQLIdent(col)))
			if val == "" {
				vals = append(vals, "NULL")
			} else {
				vals = append(vals, sqlLiteral(val))
			}
		}
		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", tableIdent, strings.Join(cols, ", "), strings.Join(vals, ", "))
		return runMySQLExec(client, port, database, query)
	case "update":
		if len(values) == 0 {
			return 0, fmt.Errorf("no values provided")
		}
		if len(keys) == 0 {
			return 0, fmt.Errorf("primary key values required for update")
		}
		setParts := make([]string, 0, len(values))
		for col, val := range values {
			if err := validateIdent(col); err != nil {
				return 0, err
			}
			if val == "" {
				setParts = append(setParts, fmt.Sprintf("`%s`=NULL", escapeMySQLIdent(col)))
			} else {
				setParts = append(setParts, fmt.Sprintf("`%s`=%s", escapeMySQLIdent(col), sqlLiteral(val)))
			}
		}
		where, err := mysqlWhereClause(keys)
		if err != nil {
			return 0, err
		}
		query := fmt.Sprintf("UPDATE %s SET %s WHERE %s LIMIT 1", tableIdent, strings.Join(setParts, ", "), where)
		return runMySQLExec(client, port, database, query)
	case "delete":
		if len(keys) == 0 {
			return 0, fmt.Errorf("primary key values required for delete")
		}
		where, err := mysqlWhereClause(keys)
		if err != nil {
			return 0, err
		}
		query := fmt.Sprintf("DELETE FROM %s WHERE %s LIMIT 1", tableIdent, where)
		return runMySQLExec(client, port, database, query)
	default:
		return 0, fmt.Errorf("unsupported operation")
	}
}

func mysqlWhereClause(keys map[string]string) (string, error) {
	parts := make([]string, 0, len(keys))
	for col, val := range keys {
		if err := validateIdent(col); err != nil {
			return "", err
		}
		if val == "" {
			parts = append(parts, fmt.Sprintf("`%s` IS NULL", escapeMySQLIdent(col)))
		} else {
			parts = append(parts, fmt.Sprintf("`%s`=%s", escapeMySQLIdent(col), sqlLiteral(val)))
		}
	}
	return strings.Join(parts, " AND "), nil
}

func runMySQLRaw(client string, port int, database, query string) ([]string, error) {
	args := []string{"-u", "root", "-h", "127.0.0.1", "-P", fmt.Sprintf("%d", port), "-B", "-e", query}
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
		return nil, fmt.Errorf("%s", msg)
	}
	text := strings.TrimSpace(string(out))
	if text == "" {
		return nil, nil
	}
	return strings.Split(text, "\n"), nil
}

func runMySQLScalar(client string, port int, database, query string) (string, error) {
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
		return "", fmt.Errorf("%s", msg)
	}
	return strings.TrimSpace(string(out)), nil
}

func runMySQLExec(client string, port int, database, query string) (int64, error) {
	args := []string{"-u", "root", "-h", "127.0.0.1", "-P", fmt.Sprintf("%d", port), "-e", query}
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
		return 0, fmt.Errorf("%s", msg)
	}
	text := strings.TrimSpace(string(out))
	if strings.Contains(text, "Rows matched:") {
		for _, line := range strings.Split(text, "\n") {
			if strings.Contains(line, "Changed:") {
				fields := strings.Fields(line)
				for i, f := range fields {
					if f == "Changed:" && i+1 < len(fields) {
						n, _ := parseCountLine([]string{fields[i+1]})
						return int64(n), nil
					}
				}
			}
		}
	}
	return 1, nil
}
