package osutil

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// OpenInIDE opens a file at a specific line in the configured editor.
func OpenInIDE(editor, filePath string, line int) error {
	filePath = filepath.Clean(filePath)
	if _, err := os.Stat(filePath); err != nil {
		return fmt.Errorf("file not found: %s", filePath)
	}
	if line <= 0 {
		line = 1
	}
	editor = strings.TrimSpace(strings.ToLower(editor))
	if editor == "" {
		editor = "cursor"
	}

	switch editor {
	case "cursor", "code", "phpstorm", "idea", "vscode", "subl", "sublime":
		return openWithEditor(editor, filePath, line)
	default:
		return openWithEditor("cursor", filePath, line)
	}
}

func openWithEditor(editor, filePath string, line int) error {
	target := fmt.Sprintf("%s:%d", filePath, line)
	var cmd *exec.Cmd
	switch editor {
	case "cursor":
		cmd = exec.Command("cursor", "-g", target)
	case "code", "vscode":
		cmd = exec.Command("code", "-g", target)
	case "phpstorm", "idea":
		cmd = exec.Command("phpstorm", "--line", fmt.Sprintf("%d", line), filePath)
	case "subl", "sublime":
		cmd = exec.Command("subl", target)
	default:
		if runtime.GOOS == "windows" {
			return exec.Command("cmd", "/c", "start", "", target).Start()
		}
		return exec.Command("xdg-open", filePath).Start()
	}
	return cmd.Start()
}

// OpenTablePlus opens a database connection URL in TablePlus when installed.
func OpenTablePlus(connURL string) error {
	if connURL == "" {
		return fmt.Errorf("empty connection URL")
	}
	if tp, err := exec.LookPath("tableplus"); err == nil {
		return exec.Command(tp, connURL).Start()
	}
	if runtime.GOOS == "windows" {
		return exec.Command("cmd", "/c", "start", "tableplus://"+connURL).Start()
	}
	return fmt.Errorf("tableplus not found on PATH")
}
