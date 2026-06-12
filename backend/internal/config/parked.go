package config

import (
	"path/filepath"
	"strings"
	"time"
)

// ParkedPath is a folder root scanned for local projects (Herd-style).
type ParkedPath struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
	Path string `json:"path"`
}

func (s *Store) GetParkedPaths() []ParkedPath {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ParkedPath, len(s.data.ParkedPaths))
	copy(out, s.data.ParkedPaths)
	return out
}

func (s *Store) AddParkedPath(entry ParkedPath) error {
	entry.Path = strings.TrimSpace(entry.Path)
	if entry.Path == "" {
		return nil
	}
	entry.Path = filepath.Clean(entry.Path)
	if entry.Name == "" {
		entry.Name = filepath.Base(entry.Path)
	}

	s.mu.Lock()
	for i, existing := range s.data.ParkedPaths {
		if filepath.Clean(existing.Path) == entry.Path {
			if entry.ID != "" {
				s.data.ParkedPaths[i].ID = entry.ID
			}
			if entry.Name != "" {
				s.data.ParkedPaths[i].Name = entry.Name
			}
			s.mu.Unlock()
			return s.Save()
		}
	}
	if entry.ID == "" {
		entry.ID = "parked-" + strings.ReplaceAll(filepath.Base(entry.Path), " ", "-") + "-" + time.Now().Format("150405")
	}
	s.data.ParkedPaths = append(s.data.ParkedPaths, entry)
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) RemoveParkedPath(id string) error {
	s.mu.Lock()
	filtered := s.data.ParkedPaths[:0]
	for _, p := range s.data.ParkedPaths {
		if p.ID != id {
			filtered = append(filtered, p)
		}
	}
	s.data.ParkedPaths = filtered
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) ParkedPathByID(id string) (ParkedPath, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.data.ParkedPaths {
		if p.ID == id {
			return p, true
		}
	}
	return ParkedPath{}, false
}
