package processlog

import (
	"bufio"
	"io"
	"sync"
	"time"
)

const defaultMaxLines = 500

// Line is a single captured stdout/stderr line from a supervised process.
type Line struct {
	Key      string    `json:"key"`
	Domain   string    `json:"domain"`
	Kind     string    `json:"kind"`
	Stream   string    `json:"stream"`
	Text     string    `json:"text"`
	Time     time.Time `json:"time"`
	TimeUnix int64     `json:"time_unix"`
}

// Store keeps ring buffers of process output keyed by worker key (e.g. queue-fabamall-test).
type Store struct {
	mu       sync.RWMutex
	maxLines int
	buffers  map[string][]Line
	onLine   func(Line)
}

var globalStore *Store

func Init(maxLines int, onLine func(Line)) *Store {
	if maxLines <= 0 {
		maxLines = defaultMaxLines
	}
	globalStore = &Store{
		maxLines: maxLines,
		buffers:  make(map[string][]Line),
		onLine:   onLine,
	}
	return globalStore
}

func Global() *Store {
	if globalStore == nil {
		globalStore = Init(defaultMaxLines, nil)
	}
	return globalStore
}

func (s *Store) Append(key, domain, kind, stream, text string) {
	text = trimLine(text)
	if text == "" {
		return
	}
	line := Line{
		Key:      key,
		Domain:   domain,
		Kind:     kind,
		Stream:   stream,
		Text:     text,
		Time:     time.Now(),
		TimeUnix: time.Now().Unix(),
	}

	s.mu.Lock()
	buf := append(s.buffers[key], line)
	if len(buf) > s.maxLines {
		buf = buf[len(buf)-s.maxLines:]
	}
	s.buffers[key] = buf
	cb := s.onLine
	s.mu.Unlock()

	if cb != nil {
		cb(line)
	}
}

func trimLine(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}

func (s *Store) Get(key string, limit int) []Line {
	s.mu.RLock()
	defer s.mu.RUnlock()
	buf := s.buffers[key]
	if limit <= 0 || limit > len(buf) {
		limit = len(buf)
	}
	if limit == 0 {
		return nil
	}
	start := len(buf) - limit
	out := make([]Line, limit)
	copy(out, buf[start:])
	return out
}

func (s *Store) Snapshot(kind, domain string) []Line {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Line
	for _, buf := range s.buffers {
		for _, line := range buf {
			if kind != "" && line.Kind != kind {
				continue
			}
			if domain != "" && line.Domain != domain {
				continue
			}
			out = append(out, line)
		}
	}
	if len(out) > 500 {
		out = out[len(out)-500:]
	}
	return out
}

func (s *Store) Clear(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if key == "" {
		s.buffers = make(map[string][]Line)
		return
	}
	delete(s.buffers, key)
}

// ClearFilter removes buffers matching kind and/or domain.
func (s *Store) ClearFilter(kind, domain string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, buf := range s.buffers {
		if len(buf) == 0 {
			continue
		}
		line := buf[len(buf)-1]
		if kind != "" && line.Kind != kind {
			continue
		}
		if domain != "" && line.Domain != domain {
			continue
		}
		delete(s.buffers, key)
	}
}

func (s *Store) StreamReader(key, domain, kind, stream string, r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 256*1024)
	for scanner.Scan() {
		s.Append(key, domain, kind, stream, scanner.Text())
	}
}
