package php

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

// InstallCatalog lists PHP versions available for download on Windows.
var InstallCatalog = []struct {
	Version string
	URL     string
}{
	{"8.3.21", "https://windows.php.net/downloads/releases/php-8.3.21-Win32-vs16-x64.zip"},
	{"8.2.28", "https://windows.php.net/downloads/releases/php-8.2.28-Win32-vs16-x64.zip"},
	{"8.1.32", "https://windows.php.net/downloads/releases/php-8.1.32-Win32-vs16-x64.zip"},
}

// InstallResult describes a completed PHP installation.
type InstallResult struct {
	Version        string `json:"version"`
	Path           string `json:"path"`
	CGIPath        string `json:"cgi_path"`
	IniPath        string `json:"ini_path"`
	AlreadyExisted bool   `json:"already_existed"`
}

// InstallWindows downloads and extracts PHP to ~/.devnest/runtimes/php/php-{version}.
func InstallWindows(version string, onProgress func(downloaded, total int64)) (InstallResult, error) {
	if runtime.GOOS != "windows" {
		return InstallResult{}, fmt.Errorf("php install is only supported on Windows — use your package manager on other platforms")
	}

	url := ""
	for _, item := range InstallCatalog {
		if item.Version == version {
			url = item.URL
			break
		}
	}
	if url == "" {
		return InstallResult{}, fmt.Errorf("unsupported PHP version %s — available: 8.1.32, 8.2.28, 8.3.21", version)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return InstallResult{}, err
	}
	targetDir := filepath.Join(home, ".devnest", "runtimes", "php", "php-"+version)
	phpExe := filepath.Join(targetDir, "php.exe")
	cgiExe := filepath.Join(targetDir, "php-cgi.exe")
	if st, statErr := os.Stat(phpExe); statErr == nil && !st.IsDir() {
		return InstallResult{
			Version:        version,
			Path:           phpExe,
			CGIPath:        cgiExe,
			IniPath:        filepath.Join(targetDir, "php.ini"),
			AlreadyExisted: true,
		}, nil
	}

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return InstallResult{}, err
	}

	zipPath := filepath.Join(os.TempDir(), fmt.Sprintf("devnest-php-%s.zip", version))
	if err := downloadPHPFile(url, zipPath, onProgress); err != nil {
		return InstallResult{}, err
	}
	defer os.Remove(zipPath)

	if err := unzipPHP(zipPath, targetDir); err != nil {
		return InstallResult{}, err
	}

	iniDev := filepath.Join(targetDir, "php.ini-development")
	ini := filepath.Join(targetDir, "php.ini")
	if _, err := os.Stat(ini); os.IsNotExist(err) {
		if data, readErr := os.ReadFile(iniDev); readErr == nil {
			_ = os.WriteFile(ini, data, 0644)
		}
	}

	if _, err := os.Stat(phpExe); err != nil {
		return InstallResult{}, fmt.Errorf("php.exe not found after extract")
	}

	return InstallResult{
		Version: version,
		Path:    phpExe,
		CGIPath: cgiExe,
		IniPath: ini,
	}, nil
}

func downloadPHPFile(url, dest string, onProgress func(downloaded, total int64)) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: %s", resp.Status)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	var downloaded int64
	total := resp.ContentLength
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

func unzipPHP(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		target := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("invalid zip entry: %s", f.Name)
		}
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
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
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
	return nil
}
