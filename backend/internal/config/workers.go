package config

// QueueWorkerDefaults are global overrides for artisan queue:work.
type QueueWorkerDefaults struct {
	Tries   int    `json:"tries"`
	Timeout int    `json:"timeout"` // seconds; 0 = no limit
	Memory  int    `json:"memory"`  // MB
	Queues  string `json:"queues"`  // comma-separated queue names
}

func DefaultQueueWorkerDefaults() QueueWorkerDefaults {
	return QueueWorkerDefaults{
		Tries:   3,
		Timeout: 60,
		Memory:  128,
		Queues:  "default",
	}
}

// GetQueueDefaults returns persisted queue worker settings with fallbacks.
func (s *Store) GetQueueDefaults() QueueWorkerDefaults {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d := s.data.QueueWorkerDefaults
	if d.Tries <= 0 {
		d.Tries = 3
	}
	if d.Memory <= 0 {
		d.Memory = 128
	}
	if d.Queues == "" {
		d.Queues = "default"
	}
	return d
}

// UpdateQueueDefaults persists global queue worker options.
func (s *Store) UpdateQueueDefaults(def QueueWorkerDefaults) error {
	s.mu.Lock()
	if def.Tries <= 0 {
		def.Tries = 3
	}
	if def.Memory <= 0 {
		def.Memory = 128
	}
	if def.Queues == "" {
		def.Queues = "default"
	}
	s.data.QueueWorkerDefaults = def
	s.mu.Unlock()
	return s.Save()
}
