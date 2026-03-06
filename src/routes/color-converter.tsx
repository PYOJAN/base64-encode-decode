import { useState, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Palette, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdvancedColorPicker } from "@/components/ui/advanced-color-picker"
import { ToolPageLayout, ErrorBanner } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import {
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  parseColorInput,
  detectColorFormat,
  type RGB,
} from "@/utils/color"

export const Route = createFileRoute("/color-converter")({
  component: ColorConverterPage,
})

interface ColorValues {
  hex: string
  rgb: string
  hsl: string
  hsv: string
  rgbObj: RGB
}

function computeColorValues(rgb: RGB): ColorValues {
  const hex = rgbToHex(rgb)
  const hsl = rgbToHsl(rgb)
  const hsv = rgbToHsv(rgb)

  return {
    hex: hex.toUpperCase(),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    hsv: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`,
    rgbObj: rgb,
  }
}

const FORMAT_META: {
  key: keyof Omit<ColorValues, "rgbObj">
  label: string
  color: string
}[] = [
  { key: "hex", label: "HEX", color: "text-emerald-400" },
  { key: "rgb", label: "RGB", color: "text-blue-400" },
  { key: "hsl", label: "HSL", color: "text-purple-400" },
  { key: "hsv", label: "HSV", color: "text-amber-400" },
]

function ColorConverterPage() {
  const [input, setInput] = useState("")
  const [pickerColor, setPickerColor] = useState("#6366f1")
  const { copy } = useClipboard()

  const debouncedInput = useDebounce(input, 300)

  const { values, detectedFormat, error } = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { values: null, detectedFormat: null, error: "" }
    }

    const format = detectColorFormat(debouncedInput)
    if (!format) {
      return {
        values: null,
        detectedFormat: null,
        error: "Unrecognized color format. Try HEX (#ff0000), RGB (rgb(255,0,0)), HSL, or HSV.",
      }
    }

    const rgb = parseColorInput(debouncedInput)
    if (!rgb) {
      return {
        values: null,
        detectedFormat: format,
        error: "Could not parse color value.",
      }
    }

    return {
      values: computeColorValues(rgb),
      detectedFormat: format,
      error: "",
    }
  }, [debouncedInput])

  const handlePickerChange = (hex: string) => {
    setPickerColor(hex)
    setInput(hex)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    // Sync the color picker if the input is a valid hex
    const rgb = parseColorInput(val)
    if (rgb) {
      setPickerColor(rgbToHex(rgb))
    }
  }

  // Swatch hex value for the preview
  const swatchHex = values ? values.hex : pickerColor

  return (
    <ToolPageLayout
      variant="scroll"
      icon={Palette}
      title="Color Converter"
      description="Convert colors between HEX, RGB, HSL, and HSV formats with a live preview."
      badge="Text / Data"
    >

      {/* Input section */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Color picker */}
            <div className="flex flex-col items-center gap-2">
              <Label
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Picker
              </Label>
              <div className="w-[200px]">
                <AdvancedColorPicker value={pickerColor} onChange={handlePickerChange} />
              </div>
            </div>

            {/* Text input */}
            <div className="flex-1 space-y-2">
              <Label
                htmlFor="color-input"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Color Value
              </Label>
              <Input
                id="color-input"
                value={input}
                onChange={handleInputChange}
                placeholder="#ff6347, rgb(255,99,71), hsl(9,100%,64%), hsv(9,72%,100%)"
                className="font-mono"
              />
              {detectedFormat && !error && (
                <p className="text-xs text-muted-foreground">
                  Detected format:{" "}
                  <span className="font-semibold uppercase text-foreground">
                    {detectedFormat}
                  </span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      <ErrorBanner error={error} />

      {/* Color swatch preview */}
      {values && (
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Preview
            </p>
            <div
              className="h-32 w-full rounded-xl border-2 border-muted shadow-inner"
              style={{ backgroundColor: swatchHex }}
            />
          </CardContent>
        </Card>
      )}

      {/* Conversion results */}
      {values && (
        <div className="grid gap-3 sm:grid-cols-2">
          {FORMAT_META.map(({ key, label, color }) => (
            <Card key={key}>
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className="h-8 w-8 shrink-0 rounded-lg border"
                  style={{ backgroundColor: swatchHex }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wider ${color} mb-0.5`}
                  >
                    {label}
                  </p>
                  <p className="truncate font-mono text-sm text-foreground select-all">
                    {values[key]}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copy(values[key], `${label} copied`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ToolPageLayout>
  )
}
