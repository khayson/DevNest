package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// DevNestConfig represents the persisted state of the environment.
type DevNestConfig struct {
	ActivePHPVersion  string            `json:"active_php_version"`
	ActivePHPPath     string            `json:"active_php_path,omitempty"`
	PHPIniDirectives  map[string]string `json:"php_ini_directives,omitempty"`
	RegisteredSites   map[string]string `json:"registered_sites"` // legacy domain -> path
	Sites             []SiteEntry       `json:"sites"`
	CustomPorts       map[string]int    `json:"custom_ports"`
	LaunchOnStartup   bool              `json:"launch_on_startup"`
	AutoStartServices bool              `json:"auto_start_services"`
	Theme             string            `json:"theme"`
	CaddyBinary       string            `json:"caddy_binary,omitempty"`
	QueueWorkerDefaults QueueWorkerDefaults `json:"queue_worker_defaults,omitempty"`
	ActiveNodeVersion   string              `json:"active_node_version,omitempty"`
	ActiveNodePath      string              `json:"active_node_path,omitempty"`
	RuntimePaths        RuntimePaths        `json:"runtime_paths,omitempty"`
	InstalledStacks     []InstalledStack    `json:"installed_stacks,omitempty"`
	ParkedPaths         []ParkedPath        `json:"parked_paths,omitempty"`
}

type Store struct {
	filePath string
	mu       sync.RWMutex
	data     DevNestConfig
}

// NewStore initializes the configuration store pointing to ~/.devnest/devnest.json.
func NewStore() (*Store, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	configDir := filepath.Join(homeDir, ".devnest")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return nil, err
	}

	store := &Store{
		filePath: filepath.Join(configDir, "devnest.json"),
		data: DevNestConfig{
			RegisteredSites:   make(map[string]string),
			Sites:             []SiteEntry{},
			CustomPorts:       make(map[string]int),
			LaunchOnStartup:   true,
			AutoStartServices: true,
			Theme:             "system",
		},
	}

	// Load existing or save defaults
	if err := store.Load(); err != nil {
		if os.IsNotExist(err) {
			store.Save()
		} else {
			return nil, err
		}
	}

	store.migrateLegacySites()
	if len(store.data.Sites) > 0 {
		_ = store.Save()
	}

	return store, nil
}

// Load reads the JSON configuration from disk.
func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, &s.data)
}

// Save writes the JSON configuration to disk with restricted permissions (owner-only).
func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}

	// 0600 = owner read/write only. Prevents other users from reading project configs.
	return os.WriteFile(s.filePath, data, 0600)
}

// GetConfig returns a copy of the current configuration.
func (s *Store) GetConfig() DevNestConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data
}

// SetActivePHP updates the active PHP version and persists it.
func (s *Store) SetActivePHP(version string) error {
	s.mu.Lock()
	s.data.ActivePHPVersion = version
	s.mu.Unlock()
	return s.Save()
}

// RegisterSite adds a domain -> path mapping and persists it.
func (s *Store) RegisterSite(domain, localPath string) error {
	s.mu.Lock()
	s.data.RegisteredSites[domain] = localPath
	s.mu.Unlock()
	return s.Save()
}

// UnregisterSite removes a domain mapping and persists it.
func (s *Store) UnregisterSite(domain string) error {
	s.mu.Lock()
	delete(s.data.RegisteredSites, domain)
	s.mu.Unlock()
	return s.Save()
}

// UpdateSettings updates the general preferences in a thread-safe way and persists them.
func (s *Store) UpdateSettings(launchOnStartup, autoStartServices bool, theme string) error {
	s.mu.Lock()
	s.data.LaunchOnStartup = launchOnStartup
	s.data.AutoStartServices = autoStartServices
	s.data.Theme = theme
	s.mu.Unlock()
	return s.Save()
}
