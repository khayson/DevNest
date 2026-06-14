import { debugStart, debugStop, togglePHPExtension } from "@/shared/api/ws"
import { type PHPExtensionState, type PHPInstallation } from "@/shared/store/php"
import { Button } from "@/shared/ui/button"
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings-group"
import { Switch } from "@/shared/ui/switch"

interface PHPExtensionsProps {
  active: PHPInstallation | undefined
  extensions: PHPExtensionState[]
  connected: boolean
}

export function PHPExtensions({ active, extensions, connected }: PHPExtensionsProps) {
  const disabled = !connected || !active?.ini_path

  return (
    <SettingsGroup
      title="Extensions"
      description={
        active?.ini_path
          ? "Toggle Xdebug and OPcache in php.ini. PHP-CGI restarts automatically after each change."
          : "Select an active PHP installation with a php.ini to manage extensions."
      }
    >
      {extensions.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">No extension state available yet.</p>
      ) : (
        extensions.map((ext) => (
          <SettingsRow
            key={ext.name}
            label={ext.label}
            description={ext.enabled ? "Enabled in php.ini" : "Disabled (commented out)"}
            disabled={disabled}
          >
            <Switch
              checked={ext.enabled}
              disabled={disabled}
              onCheckedChange={(checked) => togglePHPExtension(ext.name, checked)}
            />
          </SettingsRow>
        ))
      )}
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => debugStart()}>
          Start debug session
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => debugStop()}>
          Stop debug session
        </Button>
      </div>
    </SettingsGroup>
  )
}
