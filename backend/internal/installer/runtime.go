package installer

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// RuntimeResult describes an installed runtime binary.
type RuntimeResult struct {
	Name           string `json:"name"`
	Path           string `json:"path"`
	AlreadyExisted bool   `json:"already_existed"`
}

type runtimeSpec struct {
	name      string
	version   string
	url       string
	targetDir string
	exeName   string
	zipSingle bool
}

var windowsCatalog = map[string]runtimeSpec{
	"caddy": {
		name: "caddy", version: "2.11.4",
		url:       "https://github.com/caddyserver/caddy/releases/download/v2.11.4/caddy_2.11.4_windows_amd64.zip",
		targetDir: "caddy", exeName: "caddy.exe", zipSingle: true,
	},
	"node": {
		name: "node", version: "22.16.0",
		url:       "https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip",
		targetDir: "node", exeName: "node.exe", zipSingle: false,
	},
	"cloudflared": {
		name: "cloudflared", version: "2025.5.0",
		url:       "https://github.com/cloudflare/cloudflared/releases/download/2025.5.0/cloudflared-windows-amd64.exe",
		targetDir: "cloudflared", exeName: "cloudflared.exe", zipSingle: false,
	},
	"mariadb": {
		name: "mariadb", version: "11.4.4",
		url:       "https://archive.mariadb.org/mariadb-11.4.4/winx64-packages/mariadb-11.4.4-winx64.zip",
		targetDir: "mariadb", exeName: "mariadbd.exe", zipSingle: false,
	},
}

// Catalog returns installable runtime names for the current OS.
func Catalog() []string {
	if runtime.GOOS != "windows" {
		return nil
	}
	out := make([]string, 0, len(windowsCatalog))
	for name := range windowsCatalog {
		out = append(out, name)
	}
	return out
}

// Install downloads and extracts a runtime into ~/.devnest/runtimes/{name}.
func Install(name string, onProgress func(downloaded, total int64)) (RuntimeResult, error) {
	if runtime.GOOS != "windows" {
		return RuntimeResult{}, fmt.Errorf("%s install is only supported on Windows in this release", name)
	}
	spec, ok := windowsCatalog[strings.ToLower(name)]
	if !ok {
		return RuntimeResult{}, fmt.Errorf("unknown runtime %q — available: caddy, node, cloudflared, mariadb", name)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return RuntimeResult{}, err
	}
	targetDir := filepath.Join(home, ".devnest", "runtimes", spec.targetDir)
	exePath := filepath.Join(targetDir, spec.exeName)
	if st, statErr := os.Stat(exePath); statErr == nil && !st.IsDir() {
		return RuntimeResult{Name: spec.name, Path: exePath, AlreadyExisted: true}, nil
	}
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return RuntimeResult{}, err
	}

	if strings.HasSuffix(spec.url, ".exe") {
		if err := downloadFile(spec.url, exePath, onProgress); err != nil {
			return RuntimeResult{}, err
		}
		return RuntimeResult{Name: spec.name, Path: exePath}, nil
	}

	zipPath := filepath.Join(os.TempDir(), fmt.Sprintf("devnest-%s-%s.zip", spec.name, spec.version))
	if err := downloadFile(spec.url, zipPath, onProgress); err != nil {
		return RuntimeResult{}, err
	}
	defer os.Remove(zipPath)

	if err := unzip(zipPath, targetDir, spec); err != nil {
		return RuntimeResult{}, err
	}
	if _, err := os.Stat(exePath); err != nil {
		found, findErr := findExe(targetDir, spec.exeName)
		if findErr != nil {
			return RuntimeResult{}, fmt.Errorf("%s not found after extract: %w", spec.exeName, findErr)
		}
		exePath = found
	}
	return RuntimeResult{Name: spec.name, Path: exePath}, nil
}

func downloadFile(url, dest string, onProgress func(int64, int64)) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := out.Write(buf[:n]); wErr != nil {
				return wErr
			}
			downloaded += int64(n)
			if onProgress != nil {
				onProgress(downloaded, total)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	return nil
}

func unzip(zipPath, dest string, spec runtimeSpec) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		name := filepath.Base(f.Name)
		if spec.zipSingle && name != spec.exeName {
			continue
		}
		if !spec.zipSingle && !strings.HasSuffix(strings.ToLower(name), ".exe") && !strings.Contains(f.Name, "/") {
			// node zip: extract folder contents
		}
		target := filepath.Join(dest, name)
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(target)
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(out, rc)
		out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	// Node ships as node-v22.../node.exe — flatten if needed
	if spec.name == "node" {
		found, err := findExe(dest, spec.exeName)
		if err == nil && found != filepath.Join(dest, spec.exeName) {
			data, _ := os.ReadFile(found)
			_ = os.WriteFile(filepath.Join(dest, spec.exeName), data, 0755)
		}
	}
	if spec.name == "mariadb" {
		binDir := filepath.Join(dest, "bin")
		_ = os.MkdirAll(binDir, 0755)
		found, err := findExe(dest, "mariadbd.exe")
		if err != nil {
			found, err = findExe(dest, "mysqld.exe")
		}
		if err == nil {
			target := filepath.Join(binDir, "mariadbd.exe")
			if found != target {
				data, readErr := os.ReadFile(found)
				if readErr == nil {
					_ = os.WriteFile(target, data, 0755)
				}
			}
		}
	}
	return nil
}

func findExe(root, exeName string) (string, error) {
	var found string
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if strings.EqualFold(filepath.Base(path), exeName) {
			found = path
			return io.EOF
		}
		return nil
	})
	if found == "" {
		return "", os.ErrNotExist
	}
	return found, nil
}
