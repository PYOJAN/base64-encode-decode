import { CodeEditor } from "@/components/code-editor"
import type { EditorTheme } from "@/lib/editor-themes"

type Language = "json" | "xml" | "yaml" | "javascript" | "css" | "text"

interface EditorPaneConfig {
  label: string
  value: string
  onChange?: (value: string) => void
  language?: Language
  readOnly?: boolean
  placeholder?: string
}

interface DualEditorLayoutProps {
  left: EditorPaneConfig
  right: EditorPaneConfig
  theme?: EditorTheme
}

function EditorPane({
  config,
  theme,
}: {
  config: EditorPaneConfig
  theme?: EditorTheme
}) {
  return (
    <div className="flex flex-col min-h-0 gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        {config.label}
      </label>
      <div className="flex-1 min-h-[200px]">
        <CodeEditor
          value={config.value}
          onChange={config.onChange}
          language={config.language}
          readOnly={config.readOnly}
          placeholder={config.placeholder}
          fillHeight
          theme={theme}
        />
      </div>
    </div>
  )
}

export function DualEditorLayout({
  left,
  right,
  theme,
}: DualEditorLayoutProps) {
  return (
    <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-2">
      <EditorPane config={left} theme={theme} />
      <EditorPane config={right} theme={theme} />
    </div>
  )
}
