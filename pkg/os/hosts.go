package osutil

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strings"
)

// AddHostEntry adds a routing rule to the system hosts file for the given domain.
// e.g. mapping "my-app.test" to "127.0.0.1".
func AddHostEntry(domain string) error {
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
		if strings.Contains(line, domain) && strings.Contains(line, "127.0.0.1") {
			return true, nil
		}
	}
	return false, scanner.Err()
}
