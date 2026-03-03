import { useState, useRef, useCallback, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader,
  AlertCircle,
  Download,
  Printer,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

interface PdfViewerProps {
  data: string
  title?: string
  className?: string
  onDownload?: () => void
  onClose?: () => void
}

type ZoomPreset = "fit-width" | "fit-page"

interface ZoomOption {
  label: string
  value: number | ZoomPreset
}

const ZOOM_OPTIONS: ZoomOption[] = [
  { label: "Fit Width", value: "fit-width" },
  { label: "Fit Page", value: "fit-page" },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2 },
  { label: "300%", value: 3 },
]

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const THUMBNAIL_WIDTH = 110

export function PdfViewer({ data, title, className, onDownload, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [fitMode, setFitMode] = useState<ZoomPreset | null>("fit-width")
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pageInputValue, setPageInputValue] = useState("1")
  const [zoomOpen, setZoomOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbs, setShowThumbs] = useState(false)
  const [pageDims, setPageDims] = useState<{
    w: number
    h: number
  } | null>(null)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomBtnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync page input display with current page
  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  // Track viewport dimensions for fit calculations
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setViewportSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute effective scale from fit mode + container + page dimensions
  const effectiveScale = (() => {
    if (!fitMode || !pageDims || viewportSize.w === 0) return scale
    const pad = 48
    const availW = viewportSize.w - pad
    const availH = viewportSize.h - pad
    const isRotated = rotation === 90 || rotation === 270
    const pw = isRotated ? pageDims.h : pageDims.w
    const ph = isRotated ? pageDims.w : pageDims.h
    if (fitMode === "fit-width") return Math.max(MIN_ZOOM, availW / pw)
    return Math.max(MIN_ZOOM, Math.min(availW / pw, availH / ph))
  })()

  const displayPercent = Math.round(effectiveScale * 100)

  // ── Document / page callbacks ──

  const onDocLoad = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      setLoading(false)
      setError("")
    },
    []
  )

  const onPageLoad = useCallback((page: { originalWidth: number; originalHeight: number }) => {
    setPageDims({ w: page.originalWidth, h: page.originalHeight })
  }, [])

  // ── Navigation ──

  const goToPage = useCallback(
    (p: number) => {
      const page = Math.max(1, Math.min(p, numPages))
      setCurrentPage(page)

      // Scroll to page in main viewport
      requestAnimationFrame(() => {
        const el = document.getElementById(`pdf-page-${page}`)
        el?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      })
    },
    [numPages]
  )

  // ── Zoom ──

  const zoomIn = useCallback(() => {
    setFitMode(null)
    setScale((s) =>
      Math.min(Math.round((s + ZOOM_STEP) * 100) / 100, MAX_ZOOM)
    )
  }, [])

  const zoomOut = useCallback(() => {
    setFitMode(null)
    setScale((s) =>
      Math.max(Math.round((s - ZOOM_STEP) * 100) / 100, MIN_ZOOM)
    )
  }, [])

  const selectZoom = useCallback((v: number | ZoomPreset) => {
    if (typeof v === "string") {
      setFitMode(v)
    } else {
      setFitMode(null)
      setScale(v)
    }
    setZoomOpen(false)
  }, [])

  // ── Rotation ──

  const rotate = useCallback(() => setRotation((r) => (r + 90) % 360), [])

  // ── Fullscreen ──

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      wrapperRef.current.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", h)
    return () => document.removeEventListener("fullscreenchange", h)
  }, [])

  // ── Download ──

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
      return
    }
    const a = document.createElement("a")
    a.href = data
    a.download = "document.pdf"
    a.click()
  }, [data, onDownload])

  // ── Print ──

  const handlePrint = useCallback(() => {
    const raw = data.includes(",") ? (data.split(",")[1] ?? "") : data
    const bytes = atob(raw)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 60_000)
    })
  }, [data])

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          goToPage(currentPage - 1)
          break
        case "ArrowRight":
          e.preventDefault()
          goToPage(currentPage + 1)
          break
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case "-":
        case "_":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setFitMode(null)
            setScale(1)
          }
          break
        case "Escape":
          if (onClose && !isFullscreen) {
            onClose()
          }
          break
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [currentPage, goToPage, zoomIn, zoomOut, onClose, isFullscreen])

  // ── Close zoom dropdown on outside click ──

  useEffect(() => {
    if (!zoomOpen) return
    const h = (e: MouseEvent) => {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !zoomBtnRef.current?.contains(e.target as Node)
      ) {
        setZoomOpen(false)
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [zoomOpen])

  // ── Scroll active thumbnail into view ──

  useEffect(() => {
    if (showThumbs && numPages > 0) {
      document
        .getElementById(`pdf-thumb-${currentPage}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [currentPage, showThumbs, numPages])

  // ── Derived values ──

  const zoomLabel =
    fitMode === "fit-width"
      ? "Fit Width"
      : fitMode === "fit-page"
        ? "Fit Page"
        : `${displayPercent}%`

  const pages = Array.from({ length: numPages }, (_, i) => i + 1)

  const isZoomActive = (v: number | ZoomPreset) => {
    if (typeof v === "string") return fitMode === v
    return !fitMode && Math.abs(scale - v) < 0.01
  }

  // ── Scroll syncing ──
  useEffect(() => {
    const container = viewportRef.current
    if (!container) return

    const handleScroll = () => {
      const pagesEls = pages
        .map((p) => document.getElementById(`pdf-page-${p}`))
        .filter(Boolean) as HTMLElement[]

      if (!pagesEls.length) return

      const containerTop = container.getBoundingClientRect().top

      let closestPage = currentPage
      let minDistance = Number.POSITIVE_INFINITY

      for (const el of pagesEls) {
        const rect = el.getBoundingClientRect()
        const distance = Math.abs(rect.top - containerTop)

        if (distance < minDistance) {
          minDistance = distance
          const pageNum = Number(el.id.replace("pdf-page-", ""))
          closestPage = pageNum
        }
      }

      if (closestPage !== currentPage) {
        setCurrentPage(closestPage)
      }
    }

    container.addEventListener("scroll", handleScroll)

    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [pages, currentPage])


  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={wrapperRef}
        className={cn(
          "flex flex-col h-full min-h-0 bg-background rounded-lg border overflow-hidden",
          isFullscreen && "rounded-none border-0",
          className
        )}
        tabIndex={-1}
      >
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-b bg-card shrink-0 z-50">
          {/* Thumbnail toggle */}
          {numPages > 1 && (
            <>
              <ToolbarButton
                icon={showThumbs ? PanelLeftClose : PanelLeftOpen}
                tooltip={showThumbs ? "Hide thumbnails" : "Show thumbnails"}
                onClick={() => setShowThumbs((v) => !v)}
                active={showThumbs}
              />
              <ToolbarSep />
            </>
          )}

          {/* Page navigation */}
          <ToolbarButton
            icon={ChevronLeft}
            tooltip="Previous page"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
          />
          <div className="flex items-center gap-1 text-xs shrink-0 mx-0.5">
            <Input
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const p = parseInt(pageInputValue)
                  if (p >= 1 && p <= numPages) goToPage(p)
                  else setPageInputValue(String(currentPage))
                    ; (e.target as HTMLInputElement).blur()
                }
              }}
              onBlur={() => setPageInputValue(String(currentPage))}
              className="w-10 h-7 text-center text-xs px-0 font-mono"
              disabled={loading}
            />
            <span className="text-muted-foreground whitespace-nowrap font-mono">
              / {numPages || "–"}
            </span>
          </div>
          <ToolbarButton
            icon={ChevronRight}
            tooltip="Next page"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages || loading}
          />
          <ToolbarSep />

          {/* Zoom controls */}
          <ToolbarButton
            icon={ZoomOut}
            tooltip="Zoom out"
            onClick={zoomOut}
            disabled={effectiveScale <= MIN_ZOOM || loading}
          />
          <div className="relative">
            <button
              ref={zoomBtnRef}
              onClick={() => setZoomOpen((v) => !v)}
              disabled={loading}
              className={cn(
                "flex items-center gap-1 h-7 px-2 rounded-md text-xs",
                "hover:bg-accent transition-colors",
                "disabled:opacity-50 disabled:pointer-events-none",
                zoomOpen && "bg-accent"
              )}
            >
              <span className="w-16 text-center tabular-nums">
                {zoomLabel}
              </span>
              <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {zoomOpen && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 z-50 w-36 rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
              >
                {ZOOM_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => selectZoom(opt.value)}
                    className={cn(
                      "flex items-center w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isZoomActive(opt.value) && "bg-accent/50"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3 shrink-0",
                        isZoomActive(opt.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolbarButton
            icon={ZoomIn}
            tooltip="Zoom in"
            onClick={zoomIn}
            disabled={effectiveScale >= MAX_ZOOM || loading}
          />
          <ToolbarSep className="hidden sm:block" />

          {/* Rotate */}
          <ToolbarButton
            icon={RotateCw}
            tooltip="Rotate 90°"
            onClick={rotate}
            disabled={loading}
            className="hidden sm:inline-flex"
          />

          {/* Spacer / Title */}
          <div className="flex-1 min-w-4 flex items-center justify-center overflow-hidden px-4">
            {title && (
              <span className="text-xs font-medium text-muted-foreground truncate opacity-0 sm:opacity-100 transition-opacity">
                {title}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={Printer}
              tooltip="Print"
              onClick={handlePrint}
              disabled={loading}
              className="hidden sm:inline-flex"
            />
            <ToolbarButton
              icon={Download}
              tooltip="Download"
              onClick={handleDownload}
              disabled={loading}
            />
            <ToolbarButton
              icon={isFullscreen ? Minimize : Maximize}
              tooltip={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
              className="hidden sm:inline-flex"
            />
            {onClose && (
              <>
                <ToolbarSep />
                <ToolbarButton
                  icon={X}
                  tooltip="Close"
                  onClick={onClose}
                  className="hover:bg-destructive/10 hover:text-destructive"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Content area ── */}
        <div className="flex flex-1 min-h-0">
          {/* Thumbnail sidebar */}
          {showThumbs && numPages > 1 && (
            <div className="w-36 shrink-0 border-r bg-card/30 overflow-y-auto">
              <Document file={data} loading={null} error={null}>
                <div className="p-2 space-y-2">
                  {pages.map((p) => (
                    <button
                      key={p}
                      id={`pdf-thumb-${p}`}
                      onClick={() => goToPage(p)}
                      className={cn(
                        "group block w-full rounded-md p-1.5 transition-all",
                        "border-2",
                        currentPage === p
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent hover:border-border hover:bg-accent/30"
                      )}
                    >
                      <div className="overflow-hidden rounded-sm bg-white">
                        <Page
                          pageNumber={p}
                          width={THUMBNAIL_WIDTH}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          loading={
                            <div className="flex items-center justify-center h-28">
                              <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          }
                        />
                      </div>
                      <span
                        className={cn(
                          "block text-center text-[10px] mt-1.5 tabular-nums",
                          currentPage === p
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
              </Document>
            </div>
          )}

          {/* Main viewport */}
          <div ref={viewportRef} className="flex-1 overflow-auto bg-muted/20">
            {loading && !error && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Loader className="h-8 w-8 animate-spin" />
                <span className="text-sm">Loading document…</span>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  Failed to load PDF
                </span>
                <span className="text-xs text-muted-foreground max-w-md text-center">
                  {error}
                </span>
              </div>
            )}
            <Document
              file={data}
              onLoadSuccess={onDocLoad}
              onLoadError={(e: Error) => {
                setError(e.message)
                setLoading(false)
              }}
              loading={null}
              error={null}
            >
              {!loading && !error && (
                <div className="flex flex-col items-center gap-6 py-6">
                  {pages.map((pageNumber) => (
                    <div
                      key={pageNumber}
                      id={`pdf-page-${pageNumber}`}
                      className="shadow-2xl rounded-sm bg-white"
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={effectiveScale}
                        rotate={rotation}
                        onLoadSuccess={pageNumber === 1 ? onPageLoad : undefined}
                        renderAnnotationLayer={true}
                        renderTextLayer={true}
                        loading={
                          <div className="flex items-center justify-center h-96 w-64">
                            <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </Document>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ── Toolbar helpers ──

function ToolbarSep({ className }: { className?: string }) {
  return <Separator orientation="vertical" className={cn("mx-1 h-5", className)} />
}

function ToolbarButton({
  icon: Icon,
  tooltip,
  onClick,
  disabled,
  active,
  className: cls,
}: {
  icon: React.ComponentType<{ className?: string }>
  tooltip: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0",
            active && "bg-accent text-accent-foreground",
            cls
          )}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
