package watcher

import (
	"log"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// ProjectWatcher monitors a Laravel project directory for configuration changes
// (e.g., .env, composer.json) and triggers a debounced callback.
type ProjectWatcher struct {
	projectPath string
	watcher     *fsnotify.Watcher
	onChange    func(string) // Callback when a watched file changes
	debounce    time.Duration
	mu          sync.Mutex
	timer       *time.Timer
	quit        chan struct{}
	wg          sync.WaitGroup
}

// NewProjectWatcher creates a watcher for the given project path.
func NewProjectWatcher(projectPath string, debounceMs int, onChange func(string)) (*ProjectWatcher, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &ProjectWatcher{
		projectPath: projectPath,
		watcher:     w,
		onChange:    onChange,
		debounce:    time.Duration(debounceMs) * time.Millisecond,
		quit:        make(chan struct{}),
	}, nil
}

// Start begins watching specific critical files in the project directory.
func (pw *ProjectWatcher) Start() error {
	// We only watch specific files to avoid massive overhead
	filesToWatch := []string{
		filepath.Join(pw.projectPath, ".env"),
		filepath.Join(pw.projectPath, "composer.json"),
		filepath.Join(pw.projectPath, "php.ini"), // If a local override exists
	}

	for _, file := range filesToWatch {
		// Ignore errors if the file doesn't exist yet
		_ = pw.watcher.Add(file)
	}

	// Also watch the root directory for newly created files (like a new .env)
	if err := pw.watcher.Add(pw.projectPath); err != nil {
		return err
	}

	pw.wg.Add(1)
	go func() {
		defer pw.wg.Done()
		for {
			select {
			case event, ok := <-pw.watcher.Events:
				if !ok {
					return
				}

				// Only trigger for Write or Create events on our target files
				if event.Op&(fsnotify.Write|fsnotify.Create) != 0 {
					base := filepath.Base(event.Name)
					if base == ".env" || base == "composer.json" || base == "php.ini" {
						pw.triggerDebounced(event.Name)
					}
				}

			case err, ok := <-pw.watcher.Errors:
				if !ok {
					return
				}
				log.Printf("[Watcher] Error watching %s: %v", pw.projectPath, err)
			case <-pw.quit:
				return
			}
		}
	}()

	log.Printf("[Watcher] Started monitoring config files in %s", pw.projectPath)
	return nil
}

// Stop halts the watcher.
func (pw *ProjectWatcher) Stop() error {
	close(pw.quit)
	err := pw.watcher.Close()
	pw.wg.Wait()
	return err
}

func (pw *ProjectWatcher) triggerDebounced(filename string) {
	pw.mu.Lock()
	defer pw.mu.Unlock()

	if pw.timer != nil {
		pw.timer.Stop()
	}

	pw.timer = time.AfterFunc(pw.debounce, func() {
		log.Printf("[Watcher] Config change detected in: %s", filename)
		if pw.onChange != nil {
			pw.onChange(filename)
		}
	})
}
