package logs

import (
	"devnest/internal/config"
	"log"
	"path/filepath"
)

// Manager coordinates log file watching and in-memory storage.
type Manager struct {
	store      *Store
	watcher    *Watcher
	onNewEntry func(LogEntry)
}

// NewManager creates a log aggregator with the given buffer size.
func NewManager(maxSize int, onNewEntry func(LogEntry)) (*Manager, error) {
	store := NewStore(maxSize)
	watcher, err := NewWatcher(store, onNewEntry)
	if err != nil {
		return nil, err
	}
	return &Manager{
		store:      store,
		watcher:    watcher,
		onNewEntry: onNewEntry,
	}, nil
}

// Start begins tailing configured log files.
func (m *Manager) Start() {
	m.watcher.Start()
}

// Stop halts all watchers.
func (m *Manager) Stop() error {
	return m.watcher.Stop()
}

// Clear removes buffered entries (does not truncate files on disk).
func (m *Manager) Clear() {
	m.store.Clear()
}

// GetAll returns stored entries oldest-first.
func (m *Manager) GetAll() []LogEntry {
	return m.store.GetAll()
}

// ConfigureSources (re)registers log files for DevNest, Caddy, and Laravel sites.
func (m *Manager) ConfigureSources(sites []config.SiteEntry) error {
	logsDir, err := config.LogsDir()
	if err != nil {
		return err
	}

	sources := map[string]string{
		filepath.Join(logsDir, "devnest.log"): "devnest",
	}

	caddyDir, err := config.CaddyConfigDir()
	if err == nil {
		sources[filepath.Join(caddyDir, "caddy.log")] = "caddy"
	}

	for _, site := range sites {
		if site.Path == "" {
			continue
		}
		laravelLog := filepath.Join(site.Path, "storage", "logs", "laravel.log")
		source := "laravel"
		if site.Domain != "" {
			source = "laravel:" + site.Domain
		}
		sources[laravelLog] = source
	}

	for filePath, source := range sources {
		if err := m.watcher.Watch(filePath, source); err != nil {
			log.Printf("[LogWatcher] Skipped %s (%s): %v", filePath, source, err)
		}
	}
	return nil
}
