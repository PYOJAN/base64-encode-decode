import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const COLOR_SWATCHES = [
  "#020617",
  "#0f172a",
  "#1e293b",
  "#334155",
  "#64748b",
  "#94a3b8",
  "#0ea5e9",
  "#0284c7",
  "#06b6d4",
  "#10b981",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#f43f5e",
  "#ec4899",
  "#a855f7",
  "#6366f1",
]

function normalizeHex(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, "")
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split("")
      .map((ch) => ch + ch)
      .join("")
    return `#${expanded.toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`
  }
  return null
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}

function hexToRgbTriplet(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g).toString(16).padStart(2, "0")}${clampByte(b).toString(16).padStart(2, "0")}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  let s = 0

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / delta) % 6)
        break
      case gn:
        h = 60 * ((bn - rn) / delta + 2)
        break
      default:
        h = 60 * ((rn - gn) / delta + 4)
        break
    }
  }

  if (h < 0) h += 360
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360
  const sn = Math.max(0, Math.min(100, s)) / 100
  const ln = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs((hh / 60) % 2 - 1))
  const m = ln - c / 2

  let rp = 0
  let gp = 0
  let bp = 0

  if (hh < 60) {
    rp = c
    gp = x
  } else if (hh < 120) {
    rp = x
    gp = c
  } else if (hh < 180) {
    gp = c
    bp = x
  } else if (hh < 240) {
    gp = x
    bp = c
  } else if (hh < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }

  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  }
}

function pushRecentColors(next: string, prev: string[]): string[] {
  const normalized = normalizeHex(next)
  if (!normalized) return prev
  return [normalized, ...prev.filter((v) => v !== normalized)].slice(0, 8)
}

type EyeDropperLike = {
  open: () => Promise<{ sRGBHex: string }>
}

type AdvancedColorPickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function AdvancedColorPicker({ value, onChange, className }: AdvancedColorPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(normalizeHex(value) ?? "#000000")
  const [recent, setRecent] = useState<string[]>([])

  const rgb = useMemo(() => hexToRgbTriplet(draft) ?? { r: 0, g: 0, b: 0 }, [draft])
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb.b, rgb.g, rgb.r])
  const supportsEyeDropper = typeof window !== "undefined" && "EyeDropper" in window

  const applyColor = useCallback(
    (next: string) => {
      const normalized = normalizeHex(next)
      if (!normalized) return
      setDraft(normalized)
      onChange(normalized)
      setRecent((prev) => {
        const updated = pushRecentColors(normalized, prev)
        try {
          localStorage.setItem("advanced-color-recent", JSON.stringify(updated))
        } catch {}
        return updated
      })
    },
    [onChange]
  )

  useEffect(() => {
    const normalized = normalizeHex(value)
    if (normalized) setDraft(normalized)
  }, [value])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("advanced-color-recent")
      if (!raw) return
      const parsed = JSON.parse(raw) as string[]
      if (!Array.isArray(parsed)) return
      const cleaned = parsed.map((v) => normalizeHex(v)).filter(Boolean) as string[]
      setRecent(cleaned.slice(0, 8))
    } catch {}
  }, [])

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [open])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-2 text-left text-sm"
      >
        <span className="h-4 w-4 shrink-0 rounded border" style={{ backgroundColor: draft }} />
        <span className="font-mono text-xs uppercase">{draft}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Pick</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[280px] rounded-md border bg-popover p-2 shadow-xl">
          <div className="mb-2 space-y-2 rounded border bg-muted/30 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mixer</p>
            <div
              className="h-8 w-full rounded border"
              style={{ background: `linear-gradient(90deg, #ffffff 0%, ${draft} 50%, #000000 100%)` }}
            />
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Hue: {hsl.h}</Label>
              <input
                type="range"
                min={0}
                max={360}
                value={hsl.h}
                className="w-full"
                style={{ accentColor: draft }}
                onChange={(e) => {
                  const next = hslToRgb(Number(e.target.value), hsl.s, hsl.l)
                  applyColor(rgbToHex(next.r, next.g, next.b))
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Saturation: {hsl.s}</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={hsl.s}
                className="w-full"
                style={{ accentColor: draft }}
                onChange={(e) => {
                  const next = hslToRgb(hsl.h, Number(e.target.value), hsl.l)
                  applyColor(rgbToHex(next.r, next.g, next.b))
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Lightness: {hsl.l}</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={hsl.l}
                className="w-full"
                style={{ accentColor: draft }}
                onChange={(e) => {
                  const next = hslToRgb(hsl.h, hsl.s, Number(e.target.value))
                  applyColor(rgbToHex(next.r, next.g, next.b))
                }}
              />
            </div>
          </div>

          <div className="mb-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Palette</p>
            <div className="grid grid-cols-10 gap-1">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "h-5 w-5 rounded border transition-transform hover:scale-110",
                    draft === color && "ring-2 ring-sky-400 ring-offset-1"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => applyColor(color)}
                />
              ))}
            </div>
          </div>

          {recent.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
              <div className="grid grid-cols-8 gap-1">
                {recent.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-5 w-5 rounded border transition-transform hover:scale-110",
                      draft === color && "ring-2 ring-sky-400 ring-offset-1"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => applyColor(color)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="w-9 text-[10px] text-muted-foreground">HEX</Label>
              <Input
                value={draft}
                className="h-8 font-mono uppercase"
                onChange={(e) => {
                  const raw = e.target.value
                  setDraft(raw)
                  const normalized = normalizeHex(raw)
                  if (normalized) applyColor(normalized)
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["R", "G", "B"] as const).map((channel) => (
                <div key={channel} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{channel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={channel === "R" ? rgb.r : channel === "G" ? rgb.g : rgb.b}
                    className="h-8"
                    onChange={(e) => {
                      const next = clampByte(Number(e.target.value))
                      const r = channel === "R" ? next : rgb.r
                      const g = channel === "G" ? next : rgb.g
                      const b = channel === "B" ? next : rgb.b
                      applyColor(rgbToHex(r, g, b))
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">H</Label>
                <Input
                  type="number"
                  min={0}
                  max={360}
                  value={hsl.h}
                  className="h-8"
                  onChange={(e) => {
                    const next = hslToRgb(Number(e.target.value) || 0, hsl.s, hsl.l)
                    applyColor(rgbToHex(next.r, next.g, next.b))
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">S</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={hsl.s}
                  className="h-8"
                  onChange={(e) => {
                    const next = hslToRgb(hsl.h, Number(e.target.value) || 0, hsl.l)
                    applyColor(rgbToHex(next.r, next.g, next.b))
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">L</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={hsl.l}
                  className="h-8"
                  onChange={(e) => {
                    const next = hslToRgb(hsl.h, hsl.s, Number(e.target.value) || 0)
                    applyColor(rgbToHex(next.r, next.g, next.b))
                  }}
                />
              </div>
            </div>

            <div className={cn("grid gap-2", supportsEyeDropper ? "grid-cols-2" : "grid-cols-1")}>
              {supportsEyeDropper && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={async () => {
                    const EyeDropperCtor = (window as Window & { EyeDropper?: { new (): EyeDropperLike } }).EyeDropper
                    if (!EyeDropperCtor) return
                    try {
                      const eyedropper = new EyeDropperCtor()
                      const result = await eyedropper.open()
                      applyColor(result.sRGBHex)
                    } catch {}
                  }}
                >
                  Pick From Screen
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft)
                  } catch {}
                }}
              >
                Copy HEX
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
