package dump

import (
	"bufio"
	"bytes"
	"devnest/pkg/service"
	"devnest/pkg/telemetry"
	"fmt"
	"log"
	"net"
	"sync"
)

// Server implements an embedded TCP dump server compatible with Symfony Var-Dumper.
type Server struct {
	port     int
	listener net.Listener
	wg       sync.WaitGroup
	quit     chan struct{}
	state    service.HealthState
}

// NewServer creates a new Dump server listening on the specified port (typically 9912).
func NewServer(port int) *Server {
	return &Server{
		port:  port,
		quit:  make(chan struct{}),
		state: service.StateStopped,
	}
}

// ID returns the unique service identifier.
func (s *Server) ID() string {
	return "embedded-dump-server"
}

// Name returns the display name.
func (s *Server) Name() string {
	return "Dump Server"
}

// Version returns the current version.
func (s *Server) Version() string {
	return "1.0.0"
}

// Configure is a no-op for the embedded dump server.
func (s *Server) Configure() error {
	return nil
}

// Start opens the TCP socket and begins listening for payload dumps.
func (s *Server) Start() error {
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
// Since it's embedded in the Go process, returning OS metrics specific to it
// is approximated.
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
				// Expected error during shutdown
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

// handleConnection reads the incoming payload payload.
func (s *Server) handleConnection(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	// Symfony Var-Dumper sends data over TCP. We read everything until EOF.
	var buffer bytes.Buffer
	scanner := bufio.NewScanner(conn)
	// Var-Dumper payloads can be large, we might need a custom split func or just read all.
	// For now, scan until EOF.
	for scanner.Scan() {
		buffer.Write(scanner.Bytes())
		buffer.WriteString("\n")
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[Dump Server] Read error: %v", err)
		return
	}

	payload := buffer.Bytes()
	if len(payload) > 0 {
		// TODO: Parse the encoded format, extract HTML/CLI version, and forward via WebSockets
		log.Printf("[Dump Server] Received %d bytes of payload", len(payload))
	}
}
