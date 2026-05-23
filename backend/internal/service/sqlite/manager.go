package sqlite

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

// Manager handles SQLite-specific operations for Laravel projects.
// Since SQLite is file-based, this isn't a long-running service, but rather a utility.
type Manager struct {
	phpBinary string
}

func NewManager(phpBinary string) *Manager {
	return &Manager{
		phpBinary: phpBinary,
	}
}

// EnsureDatabase checks if database/database.sqlite exists in the given Laravel project.
// If not, it creates it.
func (m *Manager) EnsureDatabase(projectPath string) error {
	dbDir := filepath.Join(projectPath, "database")
	dbPath := filepath.Join(dbDir, "database.sqlite")

	// Ensure database directory exists
	if _, err := os.Stat(dbDir); os.IsNotExist(err) {
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// Create database.sqlite if missing
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		file, err := os.Create(dbPath)
		if err != nil {
			return fmt.Errorf("failed to create database.sqlite: %w", err)
		}
		file.Close()
		log.Printf("[SQLite] Created %s", dbPath)
	}

	return nil
}

// Migrate runs `php artisan migrate` for the given project.
func (m *Manager) Migrate(projectPath string) error {
	cmd := exec.Command(m.phpBinary, "artisan", "migrate", "--force")
	cmd.Dir = projectPath
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("migration failed: %s", string(output))
	}
	
	log.Printf("[SQLite] Migrated %s: %s", projectPath, string(output))
	return nil
}

// MigrateFresh runs `php artisan migrate:fresh --seed` for the given project.
func (m *Manager) MigrateFresh(projectPath string) error {
	cmd := exec.Command(m.phpBinary, "artisan", "migrate:fresh", "--seed", "--force")
	cmd.Dir = projectPath
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("fresh migration failed: %s", string(output))
	}
	
	log.Printf("[SQLite] Fresh Migrated %s: %s", projectPath, string(output))
	return nil
}
