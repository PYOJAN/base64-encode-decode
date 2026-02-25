import { useState, useRef, useCallback, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FilePlus,
  Download,
  Eye,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Minus,
  ScissorsLineDashed,
  Image as ImageIcon,
  Settings,
  FileText,
  RotateCcw,
  Quote,
  Type,
  Pencil,
  FileStack,
} from "lucide-react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { PageHeader } from "@/components/page-header"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import { cn } from "@/lib/utils"
import { hexToRgb } from "@/utils/color"

export const Route = createFileRoute("/pdf-generator")({
  component: PdfGeneratorPage,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlockType = "heading" | "paragraph" | "list" | "separator" | "pagebreak" | "image" | "quote"
type HeadingLevel = 1 | 2 | 3
type ListStyle = "bullet" | "numbered"
type ImageAlign = "left" | "center" | "right"
type PageSize = "a4" | "letter" | "legal" | "a3" | "a5"
type Orientation = "portrait" | "landscape"
type FontFamily = "helvetica" | "times" | "courier"

interface ContentBlock {
  id: string
  type: BlockType
  content: string
  headingLevel: HeadingLevel
  listStyle: ListStyle
  imageData?: string
  imageName?: string
  imageWidth: number
  imageAlign: ImageAlign
  imageCaption: string
  textColor: string
  /** Page number (1-indexed) */
  page: number
  /** Absolute x offset in px within the preview content area */
  x: number
  /** Absolute y offset in px within the preview content area */
  y: number
}

interface DocumentSettings {
  pageSize: PageSize
  orientation: Orientation
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  font: FontFamily
  fontSize: number
  lineSpacing: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_DIMENSIONS: Record<PageSize, { w: number; h: number; label: string }> = {
  a4: { w: 210, h: 297, label: "A4" },
  letter: { w: 216, h: 279, label: "Letter" },
  legal: { w: 216, h: 356, label: "Legal" },
  a3: { w: 297, h: 420, label: "A3" },
  a5: { w: 148, h: 210, label: "A5" },
}

const FONTS: { value: FontFamily; label: string }[] = [
  { value: "helvetica", label: "Helvetica" },
  { value: "times", label: "Times" },
  { value: "courier", label: "Courier" },
]

const FONT_CSS: Record<FontFamily, string> = {
  helvetica: "font-sans",
  times: "font-serif",
  courier: "font-mono",
}

const BLOCK_META: Record<BlockType, { label: string; icon: typeof Heading1; color: string; border: string; bg: string }> = {
  heading:   { label: "Heading",    icon: Heading1,           color: "text-blue-400",   border: "border-l-blue-400",   bg: "bg-blue-400/10" },
  paragraph: { label: "Paragraph",  icon: AlignLeft,          color: "text-slate-400",  border: "border-l-slate-400",  bg: "bg-slate-400/10" },
  list:      { label: "List",       icon: List,               color: "text-green-400",  border: "border-l-green-400",  bg: "bg-green-400/10" },
  quote:     { label: "Quote",      icon: Quote,              color: "text-amber-400",  border: "border-l-amber-400",  bg: "bg-amber-400/10" },
  image:     { label: "Image",      icon: ImageIcon,          color: "text-purple-400", border: "border-l-purple-400", bg: "bg-purple-400/10" },
  separator: { label: "Separator",  icon: Minus,              color: "text-gray-400",   border: "border-l-gray-400",   bg: "bg-gray-400/10" },
  pagebreak: { label: "Page Break", icon: ScissorsLineDashed, color: "text-orange-400", border: "border-l-orange-400", bg: "bg-orange-400/10" },
}

const BLOCK_TYPE_LIST: BlockType[] = ["heading", "paragraph", "list", "quote", "image", "separator", "pagebreak"]

const DEFAULT_SETTINGS: DocumentSettings = {
  pageSize: "a4",
  orientation: "portrait",
  marginTop: 20,
  marginRight: 20,
  marginBottom: 20,
  marginLeft: 20,
  font: "helvetica",
  fontSize: 12,
  lineSpacing: 1.5,
}

// 1mm ≈ 2.2px at our preview scale
const MM_SCALE = 2.2

function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

let nextBlockY = 0

function createBlock(type: BlockType, page = 1): ContentBlock {
  const y = nextBlockY
  nextBlockY += 40
  return { id: createId(), type, content: "", headingLevel: 1, listStyle: "bullet", imageWidth: 100, imageAlign: "center", imageCaption: "", textColor: "#000000", page, x: 0, y }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ---------------------------------------------------------------------------
// Draggable Preview Block  (absolute positioning on the canvas)
// ---------------------------------------------------------------------------

function DraggablePreviewBlock({
  block,
  isActive,
  headingPx,
  onClick,
}: {
  block: ContentBlock
  isActive: boolean
  headingPx: (level: HeadingLevel) => number
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: block.id })

  const style: React.CSSProperties = {
    position: "absolute",
    left: block.x,
    top: block.y,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: "pointer",
    borderRadius: 3,
    padding: "2px 4px 2px 18px",
    outline: isActive ? "2px solid rgba(59,130,246,0.4)" : "none",
    backgroundColor: isActive ? "rgba(59,130,246,0.04)" : "transparent",
    zIndex: isDragging ? 50 : isActive ? 10 : 1,
    maxWidth: "100%",
    boxSizing: "border-box",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      onMouseEnter={(e) => { if (!isActive && !isDragging) (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)") }}
      onMouseLeave={(e) => { if (!isActive && !isDragging) (e.currentTarget.style.backgroundColor = isActive ? "rgba(59,130,246,0.04)" : "transparent") }}
      className="group/preview"
    >
      {/* Drag handle — visible on hover, absolutely positioned */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/preview:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 rounded p-0.5 hover:bg-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" style={{ color: "#999" }} />
      </div>

      {/* Heading */}
      {block.type === "heading" && (
        <p style={{
          fontSize: headingPx(block.headingLevel),
          fontWeight: 700,
          margin: 0,
          opacity: block.content ? 1 : 0.15,
          lineHeight: 1.3,
          color: block.content ? block.textColor : undefined,
        }}>
          {block.content || `Heading ${block.headingLevel}`}
        </p>
      )}

      {/* Paragraph */}
      {block.type === "paragraph" && (
        <p style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          opacity: block.content ? 1 : 0.15,
          color: block.content ? block.textColor : undefined,
        }}>
          {block.content || "Paragraph text..."}
        </p>
      )}

      {/* List */}
      {block.type === "list" && (
        <div style={{ color: block.textColor }}>
          {block.content ? (
            block.content.split("\n").filter((l) => l.trim()).map((item, i) => (
              <p key={i} style={{ margin: 0, paddingLeft: "1.2em", textIndent: "-1.2em" }}>
                <span style={{ color: "#888", marginRight: 4 }}>
                  {block.listStyle === "numbered" ? `${i + 1}.` : "\u2022"}
                </span>
                {item}
              </p>
            ))
          ) : (
            <p style={{ opacity: 0.15, paddingLeft: "1.2em", margin: 0 }}>List items...</p>
          )}
        </div>
      )}

      {/* Quote */}
      {block.type === "quote" && (
        <div style={{
          borderLeft: "3px solid #d4a050",
          paddingLeft: "0.8em",
          fontStyle: "italic",
          color: block.content ? (block.textColor !== "#000000" ? block.textColor : "#666") : "#ccc",
        }}>
          <p style={{ margin: 0 }}>{block.content || "Quote text..."}</p>
        </div>
      )}

      {/* Separator */}
      {block.type === "separator" && (
        <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: 0, width: 200 }} />
      )}

      {/* Page Break */}
      {block.type === "pagebreak" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: 200 }}>
          <div style={{ flex: 1, borderTop: "2px dashed #f90" }} />
          <span style={{ fontSize: "0.6em", color: "#f90", letterSpacing: "0.12em", fontWeight: 600 }}>PAGE BREAK</span>
          <div style={{ flex: 1, borderTop: "2px dashed #f90" }} />
        </div>
      )}

      {/* Image */}
      {block.type === "image" && (
        <div style={{ textAlign: block.imageAlign }}>
          {block.imageData ? (
            <>
              <img
                src={block.imageData}
                alt={block.imageName || "Image"}
                style={{ width: `${block.imageWidth}%`, maxWidth: "100%", display: "inline-block", borderRadius: 3 }}
              />
              {block.imageCaption && (
                <p style={{ fontSize: "0.8em", color: "#999", fontStyle: "italic", textAlign: "center", marginTop: 4, marginBottom: 0 }}>
                  {block.imageCaption}
                </p>
              )}
            </>
          ) : (
            <div style={{ padding: "1.5em", textAlign: "center", border: "1px dashed #ddd", borderRadius: 4 }}>
              <p style={{ fontSize: "0.8em", color: "#ccc", margin: 0 }}>Image placeholder</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PdfGeneratorPage() {
  const [settings, setSettings] = useState<DocumentSettings>(DEFAULT_SETTINGS)
  const [blocks, setBlocks] = useState<ContentBlock[]>([createBlock("heading", 1), createBlock("paragraph", 1)])
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor")
  const [showSettings, setShowSettings] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [generating, setGenerating] = useState(false)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const blockEditorRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const imageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  // -- Settings --
  const updateSetting = useCallback(<K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  // -- Blocks --
  const addBlock = useCallback((type: BlockType) => {
    setBlocks((prev) => {
      // Place new block below the lowest existing block on the current page
      const pageBlocks = prev.filter((b) => b.page === currentPage)
      const maxY = pageBlocks.reduce((max, b) => Math.max(max, b.y), -40)
      nextBlockY = maxY + 40
      return [...prev, createBlock(type, currentPage)]
    })
  }, [currentPage])

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const updateBlock = useCallback((id: string, patch: Partial<ContentBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const moveBlock = useCallback((id: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0) return prev
      const targetIdx = direction === "up" ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[targetIdx]] = [next[targetIdx]!, next[idx]!]
      return next
    })
  }, [])

  const addPage = useCallback(() => {
    setTotalPages((p) => p + 1)
    setCurrentPage((p) => p + 1)
  }, [])

  const removePage = useCallback((pageNum: number) => {
    if (totalPages <= 1) return
    // Remove blocks on the deleted page and shift pages above it down
    setBlocks((prev) =>
      prev
        .filter((b) => b.page !== pageNum)
        .map((b) => (b.page > pageNum ? { ...b, page: b.page - 1 } : b))
    )
    setTotalPages((p) => p - 1)
    setCurrentPage((c) => (c > pageNum ? c - 1 : c > 1 && c === pageNum ? c - 1 : Math.min(c, totalPages - 1)))
  }, [totalPages])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    if (delta.x === 0 && delta.y === 0) return
    const id = String(active.id)
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, x: Math.max(0, b.x + delta.x), y: Math.max(0, b.y + delta.y) }
          : b
      )
    )
  }, [])

  const handleImageUpload = useCallback((blockId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = () => { updateBlock(blockId, { imageData: reader.result as string, imageName: file.name }) }
    reader.readAsDataURL(file)
  }, [updateBlock])

  const handlePreviewBlockClick = useCallback((id: string) => {
    setActiveBlockId(id)
    const el = blockEditorRefs.current.get(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    setMobileView("editor")
  }, [])

  // -- PDF Generation --
  const generatePdf = useCallback(() => {
    setGenerating(true)
    requestAnimationFrame(() => {
      try {
        const doc = new jsPDF({ orientation: settings.orientation, unit: "mm", format: settings.pageSize })
        const pageWidth = doc.internal.pageSize.getWidth()
        const contentWidth = pageWidth - settings.marginLeft - settings.marginRight

        // Convert block pixel coords → mm.  Origin = inside margins.
        const pxToMm = (px: number) => px / MM_SCALE

        // Group blocks by page and sort within each page
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (pageNum > 1) doc.addPage()
          const pageBlocks = blocks.filter((b) => b.page === pageNum).sort((a, b) => a.y - b.y || a.x - b.x)

        for (const block of pageBlocks) {
          const bx = settings.marginLeft + pxToMm(block.x)
          let by = settings.marginTop + pxToMm(block.y)
          const maxTextW = contentWidth - pxToMm(block.x)

          const renderTextAt = (text: string, fontSize: number, fontStyle: string, startX: number, startY: number, textW: number) => {
            doc.setFont(settings.font, fontStyle)
            doc.setFontSize(fontSize)
            const lh = fontSize * 0.3528 * settings.lineSpacing
            const lines = doc.splitTextToSize(text, textW)
            let cy = startY
            for (const line of lines) { doc.text(line, startX, cy + lh * 0.75); cy += lh }
          }

          switch (block.type) {
            case "heading": {
              if (!block.content.trim()) break
              const rgb = hexToRgb(block.textColor)
              if (rgb) doc.setTextColor(rgb.r, rgb.g, rgb.b)
              const mult = block.headingLevel === 1 ? 2 : block.headingLevel === 2 ? 1.5 : 1.25
              renderTextAt(block.content, settings.fontSize * mult, "bold", bx, by, maxTextW)
              doc.setTextColor(0, 0, 0)
              break
            }
            case "paragraph": {
              if (!block.content.trim()) break
              const rgb = hexToRgb(block.textColor)
              if (rgb) doc.setTextColor(rgb.r, rgb.g, rgb.b)
              renderTextAt(block.content, settings.fontSize, "normal", bx, by, maxTextW)
              doc.setTextColor(0, 0, 0)
              break
            }
            case "list": {
              const rgb = hexToRgb(block.textColor)
              if (rgb) doc.setTextColor(rgb.r, rgb.g, rgb.b)
              const items = block.content.split("\n").filter((l) => l.trim())
              const lh = settings.fontSize * 0.3528 * settings.lineSpacing
              let cy = by
              for (let i = 0; i < items.length; i++) {
                const prefix = block.listStyle === "numbered" ? `${i + 1}. ` : "\u2022 "
                doc.setFont(settings.font, "normal"); doc.setFontSize(settings.fontSize)
                doc.text(prefix + items[i]!, bx, cy + lh * 0.75)
                cy += lh
              }
              doc.setTextColor(0, 0, 0)
              break
            }
            case "quote": {
              if (!block.content.trim()) break
              const barX = bx + 2
              doc.setFont(settings.font, "italic"); doc.setFontSize(settings.fontSize)
              const lh = settings.fontSize * 0.3528 * settings.lineSpacing
              const lines = doc.splitTextToSize(block.content, maxTextW - 10)
              const quoteRgb = block.textColor !== "#000000" ? hexToRgb(block.textColor) : null
              let cy = by
              for (const line of lines) {
                if (quoteRgb) doc.setTextColor(quoteRgb.r, quoteRgb.g, quoteRgb.b); else doc.setTextColor(120, 120, 120)
                doc.text(line, bx + 8, cy + lh * 0.75); cy += lh
              }
              doc.setTextColor(0, 0, 0)
              doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.8)
              doc.line(barX, by, barX, cy)
              break
            }
            case "separator": {
              doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.3)
              doc.line(bx, by, bx + Math.min(pxToMm(200), contentWidth), by)
              break
            }
            case "pagebreak": { doc.addPage(); break }
            case "image": {
              if (!block.imageData) break
              try {
                const fm = block.imageData.match(/data:image\/(png|jpeg|jpg|gif|webp)/i)
                const format = fm ? fm[1]!.toUpperCase().replace("JPG", "JPEG") : "PNG"
                const imgWidth = contentWidth * (block.imageWidth / 100)
                let imgX = bx
                if (block.imageAlign === "center") imgX = bx + (maxTextW - imgWidth) / 2
                else if (block.imageAlign === "right") imgX = bx + maxTextW - imgWidth
                doc.addImage(block.imageData, format, imgX, by, imgWidth, 0)
                if (block.imageCaption.trim()) {
                  const capLh = settings.fontSize * 0.85 * 0.3528 * settings.lineSpacing
                  const estimatedH = imgWidth * 0.75
                  doc.setFont(settings.font, "italic"); doc.setFontSize(settings.fontSize * 0.85); doc.setTextColor(120, 120, 120)
                  const capLines = doc.splitTextToSize(block.imageCaption, maxTextW)
                  let cy = by + estimatedH + capLh * 0.3
                  for (const l of capLines) { const tw = doc.getTextWidth(l); doc.text(l, bx + (maxTextW - tw) / 2, cy + capLh * 0.75); cy += capLh }
                  doc.setTextColor(0, 0, 0)
                }
              } catch { /* skip */ }
              break
            }
          }
        }
        } // end page loop

        const blob = doc.output("blob")
        const url = URL.createObjectURL(blob)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(url); setPdfBlob(blob)
        toast.success("PDF generated successfully")
      } catch (err) {
        toast.error(`Failed to generate PDF: ${err instanceof Error ? err.message : "Unknown error"}`)
      } finally { setGenerating(false) }
    })
  }, [settings, blocks, previewUrl, totalPages])

  const downloadPdf = useCallback(() => {
    if (!pdfBlob || !previewUrl) return
    const a = document.createElement("a"); a.href = previewUrl; a.download = "document.pdf"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    toast.success("PDF downloaded")
  }, [pdfBlob, previewUrl])

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    nextBlockY = 0
    setBlocks([createBlock("heading", 1), createBlock("paragraph", 1)])
    setTotalPages(1)
    setCurrentPage(1)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null); setPdfBlob(null); setActiveBlockId(null)
    toast.success("Reset to defaults")
  }, [previewUrl])

  // -- Heading size for live preview --
  const headingPx = (level: HeadingLevel) => settings.fontSize * (level === 1 ? 2 : level === 2 ? 1.5 : 1.25)

  // =====================================================================
  // Render
  // =====================================================================

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <PageHeader
        icon={FilePlus}
        title="PDF Generator"
        description="Create professional PDFs — content blocks render live on the page preview."
        badge="PDF"
      />

      {/* -------- Mobile view toggle -------- */}
      <div className="flex lg:hidden rounded-lg border bg-muted/30 p-0.5">
        {(["editor", "preview"] as const).map((view) => (
          <button
            key={view}
            onClick={() => setMobileView(view)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mobileView === view ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {view === "editor" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {view === "editor" ? "Editor" : "Preview"}
          </button>
        ))}
      </div>

      {/* -------- Main two-column layout -------- */}
      <div className="grid gap-4 lg:grid-cols-2 items-start">

        {/* ============================================================= */}
        {/* LEFT COLUMN: Editor                                            */}
        {/* ============================================================= */}
        <div className={cn("space-y-4", mobileView === "preview" && "hidden lg:block")}>

          {/* -- Document Settings (collapsible) -- */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex w-full items-center gap-2 text-left"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Settings className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold tracking-tight flex-1">Document Settings</span>
                <Badge variant="outline" className="text-[10px] mr-1">
                  {PAGE_DIMENSIONS[settings.pageSize].label} · {settings.orientation === "portrait" ? "P" : "L"}
                </Badge>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showSettings && "rotate-90")} />
              </button>

              {showSettings && (
                <div className="mt-4 space-y-4">
                  <Separator />

                  {/* Page Size */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Page Size</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(PAGE_DIMENSIONS) as [PageSize, typeof PAGE_DIMENSIONS.a4][]).map(([key, dim]) => (
                        <button
                          key={key}
                          onClick={() => updateSetting("pageSize", key)}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                            settings.pageSize === key
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          {dim.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orientation */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Orientation</Label>
                    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
                      {(["portrait", "landscape"] as Orientation[]).map((o) => (
                        <button
                          key={o}
                          onClick={() => updateSetting("orientation", o)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-all",
                            settings.orientation === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "rounded-[2px] border-2 transition-colors",
                            o === "portrait" ? "h-4 w-3" : "h-3 w-4",
                            settings.orientation === o ? "border-primary" : "border-muted-foreground/40"
                          )} />
                          {o === "portrait" ? "Portrait" : "Landscape"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Font Family</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {FONTS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => updateSetting("font", f.value)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-all",
                            FONT_CSS[f.value],
                            settings.font === f.value
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          <Type className="h-3 w-3" />
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size + Line Spacing */}
                  <div className="grid gap-4 grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">Font Size</Label>
                        <Badge variant="outline" className="text-[10px] font-mono">{settings.fontSize}pt</Badge>
                      </div>
                      <input type="range" min={8} max={48} step={1} value={settings.fontSize}
                        onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                        className="w-full accent-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">Line Spacing</Label>
                        <Badge variant="outline" className="text-[10px] font-mono">{settings.lineSpacing.toFixed(1)}×</Badge>
                      </div>
                      <input type="range" min={1} max={3} step={0.1} value={settings.lineSpacing}
                        onChange={(e) => updateSetting("lineSpacing", Number(e.target.value))}
                        className="w-full accent-primary" />
                    </div>
                  </div>

                  {/* Margins — proper 3×3 grid alignment */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Margins (mm)</Label>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center justify-items-center max-w-[260px] mx-auto py-2">
                      {/* Row 1: empty · Top · empty */}
                      <div />
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Top</span>
                        <Input type="number" min={0} max={100} value={settings.marginTop}
                          onChange={(e) => updateSetting("marginTop", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="h-7 w-16 text-center text-xs font-mono" />
                      </div>
                      <div />

                      {/* Row 2: Left · Page · Right */}
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Left</span>
                        <Input type="number" min={0} max={100} value={settings.marginLeft}
                          onChange={(e) => updateSetting("marginLeft", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="h-7 w-16 text-center text-xs font-mono" />
                      </div>
                      <div className="flex h-14 w-20 items-center justify-center rounded border-2 border-dashed border-primary/25 bg-primary/5">
                        <span className="text-[9px] text-primary/50 font-medium tracking-wide">Content</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Right</span>
                        <Input type="number" min={0} max={100} value={settings.marginRight}
                          onChange={(e) => updateSetting("marginRight", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="h-7 w-16 text-center text-xs font-mono" />
                      </div>

                      {/* Row 3: empty · Bottom · empty */}
                      <div />
                      <div className="flex flex-col items-center gap-0.5">
                        <Input type="number" min={0} max={100} value={settings.marginBottom}
                          onChange={(e) => updateSetting("marginBottom", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="h-7 w-16 text-center text-xs font-mono" />
                        <span className="text-[9px] text-muted-foreground">Bottom</span>
                      </div>
                      <div />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* -- Page Navigation -- */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <FileStack className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight">Pages</h2>
                  <Badge variant="secondary" className="text-[10px] font-mono">{totalPages}</Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addPage}>
                      <Plus className="mr-1 h-3 w-3" /> Add Page
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a new page</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <div key={pg} className="flex items-center">
                    <button
                      onClick={() => setCurrentPage(pg)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        currentPage === pg
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground border border-border"
                      )}
                    >
                      Page {pg}
                      <Badge variant="outline" className="text-[9px] font-mono ml-0.5 px-1 py-0 h-4">
                        {blocks.filter((b) => b.page === pg).length}
                      </Badge>
                    </button>
                    {totalPages > 1 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-0.5 text-destructive/40 hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); removePage(pg) }}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove page {pg}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* -- Content Blocks -- */}
          <Card>
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight">Content Blocks</h2>
                  <Badge variant="secondary" className="text-[10px] font-mono">{blocks.filter((b) => b.page === currentPage).length}</Badge>
                  <Badge variant="outline" className="text-[9px]">Page {currentPage}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground h-7 px-2 text-xs">
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                        <Plus className="mr-1 h-3 w-3" /> Add
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {BLOCK_TYPE_LIST.map((bt) => {
                        const meta = BLOCK_META[bt]
                        const Icon = meta.icon
                        return (
                          <DropdownMenuItem key={bt} onClick={() => addBlock(bt)}>
                            <Icon className={cn("mr-2 h-3.5 w-3.5", meta.color)} />
                            {meta.label}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <Separator />

              {blocks.filter((b) => b.page === currentPage).length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs font-medium">No content blocks on page {currentPage}</p>
                  <p className="text-[11px] mt-0.5">Click "Add" to start building your document.</p>
                </div>
              )}

              <div className="space-y-2">
                {blocks.filter((b) => b.page === currentPage).map((block, index) => {
                  const meta = BLOCK_META[block.type]
                  const Icon = meta.icon
                  const isActive = block.id === activeBlockId
                  return (
                    <div
                      key={block.id}
                      ref={(el) => { if (el) blockEditorRefs.current.set(block.id, el) }}
                      onClick={() => setActiveBlockId(block.id)}
                      className={cn(
                        "rounded-lg border-l-[3px] border bg-card p-2.5 sm:p-3 space-y-2 transition-all cursor-pointer",
                        meta.border,
                        isActive ? "ring-1 ring-primary/30 shadow-sm" : "hover:shadow-sm"
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/25 shrink-0" />
                        <div className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", meta.bg, meta.color)}>
                          <Icon className="h-2.5 w-2.5" />
                          {meta.label}
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono">#{index + 1}</Badge>

                        {/* Heading level */}
                        {block.type === "heading" && (
                          <div className="inline-flex rounded border bg-muted/30 p-0.5 ml-0.5">
                            {([1, 2, 3] as HeadingLevel[]).map((lvl) => {
                              const LI = lvl === 1 ? Heading1 : lvl === 2 ? Heading2 : Heading3
                              return (
                                <button key={lvl}
                                  onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { headingLevel: lvl }) }}
                                  className={cn("rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium transition-all inline-flex items-center gap-0.5",
                                    block.headingLevel === lvl ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                  )}>
                                  <LI className="h-2.5 w-2.5" /> H{lvl}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* List style */}
                        {block.type === "list" && (
                          <div className="inline-flex rounded border bg-muted/30 p-0.5 ml-0.5">
                            {([{ v: "bullet" as ListStyle, icon: List, l: "Bullet" }, { v: "numbered" as ListStyle, icon: ListOrdered, l: "Num" }]).map((opt) => (
                              <button key={opt.v}
                                onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { listStyle: opt.v }) }}
                                className={cn("rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium transition-all inline-flex items-center gap-0.5",
                                  block.listStyle === opt.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}>
                                <opt.icon className="h-2.5 w-2.5" /> {opt.l}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Text color picker */}
                        {(block.type === "heading" || block.type === "paragraph" || block.type === "list" || block.type === "quote") && (
                          <div className="inline-flex items-center gap-0.5 ml-0.5" onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <label className="relative inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border transition-all hover:scale-110"
                                  style={{ backgroundColor: block.textColor }}>
                                  <input type="color" value={block.textColor}
                                    onChange={(e) => updateBlock(block.id, { textColor: e.target.value })}
                                    className="absolute inset-0 cursor-pointer opacity-0" />
                                </label>
                              </TooltipTrigger>
                              <TooltipContent>Text color</TooltipContent>
                            </Tooltip>
                            {block.textColor !== "#000000" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100"
                                    onClick={() => updateBlock(block.id, { textColor: "#000000" })}>
                                    <RotateCcw className="h-2.5 w-2.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reset color</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}

                        <div className="ml-auto flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" disabled={index === 0}
                                onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up") }}>
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move up</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" disabled={index === blocks.filter((b) => b.page === currentPage).length - 1}
                                onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down") }}>
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move down</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete block</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Content */}
                      {block.type === "heading" && (
                        <Input
                          placeholder={`${block.headingLevel === 1 ? "Main" : block.headingLevel === 2 ? "Section" : "Sub"} heading...`}
                          value={block.content}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                          className={cn("h-8 font-semibold border-0 bg-muted/20 focus-visible:bg-muted/30 text-xs", block.headingLevel === 1 && "text-sm")}
                        />
                      )}

                      {block.type === "paragraph" && (
                        <Textarea placeholder="Paragraph text..." value={block.content}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                          rows={3} className="resize-none border-0 bg-muted/20 focus-visible:bg-muted/30 text-xs" />
                      )}

                      {block.type === "list" && (
                        <Textarea placeholder={"One item per line...\nItem 1\nItem 2"} value={block.content}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                          rows={3} className="resize-none border-0 bg-muted/20 focus-visible:bg-muted/30 text-xs" />
                      )}

                      {block.type === "quote" && (
                        <Textarea placeholder="Quote text..." value={block.content}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                          rows={2} className="resize-none border-0 bg-muted/20 focus-visible:bg-muted/30 text-xs italic" />
                      )}

                      {block.type === "separator" && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">HR</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}

                      {block.type === "pagebreak" && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex-1 border-t-2 border-dashed border-orange-400/30" />
                          <ScissorsLineDashed className="h-3 w-3 text-orange-400/40" />
                          <div className="flex-1 border-t-2 border-dashed border-orange-400/30" />
                        </div>
                      )}

                      {block.type === "image" && (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div
                            onClick={() => imageInputRefs.current.get(block.id)?.click()}
                            className={cn(
                              "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-all",
                              block.imageData ? "border-purple-400/20 bg-purple-400/5 p-2" : "border-muted-foreground/15 py-5 hover:border-primary/30"
                            )}
                          >
                            {block.imageData ? (
                              <div className="space-y-1 w-full">
                                <img src={block.imageData} alt={block.imageName || ""} className="max-h-28 max-w-full rounded object-contain mx-auto" />
                                <p className="text-[10px] text-muted-foreground text-center">{block.imageName} — Click to replace</p>
                              </div>
                            ) : (
                              <>
                                <ImageIcon className="h-5 w-5 text-muted-foreground/30 mb-1" />
                                <p className="text-[11px] text-muted-foreground">Click to upload image</p>
                              </>
                            )}
                            <input ref={(el) => { if (el) imageInputRefs.current.set(block.id, el) }}
                              type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(block.id, f); e.target.value = "" }} />
                          </div>

                          {block.imageData && (
                            <div className="space-y-2 rounded border bg-muted/10 p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">Align</span>
                                <div className="inline-flex rounded border bg-muted/30 p-0.5">
                                  {([{ v: "left" as ImageAlign, icon: AlignLeft, label: "Left" }, { v: "center" as ImageAlign, icon: AlignCenter, label: "Center" }, { v: "right" as ImageAlign, icon: AlignRight, label: "Right" }]).map((a) => (
                                    <Tooltip key={a.v}>
                                      <TooltipTrigger asChild>
                                        <button onClick={() => updateBlock(block.id, { imageAlign: a.v })}
                                          className={cn("rounded-[3px] p-1 transition-all",
                                            block.imageAlign === a.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                          )}>
                                          <a.icon className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>{a.label}</TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0">Width</span>
                                <input type="range" min={10} max={100} step={5} value={block.imageWidth}
                                  onChange={(e) => updateBlock(block.id, { imageWidth: Number(e.target.value) })}
                                  className="flex-1 accent-primary" />
                                <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{block.imageWidth}%</span>
                              </div>
                              <Input placeholder="Caption (optional)..." value={block.imageCaption}
                                onChange={(e) => updateBlock(block.id, { imageCaption: e.target.value })}
                                className="h-7 text-[11px] border-0 bg-background" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quick add */}
              {blocks.length > 0 && (
                <div className="flex items-center gap-1 pt-1">
                  <span className="text-[9px] text-muted-foreground mr-0.5">Add:</span>
                  {BLOCK_TYPE_LIST.map((bt) => {
                    const BIcon = BLOCK_META[bt].icon
                    return (
                      <Tooltip key={bt}>
                        <TooltipTrigger asChild>
                          <button onClick={() => addBlock(bt)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-dashed border-muted-foreground/15 text-muted-foreground/40 transition-all hover:border-primary/30 hover:text-primary hover:bg-primary/5">
                            <BIcon className="h-2.5 w-2.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{BLOCK_META[bt].label}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================= */}
        {/* RIGHT COLUMN: Live Preview                                      */}
        {/* ============================================================= */}
        <div className={cn("lg:sticky lg:top-4 space-y-4", mobileView === "editor" && "hidden lg:block")}>
          <Card>
            <CardContent className="p-3 sm:p-4 space-y-3">
              {/* Preview header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight">Live Preview</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" className="h-7 px-2.5 text-xs gap-1.5" onClick={generatePdf} disabled={generating || blocks.length === 0}>
                    {generating ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {generating ? "..." : "Generate"}
                  </Button>
                  {pdfBlob && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={downloadPdf}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download PDF</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Page navigation for preview */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous page</TooltipContent>
                  </Tooltip>
                  <span className="text-xs font-medium text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next page</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Live page surface */}
              <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
                <div
                  className={cn("bg-white rounded-sm shadow-lg mx-auto transition-all", FONT_CSS[settings.font])}
                  style={{
                    position: "relative",
                    paddingTop: settings.marginTop * MM_SCALE,
                    paddingRight: settings.marginRight * MM_SCALE,
                    paddingBottom: Math.max(settings.marginBottom * MM_SCALE, 40),
                    paddingLeft: settings.marginLeft * MM_SCALE,
                    fontSize: settings.fontSize,
                    lineHeight: settings.lineSpacing,
                    color: "#1a1a1a",
                    minHeight: 500,
                    overflow: "hidden",
                  }}
                >
                  {blocks.filter((b) => b.page === currentPage).length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#ccc", fontSize: 13 }}>
                      {blocks.length === 0 ? "Add content blocks to see preview" : `Page ${currentPage} is empty`}
                    </div>
                  ) : (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                      <div style={{ position: "relative", minHeight: 460 }}>
                        {blocks.filter((b) => b.page === currentPage).map((block) => (
                          <DraggablePreviewBlock
                            key={block.id}
                            block={block}
                            isActive={block.id === activeBlockId}
                            headingPx={headingPx}
                            onClick={() => handlePreviewBlockClick(block.id)}
                          />
                        ))}
                      </div>
                    </DndContext>
                  )}
                </div>
              </div>

              {pdfBlob && (
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="font-mono text-[10px]">{formatBytes(pdfBlob.size)}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated PDF iframe */}
          {previewUrl && (
            <Card>
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground">Generated PDF</h3>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={downloadPdf}>
                    <Download className="mr-1 h-2.5 w-2.5" /> Download
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <iframe src={previewUrl} title="PDF Preview" className="h-[400px] w-full border-0" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
