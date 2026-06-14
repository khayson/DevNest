package sites

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// CreateProjectOptions configures a new Laravel project wizard run.
type CreateProjectOptions struct {
	ParentDir   string
	Name        string
	StarterKit  string // blank, api, react, vue, livewire
	PHPBinary   string
}

// CreateLaravelProject scaffolds a new Laravel app using composer or laravel CLI.
func CreateLaravelProject(opts CreateProjectOptions) (string, error) {
	name := strings.TrimSpace(opts.Name)
	if name == "" {
		return "", fmt.Errorf("project name is required")
	}
	parent := strings.TrimSpace(opts.ParentDir)
	if parent == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		parent = cwd
	}
	target := filepath.Join(parent, name)
	if _, err := os.Stat(target); err == nil {
		return "", fmt.Errorf("directory already exists: %s", target)
	}

	phpBin := opts.PHPBinary
	if phpBin == "" {
		phpBin = "php"
	}

	if laravel, err := exec.LookPath("laravel"); err == nil {
		args := []string{"new", name}
		switch opts.StarterKit {
		case "react":
			args = append(args, "--react")
		case "vue":
			args = append(args, "--vue")
		case "livewire":
			args = append(args, "--livewire")
		case "api":
			args = append(args, "--api")
		}
		cmd := exec.Command(laravel, args...)
		cmd.Dir = parent
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return "", fmt.Errorf("laravel new failed: %w", err)
		}
		return target, nil
	}

	args := []string{"create-project", "laravel/laravel", name}
	if opts.StarterKit == "api" {
		args = append(args, "--prefer-dist")
	}
	cmd := exec.Command("composer", args...)
	cmd.Dir = parent
	cmd.Env = append(os.Environ(), "COMPOSER_ALLOW_SUPERUSER=1")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("composer create-project failed: %w — install Composer or Laravel installer", err)
	}

	if opts.StarterKit == "react" || opts.StarterKit == "vue" || opts.StarterKit == "livewire" {
		breeze := exec.Command(phpBin, filepath.Join(target, "artisan"), "install:breeze", "--"+opts.StarterKit)
		breeze.Dir = target
		breeze.Stdout = os.Stdout
		breeze.Stderr = os.Stderr
		_ = breeze.Run()
	}

	return target, nil
}
