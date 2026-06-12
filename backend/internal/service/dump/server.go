package dump

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"time"
)

// CapturedDump represents an intercepted dump() payload.
type CapturedDump struct {
	ID        string `json:"id"`
	Payload   string `json:"payload"`
	Size      int    `json:"size"`
	Source    string `json:"source"` // Remote address of the sender
	Timestamp string `json:"timestamp"`
}

// Store holds captured dumps in a circular buffer.
type Store struct {
	mu       sync.RWMutex
	dumps    []CapturedDump
	maxSize  int
	sequence int
}

// NewStore creates an in-memory store for captured dumps.
func NewStore(maxSize int) *Store {
	return &Store{
		dumps:   make([]CapturedDump, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add inserts a captured dump, evicting the oldest if at capacity.
func (s *Store) Add(entry CapturedDump) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.dumps) >= s.maxSize {
		s.dumps = s.dumps[1:]
	}
	s.dumps = append(s.dumps, entry)
}

// GetAll returns a copy of all stored dumps.
func (s *Store) GetAll() []CapturedDump {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]CapturedDump, len(s.dumps))
	copy(result, s.dumps)
	return result
}

// Clear removes all captured dumps.
func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dumps = make([]CapturedDump, 0, s.maxSize)
}

// Server implements an embedded TCP dump server compatible with Symfony Var-Dumper.
type Server struct {
	port      int
	listener  net.Listener
	wg        sync.WaitGroup
	quit      chan struct{}
	state     service.HealthState
	store     *Store
	onCapture func(CapturedDump) // Callback to broadcast via WebSocket
}

// NewServer creates a new Dump server listening on the specified port (typically 9912).
func NewServer(port int, store *Store, onCapture func(CapturedDump)) *Server {
	return &Server{
		port:      port,
		quit:      make(chan struct{}),
		state:     service.StateStopped,
		store:     store,
		onCapture: onCapture,
	}
}

// ID returns the unique service identifier.
func (s *Server) ID() string { return "embedded-dump-server" }

// Name returns the display name.
func (s *Server) Name() string { return "Dump Server" }

// Version returns the current version.
func (s *Server) Version() string { return "1.0.0" }

// Configure is a no-op for the embedded dump server.
func (s *Server) Configure() error { return nil }

// Start opens the TCP socket and begins listening for payload dumps.
func (s *Server) Start() error {
	if s.state == service.StateRunning {
		return nil
	}
	s.quit = make(chan struct{})
	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	l, err := net.Listen("tcp", addr)
	if err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start dump server on %s: %w", addr, err)
	}

	s.listener = l
	s.state = service.StateRunning
	s.wg.Add(1)

	go s.serve()

	log.Printf("[Dump Server] Listening on %s", addr)
	return nil
}

// Stop closes the listener and waits for active connections to finish.
func (s *Server) Stop() error {
	if s.state != service.StateRunning {
		return nil
	}
	close(s.quit)
	err := s.listener.Close()
	s.wg.Wait()
	s.state = service.StateStopped
	return err
}

// HealthCheck verifies if the server is running.
func (s *Server) HealthCheck() (service.HealthState, error) {
	return s.state, nil
}

// GetMetrics returns basic metrics for the embedded server.
func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	return &telemetry.ProcessMetrics{}, nil
}

// serve handles incoming TCP connections.
func (s *Server) serve() {
	defer s.wg.Done()
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-s.quit:
				return
			default:
				log.Printf("[Dump Server] Accept error: %v", err)
				continue
			}
		}

		s.wg.Add(1)
		go s.handleConnection(conn)
	}
}

// handleConnection reads the incoming dump payload until the client closes the connection.
func (s *Server) handleConnection(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	remoteAddr := conn.RemoteAddr().String()

	_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	payloadBytes, err := io.ReadAll(io.LimitReader(conn, 1024*1024))
	if err != nil && !errors.Is(err, io.EOF) && !isConnClosed(err) {
		log.Printf("[Dump Server] Read error from %s: %v", remoteAddr, err)
		return
	}

	payload := string(payloadBytes)
	if len(payload) == 0 {
		log.Printf("[Dump Server] Empty payload from %s (ignored)", remoteAddr)
		return
	}

	s.store.mu.Lock()
	s.store.sequence++
	dumpID := fmt.Sprintf("DUMP-%06d", s.store.sequence)
	s.store.mu.Unlock()

	captured := CapturedDump{
		ID:        dumpID,
		Payload:   payload,
		Size:      len(payload),
		Source:    remoteAddr,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	s.store.Add(captured)
	log.Printf("[Dump Server] %s: Received %d bytes from %s", dumpID, captured.Size, remoteAddr)

	if s.onCapture != nil {
		s.onCapture(captured)
	}
}

func isConnClosed(err error) bool {
	if err == nil {
		return false
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return opErr.Err.Error() == "use of closed network connection"
	}
	return false
}
