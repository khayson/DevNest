package processlog

import "os/exec"

// AttachPipes wires stdout/stderr from cmd into the log store.
func AttachPipes(cmd *exec.Cmd, key, domain, kind string) error {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	store := Global()
	go store.StreamReader(key, domain, kind, "stdout", stdout)
	go store.StreamReader(key, domain, kind, "stderr", stderr)
	return nil
}
