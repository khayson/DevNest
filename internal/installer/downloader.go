package installer

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

// ProgressCallback is called during downloads to report progress.
// downloaded = bytes received so far, total = Content-Length (-1 if unknown).
type ProgressCallback func(downloaded int64, total int64)

// DownloadFile pulls a binary from a remote URL to a local destination with progress reporting.
func DownloadFile(url string, destPath string, onProgress ProgressCallback) error {
	// Ensure destination directory exists
	dir := filepath.Dir(destPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	totalSize := resp.ContentLength

	// Wrap the reader with a progress tracker
	reader := &progressReader{
		reader:     resp.Body,
		total:      totalSize,
		onProgress: onProgress,
	}

	_, err = io.Copy(out, reader)
	return err
}

// DownloadAndVerify downloads a file and verifies its SHA-256 checksum.
// This prevents man-in-the-middle attacks when downloading PHP/Caddy binaries.
func DownloadAndVerify(url, destPath, expectedSHA256 string, onProgress ProgressCallback) error {
	if err := DownloadFile(url, destPath, onProgress); err != nil {
		return err
	}

	actualHash, err := computeSHA256(destPath)
	if err != nil {
		os.Remove(destPath) // Clean up corrupt file
		return fmt.Errorf("failed to compute checksum: %w", err)
	}

	if actualHash != expectedSHA256 {
		os.Remove(destPath) // Clean up tampered file
		return fmt.Errorf("checksum mismatch for %s: expected %s, got %s", destPath, expectedSHA256, actualHash)
	}

	log.Printf("[Installer] Checksum verified for %s (SHA-256: %s)", filepath.Base(destPath), actualHash[:16]+"...")
	return nil
}

// computeSHA256 calculates the SHA-256 hash of a file.
func computeSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		return "", err
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// progressReader wraps an io.Reader to report download progress.
type progressReader struct {
	reader     io.Reader
	total      int64
	downloaded int64
	onProgress ProgressCallback
}

func (r *progressReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.downloaded += int64(n)

	if r.onProgress != nil && n > 0 {
		r.onProgress(r.downloaded, r.total)
	}

	return n, err
}
