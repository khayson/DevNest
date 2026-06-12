package config

import "path/filepath"

// SetActiveNodePath persists the active Node.js installation.
func (s *Store) SetActiveNodePath(version, binaryPath string) error {
	s.mu.Lock()
	s.data.ActiveNodeVersion = version
	s.data.ActiveNodePath = binaryPath
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) GetActiveNodePath() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.ActiveNodePath
}

func (s *Store) GetActiveNodeVersion() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.ActiveNodeVersion
}

func normalizeNodePath(path string) string {
	if path == "" {
		return ""
	}
	return filepath.Clean(path)
}
