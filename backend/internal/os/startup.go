package osutil

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// SetLaunchOnStartup configures the application to launch automatically at login on Windows.
func SetLaunchOnStartup(enable bool) error {
	if runtime.GOOS != "windows" {
		return nil // NOP on non-Windows for now
	}

	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	if enable {
		// Run command: reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v DevNest /t REG_SZ /d "\"C:\path\to\devnest.exe\" daemon" /f
		// Ensure quotes around path in case it contains spaces
		cmdValue := fmt.Sprintf(`"%s" daemon`, execPath)
		cmd := exec.Command("reg", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "DevNest", "/t", "REG_SZ", "/d", cmdValue, "/f")
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to add startup registry key: %s (error: %w)", string(output), err)
		}
	} else {
		// Run command: reg delete HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v DevNest /f
		cmd := exec.Command("reg", "delete", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "DevNest", "/f")
		// ignore error if the key doesn't exist
		_ = cmd.Run()
	}

	return nil
}
