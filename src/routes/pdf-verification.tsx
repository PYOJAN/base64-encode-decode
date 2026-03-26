import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  BookOpen,
  FileCheck2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import type { DefaultLayoutPluginOptions, ToolbarConfig } from "@trexolab/verifykit-react"
import { PdfViewer, type PdfViewerOptions } from "@/components/pdf-viewer"
import { FileDropzone } from "@/components/file-dropzone"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
import { ToolPageLayout } from "@/components"

export const Route = createFileRoute("/pdf-verification")({
  component: PdfVerificationPage,
})

const DEFAULT_WORKER_URL = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`
const DEFAULT_CMAP_URL = `${import.meta.env.BASE_URL}cmaps/`
const DEFAULT_FONT_URL = `${import.meta.env.BASE_URL}standard_fonts/`
const DEFAULT_REVOCATION_ENDPOINT = "https://verifykit.trexolab.com/api/revocation"

const DOC_LINKS = [
  { label: "React Guide", href: "https://verifykit.trexolab.com/docs/react" },
  { label: "React API", href: "https://verifykit.trexolab.com/docs/api/react" },
  { label: "Revocation Guide", href: "https://verifykit.trexolab.com/docs/revocation" },
  { label: "Revocation API", href: "https://verifykit.trexolab.com/docs/api/plugin-revocation" },
]

const toolbarFields: Array<{
  key: keyof ToolbarConfig
  label: string
  note: string
}> = [
  { key: "openFile", label: "Open File", note: "Hidden by default in the SDK toolbar." },
  { key: "pageNavigation", label: "Page Navigation", note: "Prev/next and page jump controls." },
  { key: "zoom", label: "Zoom", note: "Zoom in/out and percentage presets." },
  { key: "fitMode", label: "Fit Mode", note: "Fit width and fit page toggles." },
  { key: "rotation", label: "Rotation", note: "Rotate clockwise and counter-clockwise." },
  { key: "scrollMode", label: "Scroll Mode", note: "Vertical, horizontal, wrapped, and page modes." },
  { key: "search", label: "Search", note: "Find in document." },
  { key: "print", label: "Print", note: "Browser print action." },
  { key: "download", label: "Download", note: "Hidden by default in the SDK toolbar." },
  { key: "themeToggle", label: "Theme Toggle", note: "Light/dark switch in the toolbar." },
  { key: "fullscreen", label: "Fullscreen", note: "Presentation mode control." },
  { key: "signaturePanel", label: "Signature Panel", note: "Signature drawer toggle." },
  { key: "cursorTool", label: "Cursor Tool", note: "Hand/select cursor switching." },
  { key: "moreMenu", label: "More Menu", note: "Overflow menu for extra actions." },
  { key: "documentProperties", label: "Document Properties", note: "Show document metadata modal." },
]

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
  { name: "toolbar", type: "ToolbarConfig", defaultValue: "mixed", detail: "Visibility model for all toolbar controls." },
  { name: "locale", type: "string", defaultValue: "en", detail: "Built-in locale code." },
  { name: "translations", type: "Partial<TranslationStrings>", defaultValue: "{}", detail: "Per-key translation overrides." },
]

const viewerReference = [
  { name: "fileBuffer", type: "ArrayBuffer", detail: "PDF bytes passed into <Viewer>." },
  { name: "fileName", type: "string", detail: "Display name used by the viewer." },
  { name: "plugins", type: "ViewerPlugin[]", detail: "Installed viewer plugins, commonly defaultLayoutPlugin()." },
  { name: "initialState", type: "Partial<ViewerStoreState>", detail: "Initial viewer store overrides." },
  { name: "signatures", type: "PdfSignature[]", detail: "Verification results passed into the viewer UI." },
  { name: "unsignedFields", type: "UnsignedSigField[]", detail: "Unsigned form signature fields." },
  { name: "verificationStatus", type: "VerificationStatus", detail: "Document-level verification status pill." },
  { name: "signaturePanelOpen", type: "boolean", detail: "Initial signature drawer state." },
  { name: "onOpenFile", type: "(file: File) => void", detail: "Required for the open-file toolbar action." },
  { name: "verifying", type: "boolean", detail: "Controls the verification progress floater." },
]

const revocationReference = [
  { name: "endpoint", type: "string", detail: "Proxy endpoint for browser-safe CRL/OCSP checks." },
  { name: "timeout", type: "number", detail: "Timeout in milliseconds. Default 10000." },
  { name: "crl", type: "boolean", detail: "Enable CRL checks." },
  { name: "ocsp", type: "boolean", detail: "Enable OCSP checks." },
  { name: "maxCrlSize", type: "number", detail: "Maximum CRL payload size in bytes. Default 10485760." },
  { name: "headers", type: "Record<string, string>", detail: "Custom proxy request headers in browser mode." },
  { name: "onError", type: "(error, context) => void", detail: "Code-level callback for revocation request failures." },
]

function PdfVerificationPage() {
  const [pdfData, setPdfData] = useState("")
  const [fileName, setFileName] = useState("")
  const [uploadError, setUploadError] = useState("")

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

  const [toolbarConfig, setToolbarConfig] = useState<Record<keyof ToolbarConfig, boolean>>({
    openFile: false,
    pageNavigation: true,
    zoom: true,
    fitMode: true,
    rotation: true,
    scrollMode: true,
    search: true,
    print: true,
    download: true,
    themeToggle: true,
    fullscreen: true,
    signaturePanel: true,
    cursorTool: true,
    moreMenu: true,
    documentProperties: true,
  })

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
  const viewerRenderKey = useMemo(
    () => JSON.stringify(viewerOptions),
    [viewerOptions]
  )

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
    const dataUrl = await readFileAsDataUrl(file)
    setPdfData(dataUrl)
    setFileName(file.name)
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={ShieldCheck}
      title="PDF Verification"
      description="Adobe-style web PDF signature verification powered by VerifyKit. Upload a signed PDF, inspect the live viewer, and tune the SDK settings in one place."
      badge="VerifyKit SDK"
      maxWidth="max-w-7xl"
    >
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Verification Session</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Keep the document review in the viewer. Use this rail only for upload, quick actions, and documentation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                onFile={handleFile}
                accept=".pdf,application/pdf"
                label="Drop a signed PDF"
                sublabel="or click to browse from this device"
                className="min-h-36 bg-background/80"
              />

              <div className="flex flex-wrap gap-2">
                {fileName ? (
                  <>
                    <Badge variant="secondary">{fileName}</Badge>
                  </>
                ) : (
                  <Badge variant="outline">Waiting for document</Badge>
                )}
              </div>

              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

              <div className="grid gap-2">
                <MiniToggle
                  checked={revocationEnabled}
                  label="Enable online revocation"
                  onChange={setRevocationEnabled}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPdfData("")
                    setFileName("")
                    setUploadError("")
                  }}
                  disabled={!pdfData}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Clear PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
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
                    setToolbarConfig({
                      openFile: false,
                      pageNavigation: true,
                      zoom: true,
                      fitMode: true,
                      rotation: true,
                      scrollMode: true,
                      search: true,
                      print: true,
                      download: true,
                      themeToggle: true,
                      fullscreen: true,
                      signaturePanel: true,
                      cursorTool: true,
                      moreMenu: true,
                      documentProperties: true,
                    })
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
                  }}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Reset settings
                </Button>
              </div>

              <Separator />

              <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/15 dark:text-sky-300">
                    Learn More
                  </Badge>
                  <span className="text-xs text-muted-foreground">VerifyKit docs</span>
                </div>
                <div className="grid gap-2">
                  {DOC_LINKS.map((link) => (
                    <Button
                      key={link.href}
                      asChild
                      variant="outline"
                      className="justify-start border-sky-500/20 bg-background/80 hover:bg-sky-500/10"
                    >
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        <BookOpen className="mr-2 h-4 w-4" />
                        {link.label}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                    {verificationModeLabel}
                  </Badge>
                  <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/15 dark:text-sky-300">
                    {signaturePanelOpen ? "Panel open" : "Panel closed"}
                  </Badge>
                  {hasPdf ? (
                    <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                      {fileName}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Waiting for PDF</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
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
                                <ReferenceList title="revocationPlugin Options" items={revocationReference} />
                              </TabsContent>
                            </ScrollArea>
                          </Tabs>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {configWarnings.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
                  <p className="font-medium">Some JSON overrides are invalid and are being ignored.</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {configWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {pdfData ? (
                <div className="space-y-3">
                  <div className="h-[calc(100svh-12rem)] min-h-[calc(100svh-12rem)] overflow-hidden border border-slate-200 bg-background shadow-[0_16px_60px_-28px_rgba(15,23,42,0.45)] dark:border-slate-800">
                    <PdfViewer
                      key={viewerRenderKey}
                      data={pdfData}
                      title={fileName || "Verification Preview"}
                      className="h-full"
                      onOpenFile={handleFile}
                      viewerOptions={viewerOptions}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[calc(100svh-12rem)] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-background/80 px-8 text-center shadow-inner dark:border-slate-700">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight">The PDF viewer becomes the main evidence surface once a file is loaded.</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Upload a signed PDF from the left. This workspace is built so the document stays central, the
                    verification message is visible, and deeper SDK controls remain available without taking over the page.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">Signature panel ready</Badge>
                    <Badge variant="secondary">Toolbar configurable</Badge>
                    <Badge variant="secondary">Revocation-aware</Badge>
                    <Badge variant="secondary">PDF.js assets mapped</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </ToolPageLayout>
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
