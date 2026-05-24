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
func (p *Poller) Start(isRunning func(string) bool, metricCallback func(metrics map[string]*ProcessMetrics)) {
	p.ticker = time.NewTicker(p.interval)
	
	go func() {
		log.Printf("[Telemetry] Poller started (Interval: %v)", p.interval)
		for {
			select {
			case <-p.ticker.C:
				// Simulated metrics gathering based on active service states
				metricsMap := make(map[string]*ProcessMetrics)
				
				if isRunning("caddy") {
					metricsMap["caddy"] = &ProcessMetrics{
						PID:         1234,
						CPUPercent:  0.8,
						MemoryBytes: 25000000,
					}
				}
				if isRunning("php") {
					metricsMap["php"] = &ProcessMetrics{
						PID:         5678,
						CPUPercent:  0.4,
						MemoryBytes: 32000000,
					}
				}
				if isRunning("mysql") {
					metricsMap["mysql"] = &ProcessMetrics{
						PID:         9012,
						CPUPercent:  1.2,
						MemoryBytes: 128000000,
					}
				}
				if isRunning("postgres") {
					metricsMap["postgres"] = &ProcessMetrics{
						PID:         3456,
						CPUPercent:  0.5,
						MemoryBytes: 64000000,
					}
				}
				if isRunning("redis") {
					metricsMap["redis"] = &ProcessMetrics{
						PID:         7890,
						CPUPercent:  0.1,
						MemoryBytes: 16000000,
					}
				}
				if isRunning("embedded-mail-server") {
					metricsMap["embedded-mail-server"] = &ProcessMetrics{
						PID:         2345,
						CPUPercent:  0.2,
						MemoryBytes: 12000000,
					}
				}
				if isRunning("embedded-dump-server") {
					metricsMap["embedded-dump-server"] = &ProcessMetrics{
						PID:         6789,
						CPUPercent:  0.2,
						MemoryBytes: 10000000,
					}
				}
				if isRunning("dns") {
					metricsMap["dns"] = &ProcessMetrics{
						PID:         1011,
						CPUPercent:  0.1,
						MemoryBytes: 8000000,
					}
				}
				if isRunning("cron") {
					metricsMap["cron"] = &ProcessMetrics{
						PID:         1213,
						CPUPercent:  0.1,
						MemoryBytes: 15000000,
					}
				}
				if isRunning("queue") {
					metricsMap["queue"] = &ProcessMetrics{
						PID:         1415,
						CPUPercent:  0.3,
						MemoryBytes: 28000000,
					}
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
