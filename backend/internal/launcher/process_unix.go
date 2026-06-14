//go:build !windows

package launcher

import (
	"os/exec"
	"syscall"
)

func attachDetached(c *exec.Cmd) error {
	c.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	return c.Start()
}
