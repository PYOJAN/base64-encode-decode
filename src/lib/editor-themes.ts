import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { oneDark } from "@codemirror/theme-one-dark"
import type { Extension } from "@codemirror/state"

// ── Theme definitions ──

function makeTheme(
  chrome: Parameters<typeof EditorView.theme>[0],
  highlights: Parameters<typeof HighlightStyle.define>[0]
): Extension {
  return [
    EditorView.theme(chrome, { dark: true }),
    syntaxHighlighting(HighlightStyle.define(highlights)),
  ]
}

const dracula = makeTheme(
  {
    "&": { backgroundColor: "#282a36", color: "#f8f8f2" },
    ".cm-content": { caretColor: "#f8f8f0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f8f8f0" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#44475a" },
    ".cm-panels": { backgroundColor: "#21222c", color: "#f8f8f2" },
    ".cm-gutters": { backgroundColor: "#282a36", color: "#6272a4", borderRight: "1px solid #44475a" },
    ".cm-activeLineGutter": { backgroundColor: "#44475a" },
    ".cm-activeLine": { backgroundColor: "#44475a33" },
    ".cm-foldPlaceholder": { backgroundColor: "#44475a", border: "none", color: "#6272a4" },
    ".cm-matchingBracket": { backgroundColor: "#44475a", color: "#f8f8f2 !important" },
  },
  [
    { tag: tags.keyword, color: "#ff79c6" },
    { tag: [tags.string, tags.special(tags.brace)], color: "#f1fa8c" },
    { tag: tags.number, color: "#bd93f9" },
    { tag: tags.bool, color: "#bd93f9" },
    { tag: tags.null, color: "#bd93f9" },
    { tag: tags.propertyName, color: "#66d9ef" },
    { tag: tags.comment, color: "#6272a4" },
    { tag: tags.operator, color: "#ff79c6" },
    { tag: tags.punctuation, color: "#f8f8f2" },
    { tag: tags.bracket, color: "#f8f8f2" },
    { tag: tags.tagName, color: "#ff79c6" },
    { tag: tags.attributeName, color: "#50fa7b" },
    { tag: tags.attributeValue, color: "#f1fa8c" },
    { tag: tags.angleBracket, color: "#f8f8f2" },
  ]
)

const nightOwl = makeTheme(
  {
    "&": { backgroundColor: "#011627", color: "#d6deeb" },
    ".cm-content": { caretColor: "#80a4c2" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#80a4c2" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#1d3b53" },
    ".cm-panels": { backgroundColor: "#011627", color: "#d6deeb" },
    ".cm-gutters": { backgroundColor: "#011627", color: "#4b6479", borderRight: "1px solid #1d3b53" },
    ".cm-activeLineGutter": { backgroundColor: "#1d3b53" },
    ".cm-activeLine": { backgroundColor: "#1d3b5333" },
    ".cm-foldPlaceholder": { backgroundColor: "#1d3b53", border: "none", color: "#4b6479" },
    ".cm-matchingBracket": { backgroundColor: "#1d3b53", color: "#d6deeb !important" },
  },
  [
    { tag: tags.keyword, color: "#c792ea" },
    { tag: [tags.string, tags.special(tags.brace)], color: "#ecc48d" },
    { tag: tags.number, color: "#f78c6c" },
    { tag: tags.bool, color: "#ff5874" },
    { tag: tags.null, color: "#ff5874" },
    { tag: tags.propertyName, color: "#7fdbca" },
    { tag: tags.comment, color: "#637777", fontStyle: "italic" },
    { tag: tags.operator, color: "#c792ea" },
    { tag: tags.punctuation, color: "#d6deeb" },
    { tag: tags.bracket, color: "#d6deeb" },
    { tag: tags.tagName, color: "#caece6" },
    { tag: tags.attributeName, color: "#addb67" },
    { tag: tags.attributeValue, color: "#ecc48d" },
    { tag: tags.angleBracket, color: "#7fdbca" },
  ]
)

const githubDark = makeTheme(
  {
    "&": { backgroundColor: "#0d1117", color: "#e6edf3" },
    ".cm-content": { caretColor: "#58a6ff" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#58a6ff" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#264f78" },
    ".cm-panels": { backgroundColor: "#161b22", color: "#e6edf3" },
    ".cm-gutters": { backgroundColor: "#0d1117", color: "#484f58", borderRight: "1px solid #21262d" },
    ".cm-activeLineGutter": { backgroundColor: "#161b22" },
    ".cm-activeLine": { backgroundColor: "#161b2266" },
    ".cm-foldPlaceholder": { backgroundColor: "#21262d", border: "none", color: "#484f58" },
    ".cm-matchingBracket": { backgroundColor: "#264f78", color: "#e6edf3 !important" },
  },
  [
    { tag: tags.keyword, color: "#ff7b72" },
    { tag: [tags.string, tags.special(tags.brace)], color: "#a5d6ff" },
    { tag: tags.number, color: "#79c0ff" },
    { tag: tags.bool, color: "#79c0ff" },
    { tag: tags.null, color: "#79c0ff" },
    { tag: tags.propertyName, color: "#7ee787" },
    { tag: tags.comment, color: "#8b949e" },
    { tag: tags.operator, color: "#ff7b72" },
    { tag: tags.punctuation, color: "#e6edf3" },
    { tag: tags.bracket, color: "#e6edf3" },
    { tag: tags.tagName, color: "#7ee787" },
    { tag: tags.attributeName, color: "#79c0ff" },
    { tag: tags.attributeValue, color: "#a5d6ff" },
    { tag: tags.angleBracket, color: "#e6edf3" },
  ]
)

const monokai = makeTheme(
  {
    "&": { backgroundColor: "#272822", color: "#f8f8f2" },
    ".cm-content": { caretColor: "#f8f8f0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f8f8f0" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#49483e" },
    ".cm-panels": { backgroundColor: "#272822", color: "#f8f8f2" },
    ".cm-gutters": { backgroundColor: "#272822", color: "#75715e", borderRight: "1px solid #3e3d32" },
    ".cm-activeLineGutter": { backgroundColor: "#3e3d32" },
    ".cm-activeLine": { backgroundColor: "#3e3d3233" },
    ".cm-foldPlaceholder": { backgroundColor: "#3e3d32", border: "none", color: "#75715e" },
    ".cm-matchingBracket": { backgroundColor: "#49483e", color: "#f8f8f2 !important" },
  },
  [
    { tag: tags.keyword, color: "#f92672" },
    { tag: [tags.string, tags.special(tags.brace)], color: "#e6db74" },
    { tag: tags.number, color: "#ae81ff" },
    { tag: tags.bool, color: "#ae81ff" },
    { tag: tags.null, color: "#ae81ff" },
    { tag: tags.propertyName, color: "#a6e22e" },
    { tag: tags.comment, color: "#75715e" },
    { tag: tags.operator, color: "#f92672" },
    { tag: tags.punctuation, color: "#f8f8f2" },
    { tag: tags.bracket, color: "#f8f8f2" },
    { tag: tags.tagName, color: "#f92672" },
    { tag: tags.attributeName, color: "#a6e22e" },
    { tag: tags.attributeValue, color: "#e6db74" },
    { tag: tags.angleBracket, color: "#f8f8f2" },
  ]
)

// ── Exports ──

export type EditorTheme = "one-dark" | "dracula" | "night-owl" | "github-dark" | "monokai"

export const EDITOR_THEMES: { id: EditorTheme; label: string }[] = [
  { id: "one-dark", label: "One Dark" },
  { id: "dracula", label: "Dracula" },
  { id: "night-owl", label: "Night Owl" },
  { id: "github-dark", label: "GitHub Dark" },
  { id: "monokai", label: "Monokai" },
]

export function getThemeExtension(id: EditorTheme): Extension {
  switch (id) {
    case "one-dark":
      return oneDark
    case "dracula":
      return dracula
    case "night-owl":
      return nightOwl
    case "github-dark":
      return githubDark
    case "monokai":
      return monokai
  }
}

const THEME_ACCENT_COLORS: Record<EditorTheme, string> = {
  "one-dark": "#282c34",
  "dracula": "#282a36",
  "night-owl": "#011627",
  "github-dark": "#0d1117",
  "monokai": "#272822",
}

export function getThemeAccentColor(id: EditorTheme): string {
  return THEME_ACCENT_COLORS[id]
}
