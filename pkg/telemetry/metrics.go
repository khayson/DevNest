package telemetry

// ProcessMetrics represents the real-time resource utilization of a managed service.
type ProcessMetrics struct {
	PID           int32   `json:"pid"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryBytes   uint64  `json:"memory_bytes"`
	UptimeSeconds int64   `json:"uptime_seconds"`
	OpenSockets   int     `json:"open_sockets"`
}
