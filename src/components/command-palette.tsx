import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FileUp, FileDown, FileText, Braces, FileCode, Hash, Clock,
  FileType, FileOutput, ShieldCheck, ArrowLeftRight,
  Globe, Binary, Fingerprint, SearchCode, Table, Palette,
  FileJson, GitCompareArrows, KeyRound, FileArchive, FileX2, Link2,
  FilePlus2, FilePlus, FileKey, FileSearch, PenTool,
  type LucideIcon,
} from "lucide-react"

interface ToolEntry {
  title: string
  url: string
  icon: LucideIcon
  keywords: string
}

const tools: ToolEntry[] = [
  { title: "PDF to Base64", url: "/pdf-to-base64", icon: FileUp, keywords: "pdf encode upload" },
  { title: "Base64 to PDF", url: "/base64-to-pdf", icon: FileDown, keywords: "pdf decode download" },
  { title: "PDF Generator", url: "/pdf-generator", icon: FilePlus, keywords: "pdf create generate document" },
  { title: "Certificate Decoder", url: "/certificate-decoder", icon: ShieldCheck, keywords: "x509 cert ssl tls pem" },

  { title: "PEM / DER Converter", url: "/pem-converter", icon: ArrowLeftRight, keywords: "pem der hex convert" },
  { title: "File to Base64", url: "/file-to-base64", icon: FileType, keywords: "file encode upload" },
  { title: "Base64 to File", url: "/base64-to-file", icon: FileOutput, keywords: "file decode download" },
  { title: "Base64 to Text", url: "/base64-to-text", icon: FileText, keywords: "text decode string" },
  { title: "JSON Formatter", url: "/json-formatter", icon: Braces, keywords: "json format minify validate" },
  { title: "XML Formatter", url: "/xml-formatter", icon: FileCode, keywords: "xml format minify" },
  { title: "YAML Formatter", url: "/yaml-formatter", icon: FileJson, keywords: "yaml yml format convert json" },
  { title: "Hash Generator", url: "/hash-generator", icon: Hash, keywords: "sha hash md5 digest" },
  { title: "Timestamp Converter", url: "/timestamp", icon: Clock, keywords: "unix epoch date time" },
  { title: "URL Encoder / Decoder", url: "/url-encoder", icon: Globe, keywords: "url encode decode percent" },

  { title: "Number Base Converter", url: "/number-base", icon: Binary, keywords: "hex decimal octal binary number base convert" },
  { title: "UUID Generator", url: "/uuid-generator", icon: Fingerprint, keywords: "uuid guid v4 v7 random" },
  { title: "Regex Tester", url: "/regex-tester", icon: SearchCode, keywords: "regex regexp test match pattern" },
  { title: "CSV / JSON Converter", url: "/csv-json", icon: Table, keywords: "csv json table convert delimiter" },
  { title: "Color Converter", url: "/color-converter", icon: Palette, keywords: "color hex rgb hsl hsv picker" },
  { title: "Diff Viewer", url: "/diff-viewer", icon: GitCompareArrows, keywords: "diff compare text" },
  { title: "JWT Decoder", url: "/jwt-decoder", icon: KeyRound, keywords: "jwt token decode header payload" },
  { title: "PKCS#7 / CMS Viewer", url: "/pkcs7-viewer", icon: FileArchive, keywords: "pkcs7 cms signed data p7b" },
  { title: "CRL Parser", url: "/crl-parser", icon: FileX2, keywords: "crl revocation list" },
  { title: "Certificate Chain Validator", url: "/chain-validator", icon: Link2, keywords: "chain certificate validate issuer subject" },
  { title: "CSR Generator", url: "/csr-generator", icon: FilePlus2, keywords: "csr generate request key" },
  { title: "PFX / PKCS#12 Converter", url: "/pfx-converter", icon: FileKey, keywords: "pfx p12 pkcs12 convert extract certificate key pem cer der" },
  { title: "CSR Decoder", url: "/csr-decoder", icon: FileSearch, keywords: "csr decode inspect pkcs10 request" },
  { title: "CSR Signer", url: "/csr-signer", icon: PenTool, keywords: "csr sign self-signed certificate ca" },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const filtered = query.trim()
    ? tools.filter((t) => {
        const q = query.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.keywords.toLowerCase().includes(q)
        )
      })
    : tools

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = useCallback(
    (url: string) => {
      onOpenChange(false)
      navigate({ to: url })
    },
    [navigate, onOpenChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault()
      handleSelect(filtered[selectedIndex].url)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>
        <div className="border-b p-3">
          <Input
            ref={inputRef}
            placeholder="Search tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 bg-transparent border-0 focus-visible:ring-0 shadow-none px-0"
          />
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-1.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No tools found.
              </p>
            )}
            {filtered.map((tool, i) => (
              <button
                key={tool.url}
                onClick={() => handleSelect(tool.url)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tool.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tool.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
