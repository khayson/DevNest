package config

// GetForge returns a copy of Forge integration settings.
func (s *Store) GetForge() ForgeSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.Forge
}

// UpdateForge persists Forge API credentials.
func (s *Store) UpdateForge(settings ForgeSettings) error {
	s.mu.Lock()
	s.data.Forge = settings
	s.mu.Unlock()
	return s.Save()
}

// GetIDECommand returns the editor open command (cursor, code, etc.).
func (s *Store) GetIDECommand() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.data.IDECommand != "" {
		return s.data.IDECommand
	}
	return "cursor"
}

func (s *Store) SetIDECommand(cmd string) error {
	s.mu.Lock()
	s.data.IDECommand = cmd
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) GetPHPVersionDirectives(version string) map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.data.PHPVersionDirectives == nil {
		return map[string]string{}
	}
	src := s.data.PHPVersionDirectives[version]
	out := make(map[string]string, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func (s *Store) UpdatePHPVersionDirectives(version string, directives map[string]string) error {
	s.mu.Lock()
	if s.data.PHPVersionDirectives == nil {
		s.data.PHPVersionDirectives = make(map[string]map[string]string)
	}
	if s.data.PHPVersionDirectives[version] == nil {
		s.data.PHPVersionDirectives[version] = make(map[string]string)
	}
	for k, v := range directives {
		s.data.PHPVersionDirectives[version][k] = v
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) IsDumpWatchIgnored(id string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, ignored := range s.data.DumpWatchIgnored {
		if ignored == id {
			return true
		}
	}
	return false
}

func (s *Store) SetDumpWatchIgnored(id string, ignored bool) error {
	s.mu.Lock()
	found := false
	filtered := s.data.DumpWatchIgnored[:0]
	for _, existing := range s.data.DumpWatchIgnored {
		if existing == id {
			found = true
			if !ignored {
				continue
			}
		}
		filtered = append(filtered, existing)
	}
	if ignored && !found {
		filtered = append(filtered, id)
	}
	s.data.DumpWatchIgnored = filtered
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) SetDebugSessionActive(active bool) error {
	s.mu.Lock()
	s.data.DebugSessionActive = active
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) DebugSessionActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.DebugSessionActive
}
