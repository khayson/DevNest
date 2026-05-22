package telemetry

import (
	"log"
	"time"
)

// Poller runs in the background and continuously gathers metrics from all registered services.
type Poller struct {
	interval time.Duration
	ticker   *time.Ticker
	quit     chan struct{}
}

// NewPoller initializes a new telemetry poller.
func NewPoller(interval time.Duration) *Poller {
	return &Poller{
		interval: interval,
		quit:     make(chan struct{}),
	}
}

// Start begins the polling loop.
func (p *Poller) Start(metricCallback func(metrics map[string]*ProcessMetrics)) {
	p.ticker = time.NewTicker(p.interval)
	
	go func() {
		log.Printf("[Telemetry] Poller started (Interval: %v)", p.interval)
		for {
			select {
			case <-p.ticker.C:
				// In a real implementation, we would iterate over all registered services
				// and call GetMetrics() on each. For now, we simulate this.
				
				// Simulated metrics gathering
				metricsMap := make(map[string]*ProcessMetrics)
				
				// Example payload
				metricsMap["caddy-proxy"] = &ProcessMetrics{
					PID:         1234,
					CPUPercent:  1.5,
					MemoryBytes: 45000000,
				}
				metricsMap["php-8.2"] = &ProcessMetrics{
					PID:         5678,
					CPUPercent:  0.8,
					MemoryBytes: 30000000,
				}
				
				// Push the metrics to the callback (which will broadcast via WebSocket)
				metricCallback(metricsMap)
				
			case <-p.quit:
				p.ticker.Stop()
				log.Printf("[Telemetry] Poller stopped")
				return
			}
		}
	}()
}

// Stop halts the polling loop.
func (p *Poller) Stop() {
	close(p.quit)
}
