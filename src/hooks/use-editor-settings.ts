import { useState, useCallback } from "react"

export interface EditorSettings {
  showLineNumbers: boolean
  lineWrapping: boolean
}

const STORAGE_KEY = "editor-settings"

const DEFAULTS: EditorSettings = {
  showLineNumbers: false,
  lineWrapping: true,
}

function load(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch (e) {
    console.warn("Failed to load editor settings:", e)
  }
  return DEFAULTS
}

export function useEditorSettings() {
  const [settings, setSettingsRaw] = useState<EditorSettings>(load)

  const update = useCallback((patch: Partial<EditorSettings>) => {
    setSettingsRaw((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const toggleLineNumbers = useCallback(() => {
    setSettingsRaw((prev) => {
      const next = { ...prev, showLineNumbers: !prev.showLineNumbers }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  const toggleLineWrapping = useCallback(() => {
    setSettingsRaw((prev) => {
      const next = { ...prev, lineWrapping: !prev.lineWrapping }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, update, toggleLineNumbers, toggleLineWrapping }
}
