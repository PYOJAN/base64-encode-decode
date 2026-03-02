import { Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { type EditorTheme, EDITOR_THEMES, getThemeAccentColor } from "@/lib/editor-themes"

interface EditorThemePickerProps {
  theme: EditorTheme
  onThemeChange: (theme: EditorTheme) => void
  /** Called on hover for live preview. Optional. */
  onPreviewChange?: (theme: EditorTheme | null) => void
}

export function EditorThemePicker({
  theme,
  onThemeChange,
  onPreviewChange,
}: EditorThemePickerProps) {
  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) onPreviewChange?.(null) }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">
            {EDITOR_THEMES.find((t) => t.id === theme)?.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Editor Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => onThemeChange(v as EditorTheme)}
        >
          {EDITOR_THEMES.map((t) => (
            <DropdownMenuRadioItem
              key={t.id}
              value={t.id}
              className="text-xs gap-2"
              onMouseEnter={() => onPreviewChange?.(t.id)}
              onMouseLeave={() => onPreviewChange?.(null)}
            >
              <span
                className="inline-block h-3 w-3 rounded-full border border-white/20 shrink-0"
                style={{ backgroundColor: getThemeAccentColor(t.id) }}
              />
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
