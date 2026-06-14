//go:build windows

package launcher

import (
	"os/exec"
	"syscall"
)

func attachDetached(c *exec.Cmd) error {
	c.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
	return c.Start()
}
