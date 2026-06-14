//go:build !windows

package launcher

func stopEnvironmentPlatform() ([]int, error) {
	_ = GracefulShutdown()
	return nil, nil
}
