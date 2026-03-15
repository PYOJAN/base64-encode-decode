import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Download,
  Eye,
  FilePlus,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Minus,
  Plus,
  Save,
  Square,
  Trash2,
  Type,
} from "lucide-react"
import { jsPDF } from "jspdf"
import { toast } from "sonner"
import { ToolPageLayout } from "@/components"
import { PdfViewer } from "@/components/pdf-viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdvancedColorPicker } from "@/components/ui/advanced-color-picker"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { hexToRgb } from "@/utils/color"

export const Route = createFileRoute("/pdf-generator")({
  component: PdfGeneratorPage,
})

type ElementType = "heading" | "text" | "divider" | "box" | "image"
type PageSize = "a4" | "letter" | "legal" | "a5"
type Orientation = "portrait" | "landscape"
type FontFamily = "helvetica" | "times" | "courier"
type TextAlign = "left" | "center" | "right"

type PdfElement = {
  id: string
  type: ElementType
  page: number
  x: number
  y: number
  w: number
  h: number
  z: number
  text: string
  fontSize: number
  color: string
  align: TextAlign
  opacity: number
  fillColor: string
  borderColor: string
  imageData?: string
  imageName?: string
}

type DocSettings = {
  pageSize: PageSize
  orientation: Orientation
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  font: FontFamily
  background: string
  showGuides: boolean
}

type DocMeta = {
  fileName: string
  title: string
  author: string
  subject: string
  keywords: string
}

type ContextMenuState = {
  screenX: number
  screenY: number
  canvasX: number
  canvasY: number
  targetId: string | null
}

const PAGE_DIMENSIONS: Record<PageSize, { w: number; h: number; label: string }> = {
  a4: { w: 210, h: 297, label: "A4" },
  letter: { w: 216, h: 279, label: "Letter" },
  legal: { w: 216, h: 356, label: "Legal" },
  a5: { w: 148, h: 210, label: "A5" },
}

const PX_PER_MM = 3

const DEFAULT_SETTINGS: DocSettings = {
  pageSize: "a4",
  orientation: "portrait",
  marginTop: 16,
  marginRight: 16,
  marginBottom: 16,
  marginLeft: 16,
  font: "helvetica",
  background: "#ffffff",
  showGuides: true,
}

const DEFAULT_META: DocMeta = {
  fileName: "live-pdf-document",
  title: "",
  author: "",
  subject: "",
  keywords: "",
}

