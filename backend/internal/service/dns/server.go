package dns

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"

	"github.com/miekg/dns"
)

// Server represents the local DNS resolver.
type Server struct {
	port          int
	server        *dns.Server
	state         service.HealthState
	mu            sync.Mutex
	tld           string
	onBindFailure func()
}

// NewServer initializes a new embedded DNS server.
func NewServer(port int, tld string) *Server {
	return &Server{
		port:  port,
		state: service.StateStopped,
		tld:   strings.ToLower(tld), // e.g. ".test"
	}
}

// SetOnBindFailure registers a callback when port 53 cannot be bound.
func (s *Server) SetOnBindFailure(fn func()) {
	s.mu.Lock()
	s.onBindFailure = fn
	s.mu.Unlock()
}

func (s *Server) ID() string      { return "dns-resolver" }
func (s *Server) Name() string    { return "Local DNS Resolver" }
func (s *Server) Version() string { return "1.0.0" }
func (s *Server) Configure() error { return nil }

func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	addr := fmt.Sprintf("127.0.0.1:%d", s.port)

	// Verify we can bind before marking running (port 53 often needs admin on Windows).
	pc, err := net.ListenPacket("udp", addr)
	if err != nil {
		s.state = service.StateError
		if s.onBindFailure != nil {
			s.onBindFailure()
		}
		return fmt.Errorf("failed to bind DNS on %s: %w", addr, err)
	}
	_ = pc.Close()

	// Create a custom multiplexer for our DNS handling
	mux := dns.NewServeMux()
	mux.HandleFunc(s.tld+".", s.handleTestDomain)

	s.server = &dns.Server{
		Addr:    addr,
		Net:     "udp",
		Handler: mux,
	}

	s.state = service.StateRunning

	// Run the server in a goroutine
	go func() {
		log.Printf("[DNS] Local resolver started on %s for %s domains", addr, s.tld)
		if err := s.server.ListenAndServe(); err != nil {
			log.Printf("[DNS] Server error: %v", err)
			s.mu.Lock()
			s.state = service.StateError
			cb := s.onBindFailure
			s.mu.Unlock()
			if cb != nil {
				cb()
			}
		}
	}()

	return nil
}

func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.server == nil {
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[DNS] Stopping local resolver...")
	return s.server.Shutdown()
}

func (s *Server) HealthCheck() (service.HealthState, error) {
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	return &telemetry.ProcessMetrics{}, nil
}

// handleTestDomain responds to any A record request for *.test with 127.0.0.1
func (s *Server) handleTestDomain(w dns.ResponseWriter, r *dns.Msg) {
	m := new(dns.Msg)
	m.SetReply(r)
	m.Authoritative = true

	for _, q := range r.Question {
		switch q.Qtype {
		case dns.TypeA:
			rr, err := dns.NewRR(fmt.Sprintf("%s 60 IN A 127.0.0.1", q.Name))
			if err == nil {
				m.Answer = append(m.Answer, rr)
				log.Printf("[DNS] Resolved %s -> 127.0.0.1", q.Name)
			}
		case dns.TypeAAAA:
			rr, err := dns.NewRR(fmt.Sprintf("%s 60 IN AAAA ::1", q.Name))
			if err == nil {
				m.Answer = append(m.Answer, rr)
			}
		}
	}

	w.WriteMsg(m)
}
