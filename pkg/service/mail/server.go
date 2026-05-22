package mail

import (
	"bufio"
	"devnest/pkg/service"
	"devnest/pkg/telemetry"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
)

// Server implements a basic embedded SMTP server (Mailpit-like interceptor).
type Server struct {
	port     int
	listener net.Listener
	wg       sync.WaitGroup
	quit     chan struct{}
	state    service.HealthState
}

// NewServer creates a new SMTP interceptor listening on the given port (e.g. 1025).
func NewServer(port int) *Server {
	return &Server{
		port:  port,
		quit:  make(chan struct{}),
		state: service.StateStopped,
	}
}

func (s *Server) ID() string { return "embedded-smtp" }
func (s *Server) Name() string { return "SMTP Interceptor" }
func (s *Server) Version() string { return "1.0.0" }
func (s *Server) Configure() error { return nil }

func (s *Server) Start() error {
	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	l, err := net.Listen("tcp", addr)
	if err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start SMTP server on %s: %w", addr, err)
	}

	s.listener = l
	s.state = service.StateRunning
	s.wg.Add(1)

	go s.serve()

	log.Printf("[SMTP] Listening for mail on %s", addr)
	return nil
}

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

func (s *Server) HealthCheck() (service.HealthState, error) {
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	return &telemetry.ProcessMetrics{}, nil
}

func (s *Server) serve() {
	defer s.wg.Done()
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-s.quit:
				return
			default:
				log.Printf("[SMTP] Accept error: %v", err)
				continue
			}
		}

		s.wg.Add(1)
		go s.handleSMTP(conn)
	}
}

// handleSMTP speaks a primitive SMTP protocol to accept any incoming mail.
func (s *Server) handleSMTP(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	// Send initial greeting
	fmt.Fprintf(conn, "220 DevNest SMTP Interceptor Ready\r\n")

	scanner := bufio.NewScanner(conn)
	receivingData := false
	var emailData strings.Builder

	for scanner.Scan() {
		line := scanner.Text()
		
		if receivingData {
			if line == "." {
				receivingData = false
				fmt.Fprintf(conn, "250 Ok: queued as DEVNEST-123\r\n")
				// TODO: Parse emailData (MIME parts) and broadcast via WebSockets to UI
				log.Printf("[SMTP] Email captured (size: %d bytes)", emailData.Len())
				continue
			}
			emailData.WriteString(line + "\n")
			continue
		}

		cmd := strings.ToUpper(strings.SplitN(line, " ", 2)[0])
		
		switch cmd {
		case "HELO", "EHLO":
			fmt.Fprintf(conn, "250 DevNest Hello\r\n")
		case "MAIL":
			fmt.Fprintf(conn, "250 Ok\r\n")
		case "RCPT":
			fmt.Fprintf(conn, "250 Ok\r\n")
		case "DATA":
			fmt.Fprintf(conn, "354 End data with <CR><LF>.<CR><LF>\r\n")
			receivingData = true
		case "QUIT":
			fmt.Fprintf(conn, "221 Bye\r\n")
			return
		default:
			fmt.Fprintf(conn, "250 Ok\r\n")
		}
	}
}
