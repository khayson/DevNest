package logs

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// LogEntry represents a single parsed log line.
type LogEntry struct {
	ID        string `json:"id"`
	Source    string `json:"source"`    // e.g. "laravel", "mysql", "caddy"
	Level     string `json:"level"`     // e.g. "INFO", "ERROR", "DEBUG"
	Message   string `json:"message"`   // The log message itself
	Timestamp string `json:"timestamp"` // Parsed or current time
}

// Store holds aggregated logs in a circular buffer.
type Store struct {
	mu       sync.RWMutex
	logs     []LogEntry
	maxSize  int
	sequence int
}

// NewStore creates a new in-memory log store.
func NewStore(maxSize int) *Store {
	return &Store{
		logs:    make([]LogEntry, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add appends a new log entry, evicting the oldest if at capacity.
func (s *Store) Add(entry LogEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.sequence++
	entry.ID = fmt.Sprintf("LOG-%07d", s.sequence)

	if len(s.logs) >= s.maxSize {
		s.logs = s.logs[1:]
	}
	s.logs = append(s.logs, entry)
}

// Clear removes all stored log entries.
func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logs = make([]LogEntry, 0, s.maxSize)
	s.sequence = 0
}

// GetAll returns a copy of all stored logs.
func (s *Store) GetAll() []LogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]LogEntry, len(s.logs))
	copy(result, s.logs)
	return result
}

// Watcher monitors log files and streams new entries to the store.
type Watcher struct {
	store      *Store
	watcher    *fsnotify.Watcher
	files      map[string]string // map[filePath]sourceName
	mu         sync.Mutex
	onNewEntry func(LogEntry)
	quit       chan struct{}
	wg         sync.WaitGroup
}

// NewWatcher initializes a new log watcher.
func NewWatcher(store *Store, onNewEntry func(LogEntry)) (*Watcher, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &Watcher{
		store:      store,
		watcher:    w,
		files:      make(map[string]string),
		onNewEntry: onNewEntry,
		quit:       make(chan struct{}),
	}, nil
}

// Watch adds a file to the watcher under the given source name.
func (w *Watcher) Watch(filePath, source string) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Ensure file exists before watching (create empty if necessary)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		f, err := os.Create(filePath)
		if err == nil {
			f.Close()
		} else {
			return fmt.Errorf("failed to create log file %s: %w", filePath, err)
		}
	}

	if err := w.watcher.Add(filePath); err != nil {
		return err
	}

	w.files[filePath] = source
	log.Printf("[LogWatcher] Now watching %s as %s", filePath, source)

	// Seed store with recent lines so the UI is not empty on connect (no WS broadcast for history)
	tailInitialLines(filePath, source, 150, w.store)
	return nil
}

func tailInitialLines(filePath, source string, maxLines int, store *Store) {
	file, err := os.Open(filePath)
	if err != nil {
		return
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		lines = append(lines, line)
		if len(lines) > maxLines {
			lines = lines[1:]
		}
	}

	w := &Watcher{store: store}
	for _, line := range lines {
		entry := w.parseLine(line, source)
		store.Add(entry)
	}
}

// Start begins the log watching loop.
func (w *Watcher) Start() {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		
		// Maintain file pointers to only read new lines
		cursors := make(map[string]int64)

		for {
			select {
			case event, ok := <-w.watcher.Events:
				if !ok {
					return
				}
				if event.Op&fsnotify.Write == fsnotify.Write {
					w.mu.Lock()
					source, exists := w.files[event.Name]
					w.mu.Unlock()

					if exists {
						w.readNewLines(event.Name, source, cursors)
					}
				}
			case err, ok := <-w.watcher.Errors:
				if !ok {
					return
				}
				log.Printf("[LogWatcher] Error: %v", err)
			case <-w.quit:
				return
			}
		}
	}()
}

// Stop halts the watcher.
func (w *Watcher) Stop() error {
	close(w.quit)
	err := w.watcher.Close()
	w.wg.Wait()
	return err
}

// readNewLines reads only the newly appended lines from a file.
func (w *Watcher) readNewLines(filePath, source string, cursors map[string]int64) {
	file, err := os.Open(filePath)
	if err != nil {
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return
	}

	// Handle log rotation/truncation
	cursor, exists := cursors[filePath]
	if !exists || stat.Size() < cursor {
		cursor = 0
	}

	_, err = file.Seek(cursor, 0)
	if err != nil {
		return
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if len(strings.TrimSpace(line)) == 0 {
			continue
		}

		entry := w.parseLine(line, source)
		w.store.Add(entry)

		if w.onNewEntry != nil {
			w.onNewEntry(entry)
		}
	}

	newCursor, _ := file.Seek(0, 1)
	cursors[filePath] = newCursor
}

// parseLine extracts level and timestamp from standard log formats (like Laravel's).
func (w *Watcher) parseLine(line, source string) LogEntry {
	level := "INFO"
	lower := strings.ToLower(line)

	if strings.HasPrefix(strings.TrimSpace(line), "{") {
		if strings.Contains(lower, `"level":"error"`) || strings.Contains(lower, `"level": "error"`) {
			level = "ERROR"
		} else if strings.Contains(lower, `"level":"warn"`) || strings.Contains(lower, `"level": "warn"`) {
			level = "WARNING"
		} else if strings.Contains(lower, `"level":"debug"`) {
			level = "DEBUG"
		}
	} else if strings.Contains(line, ".ERROR:") || strings.Contains(lower, " error:") || strings.HasPrefix(lower, "error:") {
		level = "ERROR"
	} else if strings.Contains(line, ".WARNING:") || strings.Contains(lower, "warning") {
		level = "WARNING"
	} else if strings.Contains(line, ".DEBUG:") || strings.Contains(lower, "debug") {
		level = "DEBUG"
	}

	return LogEntry{
		Source:    source,
		Level:     level,
		Message:   line,
		Timestamp: time.Now().Format(time.RFC3339),
	}
}
