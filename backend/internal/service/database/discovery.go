package database

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

const (
	DefaultMySQLPort         = 3306
	DefaultPostgresPort      = 5432
	DefaultRedisPort         = 6379
	DefaultMeilisearchPort   = 7700
	DefaultMinIOPort         = 9000
	DefaultMinIOConsolePort  = 9001
	DefaultMariaDBPort       = 3307
	DefaultValkeyPort        = 6380
	DefaultRustFSPort        = 9002
	DefaultRustFSConsolePort = 9003
)

// PathOverrides are optional config paths checked before auto-discovery.
type PathOverrides struct {
	MySQL    string
	Postgres string
	Redis    string
}

var pathOverrides PathOverrides

// SetPathOverrides sets config-driven binary paths for discovery.
func SetPathOverrides(o PathOverrides) {
	pathOverrides = o
}

// ResolveMySQL finds mysqld in config, DevNest runtimes, PATH, or common Windows installs.
func ResolveMySQL() (string, error) {
	if p, ok := statFile(pathOverrides.MySQL); ok {
		return p, nil
	}
	extras := []string{}
	if runtime.GOOS == "windows" {
		extras = append(extras, windowsMySQLCandidates()...)
	}
	return resolveBinary("mysqld", []string{
		filepath.Join("mysql", "bin", "mysqld.exe"),
		filepath.Join("mysql", "bin", "mysqld"),
	}, extras)
}

// ResolvePostgreSQL finds postgres in config, DevNest runtimes, PATH, or common Windows installs.
func ResolvePostgreSQL() (string, error) {
	if p, ok := statFile(pathOverrides.Postgres); ok {
		return p, nil
	}
	extras := []string{}
	if runtime.GOOS == "windows" {
		extras = append(extras, windowsPostgresCandidates()...)
	}
	return resolveBinary("postgres", []string{
		filepath.Join("postgres", "bin", "postgres.exe"),
		filepath.Join("postgres", "bin", "postgres"),
	}, extras)
}

// ResolveRedis finds redis-server in config, DevNest runtimes, or on PATH.
func ResolveRedis() (string, error) {
	if p, ok := statFile(pathOverrides.Redis); ok {
		return p, nil
	}
	return resolveBinary("redis-server", []string{
		filepath.Join("redis", "redis-server.exe"),
		filepath.Join("redis", "redis-server"),
	}, nil)
}

// ResolveMeilisearch finds meilisearch in DevNest runtimes or on PATH.
func ResolveMeilisearch() (string, error) {
	return resolveBinary("meilisearch", []string{
		filepath.Join("meilisearch", "meilisearch.exe"),
		filepath.Join("meilisearch", "meilisearch"),
	}, nil)
}

// ResolveMinIO finds minio in DevNest runtimes or on PATH.
func ResolveMinIO() (string, error) {
	return resolveBinary("minio", []string{
		filepath.Join("minio", "minio.exe"),
		filepath.Join("minio", "minio"),
	}, nil)
}

// ResolveCloudflared finds cloudflared in DevNest runtimes or on PATH.
func ResolveCloudflared() (string, error) {
	return resolveBinary("cloudflared", []string{
		filepath.Join("cloudflared", "cloudflared.exe"),
		filepath.Join("cloudflared", "cloudflared"),
	}, nil)
}

// ResolveMariaDB finds mariadbd/mysqld for MariaDB.
func ResolveMariaDB() (string, error) {
	if p, err := resolveBinary("mariadbd", []string{
		filepath.Join("mariadb", "bin", "mariadbd.exe"),
		filepath.Join("mariadb", "bin", "mariadbd"),
	}, nil); err == nil {
		return p, nil
	}
	return resolveBinary("mysqld", []string{
		filepath.Join("mariadb", "bin", "mysqld.exe"),
		filepath.Join("mariadb", "bin", "mysqld"),
	}, nil)
}

// ResolveValkey finds valkey-server in DevNest runtimes or on PATH.
func ResolveValkey() (string, error) {
	return resolveBinary("valkey-server", []string{
		filepath.Join("valkey", "valkey-server.exe"),
		filepath.Join("valkey", "valkey-server"),
	}, nil)
}

// ResolveRustFS finds rustfs (S3-compatible) in DevNest runtimes or on PATH.
func ResolveRustFS() (string, error) {
	return resolveBinary("rustfs", []string{
		filepath.Join("rustfs", "rustfs.exe"),
		filepath.Join("rustfs", "rustfs"),
	}, nil)
}

func statFile(path string) (string, bool) {
	if path == "" {
		return "", false
	}
	path = filepath.Clean(path)
	st, err := os.Stat(path)
	if err != nil || st.IsDir() {
		return "", false
	}
	return path, true
}

func resolveBinary(pathName string, runtimeSubpaths, extraCandidates []string) (string, error) {
	base, _ := devnestDir()

	var candidates []string
	for _, sub := range runtimeSubpaths {
		if base != "" {
			candidates = append(candidates, filepath.Join(base, "runtimes", sub))
		}
	}
	candidates = append(candidates, extraCandidates...)

	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}

	if path, err := exec.LookPath(pathName); err == nil {
		return path, nil
	}
	if runtime.GOOS == "windows" {
		if path, err := exec.LookPath(pathName + ".exe"); err == nil {
			return path, nil
		}
	}

	return "", os.ErrNotExist
}

func windowsMySQLCandidates() []string {
	return []string{
		filepath.Join("C:", "xampp", "mysql", "bin", "mysqld.exe"),
		filepath.Join("C:", "laragon", "bin", "mysql", "mysql-8.0", "bin", "mysqld.exe"),
		filepath.Join("C:", "laragon", "bin", "mysql", "mysql-8.4", "bin", "mysqld.exe"),
	}
}

func windowsPostgresCandidates() []string {
	var out []string
	roots := []string{
		filepath.Join("C:", "Program Files", "PostgreSQL"),
		filepath.Join("C:", "Program Files (x86)", "PostgreSQL"),
		filepath.Join("C:", "laragon", "bin", "postgresql"),
	}
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			name := entry.Name()
			if runtime.GOOS == "windows" {
				out = append(out, filepath.Join(root, name, "bin", "postgres.exe"))
			} else {
				out = append(out, filepath.Join(root, name, "bin", "postgres"))
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i]) > strings.ToLower(out[j])
	})
	return out
}

func devnestDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".devnest"), nil
}

// PostgresVersionLabel reads a version string from the binary path or postgres --version.
func PostgresVersionLabel(binaryPath string) string {
	lower := strings.ToLower(binaryPath)
	parts := strings.Split(lower, string(filepath.Separator))
	for _, part := range parts {
		if len(part) >= 2 && part[0] >= '0' && part[0] <= '9' {
			if strings.Contains(part, ".") || len(part) <= 3 {
				return part
			}
		}
	}
	cmd := exec.Command(binaryPath, "--version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "16"
	}
	text := strings.TrimSpace(string(out))
	if idx := strings.Index(text, "PostgreSQL"); idx >= 0 {
		fields := strings.Fields(text[idx:])
		for _, f := range fields {
			if len(f) > 0 && f[0] >= '0' && f[0] <= '9' {
				return strings.TrimSuffix(f, ",")
			}
		}
	}
	return "16"
}
