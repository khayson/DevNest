package config

import "path/filepath"

// RuntimePaths stores user-selected binary paths for services.
type RuntimePaths struct {
	MySQL    string `json:"mysql,omitempty"`
	Postgres string `json:"postgres,omitempty"`
	Redis    string `json:"redis,omitempty"`
	PHP      string `json:"php,omitempty"`
	Node     string `json:"node,omitempty"`
}

// InstalledStack is a saved local dev stack or runtime install root.
type InstalledStack struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	RootPath string `json:"root_path"`
}

func (s *Store) GetRuntimePaths() RuntimePaths {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.RuntimePaths
}

func (s *Store) GetInstalledStacks() []InstalledStack {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]InstalledStack, len(s.data.InstalledStacks))
	copy(out, s.data.InstalledStacks)
	return out
}

func (s *Store) SetRuntimePaths(paths RuntimePaths) error {
	s.mu.Lock()
	s.data.RuntimePaths = paths
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) MergeRuntimePaths(paths RuntimePaths) error {
	s.mu.Lock()
	if paths.MySQL != "" {
		s.data.RuntimePaths.MySQL = paths.MySQL
	}
	if paths.Postgres != "" {
		s.data.RuntimePaths.Postgres = paths.Postgres
	}
	if paths.Redis != "" {
		s.data.RuntimePaths.Redis = paths.Redis
	}
	if paths.PHP != "" {
		s.data.RuntimePaths.PHP = paths.PHP
	}
	if paths.Node != "" {
		s.data.RuntimePaths.Node = paths.Node
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) AddInstalledStack(stack InstalledStack) error {
	s.mu.Lock()
	for i, existing := range s.data.InstalledStacks {
		if filepath.Clean(existing.RootPath) == filepath.Clean(stack.RootPath) {
			s.data.InstalledStacks[i] = stack
			s.mu.Unlock()
			return s.Save()
		}
	}
	s.data.InstalledStacks = append(s.data.InstalledStacks, stack)
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) RemoveInstalledStack(id string) error {
	s.mu.Lock()
	filtered := s.data.InstalledStacks[:0]
	for _, st := range s.data.InstalledStacks {
		if st.ID != id {
			filtered = append(filtered, st)
		}
	}
	s.data.InstalledStacks = filtered
	s.mu.Unlock()
	return s.Save()
}
