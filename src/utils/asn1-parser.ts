import { resolveOid } from "./oids"

// ── Types ──

export interface Asn1Node {
  offset: number
  headerLen: number
  length: number
  totalLen: number
  tagClass: number // 0=universal, 1=application, 2=context, 3=private
  tagNumber: number
  constructed: boolean
  children?: Asn1Node[]
  value: Uint8Array
}

// ── Tag names ──

const UNIVERSAL_TAGS: Record<number, string> = {
  0x00: "EOC",
  0x01: "BOOLEAN",
  0x02: "INTEGER",
  0x03: "BIT STRING",
  0x04: "OCTET STRING",
  0x05: "NULL",
  0x06: "OBJECT IDENTIFIER",
  0x07: "ObjectDescriptor",
  0x08: "EXTERNAL",
  0x09: "REAL",
  0x0a: "ENUMERATED",
  0x0b: "EMBEDDED PDV",
  0x0c: "UTF8String",
  0x0d: "RELATIVE-OID",
  0x10: "SEQUENCE",
  0x11: "SET",
  0x12: "NumericString",
  0x13: "PrintableString",
  0x14: "T61String",
  0x15: "VideotexString",
  0x16: "IA5String",
  0x17: "UTCTime",
  0x18: "GeneralizedTime",
  0x19: "GraphicString",
  0x1a: "VisibleString",
  0x1b: "GeneralString",
  0x1c: "UniversalString",
  0x1d: "CHARACTER STRING",
  0x1e: "BMPString",
}

const TAG_CLASS_NAMES = ["Universal", "Application", "Context", "Private"]

export function getTagName(node: Asn1Node): string {
  if (node.tagClass === 0) {
    return UNIVERSAL_TAGS[node.tagNumber] ?? `Universal(${node.tagNumber})`
  }
  return `[${node.tagNumber}]`
}

export function getTagClassName(tagClass: number): string {
  return TAG_CLASS_NAMES[tagClass] ?? "Unknown"
}

// ── DER Parser ──

export function parseAsn1(data: Uint8Array, start = 0): Asn1Node {
  let pos = start

  // Tag byte
  const firstByte = data[pos]
  if (firstByte === undefined) throw new Error("Unexpected end of data at tag byte")
  pos++
  const tagClass = (firstByte >> 6) & 3
  const constructed = (firstByte & 0x20) !== 0
  let tagNumber = firstByte & 0x1f

  // Long-form tag
  if (tagNumber === 0x1f) {
    tagNumber = 0
    let b: number
    do {
      const nextByte = data[pos]
      if (nextByte === undefined) throw new Error("Unexpected end of data in long-form tag")
      b = nextByte
      pos++
      tagNumber = (tagNumber << 7) | (b & 0x7f)
    } while (b & 0x80)
  }

  // Length
  const lenByte = data[pos]
  if (lenByte === undefined) throw new Error("Unexpected end of data at length byte")
  pos++
  let length: number
  if (lenByte < 0x80) {
    length = lenByte
  } else if (lenByte === 0x80) {
    // Indefinite length — scan for EOC (0x00 0x00)
    let end = pos
    while (end < data.length - 1) {
      if (data[end] === 0 && data[end + 1] === 0) break
      end++
    }
    length = end - pos
  } else {
    const numBytes = lenByte & 0x7f
    length = 0
    for (let i = 0; i < numBytes; i++) {
      const lb = data[pos]
      if (lb === undefined) throw new Error("Unexpected end of data in length field")
      length = length * 256 + lb
      pos++
    }
  }

  const headerLen = pos - start
  const value = data.slice(pos, pos + length)

  const node: Asn1Node = {
    offset: start,
    headerLen,
    length,
    totalLen: headerLen + length,
    tagClass,
    tagNumber,
    constructed,
    value,
  }

  if (constructed && length > 0) {
    node.children = []
    let childPos = 0
    while (childPos < length) {
      try {
        const child = parseAsn1(value, childPos)
        node.children.push(child)
        childPos += child.totalLen
      } catch {
        break // Malformed children — stop parsing
      }
    }
  }

  // Try to parse OCTET STRING / BIT STRING as constructed
  if (
    !constructed &&
    node.tagClass === 0 &&
    (node.tagNumber === 0x03 || node.tagNumber === 0x04) &&
    length > 2
  ) {
    try {
      const innerOffset = node.tagNumber === 0x03 ? 1 : 0 // BIT STRING has unused-bits byte
      const inner = value.slice(innerOffset)
      const firstInner = inner[0]
      if (firstInner !== undefined && (firstInner === 0x30 || firstInner === 0x31 || (firstInner & 0xc0) === 0x80)) {
        const child = parseAsn1(inner, 0)
        if (child.totalLen === inner.length) {
          node.children = [child]
        }
      }
    } catch {
      /* not parseable as constructed */
    }
  }

  return node
}

