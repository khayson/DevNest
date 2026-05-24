package mail

import (
	"bufio"
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"
)

// CapturedEmail represents a fully parsed intercepted email.
type CapturedEmail struct {
	ID        string `json:"id"`
	From      string `json:"from"`
	To        string `json:"to"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
	Size      int    `json:"size"`
	Timestamp string `json:"timestamp"`
}

// Store holds captured emails in a circular buffer.
type Store struct {
	mu       sync.RWMutex
	emails   []CapturedEmail
	maxSize  int
	sequence int
}

// NewStore creates an in-memory store for captured emails.
func NewStore(maxSize int) *Store {
	return &Store{
		emails:  make([]CapturedEmail, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add inserts a captured email, evicting the oldest if at capacity.
func (s *Store) Add(email CapturedEmail) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.emails) >= s.maxSize {
		s.emails = s.emails[1:] // Evict oldest
	}
	s.emails = append(s.emails, email)
}

// GetAll returns a copy of all stored emails.
func (s *Store) GetAll() []CapturedEmail {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]CapturedEmail, len(s.emails))
	copy(result, s.emails)
	return result
}

// Server implements a basic embedded SMTP server (Mailpit-like interceptor).
type Server struct {
	port       int
	listener   net.Listener
	wg         sync.WaitGroup
	quit       chan struct{}
	state      service.HealthState
	store      *Store
	onCapture  func(CapturedEmail) // Callback to broadcast via WebSocket
}

// NewServer creates a new SMTP interceptor listening on the given port (e.g. 1025).
func NewServer(port int, store *Store, onCapture func(CapturedEmail)) *Server {
	return &Server{
		port:      port,
		quit:      make(chan struct{}),
		state:     service.StateStopped,
		store:     store,
		onCapture: onCapture,
	}
}

func (s *Server) ID() string      { return "embedded-smtp" }
func (s *Server) Name() string    { return "SMTP Interceptor" }
func (s *Server) Version() string { return "1.0.0" }
func (s *Server) Configure() error { return nil }

func (s *Server) Start() error {
	if s.state == service.StateRunning {
		return nil
	}
	s.quit = make(chan struct{})
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
	var mailFrom, rcptTo, subject string

	s.store.mu.Lock()
	s.store.sequence++
	emailID := fmt.Sprintf("DN-%06d", s.store.sequence)
	s.store.mu.Unlock()

	for scanner.Scan() {
		line := scanner.Text()

		if receivingData {
			if line == "." {
				receivingData = false
				fmt.Fprintf(conn, "250 Ok: queued as %s\r\n", emailID)

				// Extract subject from raw email data
				body := emailData.String()
				if subject == "" {
					for _, l := range strings.Split(body, "\n") {
						if strings.HasPrefix(strings.ToLower(l), "subject:") {
							subject = strings.TrimSpace(strings.TrimPrefix(l, "Subject:"))
							subject = strings.TrimPrefix(subject, "subject:")
							break
						}
					}
				}

				captured := CapturedEmail{
					ID:        emailID,
					From:      mailFrom,
					To:        rcptTo,
					Subject:   subject,
					Body:      body,
					Size:      emailData.Len(),
					Timestamp: time.Now().Format(time.RFC3339),
				}

				s.store.Add(captured)
				log.Printf("[SMTP] Email captured: %s from=%s to=%s subject=%q (%d bytes)",
					emailID, mailFrom, rcptTo, subject, captured.Size)

				if s.onCapture != nil {
					s.onCapture(captured)
				}

				// Reset for next email in same session
				emailData.Reset()
				mailFrom = ""
				rcptTo = ""
				subject = ""
				continue
			}
			emailData.WriteString(line + "\n")
			continue
		}

		parts := strings.SplitN(line, " ", 2)
		cmd := strings.ToUpper(parts[0])

		switch cmd {
		case "HELO", "EHLO":
			fmt.Fprintf(conn, "250-DevNest Hello\r\n")
			fmt.Fprintf(conn, "250-SIZE 10485760\r\n")
			fmt.Fprintf(conn, "250 OK\r\n")
		case "MAIL":
			if len(parts) > 1 {
				mailFrom = extractAddress(parts[1])
			}
			fmt.Fprintf(conn, "250 Ok\r\n")
		case "RCPT":
			if len(parts) > 1 {
				rcptTo = extractAddress(parts[1])
			}
			fmt.Fprintf(conn, "250 Ok\r\n")
		case "DATA":
			fmt.Fprintf(conn, "354 End data with <CR><LF>.<CR><LF>\r\n")
			receivingData = true
		case "RSET":
			emailData.Reset()
			mailFrom = ""
			rcptTo = ""
			subject = ""
			fmt.Fprintf(conn, "250 Ok\r\n")
		case "QUIT":
			fmt.Fprintf(conn, "221 Bye\r\n")
			return
		default:
			fmt.Fprintf(conn, "250 Ok\r\n")
		}
	}
}

// extractAddress pulls the email address from "FROM:<addr>" or "TO:<addr>" SMTP parameters.
func extractAddress(param string) string {
	start := strings.Index(param, "<")
	end := strings.Index(param, ">")
	if start >= 0 && end > start {
		return param[start+1 : end]
	}
	// Fallback: strip the command prefix
	parts := strings.SplitN(param, ":", 2)
	if len(parts) > 1 {
		return strings.TrimSpace(parts[1])
	}
	return param
}
