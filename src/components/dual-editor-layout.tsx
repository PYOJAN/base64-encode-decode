import { CodeEditor } from "@/components/code-editor"
import type { EditorTheme } from "@/lib/editor-themes"
import type { EditorSettings } from "@/hooks"

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
  editorSettings?: EditorSettings
}

function EditorPane({
  config,
  theme,
  editorSettings,
}: {
  config: EditorPaneConfig
  theme?: EditorTheme
  editorSettings?: EditorSettings
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
          showLineNumbers={editorSettings?.showLineNumbers}
          lineWrapping={editorSettings?.lineWrapping}
        />
      </div>
    </div>
  )
}

export function DualEditorLayout({
  left,
  right,
  theme,
  editorSettings,
}: DualEditorLayoutProps) {
  return (
    <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-2">
      <EditorPane config={left} theme={theme} editorSettings={editorSettings} />
      <EditorPane config={right} theme={theme} editorSettings={editorSettings} />
    </div>
  )
}
