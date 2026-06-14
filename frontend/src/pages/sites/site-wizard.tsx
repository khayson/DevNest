import { useState } from "react"
import { Sparkles } from "lucide-react"
import { createLaravelProject } from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Spinner } from "@/shared/ui/spinner"

const STARTER_KITS = [
  { id: "blank", label: "Blank Laravel" },
  { id: "api", label: "API only" },
  { id: "react", label: "React + Inertia" },
  { id: "vue", label: "Vue + Inertia" },
  { id: "livewire", label: "Livewire" },
]

interface SiteWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SiteWizard({ open, onOpenChange }: SiteWizardProps) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [parentDir, setParentDir] = useState("")
  const [starterKit, setStarterKit] = useState("blank")
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setStep(1)
    setName("")
    setParentDir("")
    setStarterKit("blank")
    setBusy(false)
  }

  const handleCreate = () => {
    if (!name.trim()) {
      notify.error("Name required", "Enter a project folder name.", "system")
      return
    }
    setBusy(true)
    if (
      createLaravelProject({
        name: name.trim(),
        parent_dir: parentDir.trim(),
        starter_kit: starterKit,
        auto_link: true,
        update_env: true,
      })
    ) {
      notify.toast("Creating project…", `Running Laravel installer for ${name}`, "info")
    } else {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            New Laravel site
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Parent folder (optional)</label>
              <Input
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value)}
                placeholder="C:/projects — defaults to current folder"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Starter kit</label>
              <Select value={starterKit} onValueChange={setStarterKit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STARTER_KITS.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={busy}>
            {busy ? <Spinner size="sm" label="Creating…" /> : "Create & link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
