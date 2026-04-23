import { ListOrdered, WrapText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EditorSettings } from "@/hooks"

interface EditorSettingsBarProps {
  settings: EditorSettings
  onToggleLineNumbers: () => void
  onToggleLineWrapping: () => void
}

function SettingToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={`h-7 w-7 ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function EditorSettingsBar({
  settings,
  onToggleLineNumbers,
  onToggleLineWrapping,
}: EditorSettingsBarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background/50 p-0.5">
      <SettingToggle
        active={settings.showLineNumbers}
        onClick={onToggleLineNumbers}
        icon={ListOrdered}
        label={settings.showLineNumbers ? "Hide line numbers" : "Show line numbers"}
      />
      <SettingToggle
        active={settings.lineWrapping}
        onClick={onToggleLineWrapping}
        icon={WrapText}
        label={settings.lineWrapping ? "Disable word wrap" : "Enable word wrap"}
      />
    </div>
  )
}
