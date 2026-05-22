package service

import "devnest/pkg/telemetry"

// HealthState represents the current running state of a service.
type HealthState string

const (
	StateStopped HealthState = "stopped"
	StateRunning HealthState = "running"
	StateError   HealthState = "error"
)

// Service defines the contract for all embedded and managed services within DevNest.
type Service interface {
	// ID returns a unique identifier for the service (e.g. "php-8.2")
	ID() string
	// Name returns the display name of the service (e.g. "PHP 8.2")
	Name() string
	// Version returns the current version string
	Version() string
	
	// Configure generates necessary configuration files (like Caddyfiles or php.ini)
	Configure() error
	// Start launches the service in the background
	Start() error
	// Stop gracefully shuts down the process
	Stop() error
	
	// HealthCheck verifies the service is responsive
	HealthCheck() (HealthState, error)
	// GetMetrics retrieves real-time OS metrics for the service process
	GetMetrics() (*telemetry.ProcessMetrics, error)
}

// Manager orchestrates the lifecycle of all registered services.
type Manager interface {
	Register(svc Service) error
	StartAll() error
	StopAll() error
	GetService(id string) (Service, error)
}
