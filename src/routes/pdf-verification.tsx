import { Fragment, useMemo, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  BookOpen,
  ExternalLink,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import type { DefaultLayoutPluginOptions, ToolbarConfig } from "@trexolab/verifykit-react"
import { PdfViewer, type PdfViewerOptions } from "@/components/pdf-viewer"
import { PdfDropSurface, WorkbenchLayout } from "@/components"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/pdf-verification")({
  component: PdfVerificationPage,
})

const DEFAULT_WORKER_URL = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`
const DEFAULT_CMAP_URL = `${import.meta.env.BASE_URL}cmaps/`
const DEFAULT_FONT_URL = `${import.meta.env.BASE_URL}standard_fonts/`
const DEFAULT_REVOCATION_ENDPOINT = "https://verifykit.trexolab.com/api/revocation"

const LIBRARY_BLURB =
  "Adobe-style PDF signature verification on a Rust/WASM engine. Every check runs in this browser tab — no document is uploaded anywhere."

const DOC_LINKS = [
  { label: "Quick Start", href: "https://verifykit.trexolab.com/docs/quick-start" },
  { label: "React Guide", href: "https://verifykit.trexolab.com/docs/react" },
  { label: "React API", href: "https://verifykit.trexolab.com/docs/api/react" },
  { label: "Plugins Guide", href: "https://verifykit.trexolab.com/docs/plugins" },
  { label: "Customization", href: "https://verifykit.trexolab.com/docs/customization" },
  { label: "Revocation Guide", href: "https://verifykit.trexolab.com/docs/revocation" },
  { label: "Revocation API", href: "https://verifykit.trexolab.com/docs/api/plugin-revocation" },
]

/**
 * The toolbar controls this page can actually switch off.
 *
 * `ToolbarConfig` is wider than this — it also carries `fitMode`, `scrollMode`,
 * `signaturePanel` and `documentProperties` — but those four cannot be honoured here.
 * The provider's `config.toolbar` is read only by the SDK's legacy `ViewerToolbar`, which
 * `Viewer`/`CoreViewer` never render, so the plugin viewer's sole lever is deleting a
 * `ToolbarSlots` entry (see `applyToolbarVisibility`), and the four have no slot to delete.
 * The two that matter are still reachable from the layout list below: `properties` covers
 * document properties, `signatures` covers the signature panel.
 *
 * `Extract` rather than a bare union so that renaming a key in a future SDK release fails
 * this build instead of silently reintroducing a switch that does nothing.
 */
type ToggleableToolbarKey = Extract<
  keyof ToolbarConfig,
  | "openFile"
  | "pageNavigation"
  | "zoom"
  | "rotation"
  | "search"
  | "print"
  | "download"
  | "themeToggle"
  | "fullscreen"
  | "cursorTool"
  | "moreMenu"
>

const toolbarFields: Array<{
  key: ToggleableToolbarKey
  label: string
  note: string
}> = [
  { key: "openFile", label: "Open File", note: "Hidden by default in the SDK toolbar." },
  { key: "pageNavigation", label: "Page Navigation", note: "Prev/next and page jump controls." },
  { key: "zoom", label: "Zoom", note: "Zoom in/out and percentage presets." },
  { key: "rotation", label: "Rotation", note: "Rotate clockwise and counter-clockwise." },
  { key: "search", label: "Search", note: "Find in document." },
  { key: "print", label: "Print", note: "Browser print action." },
  { key: "download", label: "Download", note: "Hidden by default in the SDK toolbar." },
  { key: "themeToggle", label: "Theme Toggle", note: "Light/dark switch in the toolbar." },
  { key: "fullscreen", label: "Fullscreen", note: "Presentation mode control." },
  { key: "cursorTool", label: "Cursor Tool", note: "Hand/select cursor switching." },
  { key: "moreMenu", label: "More Menu", note: "Overflow menu for extra actions." },
]

/** Shared by the initial state and "Reset settings" so the two cannot drift apart. */
const DEFAULT_TOOLBAR_CONFIG: Record<ToggleableToolbarKey, boolean> = {
  openFile: false,
  pageNavigation: true,
  zoom: true,
  rotation: true,
  search: true,
  print: true,
  download: true,
  themeToggle: true,
  fullscreen: true,
  cursorTool: true,
  moreMenu: true,
}

type LayoutDisableKey = keyof NonNullable<DefaultLayoutPluginOptions["disable"]>

const layoutDisableFields: Array<{
  key: LayoutDisableKey
  label: string
}> = [
  { key: "search", label: "Disable Search Plugin" },
  { key: "print", label: "Disable Print Plugin" },
  { key: "download", label: "Disable Download Plugin" },
  { key: "fullscreen", label: "Disable Fullscreen Plugin" },
  { key: "theme", label: "Disable Theme Plugin" },
  { key: "rotation", label: "Disable Rotation Plugin" },
  { key: "selection", label: "Disable Selection Plugin" },
  { key: "sidebar", label: "Disable Sidebar Plugin" },
  { key: "signatures", label: "Disable Signature Plugin" },
  { key: "highlights", label: "Disable Highlight Plugin" },
  { key: "openFile", label: "Disable Open File Plugin" },
  { key: "properties", label: "Disable Properties Plugin" },
  { key: "shortcuts", label: "Disable Shortcut Help" },
  { key: "contextMenu", label: "Disable Context Menu" },
  { key: "accessibility", label: "Disable Accessibility Plugin" },
]

const providerReference = [
  { name: "workerUrl", type: "string", defaultValue: "required", detail: "PDF.js worker URL. Required in VerifyKitProvider." },
  { name: "cMapUrl", type: "string", defaultValue: "/cmaps/", detail: "CMap assets for non-Latin PDFs." },
  { name: "standardFontDataUrl", type: "string", defaultValue: "/standard_fonts/", detail: "PDF.js standard font assets." },
  { name: "theme.mode", type: "'light' | 'dark' | 'system'", defaultValue: "system", detail: "Viewer theme mode." },
  { name: "theme.overrides", type: "Record<string, string>", defaultValue: "{}", detail: "CSS variable overrides for branding." },
  { name: "embeddedFont", type: "boolean | string", defaultValue: "true", detail: "Bundled font, system stack, or custom font-family string." },
  { name: "toolbar", type: "ToolbarConfig", defaultValue: "mixed", detail: "Visibility model for the toolbar. Read by the legacy ViewerToolbar only — the plugin viewer hides a control by dropping its ToolbarSlots entry, which this page does via toolbar.transform. Keys with no slot (fitMode, scrollMode, signaturePanel, documentProperties) have no effect on Viewer." },
  { name: "locale", type: "string", defaultValue: "en", detail: "Built-in locale code." },
  { name: "translations", type: "Partial<TranslationStrings>", defaultValue: "{}", detail: "Per-key translation overrides." },
  { name: "plugins", type: "VerifyKitPlugin[]", defaultValue: "[]", detail: "Core plugins array (inherited from VerifyKitCoreConfig). The revocation plugin is passed here." },
  { name: "enableAIA", type: "boolean", defaultValue: "true", detail: "Automatic AIA certificate chasing. Set false to block network fetches during verification." },
  { name: "algorithmPolicy", type: "AlgorithmPolicy", defaultValue: "Adobe parity", detail: "Since 0.5.3 SHA-1 reads as valid with an algorithmName disclosure. Pass { sha1: 'warn' } for a stricter policy. MD5/MD2/MD4 stay invalid and are not configurable." },
  { name: "trustStore", type: "TrustStoreConfig", defaultValue: "bundled", detail: "Trust anchors used for chain building. Contents live in WASM and are no longer readable from JS." },
]

const layoutReference = [
  { name: "disable", type: "Record<LayoutDisableKey, boolean>", defaultValue: "{}", detail: "Turns off individual plugins. Since 0.7.0 disabling a plugin also removes its overflow-menu entry." },
  { name: "zoom", type: "ZoomPluginOptions", defaultValue: "25%-1000%", detail: "minScale / maxScale / step. Range widened from 40%-500% in 0.5.3 to match pdf.js." },
  { name: "accessibility", type: "AccessibilityPluginOptions", defaultValue: "persist: true", detail: "initialScale ('compact' | 'default' | 'large' | 'extra-large') and whether the choice is saved to localStorage." },
  { name: "toolbar.transform", type: "(slots) => slots", defaultValue: "identity", detail: "Add, remove, or reorder toolbar slots. A slot removed here is also withheld from the overflow menu." },
]

const viewerReference = [
  { name: "fileBuffer", type: "ArrayBuffer | null", detail: "PDF bytes passed into <Viewer>." },
  { name: "fileName", type: "string", detail: "Display name used by the viewer." },
  { name: "plugins", type: "ViewerPlugin[]", detail: "Installed viewer plugins, commonly defaultLayoutPlugin()." },
  { name: "initialState", type: "Partial<ViewerStoreState>", detail: "Initial viewer store overrides." },
  { name: "signatures", type: "PdfSignature[]", detail: "Verification results passed into the viewer UI." },
  { name: "unsignedFields", type: "UnsignedSigField[]", detail: "Unsigned form signature fields." },
  { name: "verificationStatus", type: "VerificationStatus", detail: "Document-level verification status pill." },
  { name: "signaturePanelOpen", type: "boolean", detail: "Initial signature drawer state." },
  { name: "onOpenFile", type: "(file: File) => void", detail: "Required for the open-file toolbar action." },
  { name: "verifying", type: "boolean", detail: "Controls the verification progress floater." },
  { name: "isActive", type: "boolean", detail: "Tab isolation. Default true; set false for a viewer in a background tab." },
  { name: "onLoadError", type: "(error: LoadError) => void", detail: "LoadError is { name, message } — a plain object, not an Error instance." },
]

const revocationReference = [
  { name: "endpoint", type: "string", detail: "Proxy endpoint for browser-safe CRL/OCSP checks." },
  { name: "timeout", type: "number", detail: "Timeout in milliseconds. Default 10000." },
  { name: "crl", type: "boolean", detail: "Enable CRL checks. Default true." },
  { name: "ocsp", type: "boolean", detail: "Enable OCSP checks. Default true." },
  { name: "maxCrlSize", type: "number", detail: "Maximum CRL payload size in bytes. Default 10485760." },
  { name: "headers", type: "Record<string, string> | (() => Record<string, string>)", detail: "Custom proxy request headers in browser mode." },
  { name: "onError", type: "(error, context) => void", detail: "Code-level callback for revocation request failures." },
]

function PdfVerificationPage() {
  const [pdfData, setPdfData] = useState("")
  const [fileName, setFileName] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [readingName, setReadingName] = useState("")

  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL)
  const [cMapUrl, setCMapUrl] = useState(DEFAULT_CMAP_URL)
  const [standardFontDataUrl, setStandardFontDataUrl] = useState(DEFAULT_FONT_URL)
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system")
  const [embeddedFontMode, setEmbeddedFontMode] = useState<"bundled" | "system" | "custom">("bundled")
  const [customFontFamily, setCustomFontFamily] = useState("")
  const [locale, setLocale] = useState("en")
  const [themeOverridesText, setThemeOverridesText] = useState("")
  const [translationsText, setTranslationsText] = useState("")
  const [revocationHeadersText, setRevocationHeadersText] = useState("")

  const [signaturePanelOpen, setSignaturePanelOpen] = useState(true)
  const [revocationEnabled, setRevocationEnabled] = useState(true)
  const [revocationEndpoint, setRevocationEndpoint] = useState(DEFAULT_REVOCATION_ENDPOINT)
  const [revocationTimeout, setRevocationTimeout] = useState("10000")
  const [maxCrlSizeMb, setMaxCrlSizeMb] = useState("10")
  const [revocationCrl, setRevocationCrl] = useState(true)
  const [revocationOcsp, setRevocationOcsp] = useState(true)

  const [toolbarConfig, setToolbarConfig] = useState<Record<ToggleableToolbarKey, boolean>>(
    DEFAULT_TOOLBAR_CONFIG
  )

  const [layoutDisable, setLayoutDisable] = useState<Record<LayoutDisableKey, boolean>>({
    search: false,
    print: false,
    download: false,
    fullscreen: false,
    theme: false,
    rotation: false,
    selection: false,
    sidebar: false,
    signatures: false,
    highlights: false,
    openFile: false,
    properties: false,
    shortcuts: false,
    contextMenu: false,
    accessibility: false,
  })

  const themeOverrides = useMemo(
    () => parseJsonRecord(themeOverridesText, "Theme overrides"),
    [themeOverridesText]
  )
  const translations = useMemo(
    () => parseJsonRecord(translationsText, "Translations"),
    [translationsText]
  )
  const revocationHeaders = useMemo(
    () => parseJsonRecord(revocationHeadersText, "Revocation headers"),
    [revocationHeadersText]
  )

  const viewerOptions = useMemo<PdfViewerOptions>(
    () => ({
      provider: {
        workerUrl: workerUrl.trim() || DEFAULT_WORKER_URL,
        cMapUrl: cMapUrl.trim() || DEFAULT_CMAP_URL,
        standardFontDataUrl: standardFontDataUrl.trim() || DEFAULT_FONT_URL,
        theme: {
          mode: themeMode,
          overrides: themeOverrides.value ?? undefined,
        },
        embeddedFont:
          embeddedFontMode === "bundled"
            ? true
            : embeddedFontMode === "system"
              ? false
              : customFontFamily.trim() || true,
        locale: locale.trim() || undefined,
        translations: translations.value ?? undefined,
        toolbar: toolbarConfig,
      },
      layout: {
        disable: layoutDisable,
      },
      signaturePanelOpen,
      revocation: {
        enabled: revocationEnabled,
        endpoint: revocationEndpoint.trim() || DEFAULT_REVOCATION_ENDPOINT,
        timeout: toPositiveNumber(revocationTimeout),
        crl: revocationCrl,
        ocsp: revocationOcsp,
        maxCrlSize: Math.max(1, toPositiveNumber(maxCrlSizeMb, 10)) * 1024 * 1024,
        headers: revocationHeaders.value ?? undefined,
      },
    }),
    [
      cMapUrl,
      customFontFamily,
      embeddedFontMode,
      layoutDisable,
      locale,
      maxCrlSizeMb,
      revocationCrl,
      revocationEnabled,
      revocationEndpoint,
      revocationHeaders.value,
      revocationOcsp,
      revocationTimeout,
      signaturePanelOpen,
      standardFontDataUrl,
      themeMode,
      themeOverrides.value,
      toolbarConfig,
      translations.value,
      workerUrl,
    ]
  )
  const renderCounter = useRef(0)
  const viewerRenderKey = useMemo(() => {
    renderCounter.current += 1
    return renderCounter.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOptions])

  const configWarnings = [
    themeOverrides.error,
    translations.error,
    revocationHeaders.error,
  ].filter(Boolean) as string[]
  const enabledToolbarCount = Object.values(toolbarConfig).filter(Boolean).length
  const disabledLayoutCount = Object.values(layoutDisable).filter(Boolean).length
  const hasPdf = Boolean(pdfData)
  const verificationModeLabel = revocationEnabled ? "Online validation" : "Offline validation"

  const handleFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

    if (!isPdf) {
      setUploadError("Only PDF files are supported for verification.")
      return
    }

    setUploadError("")
    setReadingName(file.name)

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPdfData(dataUrl)
      setFileName(file.name)
    } catch {
      setUploadError("That file could not be read. Try selecting it again.")
    } finally {
      setReadingName("")
    }
  }

  const clearPdf = () => {
    setPdfData("")
    setFileName("")
    setUploadError("")
  }

  const resetSettings = () => {
    setWorkerUrl(DEFAULT_WORKER_URL)
    setCMapUrl(DEFAULT_CMAP_URL)
    setStandardFontDataUrl(DEFAULT_FONT_URL)
    setThemeMode("system")
    setEmbeddedFontMode("bundled")
    setCustomFontFamily("")
    setLocale("en")
    setThemeOverridesText("")
    setTranslationsText("")
    setRevocationHeadersText("")
    setSignaturePanelOpen(true)
    setRevocationEnabled(true)
    setRevocationEndpoint(DEFAULT_REVOCATION_ENDPOINT)
    setRevocationTimeout("10000")
    setMaxCrlSizeMb("10")
    setRevocationCrl(true)
    setRevocationOcsp(true)
    setToolbarConfig(DEFAULT_TOOLBAR_CONFIG)
    setLayoutDisable({
      search: false,
      print: false,
      download: false,
      fullscreen: false,
      theme: false,
      rotation: false,
      selection: false,
      sidebar: false,
      signatures: false,
      highlights: false,
      openFile: false,
      properties: false,
      shortcuts: false,
      contextMenu: false,
      accessibility: false,
    })
  }

  return (
    <WorkbenchLayout
      title="PDF Verification"
      status={
        <>
          <div className="flex shrink-0 items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                revocationEnabled ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
            <span className="text-xs font-medium">{verificationModeLabel}</span>
          </div>

          {hasPdf && (
            <>
              <span className="hidden h-4 w-px shrink-0 bg-border sm:block" />
              <span
                className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                title={fileName}
              >
                {fileName}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {signaturePanelOpen ? "Panel open" : "Panel closed"}
              </span>
            </>
          )}
        </>
      }
      actions={
        <>
          <DocsMenu />
          {hasPdf && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearPdf}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm">
                <Settings2 className="mr-1.5 h-4 w-4" />
                Open Settings
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b px-6 py-5">
                  <SheetTitle>Verification Settings</SheetTitle>
                  <SheetDescription>
                    Full VerifyKit controls live here so the page can stay centered on the PDF viewer.
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 p-4">
                  <Tabs defaultValue="verify" className="flex h-full flex-col gap-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="verify">Verify</TabsTrigger>
                      <TabsTrigger value="viewer">Viewer</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                      <TabsTrigger value="links">Links</TabsTrigger>
                    </TabsList>
                    <ScrollArea className="min-h-0 flex-1 pr-3">
                      <TabsContent value="verify" className="mt-0 space-y-4">
                        <InspectorSection
                          title="Verification defaults"
                          description="Use this tab for trust checks and the initial review flow."
                        >
                          <div className="grid gap-2">
                            <MiniToggle checked={signaturePanelOpen} label="Open signature panel" onChange={setSignaturePanelOpen} />
                            <MiniToggle checked={revocationEnabled} label="Enable revocation plugin" onChange={setRevocationEnabled} />
                          </div>
                          <Field label="Revocation endpoint">
                            <Input value={revocationEndpoint} onChange={(e) => setRevocationEndpoint(e.target.value)} />
                          </Field>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="timeout (ms)">
                              <Input value={revocationTimeout} onChange={(e) => setRevocationTimeout(e.target.value)} />
                            </Field>
                            <Field label="maxCrlSize (MB)">
                              <Input value={maxCrlSizeMb} onChange={(e) => setMaxCrlSizeMb(e.target.value)} />
                            </Field>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <MiniToggle checked={revocationCrl} label="Use CRL" onChange={setRevocationCrl} />
                            <MiniToggle checked={revocationOcsp} label="Use OCSP" onChange={setRevocationOcsp} />
                          </div>
                          <Field label="locale">
                            <Input value={locale} onChange={(e) => setLocale(e.target.value)} />
                          </Field>
                        </InspectorSection>
                      </TabsContent>

                      <TabsContent value="viewer" className="mt-0 space-y-4">
                        <InspectorSection
                          title="Display settings"
                          description="Visual settings stay separate from trust settings."
                        >
                          <Field label="theme.mode">
                            <select
                              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                              value={themeMode}
                              onChange={(e) => setThemeMode(e.target.value as "light" | "dark" | "system")}
                            >
                              <option value="system">system</option>
                              <option value="light">light</option>
                              <option value="dark">dark</option>
                            </select>
                          </Field>
                          <Field label="embeddedFont">
                            <select
                              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                              value={embeddedFontMode}
                              onChange={(e) => setEmbeddedFontMode(e.target.value as "bundled" | "system" | "custom")}
                            >
                              <option value="bundled">Bundled VerifyKit font</option>
                              <option value="system">System font stack</option>
                              <option value="custom">Custom font-family</option>
                            </select>
                          </Field>
                          {embeddedFontMode === "custom" && (
                            <Field label="custom font-family">
                              <Input
                                value={customFontFamily}
                                onChange={(e) => setCustomFontFamily(e.target.value)}
                                placeholder='"IBM Plex Sans", sans-serif'
                              />
                            </Field>
                          )}
                        </InspectorSection>

                        <InspectorSection
                          title="Viewer modules"
                          description="Open detailed module maps only when you need them."
                        >
                          <Collapsible defaultOpen>
                            <div className="rounded-2xl border">
                              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
                                <span>Toolbar controls</span>
                                <Badge variant="secondary">{enabledToolbarCount} enabled</Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="border-t px-3 py-3">
                                <div className="grid gap-2">
                                  {toolbarFields.map((field) => (
                                    <MiniToggle
                                      key={field.key}
                                      checked={toolbarConfig[field.key]}
                                      label={field.label}
                                      onChange={(checked) =>
                                        setToolbarConfig((current) => ({ ...current, [field.key]: checked }))
                                      }
                                    />
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>

                          <Collapsible>
                            <div className="rounded-2xl border">
                              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
                                <span>Disabled layout plugins</span>
                                <Badge variant="secondary">{disabledLayoutCount} disabled</Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="border-t px-3 py-3">
                                <div className="grid gap-2">
                                  {layoutDisableFields.map((field) => (
                                    <MiniToggle
                                      key={field.key}
                                      checked={layoutDisable[field.key]}
                                      label={field.label}
                                      onChange={(checked) =>
                                        setLayoutDisable((current) => ({ ...current, [field.key]: checked }))
                                      }
                                    />
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        </InspectorSection>
                      </TabsContent>

                      <TabsContent value="advanced" className="mt-0 space-y-4">
                        <InspectorSection
                          title="Asset and provider overrides"
                          description="Deep SDK hooks and PDF.js asset mappings."
                        >
                          <Field label="workerUrl">
                            <Input value={workerUrl} onChange={(e) => setWorkerUrl(e.target.value)} />
                          </Field>
                          <Field label="cMapUrl">
                            <Input value={cMapUrl} onChange={(e) => setCMapUrl(e.target.value)} />
                          </Field>
                          <Field label="standardFontDataUrl">
                            <Input value={standardFontDataUrl} onChange={(e) => setStandardFontDataUrl(e.target.value)} />
                          </Field>
                          <Field label="theme.overrides JSON">
                            <Textarea
                              rows={4}
                              className="resize-none font-mono text-xs"
                              value={themeOverridesText}
                              onChange={(e) => setThemeOverridesText(e.target.value)}
                              placeholder={"{\n  \"--vk-accent\": \"#0f766e\"\n}"}
                            />
                          </Field>
                          <Field label="translations JSON">
                            <Textarea
                              rows={4}
                              className="resize-none font-mono text-xs"
                              value={translationsText}
                              onChange={(e) => setTranslationsText(e.target.value)}
                              placeholder={"{\n  \"panel.signatures\": \"Signature Results\"\n}"}
                            />
                          </Field>
                          <Field label="headers JSON">
                            <Textarea
                              rows={4}
                              className="resize-none font-mono text-xs"
                              value={revocationHeadersText}
                              onChange={(e) => setRevocationHeadersText(e.target.value)}
                              placeholder={"{\n  \"x-demo-key\": \"verifykit\"\n}"}
                            />
                          </Field>
                        </InspectorSection>
                      </TabsContent>

                      <TabsContent value="links" className="mt-0 space-y-4">
                        <InspectorSection
                          title="Knowledge links"
                          description="Direct VerifyKit links, plus the API coverage used by this page."
                        >
                          <div className="grid gap-2">
                            {DOC_LINKS.map((link) => (
                              <Button key={link.href} asChild variant="outline" className="justify-start">
                                <a href={link.href} target="_blank" rel="noopener noreferrer">
                                  <BookOpen className="mr-2 h-4 w-4" />
                                  {link.label}
                                </a>
                              </Button>
                            ))}
                          </div>
                        </InspectorSection>
                        <ReferenceList title="VerifyKitProvider / VerifyKitConfig" items={providerReference} />
                        <ReferenceList title="Viewer Props" items={viewerReference} />
                        <ReferenceList title="defaultLayoutPlugin Options" items={layoutReference} />
                        <ReferenceList title="revocationPlugin Options" items={revocationReference} />
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </div>
                <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
                  <p className="text-xs text-muted-foreground">
                    Restore every SDK control to its default.
                  </p>
                  <Button variant="outline" size="sm" onClick={resetSettings}>
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Reset settings
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      }
      banner={
        configWarnings.length > 0 ? (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:px-4">
            <p className="text-xs text-amber-900 dark:text-amber-100">
              Invalid JSON overrides ignored — {configWarnings.join(" ")}
            </p>
          </div>
        ) : undefined
      }
    >
      {pdfData ? (
        <PdfViewer
          bare
          key={viewerRenderKey}
          data={pdfData}
          title={fileName || "Verification Preview"}
          className="h-full"
          onOpenFile={handleFile}
          viewerOptions={viewerOptions}
        />
      ) : (
        <PdfDropSurface
          onFile={handleFile}
          onReject={() => setUploadError("Only PDF files are supported for verification.")}
          title="Verify a signed PDF"
          subtitle="Drop a document anywhere on this panel, or browse from your device. Signatures, certificate chains, and revocation are all checked locally."
          error={uploadError}
          busy={Boolean(readingName)}
          busyLabel={`Reading ${readingName}`}
          footer={<VerifyKitFooter />}
        />
      )}
    </WorkbenchLayout>
  )
}

function DocsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="mr-1.5 h-4 w-4" />
          Docs
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>VerifyKit docs</span>
          <span className="text-xs font-normal text-muted-foreground">
            v{__VERIFYKIT_VERSION__} &middot; runs fully in-browser
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DOC_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              {link.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function VerifyKitFooter() {
  return (
    <div className="shrink-0 border-t px-4 py-3">
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Powered by{" "}
        <span className="font-medium text-foreground">VerifyKit v{__VERIFYKIT_VERSION__}</span>{" "}
        &mdash; {LIBRARY_BLURB}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-y-1 text-xs">
        {DOC_LINKS.map((link, index) => (
          <Fragment key={link.href}>
            {index > 0 && <span className="px-1 text-muted-foreground/40">&middot;</span>}
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-primary underline-offset-4 hover:underline"
            >
              {link.label}
            </a>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ReferenceList({
  title,
  items,
}: {
  title: string
  items: Array<{ name: string; type: string; defaultValue?: string; detail: string }>
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs font-semibold">{item.name}</code>
              <Badge variant="secondary" className="font-mono text-[10px]">{item.type}</Badge>
              {item.defaultValue && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  default: {item.defaultValue}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function InspectorSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function MiniToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <span className="pr-3">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function parseJsonRecord(
  value: string,
  label: string
): { value: Record<string, string> | undefined; error: string | null } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: undefined, error: null }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { value: undefined, error: `${label} must be a JSON object.` }
    }

    return { value: parsed as Record<string, string>, error: null }
  } catch {
    return { value: undefined, error: `${label} contains invalid JSON.` }
  }
}

function toPositiveNumber(value: string, fallback = 10000) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
