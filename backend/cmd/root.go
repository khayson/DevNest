package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "devnest",
	Short: "DevNest - Enterprise Local Development Orchestrator",
	Long: `DevNest is a high-performance local development runtime that manages
PHP, Caddy, databases, and provides an embedded mail and dump server.
It surpasses standard orchestrators with deep OS telemetry and WebSocket integrations.`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	// Run: func(cmd *cobra.Command, args []string) { },
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
	initCLI()
	initLifecycle()
}
