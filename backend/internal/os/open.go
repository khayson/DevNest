package osutil

import (
	"os/exec"
	"runtime"
)

// OpenPath reveals a file or folder in the system file manager.
func OpenPath(path string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer", path).Start()
	case "darwin":
		return exec.Command("open", path).Start()
	default:
		return exec.Command("xdg-open", path).Start()
	}
}