function createId() {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function defaultElement(type: ElementType, page: number, x = 40, y = 40, z = 1): PdfElement {
  if (type === "heading") {
    return {
      id: createId(),
      type,
      page,
      x,
      y,
      w: 360,
      h: 38,
      z,
      text: "Heading",
      fontSize: 24,
      color: "#0f172a",
      align: "left",
      opacity: 1,
      fillColor: "#e2e8f0",
      borderColor: "#64748b",
    }
  }

  if (type === "text") {
    return {
      id: createId(),
      type,
      page,
      x,
      y,
      w: 360,
      h: 88,
      z,
      text: "Editable paragraph text. Double-click and type directly on canvas.",
      fontSize: 13,
      color: "#1e293b",
      align: "left",
      opacity: 1,
      fillColor: "#f8fafc",
      borderColor: "#cbd5e1",
    }
  }

  if (type === "divider") {
    return {
      id: createId(),
      type,
      page,
      x,
      y,
      w: 320,
      h: 2,
      z,
      text: "",
      fontSize: 12,
      color: "#64748b",
      align: "left",
      opacity: 1,
      fillColor: "#f8fafc",
      borderColor: "#64748b",
    }
  }

  if (type === "box") {
    return {
      id: createId(),
      type,
      page,
      x,
      y,
      w: 260,
      h: 88,
      z,
      text: "Callout text",
      fontSize: 12,
      color: "#0f172a",
      align: "left",
      opacity: 0.2,
      fillColor: "#0ea5e9",
      borderColor: "#0284c7",
    }
  }

  return {
    id: createId(),
    type,
    page,
    x,
    y,
    w: 240,
    h: 160,
    z,
    text: "",
    fontSize: 12,
    color: "#0f172a",
    align: "center",
    opacity: 1,
    fillColor: "#f8fafc",
    borderColor: "#94a3b8",
  }
}

function PdfGeneratorPage() {
  const [settings, setSettings] = useState<DocSettings>(DEFAULT_SETTINGS)
  const [meta, setMeta] = useState<DocMeta>(DEFAULT_META)
  const [elements, setElements] = useState<PdfElement[]>([
    defaultElement("heading", 1, 24, 26, 1),
    defaultElement("text", 1, 24, 78, 2),
  ])

  const [activePage, setActivePage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState("elements")
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pdfDataUri, setPdfDataUri] = useState("")
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [generating, setGenerating] = useState(false)

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const dragRef = useRef<{
    id: string
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)

  const selected = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId]
  )

  const pageSizeMm = useMemo(() => {
    const base = PAGE_DIMENSIONS[settings.pageSize]
    return settings.orientation === "portrait"
      ? { w: base.w, h: base.h }
      : { w: base.h, h: base.w }
  }, [settings.orientation, settings.pageSize])

  const pageSizePx = useMemo(
    () => ({ w: pageSizeMm.w * PX_PER_MM, h: pageSizeMm.h * PX_PER_MM }),
    [pageSizeMm.h, pageSizeMm.w]
  )

  const contentAreaPx = useMemo(() => {
    const left = settings.marginLeft * PX_PER_MM
    const top = settings.marginTop * PX_PER_MM
    const width = Math.max(100, pageSizePx.w - (settings.marginLeft + settings.marginRight) * PX_PER_MM)
    const height = Math.max(100, pageSizePx.h - (settings.marginTop + settings.marginBottom) * PX_PER_MM)
    return { left, top, width, height }
  }, [pageSizePx.h, pageSizePx.w, settings.marginBottom, settings.marginLeft, settings.marginRight, settings.marginTop])

  const pageElements = useMemo(
    () => elements.filter((e) => e.page === activePage).sort((a, b) => a.z - b.z),
    [activePage, elements]
  )

  const updateSettings = useCallback(<K extends keyof DocSettings>(key: K, value: DocSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateMeta = useCallback(<K extends keyof DocMeta>(key: K, value: DocMeta[K]) => {
    setMeta((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateElement = useCallback((id: string, patch: Partial<PdfElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const addElement = useCallback(
    (type: ElementType, x?: number, y?: number) => {
      const z = elements.length ? Math.max(...elements.map((e) => e.z)) + 1 : 1
      const next = defaultElement(type, activePage, x ?? 30, y ?? 30, z)
      setElements((prev) => [...prev, next])
      setSelectedId(next.id)
    },
    [activePage, elements]
  )

  const removeElement = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((e) => e.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
    [selectedId]
  )

  const duplicateElement = useCallback(
    (id: string) => {
      const source = elements.find((e) => e.id === id)
      if (!source) return
      const z = elements.length ? Math.max(...elements.map((e) => e.z)) + 1 : 1
      const copy = {
        ...source,
        id: createId(),
        x: source.x + 20,
        y: source.y + 20,
        z,
      }
      setElements((prev) => [...prev, copy])
      setSelectedId(copy.id)
    },
    [elements]
  )

  const addPage = () => {
    const next = totalPages + 1
    setTotalPages(next)
    setActivePage(next)
    setSelectedId(null)
  }

  const removePage = () => {
    if (totalPages <= 1) return
    setElements((prev) =>
      prev
        .filter((e) => e.page !== activePage)
        .map((e) => (e.page > activePage ? { ...e, page: e.page - 1 } : e))
    )
    setTotalPages((p) => p - 1)
    setActivePage((p) => Math.max(1, p - 1))
    setSelectedId(null)
  }

  const bringToFront = useCallback(
    (id: string) => {
      const maxZ = elements.length ? Math.max(...elements.map((e) => e.z)) : 1
      updateElement(id, { z: maxZ + 1 })
    },
    [elements, updateElement]
  )

  const onCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const container = canvasRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const target = (e.target as HTMLElement).closest("[data-element-id]") as HTMLElement | null
    const targetId = target?.dataset.elementId ?? null

    const rawX = e.clientX - rect.left - contentAreaPx.left
    const rawY = e.clientY - rect.top - contentAreaPx.top

    const canvasX = Math.max(0, Math.min(contentAreaPx.width - 24, rawX))
    const canvasY = Math.max(0, Math.min(contentAreaPx.height - 24, rawY))

    if (targetId) setSelectedId(targetId)

    setContextMenu({
      screenX: e.clientX,
      screenY: e.clientY,
      canvasX,
      canvasY,
      targetId,
    })
  }

  const onElementMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()

    const el = elements.find((item) => item.id === id)
    if (!el) return

    setSelectedId(id)
    dragRef.current = {
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: el.x,
      startY: el.y,
    }
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const active = dragRef.current

      const dx = e.clientX - active.startClientX
      const dy = e.clientY - active.startClientY

      setElements((prev) =>
        prev.map((item) => {
          if (item.id !== active.id) return item

          const maxX = Math.max(0, contentAreaPx.width - item.w)
          const maxY = Math.max(0, contentAreaPx.height - item.h)

          const x = Math.max(0, Math.min(maxX, active.startX + dx))
          const y = Math.max(0, Math.min(maxY, active.startY + dy))

          return { ...item, x, y }
        })
      )
    }

    const handleUp = () => {
      dragRef.current = null
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)

    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [contentAreaPx.height, contentAreaPx.width])

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const menu = contextMenuRef.current
      if (!menu) return
      if (!menu.contains(e.target as Node)) setContextMenu(null)
    }

    if (contextMenu) {
      window.addEventListener("mousedown", onOutside)
      return () => window.removeEventListener("mousedown", onOutside)
    }

    return undefined
  }, [contextMenu])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      const step = e.shiftKey ? 10 : 1
      if (e.key === "Delete") {
        removeElement(selectedId)
        return
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return

      e.preventDefault()
      const selectedItem = elements.find((item) => item.id === selectedId)
      if (!selectedItem) return

      let nextX = selectedItem.x
      let nextY = selectedItem.y

      if (e.key === "ArrowLeft") nextX -= step
      if (e.key === "ArrowRight") nextX += step
      if (e.key === "ArrowUp") nextY -= step
      if (e.key === "ArrowDown") nextY += step

      const maxX = Math.max(0, contentAreaPx.width - selectedItem.w)
      const maxY = Math.max(0, contentAreaPx.height - selectedItem.h)

      updateElement(selectedId, {
        x: Math.max(0, Math.min(maxX, nextX)),
        y: Math.max(0, Math.min(maxY, nextY)),
      })
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [contentAreaPx.height, contentAreaPx.width, elements, removeElement, selectedId, updateElement])

  const handleUploadForSelected = (file: File) => {
    if (!selected || selected.type !== "image") return
    const reader = new FileReader()
    reader.onload = () => {
      updateElement(selected.id, {
        imageData: reader.result as string,
        imageName: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  const exportProject = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
      meta,
      totalPages,
      elements,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${meta.fileName || "pdf-canvas-project"}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importProject = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          settings?: DocSettings
          meta?: DocMeta
          totalPages?: number
          elements?: PdfElement[]
        }

        if (!parsed.elements || !Array.isArray(parsed.elements)) {
          toast.error("Invalid project file")
          return
        }

        if (parsed.settings) setSettings(parsed.settings)
        if (parsed.meta) setMeta(parsed.meta)
        if (parsed.totalPages) setTotalPages(Math.max(1, parsed.totalPages))

        setElements(parsed.elements.map((el) => ({ ...el, id: el.id || createId() })))
        setActivePage(1)
        setSelectedId(null)
        toast.success("Project imported")
      } catch {
        toast.error("Could not import project")
      }
    }
    reader.readAsText(file)
  }

  const generatePdf = useCallback(
    async (openDialog: boolean) => {
      if (elements.length === 0) {
        toast.error("Add at least one element")
        return
      }

      setGenerating(true)

      const pxToMm = (px: number) => px / PX_PER_MM

      const getImageMeta = (src: string) =>
        new Promise<{ w: number; h: number; format: "PNG" | "JPEG" | "WEBP" }>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            const ext = (src.match(/^data:image\/(png|jpeg|jpg|webp)/i)?.[1] || "png").toLowerCase()
            const format: "PNG" | "JPEG" | "WEBP" =
              ext === "jpg" || ext === "jpeg" ? "JPEG" : ext === "webp" ? "WEBP" : "PNG"
            resolve({ w: img.width, h: img.height, format })
          }
          img.onerror = () => reject(new Error("Image decode failed"))
          img.src = src
        })

      try {
        const doc = new jsPDF({
          orientation: settings.orientation,
          unit: "mm",
          format: settings.pageSize,
        })

        doc.setProperties({
          title: meta.title || "Canvas PDF",
          author: meta.author,
          subject: meta.subject,
          keywords: meta.keywords,
        })

        for (let page = 1; page <= totalPages; page++) {
          if (page > 1) doc.addPage()

          const current = elements
            .filter((item) => item.page === page)
            .sort((a, b) => a.z - b.z)

          for (const item of current) {
            const x = settings.marginLeft + pxToMm(item.x)
            const y = settings.marginTop + pxToMm(item.y)
            const w = pxToMm(item.w)
            const h = pxToMm(item.h)

            if (item.type === "heading" || item.type === "text") {
              const rgb = hexToRgb(item.color)
              if (rgb) doc.setTextColor(rgb.r, rgb.g, rgb.b)
              doc.setFont(settings.font, item.type === "heading" ? "bold" : "normal")
              doc.setFontSize(item.fontSize)
              const lines = doc.splitTextToSize(item.text || "", w)
              const lineHeight = item.fontSize * 0.3528 * 1.2

              let textX = x
              if (item.align === "center") textX = x + w / 2
              if (item.align === "right") textX = x + w

              doc.text(lines, textX, y + lineHeight * 0.85, {
                align: item.align,
                maxWidth: w,
              })
              doc.setTextColor(0, 0, 0)
              continue
            }

            if (item.type === "divider") {
              const rgb = hexToRgb(item.borderColor)
              if (rgb) doc.setDrawColor(rgb.r, rgb.g, rgb.b)
              doc.setLineWidth(0.5)
              doc.line(x, y + h / 2, x + w, y + h / 2)
              continue
            }

            if (item.type === "box") {
              const fill = hexToRgb(item.fillColor)
              const border = hexToRgb(item.borderColor)
              if (fill) doc.setFillColor(fill.r, fill.g, fill.b)
              if (border) doc.setDrawColor(border.r, border.g, border.b)
              doc.roundedRect(x, y, w, h, 1.8, 1.8, "FD")

              const textColor = hexToRgb(item.color)
              if (textColor) doc.setTextColor(textColor.r, textColor.g, textColor.b)
              doc.setFont(settings.font, "normal")
              doc.setFontSize(item.fontSize)
              const lines = doc.splitTextToSize(item.text || "", w - 4)
              doc.text(lines, x + 2, y + 4.5)
              doc.setTextColor(0, 0, 0)
              continue
            }

            if (item.type === "image" && item.imageData) {
              const metaImage = await getImageMeta(item.imageData)
              const targetRatio = w / h
              const sourceRatio = metaImage.w / metaImage.h

              let drawW = w
              let drawH = h
              if (sourceRatio > targetRatio) {
                drawH = w / sourceRatio
              } else {
                drawW = h * sourceRatio
              }

              const dx = x + (w - drawW) / 2
              const dy = y + (h - drawH) / 2

              doc.addImage(item.imageData, metaImage.format, dx, dy, drawW, drawH)
            }
          }
        }

        const blob = doc.output("blob")
        const dataUri = doc.output("datauristring")
        setPdfBlob(blob)
        setPdfDataUri(dataUri)

        if (openDialog) setPreviewOpen(true)
        toast.success(`PDF generated (${formatBytes(blob.size)})`)
      } catch (error) {
        console.error(error)
        toast.error("Failed to generate PDF")
      } finally {
        setGenerating(false)
      }
    },
    [elements, meta.author, meta.keywords, meta.subject, meta.title, settings, totalPages]
  )

  const downloadPdf = () => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement("a")
    const base = meta.fileName.trim() || "document"
    a.href = url
    a.download = base.endsWith(".pdf") ? base : `${base}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ToolPageLayout
      icon={FilePlus}
      title="Live PDF Generator"
      description="Drag, place, and edit elements directly on the live PDF canvas. Right-click for quick element controls."
      badge="Canvas PDF"
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Controls</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">P {activePage}/{totalPages}</Badge>
                {pdfBlob && <Badge variant="secondary" className="text-[10px] font-mono">{formatBytes(pdfBlob.size)}</Badge>}
              </div>
            </div>
          </CardHeader>

          <CardContent className="h-[calc(100%-4rem)] overflow-auto">
            <div className="flex flex-wrap gap-2 pb-3">
              <Button size="sm" onClick={() => generatePdf(true)} disabled={generating}>
                {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />} Preview
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPdf} disabled={!pdfBlob}><Download className="mr-1.5 h-4 w-4" />Download</Button>
            </div>

            <div className="flex flex-wrap gap-2 pb-3">
              <Button size="sm" variant="outline" onClick={addPage}><Plus className="mr-1.5 h-4 w-4" />Page</Button>
              <Button size="sm" variant="outline" onClick={removePage} disabled={totalPages === 1}><Trash2 className="mr-1.5 h-4 w-4" />Remove Page</Button>
              <Button size="sm" variant="outline" onClick={exportProject}><Save className="mr-1.5 h-4 w-4" />Export</Button>
              <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}><FileUp className="mr-1.5 h-4 w-4" />Import</Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) importProject(file)
                  e.target.value = ""
                }}
              />
            </div>

            <Tabs value={leftTab} onValueChange={setLeftTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="elements">Elements</TabsTrigger>
                <TabsTrigger value="selected">Selected</TabsTrigger>
                <TabsTrigger value="document">Document</TabsTrigger>
              </TabsList>

              <TabsContent value="elements" className="space-y-3">
                <QuickAdd title="Heading" icon={Type} onClick={() => addElement("heading")} />
                <QuickAdd title="Text" icon={Type} onClick={() => addElement("text")} />
                <QuickAdd title="Divider" icon={Minus} onClick={() => addElement("divider")} />
                <QuickAdd title="Box" icon={Square} onClick={() => addElement("box")} />
                <QuickAdd title="Image" icon={ImageIcon} onClick={() => addElement("image")} />
                <p className="text-xs text-muted-foreground">Tip: Right-click on canvas to add at cursor position.</p>
              </TabsContent>

              <TabsContent value="selected" className="space-y-3">
                {!selected && <p className="text-xs text-muted-foreground">Select an element to edit its properties.</p>}
                {selected && (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] uppercase">{selected.type}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => bringToFront(selected.id)}>Bring Front</Button>
                    </div>

                    <Field label="X"><Input type="number" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                    <Field label="Y"><Input type="number" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                    <Field label="Width"><Input type="number" min={20} value={Math.round(selected.w)} onChange={(e) => updateElement(selected.id, { w: Math.max(20, Number(e.target.value) || 20) })} /></Field>
                    <Field label="Height"><Input type="number" min={2} value={Math.round(selected.h)} onChange={(e) => updateElement(selected.id, { h: Math.max(2, Number(e.target.value) || 2) })} /></Field>

                    {(selected.type === "heading" || selected.type === "text" || selected.type === "box") && (
                      <>
                        <Field label="Text">
                          <Textarea value={selected.text} rows={4} className="resize-none" onChange={(e) => updateElement(selected.id, { text: e.target.value })} />
                        </Field>
                        <Field label="Font Size"><Input type="number" min={8} max={60} value={selected.fontSize} onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) || 12 })} /></Field>
                        <Field label="Text Color"><ColorInput value={selected.color} onChange={(value) => updateElement(selected.id, { color: value })} /></Field>
                      </>
                    )}

                    {(selected.type === "heading" || selected.type === "text") && (
                      <Field label="Alignment">
                        <select
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={selected.align}
                          onChange={(e) => updateElement(selected.id, { align: e.target.value as TextAlign })}
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </Field>
                    )}

                    {selected.type === "divider" && (
                      <Field label="Line Color"><ColorInput value={selected.borderColor} onChange={(value) => updateElement(selected.id, { borderColor: value })} /></Field>
                    )}

                    {selected.type === "box" && (
                      <>
                        <Field label="Fill Color"><ColorInput value={selected.fillColor} onChange={(value) => updateElement(selected.id, { fillColor: value })} /></Field>
                        <Field label="Border Color"><ColorInput value={selected.borderColor} onChange={(value) => updateElement(selected.id, { borderColor: value })} /></Field>
                        <Field label="Opacity"><Input type="number" min={0} max={1} step={0.05} value={selected.opacity} onChange={(e) => updateElement(selected.id, { opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })} /></Field>
                      </>
                    )}

                    {selected.type === "image" && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}><ImageIcon className="mr-1.5 h-4 w-4" />Upload</Button>
                          <Button size="sm" variant="outline" onClick={() => updateElement(selected.id, { imageData: undefined, imageName: undefined })}>Clear</Button>
                        </div>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadForSelected(file)
                            e.target.value = ""
                          }}
                        />
                        {selected.imageName && <p className="text-xs text-muted-foreground">{selected.imageName}</p>}
                      </>
                    )}

                    <Button size="sm" variant="destructive" onClick={() => removeElement(selected.id)}>Delete Element</Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="document" className="space-y-3">
                <Field label="File Name"><Input value={meta.fileName} onChange={(e) => updateMeta("fileName", e.target.value)} /></Field>
                <Field label="Title"><Input value={meta.title} onChange={(e) => updateMeta("title", e.target.value)} /></Field>
                <Field label="Author"><Input value={meta.author} onChange={(e) => updateMeta("author", e.target.value)} /></Field>
                <Field label="Subject"><Input value={meta.subject} onChange={(e) => updateMeta("subject", e.target.value)} /></Field>
                <Field label="Keywords"><Input value={meta.keywords} onChange={(e) => updateMeta("keywords", e.target.value)} /></Field>
                <Separator />

                <Field label="Page Size">
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={settings.pageSize} onChange={(e) => updateSettings("pageSize", e.target.value as PageSize)}>
                    {(Object.keys(PAGE_DIMENSIONS) as PageSize[]).map((size) => (
                      <option key={size} value={size}>{PAGE_DIMENSIONS[size].label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Orientation">
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={settings.orientation} onChange={(e) => updateSettings("orientation", e.target.value as Orientation)}>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </Field>

                <Field label="Font Family">
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={settings.font} onChange={(e) => updateSettings("font", e.target.value as FontFamily)}>
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times</option>
                    <option value="courier">Courier</option>
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Top"><Input type="number" min={5} max={40} value={settings.marginTop} onChange={(e) => updateSettings("marginTop", Number(e.target.value) || 10)} /></Field>
                  <Field label="Right"><Input type="number" min={5} max={40} value={settings.marginRight} onChange={(e) => updateSettings("marginRight", Number(e.target.value) || 10)} /></Field>
                  <Field label="Bottom"><Input type="number" min={5} max={40} value={settings.marginBottom} onChange={(e) => updateSettings("marginBottom", Number(e.target.value) || 10)} /></Field>
                  <Field label="Left"><Input type="number" min={5} max={40} value={settings.marginLeft} onChange={(e) => updateSettings("marginLeft", Number(e.target.value) || 10)} /></Field>
                </div>

                <Field label="Page Background"><ColorInput value={settings.background} onChange={(value) => updateSettings("background", value)} /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.showGuides} onChange={(e) => updateSettings("showGuides", e.target.checked)} /> Show margin guides</label>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">Live Canvas</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setActivePage((p) => Math.max(1, p - 1))} disabled={activePage <= 1}>Prev</Button>
                <Badge variant="outline" className="text-[10px]">Page {activePage} of {totalPages}</Badge>
                <Button variant="outline" size="sm" onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))} disabled={activePage >= totalPages}>Next</Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="h-[calc(100%-4rem)] overflow-auto bg-muted/20">
            <div className="flex min-h-full items-start justify-center py-4">
              <div
                ref={canvasRef}
                className="relative select-none shadow-xl"
                style={{
                  width: pageSizePx.w,
                  minHeight: pageSizePx.h,
                  backgroundColor: settings.background,
                }}
                onMouseDown={() => setSelectedId(null)}
                onContextMenu={onCanvasContextMenu}
              >
                <div
                  className={cn(
                    "absolute",
                    settings.showGuides ? "border border-dashed border-slate-300" : "border border-transparent"
                  )}
                  style={{
                    left: contentAreaPx.left,
                    top: contentAreaPx.top,
                    width: contentAreaPx.width,
                    height: contentAreaPx.height,
                  }}
                >
                  {pageElements.map((item) => {
                    const isSelected = item.id === selectedId
                    const isText = item.type === "heading" || item.type === "text"

                    return (
                      <div
                        key={item.id}
                        data-element-id={item.id}
                        className={cn(
                          "absolute",
                          isSelected && "ring-2 ring-sky-400"
                        )}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: item.w,
                          height: item.h,
                          zIndex: item.z,
                          cursor: "move",
                        }}
                        onMouseDown={(e) => onElementMouseDown(e, item.id)}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(item.id)
                        }}
                      >
                        {item.type === "divider" && (
                          <div style={{ height: 2, marginTop: item.h / 2 }} className="w-full" >
                            <div className="h-[2px] w-full" style={{ backgroundColor: item.borderColor }} />
                          </div>
                        )}

                        {item.type === "box" && (
                          <div
                            className="h-full w-full rounded-md border p-2"
                            style={{
                              borderColor: item.borderColor,
                              backgroundColor: item.fillColor,
                              opacity: Math.max(0.05, item.opacity),
                              color: item.color,
                              fontSize: item.fontSize,
                              textAlign: item.align,
                              overflow: "hidden",
                            }}
                          >
                            {item.text}
                          </div>
                        )}

                        {item.type === "image" && (
                          <div className="h-full w-full overflow-hidden rounded-md border border-slate-300 bg-slate-50">
                            {item.imageData ? (
                              <img src={item.imageData} alt={item.imageName || "image"} className="h-full w-full object-contain" draggable={false} />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Image Placeholder</div>
                            )}
                          </div>
                        )}

                        {isText && (
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            spellCheck={false}
                            className={cn("h-full w-full bg-transparent outline-none", item.type === "heading" ? "font-semibold" : "")}
                            style={{
                              color: item.color,
                              fontSize: item.fontSize,
                              textAlign: item.align,
                              lineHeight: 1.3,
                              whiteSpace: "pre-wrap",
                              overflow: "hidden",
                            }}
                            onBlur={(e) => updateElement(item.id, { text: e.currentTarget.textContent || "" })}
                            onMouseDown={(e) => {
                              if (e.detail >= 2) e.stopPropagation()
                            }}
                          >
                            {item.text}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[220px] rounded-md border bg-popover p-1 shadow-lg"
          style={{ left: contextMenu.screenX + 4, top: contextMenu.screenY + 4 }}
        >
          <ContextItem label="Add Heading" onClick={() => { addElement("heading", contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null) }} />
          <ContextItem label="Add Text" onClick={() => { addElement("text", contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null) }} />
          <ContextItem label="Add Divider" onClick={() => { addElement("divider", contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null) }} />
          <ContextItem label="Add Box" onClick={() => { addElement("box", contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null) }} />
          <ContextItem label="Add Image" onClick={() => { addElement("image", contextMenu.canvasX, contextMenu.canvasY); setContextMenu(null) }} />
          <div className="my-1 border-t" />
          <ContextItem label="Open Document Settings" onClick={() => { setLeftTab("document"); setContextMenu(null) }} />
          {contextMenu.targetId && (
            <>
              <ContextItem label="Edit Selected Element" onClick={() => { setLeftTab("selected"); setSelectedId(contextMenu.targetId); setContextMenu(null) }} />
              <ContextItem label="Duplicate Element" onClick={() => { duplicateElement(contextMenu.targetId!); setContextMenu(null) }} />
              <ContextItem label="Delete Element" danger onClick={() => { removeElement(contextMenu.targetId!); setContextMenu(null) }} />
            </>
          )}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="pdf-preview-dialog flex h-[90vh] w-[85vw] max-w-[85vw] flex-col overflow-visible border-0 bg-transparent p-0 shadow-none">
          <VisuallyHidden.Root>
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription>Preview of generated PDF</DialogDescription>
          </VisuallyHidden.Root>
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg bg-background">
            {pdfDataUri && (
              <PdfViewer
                data={pdfDataUri}
                title={meta.title || "Canvas PDF Preview"}
                onDownload={downloadPdf}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ToolPageLayout>
  )
}

function QuickAdd({ title, icon: Icon, onClick }: { title: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <Button variant="outline" className="w-full justify-start" onClick={onClick}>
      <Icon className="mr-2 h-4 w-4" /> {title}
    </Button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <AdvancedColorPicker value={value} onChange={onChange} />
}

function ContextItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
        danger && "text-destructive hover:bg-destructive/10"
      )}
    >
      {label}
    </button>
  )
}
