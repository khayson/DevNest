package cmd

import (
	"devnest/internal/config"
	"devnest/internal/service/sites"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

func openConfigStore() (*config.Store, error) {
	return config.NewStore()
}

var linkCmd = &cobra.Command{
	Use:   "link [domain]",
	Short: "Link the current directory as a local *.test site",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := openConfigStore()
		if err != nil {
			return err
		}
		domain := ""
		if len(args) > 0 {
			domain = args[0]
		}
		cwd, _ := os.Getwd()
		updateEnv, _ := cmd.Flags().GetBool("update-env")
		entry, err := sites.LinkProject(store, cwd, domain, updateEnv)
		if err != nil {
			return err
		}
		fmt.Printf("Linked %s -> %s\n", entry.Domain, entry.Path)
		return nil
	},
}

var parkCmd = &cobra.Command{
	Use:   "park [path]",
	Short: "Park a folder root for automatic site discovery",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := openConfigStore()
		if err != nil {
			return err
		}
		root := ""
		if len(args) > 0 {
			root = args[0]
		} else {
			root, _ = os.Getwd()
		}
		importSites, _ := cmd.Flags().GetBool("import")
		name, _ := cmd.Flags().GetString("name")
		entry := config.ParkedPath{Path: filepath.Clean(root), Name: name}
		if err := store.AddParkedPath(entry); err != nil {
			return err
		}
		fmt.Printf("Parked %s\n", root)
		if importSites {
			discovered := sites.ScanParkedPath(root, nil)
			count := 0
			for _, d := range discovered {
				if !d.AlreadyRegistered {
					_ = store.AddSite(config.SiteEntry{Name: d.Name, Domain: d.Domain, Path: d.Path, Port: d.Port, TLS: true})
					count++
				}
			}
			fmt.Printf("Imported %d site(s)\n", count)
		}
		return nil
	},
}

var sitesCmd = &cobra.Command{
	Use:   "sites",
	Short: "Manage local sites",
}

var sitesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List configured sites",
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := openConfigStore()
		if err != nil {
			return err
		}
		asJSON, _ := cmd.Flags().GetBool("json")
		items := store.GetSites()
		if asJSON {
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(items)
		}
		for _, s := range items {
			fmt.Printf("%s\t%s\t%s\n", s.Domain, s.Path, s.Group)
		}
		return nil
	},
}

var phpCmd = &cobra.Command{
	Use:   "php",
	Short: "Manage PHP installations",
}

var phpListCmd = &cobra.Command{
	Use:   "list",
	Short: "List discovered PHP installations",
	Run: func(cmd *cobra.Command, args []string) {
		installs := phpDiscoverCLI()
		for _, inst := range installs {
			fmt.Printf("%s\t%s\n", inst.Version, inst.Binary)
		}
	},
}

var phpInstallCmd = &cobra.Command{
	Use:   "install [version]",
	Short: "Download and install PHP on Windows",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		version := "8.3.21"
		if len(args) > 0 {
			version = args[0]
		}
		result, err := phpInstallCLI(version)
		if err != nil {
			return err
		}
		fmt.Printf("PHP %s installed at %s\n", result.Version, result.Path)
		return nil
	},
}

var servicesCmd = &cobra.Command{
	Use:   "services",
	Short: "Manage DevNest services via the daemon HTTP API on :9090",
}

var servicesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List known service IDs",
	Run: func(cmd *cobra.Command, args []string) {
		for _, id := range []string{
			"dns-resolver", "embedded-mail-server", "embedded-dump-server", "caddy-proxy", "php-cgi",
			"mysql", "mariadb", "postgres", "redis", "valkey", "minio", "meilisearch", "rustfs",
		} {
			fmt.Println(id)
		}
	},
}

var debugCmd = &cobra.Command{
	Use:   "debug",
	Short: "Manage Xdebug debug sessions",
}

var debugStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Enable Xdebug and start a debug session",
	RunE: func(cmd *cobra.Command, args []string) error {
		return cliDaemonCommand("debug_start", map[string]interface{}{"port": 9003, "ide_key": "PHPSTORM"})
	},
}

var debugStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Disable Xdebug debug session",
	RunE: func(cmd *cobra.Command, args []string) error {
		return cliDaemonCommand("debug_stop", map[string]interface{}{})
	},
}

func initCLI() {
	linkCmd.Flags().Bool("update-env", true, "Update APP_URL in .env")
	parkCmd.Flags().Bool("import", false, "Import discovered sites immediately")
	parkCmd.Flags().String("name", "", "Display name for parked folder")
	sitesListCmd.Flags().Bool("json", false, "Output JSON")

	rootCmd.AddCommand(linkCmd)
	rootCmd.AddCommand(parkCmd)
	sitesCmd.AddCommand(sitesListCmd)
	rootCmd.AddCommand(sitesCmd)
	phpCmd.AddCommand(phpListCmd)
	phpCmd.AddCommand(phpInstallCmd)
	rootCmd.AddCommand(phpCmd)
	servicesCmd.AddCommand(servicesListCmd)
	rootCmd.AddCommand(servicesCmd)
	debugCmd.AddCommand(debugStartCmd)
	debugCmd.AddCommand(debugStopCmd)
	rootCmd.AddCommand(debugCmd)
	initServicesCLI()
	initMCPCLI()
}
