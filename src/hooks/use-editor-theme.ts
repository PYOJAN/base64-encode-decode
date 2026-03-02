import { useState } from "react"
import type { EditorTheme } from "@/lib/editor-themes"

export function useEditorTheme(defaultTheme: EditorTheme = "dracula") {
  const [theme, setTheme] = useState<EditorTheme>(defaultTheme)
  const [previewTheme, setPreviewTheme] = useState<EditorTheme | null>(null)
  const effectiveTheme = previewTheme ?? theme

  const clearPreview = () => setPreviewTheme(null)

  return { theme, setTheme, previewTheme, setPreviewTheme, effectiveTheme, clearPreview }
}
