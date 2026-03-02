import { Link, useRouterState } from "@tanstack/react-router"
import {
  FileUp,
  FileDown,
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
  FilePlus,
  FileKey,
  FileSearch,
  PenTool,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"

interface NavItem {
  title: string
  url: string
  icon: LucideIcon
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "PDF Tools",
    items: [
      { title: "PDF to Base64", url: "/pdf-to-base64", icon: FileUp },
      { title: "Base64 to PDF", url: "/base64-to-pdf", icon: FileDown },
      { title: "PDF Generator", url: "/pdf-generator", icon: FilePlus },
    ],
  },
  {
    label: "Encode / Decode",
    items: [
      { title: "File to Base64", url: "/file-to-base64", icon: FileType },
      { title: "Base64 to File", url: "/base64-to-file", icon: FileOutput },
      { title: "Base64 to Text", url: "/base64-to-text", icon: FileText },
      { title: "URL Encoder", url: "/url-encoder", icon: Globe },
      { title: "Number Base", url: "/number-base", icon: Binary },
      { title: "UUID Generator", url: "/uuid-generator", icon: Fingerprint },
    ],
  },
  {
    label: "Converters",
    items: [
      { title: "XML / JSON", url: "/xml-json", icon: FileCode },
      { title: "YAML / JSON", url: "/yaml-json", icon: FileJson },
      { title: "CSV / JSON", url: "/csv-json", icon: Table },
    ],
  },
  {
    label: "Certificate / Signing",
    items: [
      { title: "Certificate Decoder", url: "/certificate-decoder", icon: ShieldCheck },
      { title: "PEM / DER Converter", url: "/pem-converter", icon: ArrowLeftRight },
      { title: "JWT Decoder", url: "/jwt-decoder", icon: KeyRound },
      { title: "PKCS#7 / CMS Viewer", url: "/pkcs7-viewer", icon: FileArchive },
      { title: "CRL Parser", url: "/crl-parser", icon: FileX2 },
      { title: "Chain Validator", url: "/chain-validator", icon: Link2 },
      { title: "CSR Generator", url: "/csr-generator", icon: FilePlus2 },
      { title: "CSR Decoder", url: "/csr-decoder", icon: FileSearch },
      { title: "CSR Signer", url: "/csr-signer", icon: PenTool },
      { title: "PFX Converter", url: "/pfx-converter", icon: FileKey },
    ],
  },
  {
    label: "Formatters",
    items: [
      { title: "JSON Formatter", url: "/json-formatter", icon: Braces },
      { title: "XML Formatter", url: "/xml-formatter", icon: FileCode },
      { title: "YAML Formatter", url: "/yaml-formatter", icon: FileJson },
    ],
  },
  {
    label: "Text / Data",
    items: [
      { title: "Regex Tester", url: "/regex-tester", icon: SearchCode },
      { title: "Diff Viewer", url: "/diff-viewer", icon: GitCompareArrows },
      { title: "Color Converter", url: "/color-converter", icon: Palette },
    ],
  },
  {
    label: "Utilities",
    items: [
      { title: "Hash Generator", url: "/hash-generator", icon: Hash },
      { title: "Timestamp", url: "/timestamp", icon: Clock },
    ],
  },
]

export function AppSidebar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Brand */}
      <SidebarHeader className="px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Dev Tool"
              className="hover:bg-sidebar-accent"
            >
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center">
                  <img
                    src={import.meta.env.BASE_URL + "logo.png"}
                    alt="Dev Tool"
                    className="size-7"
                  />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold tracking-tight">
                    Dev Tool
                  </span>
                  <span className="truncate text-[11px] text-sidebar-foreground/50">
                    Developer Utilities
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Navigation with collapsible category groups */}
      <SidebarContent>
        {navGroups.map((group) => {
          const hasActiveItem = group.items.some(
            (item) => currentPath === item.url,
          )

          return (
            <Collapsible
              key={group.label}
              defaultOpen={hasActiveItem}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel
                  asChild
                  className="group/label cursor-pointer select-none hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors duration-150"
                >
                  <CollapsibleTrigger>
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-sidebar-primary/70 opacity-0 transition-opacity duration-150 group-hover/label:opacity-100" />
                    {group.label}
                    <ChevronRight className="ml-auto size-3.5 text-sidebar-foreground/30 transition-all duration-200 group-hover/label:text-sidebar-foreground/70 group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const active = currentPath === item.url
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton
                              asChild
                              isActive={active}
                              tooltip={item.title}
                            >
                              <Link to={item.url}>
                                <item.icon />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <SidebarSeparator />
        <div className="px-2 py-2">
          <p className="text-[10px] text-sidebar-foreground/25 text-center leading-relaxed">
            Ctrl+B sidebar &middot; Ctrl+K search
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
