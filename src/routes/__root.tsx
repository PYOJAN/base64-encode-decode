import { useState, useEffect, useCallback } from "react"
import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router"
import { Toaster } from "sonner"
import { Search } from "lucide-react"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPalette } from "@/components/command-palette"
import { TooltipProvider } from "@/components/ui/tooltip"

export const Route = createRootRoute({
  component: RootLayout,
})

interface PageMeta { title: string; description: string }

const pageMeta: Record<string, PageMeta> = {
  "/": { title: "Home", description: "Free online developer utilities — Base64, PDF, certificates, JSON/XML/YAML formatters, hash, JWT, regex, and 20+ more tools. All processing happens locally in your browser." },
  "/certificate-decoder": { title: "Certificate Decoder", description: "Decode and inspect X.509 certificates and CSRs online. View subject, issuer, validity, extensions, SANs, key usage, and fingerprints. No data leaves your browser." },
  "/pem-converter": { title: "PEM / DER Converter", description: "Convert between PEM and DER certificate formats online. Supports X.509 certificates, keys, and CSRs. Free browser-based tool." },
  "/pdf-to-base64": { title: "PDF to Base64", description: "Convert PDF files to Base64 encoded strings online. Free, fast, and private — your PDF never leaves your browser." },
  "/base64-to-pdf": { title: "Base64 to PDF", description: "Decode Base64 strings back to PDF files with live preview. Free online tool, all processing in your browser." },
  "/pdf-generator": { title: "PDF Generator", description: "Create professional PDF documents with headings, paragraphs, images, and multi-page support. Drag-and-drop editor with live preview." },
  "/file-to-base64": { title: "File to Base64", description: "Encode any file to Base64 format online. Supports all file types. Free browser-based encoder, no upload to server." },
  "/base64-to-file": { title: "Base64 to File", description: "Decode Base64 strings back to downloadable files. Supports any file type. Free online decoder." },
  "/base64-to-text": { title: "Base64 to Text", description: "Decode Base64 encoded strings to readable text. Supports UTF-8. Free online Base64 text decoder." },
  "/json-formatter": { title: "JSON Formatter", description: "Format, minify, and validate JSON data online. Pretty-print with syntax highlighting. Free JSON beautifier tool." },
  "/xml-formatter": { title: "XML Formatter", description: "Format and minify XML documents online. Pretty-print with proper indentation. Free XML beautifier tool." },
  "/hash-generator": { title: "Hash Generator", description: "Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes from text or files in hex, Base64, and Base64URL formats. Free online hash calculator, all processing in browser." },
  "/timestamp": { title: "Timestamp Converter", description: "Convert Unix timestamps to human-readable dates and vice versa. Supports seconds and milliseconds. Free online timestamp tool." },
  "/url-encoder": { title: "URL Encoder / Decoder", description: "Encode and decode URL components online. Handles special characters and percent-encoding. Free URL encoding tool." },
  "/number-base": { title: "Number Base Converter", description: "Convert numbers between hexadecimal, decimal, octal, and binary formats. Free online number base converter." },
  "/uuid-generator": { title: "UUID Generator", description: "Generate UUID v4 and v7 identifiers online. Copy individual or bulk UUIDs. Free random UUID generator." },
  "/regex-tester": { title: "Regex Tester", description: "Test regular expressions with live matching and highlighting. Supports all JavaScript regex flags. Free online regex tester." },
  "/csv-json": { title: "CSV / JSON Converter", description: "Convert between CSV and JSON formats online. Supports custom delimiters. Free browser-based converter." },
  "/color-converter": { title: "Color Converter", description: "Convert colors between HEX, RGB, HSL, and HSV formats. Live color picker with instant conversion. Free online tool." },
  "/yaml-formatter": { title: "YAML Formatter", description: "Format YAML documents and convert between YAML and JSON. Pretty-print with proper indentation. Free online YAML tool." },
  "/diff-viewer": { title: "Diff Viewer", description: "Compare two texts with character-level diffing and highlighting. Side-by-side and inline views. Free online diff tool." },
  "/jwt-decoder": { title: "JWT Decoder", description: "Decode and inspect JWT tokens online. View header, payload, and signature. Check expiration and claims. Free JWT decoder." },
  "/pkcs7-viewer": { title: "PKCS#7 / CMS Viewer", description: "Parse and inspect PKCS#7/CMS signed-data structures. View embedded certificates, signers, and digest algorithms. Free online tool." },
  "/crl-parser": { title: "CRL Parser", description: "Parse X.509 Certificate Revocation Lists online. Search revoked certificates by serial number. Free CRL inspection tool." },
  "/chain-validator": { title: "Certificate Chain Validator", description: "Validate X.509 certificate chains. Verify issuer-subject relationships and trust paths. Free online chain validator." },
  "/csr-generator": { title: "CSR Generator", description: "Generate Certificate Signing Requests (CSR) with custom subject fields. In-browser key generation. Free online CSR tool." },
  "/pfx-converter": { title: "PFX / PKCS#12 Converter", description: "Extract certificates, private keys, and CA chains from PFX/PKCS#12 files into PEM/DER formats. Free browser-based tool, no data leaves your machine." },
  "/csr-decoder": { title: "CSR Decoder", description: "Decode and inspect Certificate Signing Requests (PKCS#10) online. View subject, public key, extensions, SANs, and fingerprints. No data leaves your browser." },
  "/csr-signer": { title: "CSR Signer", description: "Sign a Certificate Signing Request with an auto-generated CA. Generate signed certificates, CA certificates, and private keys. All processing in your browser." },
}

const pageTitles: Record<string, string> = Object.fromEntries(
  Object.entries(pageMeta).map(([k, v]) => [k, v.title])
)

function RootLayout() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const clean = pathname.replace(/^\/base64-encode-decode/, "") || "/"
  const pageTitle = pageTitles[clean] ?? "Dev Tool"

  const [paletteOpen, setPaletteOpen] = useState(false)

  // Update document title and meta description
  useEffect(() => {
    document.title = clean === "/" ? "Dev Tool - Free Online Developer Utilities" : `${pageTitle} - Dev Tool | Free Online Tool`
    const meta = pageMeta[clean]
    if (meta) {
      const descTag = document.querySelector('meta[name="description"]')
      if (descTag) descTag.setAttribute("content", meta.description)
    }
  }, [clean, pageTitle])

  // Disable right-click
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault()
    document.addEventListener("contextmenu", handler)
    return () => document.removeEventListener("contextmenu", handler)
  }, [])

  // Ctrl+K / Cmd+K to open palette
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault()
      setPaletteOpen((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <TooltipProvider delayDuration={300}>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-0.5" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium text-muted-foreground truncate">
            {pageTitle}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-xs text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
                Ctrl K
              </kbd>
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster theme="dark" richColors position="bottom-right" />
    </SidebarProvider>
    </TooltipProvider>
  )
}
