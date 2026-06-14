package cmd

import (
	"devnest/internal/launcher"
	"log"

	"github.com/spf13/cobra"
)

var launcherCmd = &cobra.Command{
	Use:   "launcher",
	Short: "Run the DevNest control API (start/stop daemon from the UI)",
	Long: `Starts a lightweight HTTP server on 127.0.0.1:9089 that the dashboard uses
to start, stop, and restart the main daemon without opening a terminal.`,
	Run: func(cmd *cobra.Command, args []string) {
		srv := launcher.NewServer("")
		log.Fatal(srv.ListenAndServe())
	},
}

func init() {
	rootCmd.AddCommand(launcherCmd)
}
