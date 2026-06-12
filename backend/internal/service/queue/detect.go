package queue

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// EnvInfo holds queue-related values from a Laravel .env file.
type EnvInfo struct {
	Connection string
	Queues     string
}

// ReadEnvInfo parses QUEUE_CONNECTION from the project .env.
func ReadEnvInfo(projectPath string) EnvInfo {
	info := EnvInfo{
		Connection: "sync",
		Queues:     "default",
	}
	envPath := filepath.Join(projectPath, ".env")
	f, err := os.Open(envPath)
	if err != nil {
		return info
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := parseEnvLine(line)
		if !ok {
			continue
		}
		switch key {
		case "QUEUE_CONNECTION":
			if v := cleanEnvValue(val); v != "" {
				info.Connection = v
			}
		case "QUEUE":
			if v := cleanEnvValue(val); v != "" {
				info.Queues = v
			}
		}
	}
	return info
}

func parseEnvLine(line string) (string, string, bool) {
	parts := strings.SplitN(line, "=", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), true
}

func cleanEnvValue(v string) string {
	v = strings.TrimSpace(v)
	v = strings.Trim(v, `"'`)
	return v
}

// SupportsWorker returns false for sync driver (no background worker needed).
func SupportsWorker(connection string) bool {
	return strings.ToLower(strings.TrimSpace(connection)) != "sync"
}
