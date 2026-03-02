import { KeyUsageFlags } from "@peculiar/x509"

// ── DN Label Map ──

export const DN_LABELS: Record<string, string> = {
  CN: "Common Name",
  O: "Organization",
  OU: "Organizational Unit",
  C: "Country",
  ST: "State / Province",
  L: "Locality",
  SN: "Surname",
  GN: "Given Name",
  E: "Email",
  SERIALNUMBER: "Serial Number",
  T: "Title",
  DC: "Domain Component",
  UID: "User ID",
  STREET: "Street Address",
  POSTALCODE: "Postal Code",
  "2.5.4.15": "Business Category",
  "1.3.6.1.4.1.311.60.2.1.3": "Jurisdiction Country",
  "1.3.6.1.4.1.311.60.2.1.2": "Jurisdiction State",
  "1.3.6.1.4.1.311.60.2.1.1": "Jurisdiction Locality",
}

// ── Key Usage Flag Names ──

export const KEY_USAGE_MAP: [number, string][] = [
  [KeyUsageFlags.digitalSignature, "Digital Signature"],
  [KeyUsageFlags.nonRepudiation, "Non Repudiation"],
  [KeyUsageFlags.keyEncipherment, "Key Encipherment"],
  [KeyUsageFlags.dataEncipherment, "Data Encipherment"],
  [KeyUsageFlags.keyAgreement, "Key Agreement"],
  [KeyUsageFlags.keyCertSign, "Certificate Sign"],
  [KeyUsageFlags.cRLSign, "CRL Sign"],
  [KeyUsageFlags.encipherOnly, "Encipher Only"],
  [KeyUsageFlags.decipherOnly, "Decipher Only"],
]

// ── Formatters ──

/** Uppercase colon-separated hex: "01:A2:B3" */
export function formatSerial(hex: string): string {
  if (!hex) return ""
  return hex
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, "$1:")
}

/** Plain lowercase hex (raw) */
export function formatSerialRaw(hex: string): string {
  return hex.toLowerCase()
}

/** Convert hex serial to decimal string */
export function formatSerialDecimal(hex: string): string {
  if (!hex) return ""
  const clean = hex.replace(/[^0-9a-fA-F]/g, "")
  if (!clean) return ""
  // Use BigInt for large serial numbers
  return BigInt("0x" + clean).toString(10)
}

export function formatFingerprint(hex: string): string {
  if (!hex) return ""
  return hex
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, "$1:")
}

export function formatDate(d: Date): string {
  return `${d.toUTCString()} (${d.toLocaleDateString()})`
}

export function formatAlgorithm(algo: Algorithm & { hash?: Algorithm }): string {
  let name = algo.name
  if (algo.hash) name += ` / ${algo.hash.name}`
  return name
}

// ── DN Helpers ──

export function parseDN(dn: string): [string, string][] {
  if (!dn) return []
  const result: [string, string][] = []
  const parts = dn.split(/,\s*(?=[A-Z]+=|[a-z]+=|[0-9.]+[=#])/)
  for (const part of parts) {
    const eqIdx = part.indexOf("=")
    if (eqIdx > 0) {
      result.push([
        part.substring(0, eqIdx).trim(),
        part.substring(eqIdx + 1).trim(),
      ])
    }
  }
  return result
}

export function extractCN(dn: string): string {
  const parts = parseDN(dn)
  const cn = parts.find(([k]) => k.toUpperCase() === "CN")
  return cn ? cn[1] : ""
}
