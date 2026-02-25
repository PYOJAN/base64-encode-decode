import { useEffect, useRef } from "react"
import { EditorView, keymap, placeholder as phPlugin } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { json } from "@codemirror/lang-json"
import { xml } from "@codemirror/lang-xml"
import { yaml } from "@codemirror/lang-yaml"
import { javascript } from "@codemirror/lang-javascript"
import { css } from "@codemirror/lang-css"
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from "@codemirror/language"
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from "@codemirror/view"
import { type EditorTheme, getThemeExtension } from "@/lib/editor-themes"

type Language = "json" | "xml" | "yaml" | "javascript" | "css" | "text"

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: Language
  readOnly?: boolean
  placeholder?: string
  className?: string
  minHeight?: string
  fillHeight?: boolean
  theme?: EditorTheme
}

const langExtensions: Record<Language, (() => ReturnType<typeof json>) | null> = {
  json,
  xml,
  yaml,
  javascript,
  css,
  text: null,
}

export function CodeEditor({
  value,
  onChange,
  language = "json",
  readOnly = false,
  placeholder = "",
  className,
  minHeight = "200px",
  fillHeight = false,
  theme = "dracula",
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const langExt = langExtensions[language]

    const themeStyles: Record<string, Record<string, string>> = {

      "&": { minHeight, fontSize: "14px" },
      ".cm-scroller": { overflow: "auto" },
    }

    if (fillHeight) {
      themeStyles["&"]!["height"] = "100%"
      themeStyles["&"]!["maxHeight"] = "none"
    } else {
      themeStyles["&"]!["maxHeight"] = "70vh"
    }

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      foldGutter(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      getThemeExtension(theme),
      ...(langExt ? [langExt()] : []),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      EditorView.theme(themeStyles),
    ]

    if (placeholder) {
      extensions.push(phPlugin(placeholder))
    }

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true))
    } else if (onChange) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())
          }
        })
      )
    }

    const state = EditorState.create({ doc: value, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Re-create editor when language, readOnly, or theme changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly, theme])

  // Sync external value changes without re-creating the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-md border ${fillHeight ? "h-full" : ""} ${className ?? ""}`}
    />
  )
}
