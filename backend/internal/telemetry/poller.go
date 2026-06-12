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

// Start begins the polling loop. collectMetrics is called each tick to gather live service data.
func (p *Poller) Start(collectMetrics func() map[string]interface{}, metricCallback func(metrics map[string]interface{})) {
	p.ticker = time.NewTicker(p.interval)

	go func() {
		log.Printf("[Telemetry] Poller started (Interval: %v)", p.interval)
		for {
			select {
			case <-p.ticker.C:
				metricCallback(collectMetrics())
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
