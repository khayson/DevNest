package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// DevNestConfig represents the persisted state of the environment.
type DevNestConfig struct {
	ActivePHPVersion string            `json:"active_php_version"`
	RegisteredSites  map[string]string `json:"registered_sites"` // Map of domain -> local path
	CustomPorts      map[string]int    `json:"custom_ports"`     // Map of service -> port
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
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}

	store := &Store{
		filePath: filepath.Join(configDir, "devnest.json"),
		data: DevNestConfig{
			RegisteredSites: make(map[string]string),
			CustomPorts:     make(map[string]int),
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

// Save writes the JSON configuration to disk.
func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

// GetConfig returns a copy of the current configuration.
func (s *Store) GetConfig() DevNestConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data
}
