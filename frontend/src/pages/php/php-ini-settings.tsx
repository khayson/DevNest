import { RefreshCw } from "lucide-react"
import { updatePHPIni } from "@/shared/api/ws"
import { formatPHPVersion, type PHPInstallation, type PHPDirectives } from "@/shared/store/php"
import { Button } from "@/shared/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings-group"
import { cn } from "@/shared/lib/utils"

const MEMORY_OPTIONS = ["128M", "256M", "512M", "1G", "2G"]
const TIME_OPTIONS = ["30", "60", "120", "300", "600"]
const UPLOAD_OPTIONS = ["2M", "10M", "20M", "50M", "100M", "500M"]

const triggerClass = "w-full min-w-[8rem] sm:w-40"

interface IniSelectProps {
  value: string
  disabled?: boolean
  options: { value: string; label: string }[]
  onValueChange: (value: string) => void
}

function IniSelect({ value, disabled, options, onValueChange }: IniSelectProps) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface PHPIniSettingsProps {
  active: PHPInstallation | undefined
  installations: PHPInstallation[]
  editVersion: string
  onEditVersionChange: (version: string) => void
  directives: PHPDirectives
  dirty: boolean
  phpAvailable: boolean
  onChange: <K extends keyof PHPDirectives>(key: K, value: PHPDirectives[K]) => void
  onApplied: () => void
}

export function PHPIniSettings({
  active,
  installations,
  editVersion,
  onEditVersionChange,
  directives,
  dirty,
  phpAvailable,
  onChange,
  onApplied,
}: PHPIniSettingsProps) {
  const editingInst =
    installations.find((i) => i.version === editVersion) ?? active
  const disabled = !editingInst?.ini_path

  const apply = () => {
    updatePHPIni({ ...directives }, editingInst?.version)
    onApplied()
  }

  const memoryOptions = MEMORY_OPTIONS.map((v) => ({
    value: v,
    label: v === "128M" ? `${v} (default)` : v,
  }))

  const timeOptions = TIME_OPTIONS.map((v) => ({
    value: v,
    label: v === "30" ? `${v}s (default)` : `${v}s`,
  }))

  const uploadOptions = UPLOAD_OPTIONS.map((v) => ({
    value: v,
    label: v === "2M" ? `${v} (default)` : v,
  }))

  return (
    <SettingsGroup
      title="php.ini settings"
      description={
        editingInst
          ? `Editing ${formatPHPVersion(editingInst)} — per-version php.ini overrides persist in devnest.json.`
          : "Select a PHP installation to edit php.ini directives."
      }
    >
      {installations.length > 1 && (
        <SettingsRow label="PHP version" description="Each installed version can have its own php.ini overrides.">
          <Select value={editVersion} onValueChange={onEditVersionChange}>
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {installations.map((inst) => (
                <SelectItem key={inst.version} value={inst.version}>
                  {formatPHPVersion(inst)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      )}

      {!editingInst?.ini_path && phpAvailable && (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          No php.ini found for the active installation. Open the install folder and add a php.ini next to the binary.
        </p>
      )}

      <SettingsRow
        label="memory_limit"
        description="Maximum memory per script. Laravel apps often need 256M or higher."
        disabled={disabled}
      >
        <IniSelect
          value={directives.memory_limit}
          disabled={disabled}
          options={memoryOptions}
          onValueChange={(v) => onChange("memory_limit", v)}
        />
      </SettingsRow>

      <SettingsRow
        label="max_execution_time"
        description="Script timeout in seconds."
        disabled={disabled}
      >
        <IniSelect
          value={directives.max_execution_time}
          disabled={disabled}
          options={timeOptions}
          onValueChange={(v) => onChange("max_execution_time", v)}
        />
      </SettingsRow>

      <SettingsRow
        label="upload_max_filesize"
        description="Maximum size for uploaded files."
        disabled={disabled}
      >
        <IniSelect
          value={directives.upload_max_filesize}
          disabled={disabled}
          options={uploadOptions}
          onValueChange={(v) => onChange("upload_max_filesize", v)}
        />
      </SettingsRow>

      <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
        {dirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
        )}
        <Button
          type="button"
          size="sm"
          className={cn("h-9", dirty && "shadow-sm")}
          disabled={!dirty || disabled}
          onClick={apply}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Apply &amp; reload PHP-CGI
        </Button>
      </div>
    </SettingsGroup>
  )
}
