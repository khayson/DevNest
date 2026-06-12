package database

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

const (
	DefaultMySQLPort     = 3306
	DefaultPostgresPort  = 5432
	DefaultRedisPort     = 6379
)

// ResolveMySQL finds mysqld in DevNest runtimes, PATH, or common Windows installs.
func ResolveMySQL() (string, error) {
	return resolveBinary("mysqld", []string{
		filepath.Join("mysql", "bin", "mysqld.exe"),
		filepath.Join("mysql", "bin", "mysqld"),
	})
}

// ResolvePostgreSQL finds postgres in DevNest runtimes or on PATH.
func ResolvePostgreSQL() (string, error) {
	return resolveBinary("postgres", []string{
		filepath.Join("postgres", "bin", "postgres.exe"),
		filepath.Join("postgres", "bin", "postgres"),
	})
}

// ResolveRedis finds redis-server in DevNest runtimes or on PATH.
func ResolveRedis() (string, error) {
	return resolveBinary("redis-server", []string{
		filepath.Join("redis", "redis-server.exe"),
		filepath.Join("redis", "redis-server"),
	})
}

func resolveBinary(pathName string, runtimeSubpaths []string) (string, error) {
	home, _ := os.UserHomeDir()
	base, _ := devnestDir()

	var candidates []string
	for _, sub := range runtimeSubpaths {
		if base != "" {
			candidates = append(candidates, filepath.Join(base, "runtimes", sub))
		}
	}

	if runtime.GOOS == "windows" && home != "" {
		candidates = append(candidates,
			filepath.Join("C:", "xampp", "mysql", "bin", "mysqld.exe"),
			filepath.Join("C:", "laragon", "bin", "mysql", "mysql-8.0", "bin", "mysqld.exe"),
			filepath.Join("C:", "laragon", "bin", "mysql", "mysql-8.4", "bin", "mysqld.exe"),
		)
	}

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

func devnestDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".devnest"), nil
}
