//go:build windows

package launcher

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

var devnestPorts = []int{9090, 1025, 9912, 2019, 9074}

func stopEnvironmentPlatform() ([]int, error) {
	pids := map[int]bool{}

	for _, port := range devnestPorts {
		if pid := listenerPID("127.0.0.1", port); pid > 0 && shouldStopProcess(pid) {
			pids[pid] = true
		}
	}
	if pid := listenerPID("0.0.0.0", 80); pid > 0 {
		if name := processName(pid); strings.EqualFold(name, "caddy") {
			pids[pid] = true
		}
	}

	out, err := exec.Command("tasklist", "/FI", "IMAGENAME eq caddy.exe", "/FO", "CSV", "/NH").Output()
	if err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.Contains(line, "No tasks") {
				continue
			}
			parts := strings.Split(line, ",")
			if len(parts) >= 2 {
				pidStr := strings.Trim(parts[1], `"`)
				if pid, err := strconv.Atoi(pidStr); err == nil {
					pids[pid] = true
				}
			}
		}
	}

	var stopped []int
	for pid := range pids {
		proc, err := os.FindProcess(pid)
		if err != nil {
			continue
		}
		if err := proc.Kill(); err == nil {
			stopped = append(stopped, pid)
		}
	}
	return stopped, nil
}

func listenerPID(host string, port int) int {
	out, err := exec.Command("netstat", "-ano").Output()
	if err != nil {
		return 0
	}
	needle := fmt.Sprintf(":%d", port)
	for _, line := range strings.Split(string(out), "\n") {
		if !strings.Contains(line, "LISTENING") || !strings.Contains(line, needle) {
			continue
		}
		if host != "" && host != "0.0.0.0" && !strings.Contains(line, host) && !strings.Contains(line, "127.0.0.1") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		if pid, err := strconv.Atoi(fields[len(fields)-1]); err == nil {
			return pid
		}
	}
	return 0
}

func shouldStopProcess(pid int) bool {
	name := strings.ToLower(processName(pid))
	switch name {
	case "devnest", "caddy", "go", "php", "php-cgi":
		return true
	}
	path := processPath(pid)
	if path == "" {
		return false
	}
	lower := strings.ToLower(path)
	return strings.Contains(lower, `\.devnest\`) || strings.Contains(lower, `\devnest\backend\`)
}

func processName(pid int) string {
	out, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid), "/FO", "CSV", "/NH").Output()
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(out))
	if line == "" || strings.Contains(line, "No tasks") {
		return ""
	}
	parts := strings.Split(line, ",")
	if len(parts) == 0 {
		return ""
	}
	return strings.Trim(parts[0], `"`)
}

func processPath(pid int) string {
	out, err := exec.Command("wmic", "process", "where", fmt.Sprintf("ProcessId=%d", pid), "get", "ExecutablePath", "/value").Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "ExecutablePath=") {
			return strings.TrimPrefix(line, "ExecutablePath=")
		}
	}
	return ""
}
