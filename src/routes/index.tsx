import { createFileRoute, Link } from "@tanstack/react-router"
import {
  FileUp,
  FileDown,
  FilePlus,
  FileText,
  Braces,
  FileCode,
  Hash,
  Clock,
  FileType,
  FileOutput,
  ShieldCheck,
  ArrowLeftRight,
  Globe,

  Binary,
  Fingerprint,
  SearchCode,
  Table,
  Palette,
  FileJson,
  GitCompareArrows,
  KeyRound,
  FileArchive,
  FileX2,
  Link2,
  FilePlus2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/")({
  component: HomePage,
})

const tools = [
  {
    title: "PDF to Base64",
    description: "Encode PDF files to Base64 with preview",
    icon: FileUp,
    url: "/pdf-to-base64",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    title: "Base64 to PDF",
    description: "Decode Base64 to PDF with floating viewer",
    icon: FileDown,
    url: "/base64-to-pdf",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    title: "PDF Generator",
    description: "Create professional PDFs with text, images, and formatting",
    icon: FilePlus,
    url: "/pdf-generator",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    title: "Certificate Decoder",
    description: "Decode X.509 certificates and CSRs",
    icon: ShieldCheck,
    url: "/certificate-decoder",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    title: "PEM / DER Converter",
    description: "Convert between PEM and DER formats",
    icon: ArrowLeftRight,
    url: "/pem-converter",
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
  },
  {
    title: "JWT Decoder",
    description: "Decode and inspect JWT tokens",
    icon: KeyRound,
    url: "/jwt-decoder",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    title: "PKCS#7 / CMS Viewer",
    description: "Parse PKCS#7 signed data structures",
    icon: FileArchive,
    url: "/pkcs7-viewer",
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
  },
  {
    title: "CRL Parser",
    description: "Parse certificate revocation lists",
    icon: FileX2,
    url: "/crl-parser",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    title: "Chain Validator",
    description: "Validate certificate chains",
    icon: Link2,
    url: "/chain-validator",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    title: "CSR Generator",
    description: "Generate certificate signing requests",
    icon: FilePlus2,
    url: "/csr-generator",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    title: "File to Base64",
    description: "Encode any file into Base64",
    icon: FileType,
    url: "/file-to-base64",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    title: "Base64 to File",
    description: "Decode Base64 back to a file",
    icon: FileOutput,
    url: "/base64-to-file",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    title: "Base64 to Text",
    description: "Decode Base64 to readable text",
    icon: FileText,
    url: "/base64-to-text",
    color: "text-gray-400",
    bg: "bg-gray-400/10",
  },
  {
    title: "URL Encoder / Decoder",
    description: "Encode and decode URL components",
    icon: Globe,
    url: "/url-encoder",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    title: "Number Base Converter",
    description: "Convert between hex, decimal, octal, binary",
    icon: Binary,
    url: "/number-base",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    title: "UUID Generator",
    description: "Generate UUID v4 and v7 identifiers",
    icon: Fingerprint,
    url: "/uuid-generator",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    title: "JSON Formatter",
    description: "Format, minify, and validate JSON",
    icon: Braces,
    url: "/json-formatter",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    title: "XML Formatter",
    description: "Format and minify XML documents",
    icon: FileCode,
    url: "/xml-formatter",
    color: "text-teal-400",
    bg: "bg-teal-400/10",
  },
  {
    title: "YAML Formatter",
    description: "Format YAML and convert YAML/JSON",
    icon: FileJson,
    url: "/yaml-formatter",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    title: "Regex Tester",
    description: "Test regular expressions with live matching",
    icon: SearchCode,
    url: "/regex-tester",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    title: "Diff Viewer",
    description: "Compare text with char-level diffing",
    icon: GitCompareArrows,
    url: "/diff-viewer",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    title: "CSV / JSON Converter",
    description: "Convert between CSV and JSON formats",
    icon: Table,
    url: "/csv-json",
    color: "text-teal-400",
    bg: "bg-teal-400/10",
  },
  {
    title: "Color Converter",
    description: "Convert between HEX, RGB, HSL, HSV",
    icon: Palette,
    url: "/color-converter",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    title: "Hash Generator",
    description: "SHA hashes from text or files",
    icon: Hash,
    url: "/hash-generator",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    title: "Timestamp",
    description: "Convert Unix timestamps and dates",
    icon: Clock,
    url: "/timestamp",
    color: "text-sky-400",
    bg: "bg-sky-400/10",
  },
]

function HomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 sm:space-y-8 p-4 sm:p-6">
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3">
          <img
            src={import.meta.env.BASE_URL + "logo.png"}
            alt="Dev Tool"
            className="h-11 w-11"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dev Tool</h1>
            <p className="text-sm text-muted-foreground">
              A collection of developer utilities, right in your browser.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.url} to={tool.url} className="group">
            <Card className="h-full transition-all duration-150 hover:border-primary/25 hover:bg-card/80">
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tool.bg}`}
                >
                  <tool.icon className={`h-[18px] w-[18px] ${tool.color}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tool.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
