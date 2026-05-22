package osutil

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"runtime"
	"strings"
)

// domainRegex validates that a domain looks like "something.test"
var domainRegex = regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$`)

// AddHostEntry adds a routing rule to the system hosts file for the given domain.
// e.g. mapping "my-app.test" to "127.0.0.1".
func AddHostEntry(domain string) error {
	// Validate domain format
	if !domainRegex.MatchString(domain) {
		return fmt.Errorf("invalid domain format: %q", domain)
	}

	hostsPath := getHostsPath()

	// Check if already exists
	exists, err := hostExists(hostsPath, domain)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	// Open for appending
	file, err := os.OpenFile(hostsPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		if os.IsPermission(err) {
			return fmt.Errorf("permission denied: DevNest requires elevated privileges to modify %s", hostsPath)
		}
		return err
	}
	defer file.Close()

	entry := fmt.Sprintf("\n127.0.0.1\t%s\n", domain)
	if _, err := file.WriteString(entry); err != nil {
		return err
	}
	return nil
}

// RemoveHostEntry removes a domain from the system hosts file.
func RemoveHostEntry(domain string) error {
	hostsPath := getHostsPath()

	data, err := os.ReadFile(hostsPath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(data), "\n")
	var result []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		// Skip lines that are our exact DevNest entry
		if !strings.HasPrefix(trimmed, "#") && matchesDomainExact(trimmed, domain) {
			continue // Remove this line
		}
		result = append(result, line)
	}

	return os.WriteFile(hostsPath, []byte(strings.Join(result, "\n")), 0644)
}

func getHostsPath() string {
	if runtime.GOOS == "windows" {
		return `C:\Windows\System32\drivers\etc\hosts`
	}
	return "/etc/hosts"
}

func hostExists(path, domain string) (bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "#") {
			continue
		}
		if matchesDomainExact(line, domain) {
			return true, nil
		}
	}
	return false, scanner.Err()
}

// matchesDomainExact checks if a hosts file line contains an exact domain match,
// not a substring match. This prevents "app.test" from matching "my-app.test".
func matchesDomainExact(line, domain string) bool {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return false
	}
	// Fields[0] is the IP, Fields[1:] are domain names
	for _, field := range fields[1:] {
		if strings.EqualFold(field, domain) {
			return true
		}
	}
	return false
}
