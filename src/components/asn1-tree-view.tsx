import { useState } from "react"
import {
  type Asn1Node,
  getTagName,
  getNodeDisplayValue,
  decodeOid,
} from "@/utils/asn1-parser"
import { resolveOid } from "@/utils/oids"
import { cn } from "@/lib/utils"
import { ChevronRight, ChevronDown } from "lucide-react"

interface Asn1TreeViewProps {
  node: Asn1Node
  depth?: number
  defaultExpanded?: number
}

const TAG_COLORS: Record<number, string> = {
  0x02: "text-blue-400", // INTEGER
  0x03: "text-amber-400", // BIT STRING
  0x04: "text-amber-400", // OCTET STRING
  0x05: "text-muted-foreground", // NULL
  0x06: "text-emerald-400", // OID
  0x0c: "text-orange-300", // UTF8String
  0x13: "text-orange-300", // PrintableString
  0x16: "text-orange-300", // IA5String
  0x17: "text-sky-400", // UTCTime
  0x18: "text-sky-400", // GeneralizedTime
  0x10: "text-violet-400", // SEQUENCE
  0x11: "text-violet-400", // SET
  0x1e: "text-orange-300", // BMPString
}

export function Asn1TreeView({
  node,
  depth = 0,
  defaultExpanded = 4,
}: Asn1TreeViewProps) {
  const [expanded, setExpanded] = useState(depth < defaultExpanded)

  const tagName = getTagName(node)
  const hasChildren = node.children && node.children.length > 0
  const displayValue = getNodeDisplayValue(node)

  const tagColor =
    node.tagClass === 0
      ? TAG_COLORS[node.tagNumber] ?? "text-foreground"
      : "text-pink-400"

  // For OID nodes, show the resolved name
  let oidAnnotation: string | null = null
  if (node.tagClass === 0 && node.tagNumber === 0x06 && !node.constructed) {
    const oid = decodeOid(node.value)
    const name = resolveOid(oid)
    if (name !== oid) oidAnnotation = name
  }

  return (
    <div className="font-mono text-xs leading-relaxed">
      <button
        onClick={() => hasChildren && setExpanded((e) => !e)}
        className={cn(
          "flex items-start gap-1 w-full text-left rounded-sm px-1 py-px transition-colors",
          hasChildren
            ? "hover:bg-accent/40 cursor-pointer"
            : "cursor-default"
        )}
      >
        {/* Expand/collapse icon */}
        <span className="w-3.5 shrink-0 mt-0.5">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="inline-block w-3" />
          )}
        </span>

        {/* Tag name */}
        <span className={cn("font-semibold shrink-0", tagColor)}>
          {tagName}
        </span>

        {/* Size info */}
        <span className="text-muted-foreground shrink-0">
          ({node.length}
          {hasChildren ? ` elem, ${node.children!.length} children` : " bytes"}
          )
        </span>

        {/* Value or OID annotation */}
        {displayValue && (
          <span className="text-foreground/80 break-all ml-1">
            {displayValue}
          </span>
        )}
        {oidAnnotation && !displayValue && (
          <span className="text-emerald-400/70 ml-1">{oidAnnotation}</span>
        )}
      </button>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="ml-4 border-l border-border/40 pl-1">
          {node.children!.map((child, i) => (
            <Asn1TreeView
              key={`${child.offset}-${i}`}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}
