package database

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// PortInUse reports whether something is listening on host:port.
func PortInUse(host string, port int) bool {
	addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))

	conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
	if err == nil {
		_ = conn.Close()
		return true
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return true
	}
	_ = ln.Close()
	return false
}

// MySQLDataDir picks the correct datadir for a discovered mysqld binary.
// XAMPP/Laragon installs must use their own data folder, not ~/.devnest/data/mysql.
func MySQLDataDir(binaryPath, devnestDataDir string) (string, bool) {
	binaryPath = filepath.Clean(binaryPath)
	lower := strings.ToLower(binaryPath)

	if strings.Contains(lower, "xampp") || strings.Contains(lower, "laragon") {
		// .../mysql/bin/mysqld.exe -> .../mysql/data
		mysqlRoot := filepath.Dir(filepath.Dir(binaryPath))
		candidate := filepath.Join(mysqlRoot, "data")
		if st, err := os.Stat(candidate); err == nil && st.IsDir() {
			return candidate, false // not DevNest-managed
		}
	}

	return devnestDataDir, true
}

// IsExternalMySQLBinary is true when the binary belongs to a full local stack (XAMPP/Laragon).
func IsExternalMySQLBinary(binaryPath string) bool {
	lower := strings.ToLower(binaryPath)
	return strings.Contains(lower, "xampp") || strings.Contains(lower, "laragon")
}

// IsExternalPostgresBinary is true when the binary belongs to a standalone PostgreSQL install.
func IsExternalPostgresBinary(binaryPath string) bool {
	lower := strings.ToLower(binaryPath)
	return strings.Contains(lower, `\program files\postgresql`) ||
		strings.Contains(lower, `/program files/postgresql`)
}

// MySQLDefaultsFile returns my.ini/my.cnf for stack installs, if present.
func MySQLDefaultsFile(binaryPath string) string {
	binaryPath = filepath.Clean(binaryPath)
	searchDirs := []string{
		filepath.Dir(binaryPath),
		filepath.Dir(filepath.Dir(binaryPath)),
	}
	for _, dir := range searchDirs {
		for _, name := range []string{"my.ini", "my.cnf"} {
			candidate := filepath.Join(dir, name)
			if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
				return candidate
			}
		}
	}
	return ""
}
