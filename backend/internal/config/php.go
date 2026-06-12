package config

// GetPHPIniDirectives returns persisted php.ini directive overrides.
func (s *Store) GetPHPIniDirectives() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.data.PHPIniDirectives == nil {
		return map[string]string{}
	}
	out := make(map[string]string, len(s.data.PHPIniDirectives))
	for k, v := range s.data.PHPIniDirectives {
		out[k] = v
	}
	return out
}

func (s *Store) UpdatePHPIniDirectives(directives map[string]string) error {
	s.mu.Lock()
	if s.data.PHPIniDirectives == nil {
		s.data.PHPIniDirectives = make(map[string]string)
	}
	for k, v := range directives {
		s.data.PHPIniDirectives[k] = v
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) SetActivePHPPath(version, binaryPath string) error {
	s.mu.Lock()
	s.data.ActivePHPVersion = version
	s.data.ActivePHPPath = binaryPath
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) GetActivePHPPath() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.ActivePHPPath
}
