package php

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// ExtensionManager handles parsing and modifying php.ini files
// to easily toggle Xdebug, OPcache, and other settings.
type ExtensionManager struct {
	iniPath string
}

func NewExtensionManager(iniPath string) *ExtensionManager {
	return &ExtensionManager{
		iniPath: iniPath,
	}
}

// ToggleExtension enables or disables a specific PHP extension by uncommenting/commenting it.
func (em *ExtensionManager) ToggleExtension(extName string, enable bool) error {
	lines, err := em.readLines()
	if err != nil {
		return err
	}

	extRegex := regexp.MustCompile(fmt.Sprintf(`^;?\s*(extension|zend_extension)\s*=\s*%s(\.so|\.dll)?`, regexp.QuoteMeta(extName)))
	
	modified := false
	for i, line := range lines {
		if extRegex.MatchString(line) {
			if enable {
				// Remove leading semicolon
				lines[i] = strings.TrimLeft(line, "; ")
			} else {
				// Add leading semicolon if it doesn't have one
				if !strings.HasPrefix(strings.TrimSpace(line), ";") {
					lines[i] = "; " + line
				}
			}
			modified = true
		}
	}

	if !modified && enable {
		// If we couldn't find the extension to uncomment, we append it
		// (Assume standard extension=name format for Windows/Linux abstraction)
		lines = append(lines, fmt.Sprintf("extension=%s", extName))
	}

	return em.writeLines(lines)
}

// SetINIValue updates a key-value pair in the php.ini (e.g., memory_limit = 512M)
func (em *ExtensionManager) SetINIValue(key, value string) error {
	lines, err := em.readLines()
	if err != nil {
		return err
	}

	keyRegex := regexp.MustCompile(fmt.Sprintf(`^;?\s*%s\s*=.*`, regexp.QuoteMeta(key)))
	
	modified := false
	for i, line := range lines {
		if keyRegex.MatchString(line) {
			lines[i] = fmt.Sprintf("%s = %s", key, value)
			modified = true
			break
		}
	}

	if !modified {
		lines = append(lines, fmt.Sprintf("%s = %s", key, value))
	}

	return em.writeLines(lines)
}

// GetINIValue retrieves the current value of a key in the php.ini.
func (em *ExtensionManager) GetINIValue(key string) (string, error) {
	lines, err := em.readLines()
	if err != nil {
		return "", err
	}

	keyRegex := regexp.MustCompile(fmt.Sprintf(`^\s*%s\s*=\s*(.*)`, regexp.QuoteMeta(key)))
	
	for _, line := range lines {
		matches := keyRegex.FindStringSubmatch(line)
		if len(matches) > 1 {
			return strings.TrimSpace(matches[1]), nil
		}
	}

	return "", fmt.Errorf("key %s not found in %s", key, em.iniPath)
}

// Helpers for reading/writing

func (em *ExtensionManager) readLines() ([]string, error) {
	file, err := os.Open(em.iniPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open php.ini: %w", err)
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines, scanner.Err()
}

func (em *ExtensionManager) writeLines(lines []string) error {
	file, err := os.OpenFile(em.iniPath, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0644)
	if err != nil {
		return fmt.Errorf("failed to write php.ini: %w", err)
	}
	defer file.Close()

	writer := bufio.NewWriter(file)
	for _, line := range lines {
		if _, err := writer.WriteString(line + "\n"); err != nil {
			return err
		}
	}
	return writer.Flush()
}
