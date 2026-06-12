package database

import (
	"fmt"
	"os/exec"
	"strings"
)

func postgresTableStructure(psql string, port int, database, table, username string) ([]ColumnInfo, error) {
	query := fmt.Sprintf(`
SELECT c.column_name, c.data_type, c.is_nullable, COALESCE(c.column_default, ''),
  CASE WHEN pk.column_name IS NOT NULL THEN 'yes' ELSE 'no' END
FROM information_schema.columns c
LEFT JOIN (
  SELECT kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = '%s'
) pk ON pk.column_name = c.column_name
WHERE c.table_schema = 'public' AND c.table_name = '%s'
ORDER BY c.ordinal_position`, table, table)
	lines, err := runPsqlRaw(psql, port, database, username, query)
	if err != nil {
		return nil, err
	}
	cols := make([]ColumnInfo, 0, len(lines))
	for _, line := range lines {
		parts := strings.Split(line, "|")
		if len(parts) < 5 {
			continue
		}
		cols = append(cols, ColumnInfo{
			Name:     strings.TrimSpace(parts[0]),
			Type:     strings.TrimSpace(parts[1]),
			Nullable: strings.EqualFold(strings.TrimSpace(parts[2]), "YES"),
			Default:  strings.TrimSpace(parts[3]),
			Primary:  strings.EqualFold(strings.TrimSpace(parts[4]), "yes"),
		})
	}
	return cols, nil
}

func postgresTableData(psql string, port int, database, table, username string, limit, offset int) (rawTableData, error) {
	tableIdent := fmt.Sprintf(`"%s"`, table)
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM %s`, tableIdent)
	countLines, err := runPsqlRaw(psql, port, database, username, countQuery)
	if err != nil {
		return rawTableData{}, err
	}
	total, err := parseCountLine(countLines)
	if err != nil {
		return rawTableData{}, err
	}

	dataQuery := fmt.Sprintf(`SELECT * FROM %s LIMIT %d OFFSET %d`, tableIdent, limit, offset)
	lines, err := runPsqlRaw(psql, port, database, username, dataQuery)
	if err != nil {
		return rawTableData{}, err
	}
	if len(lines) == 0 {
		return rawTableData{Total: total}, nil
	}

	columns := strings.Split(lines[0], "|")
	for i := range columns {
		columns[i] = strings.TrimSpace(columns[i])
	}
	rows := make([][]string, 0, len(lines)-1)
	for _, line := range lines[1:] {
		parts := strings.Split(line, "|")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		rows = append(rows, parts)
	}
	return rawTableData{Columns: columns, Rows: rows, Total: total}, nil
}

func postgresRunQuery(psql string, port int, database, username, sqlText string) QueryResult {
	result := QueryResult{Engine: "postgres", Database: database}
	upper := strings.ToUpper(strings.TrimSpace(sqlText))
	isSelect := strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "WITH") || strings.HasPrefix(upper, "SHOW") || strings.HasPrefix(upper, "EXPLAIN")

	if isSelect {
		lines, err := runPsqlRaw(psql, port, database, username, sqlText)
		if err != nil {
			result.Error = err.Error()
			return result
		}
		if len(lines) == 0 {
			return result
		}
		result.Columns = splitPipeLine(lines[0])
		for _, line := range lines[1:] {
			result.Rows = append(result.Rows, splitPipeLine(line))
		}
		result.Message = fmt.Sprintf("%d row(s)", len(result.Rows))
		return result
	}

	affected, err := runPsqlExec(psql, port, database, username, sqlText)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	result.Affected = affected
	result.Message = fmt.Sprintf("%d row(s) affected", affected)
	return result
}

func postgresMutateRow(psql string, port int, database, table, username, op string, values, keys map[string]string) (int64, error) {
	tableIdent := fmt.Sprintf(`"%s"`, table)
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
			cols = append(cols, fmt.Sprintf(`"%s"`, col))
			if val == "" {
				vals = append(vals, "NULL")
			} else {
				vals = append(vals, sqlLiteral(val))
			}
		}
		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", tableIdent, strings.Join(cols, ", "), strings.Join(vals, ", "))
		return runPsqlExec(psql, port, database, username, query)
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
				setParts = append(setParts, fmt.Sprintf(`"%s"=NULL`, col))
			} else {
				setParts = append(setParts, fmt.Sprintf(`"%s"=%s`, col, sqlLiteral(val)))
			}
		}
		where, err := postgresWhereClause(keys)
		if err != nil {
			return 0, err
		}
		query := fmt.Sprintf("UPDATE %s SET %s WHERE %s", tableIdent, strings.Join(setParts, ", "), where)
		return runPsqlExec(psql, port, database, username, query)
	case "delete":
		if len(keys) == 0 {
			return 0, fmt.Errorf("primary key values required for delete")
		}
		where, err := postgresWhereClause(keys)
		if err != nil {
			return 0, err
		}
		query := fmt.Sprintf("DELETE FROM %s WHERE %s", tableIdent, where)
		return runPsqlExec(psql, port, database, username, query)
	default:
		return 0, fmt.Errorf("unsupported operation")
	}
}

func postgresWhereClause(keys map[string]string) (string, error) {
	parts := make([]string, 0, len(keys))
	for col, val := range keys {
		if err := validateIdent(col); err != nil {
			return "", err
		}
		if val == "" {
			parts = append(parts, fmt.Sprintf(`"%s" IS NULL`, col))
		} else {
			parts = append(parts, fmt.Sprintf(`"%s"=%s`, col, sqlLiteral(val)))
		}
	}
	return strings.Join(parts, " AND "), nil
}

func runPsqlRaw(psql string, port int, database, username, query string) ([]string, error) {
	args := []string{
		"-h", "127.0.0.1",
		"-p", fmt.Sprintf("%d", port),
		"-U", username,
		"-d", database,
		"-t", "-A", "-F", "|",
		"-c", query,
	}
	cmd := exec.Command(psql, args...)
	cmd.Env = append(cmd.Environ(), "PGPASSWORD=")
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

func runPsqlExec(psql string, port int, database, username, query string) (int64, error) {
	args := []string{
		"-h", "127.0.0.1",
		"-p", fmt.Sprintf("%d", port),
		"-U", username,
		"-d", database,
		"-c", query,
	}
	cmd := exec.Command(psql, args...)
	cmd.Env = append(cmd.Environ(), "PGPASSWORD=")
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return 0, fmt.Errorf("%s", msg)
	}
	text := strings.TrimSpace(string(out))
	if strings.HasPrefix(text, "INSERT") || strings.HasPrefix(text, "UPDATE") || strings.HasPrefix(text, "DELETE") {
		fields := strings.Fields(text)
		if len(fields) >= 2 {
			n, convErr := parseCountLine([]string{fields[len(fields)-1]})
			if convErr == nil {
				return int64(n), nil
			}
		}
	}
	return 1, nil
}

func splitPipeLine(line string) []string {
	parts := strings.Split(line, "|")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
