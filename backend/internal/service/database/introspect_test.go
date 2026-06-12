package database

import (
	"strings"
	"testing"
)

func TestSQLiteIntrospectScriptEscapesPercent(t *testing.T) {
	dbPath := `C:\xampp\htdocs\globalimpactinitiativengo\database\database.sqlite`
	dsn := phpSQLiteDSN(dbPath)
	if !strings.Contains(dsn, "/") || strings.Contains(dsn, `\`) {
		t.Fatalf("expected forward slashes in DSN, got %q", dsn)
	}

	script := buildSQLiteIntrospectScript(dsn)
	if strings.Contains(script, "%!") {
		t.Fatalf("fmt.Sprintf mangled percent in SQL: %q", script)
	}
	if !strings.Contains(script, `'sqlite_%'`) {
		t.Fatalf("LIKE pattern missing in script: %q", script)
	}
}