// ── OID Decoding ──

export function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""
  const first = bytes[0]!
  const parts: number[] = []
  parts.push(Math.floor(first / 40))
  parts.push(first % 40)

  let value = 0
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i]!
    value = (value << 7) | (b & 0x7f)
    if ((b & 0x80) === 0) {
      parts.push(value)
      value = 0
    }
  }
  return parts.join(".")
}

// ── Value Formatting ──

export function decodeAsn1String(node: Asn1Node): string {
  if (node.tagClass !== 0) return formatHex(node.value)
  switch (node.tagNumber) {
    case 0x0c: // UTF8String
      return new TextDecoder("utf-8").decode(node.value)
    case 0x13: // PrintableString
    case 0x16: // IA5String
    case 0x1a: // VisibleString
    case 0x12: // NumericString
    case 0x14: // T61String
    case 0x1b: // GeneralString
      return String.fromCharCode(...node.value)
    case 0x1e: // BMPString
      return new TextDecoder("utf-16be").decode(node.value)
    case 0x1c: // UniversalString
      return new TextDecoder("utf-32be").decode(node.value)
    default:
      return formatHex(node.value)
  }
}

export function isStringTag(tagNumber: number): boolean {
  return [0x0c, 0x12, 0x13, 0x14, 0x16, 0x1a, 0x1b, 0x1c, 0x1e].includes(
    tagNumber
  )
}

export function formatHex(bytes: Uint8Array, max = 64): string {
  const hex = Array.from(bytes.slice(0, max))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")
  return bytes.length > max ? hex + "…" : hex
}

export function formatInteger(bytes: Uint8Array): string {
  if (bytes.length <= 8) {
    let val = 0n
    for (const b of bytes) val = (val << 8n) | BigInt(b)
    // Handle negative (two's complement)
    if (bytes[0]! & 0x80) {
      val -= 1n << BigInt(bytes.length * 8)
    }
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    return `${val} (0x${hex})`
  }
  return formatHex(bytes, 128)
}

export function formatUtcTime(bytes: Uint8Array): string {
  const s = String.fromCharCode(...bytes)
  // YYMMDDHHmmssZ
  const yy = parseInt(s.substring(0, 2))
  const year = yy >= 50 ? 1900 + yy : 2000 + yy
  const month = s.substring(2, 4)
  const day = s.substring(4, 6)
  const hour = s.substring(6, 8)
  const min = s.substring(8, 10)
  const sec = s.substring(10, 12)
  return `${year}-${month}-${day} ${hour}:${min}:${sec} UTC`
}

export function formatGeneralizedTime(bytes: Uint8Array): string {
  const s = String.fromCharCode(...bytes)
  // YYYYMMDDHHmmssZ
  const year = s.substring(0, 4)
  const month = s.substring(4, 6)
  const day = s.substring(6, 8)
  const hour = s.substring(8, 10)
  const min = s.substring(10, 12)
  const sec = s.substring(12, 14)
  return `${year}-${month}-${day} ${hour}:${min}:${sec} UTC`
}

/** Get a human-readable display value for any ASN.1 node */
export function getNodeDisplayValue(node: Asn1Node): string | null {
  if (node.constructed) return null
  if (node.tagClass !== 0) return formatHex(node.value)

  switch (node.tagNumber) {
    case 0x01: // BOOLEAN
      return node.value[0] ? "TRUE" : "FALSE"
    case 0x02: // INTEGER
      return formatInteger(node.value)
    case 0x05: // NULL
      return ""
    case 0x06: { // OID
      const oid = decodeOid(node.value)
      const name = resolveOid(oid)
      return name !== oid ? `${oid} (${name})` : oid
    }
    case 0x17: // UTCTime
      return formatUtcTime(node.value)
    case 0x18: // GeneralizedTime
      return formatGeneralizedTime(node.value)
    case 0x03: // BIT STRING
      if (!node.children?.length) {
        const unused = node.value[0] ?? 0
        return `(${(node.value.length - 1) * 8 - unused} bits) ${formatHex(node.value.slice(1))}`
      }
      return null
    case 0x04: // OCTET STRING
      if (!node.children?.length) {
        return formatHex(node.value)
      }
      return null
    default:
      if (isStringTag(node.tagNumber)) {
        return decodeAsn1String(node)
      }
      return formatHex(node.value)
  }
}
