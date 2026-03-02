// Use the pre-built UMD bundle which has all algorithms self-contained.
// The normal `node-forge` entry (lib/index.js) relies on side-effect
// require() chains to register digest algorithms on the forge object.
// Vite's CJS→ESM conversion breaks this, leaving forge.md.sha1 etc.
// undefined and causing "Cannot read properties of undefined" at runtime.
// @ts-expect-error — UMD bundle; types come from @types/node-forge
import forge from "node-forge/dist/forge.min.js"

export interface Pkcs12Cert {
  pem: string
  der: Uint8Array
  subject: string
  issuer: string
  serial: string
  notBefore: Date
  notAfter: Date
  isCA: boolean
  friendlyName: string
}

export interface Pkcs12Result {
  certificate: Pkcs12Cert | null
  privateKeyPem: string
  privateKeyAlgo: string
  caChain: Pkcs12Cert[]
}

function forgeCertToInfo(cert: forge.pki.Certificate, friendlyName: string): Pkcs12Cert {
  const pem = forge.pki.certificateToPem(cert)
  const derAsn1 = forge.pki.certificateToAsn1(cert)
  const derBytes = forge.asn1.toDer(derAsn1)
  const der = new Uint8Array(
    derBytes.data.split("").map((c: string) => c.charCodeAt(0))
  )

  const subject = cert.subject.attributes
    .map((a: any) => `${(a.shortName || a.name || a.type)}=${a.value}`)
    .join(", ")

  const issuer = cert.issuer.attributes
    .map((a: any) => `${(a.shortName || a.name || a.type)}=${a.value}`)
    .join(", ")

  const serial = cert.serialNumber
    .replace(/^0+/, "")
    .toUpperCase()
    .match(/.{1,2}/g)
    ?.join(":") ?? cert.serialNumber

  const basicConstraints = cert.getExtension("basicConstraints") as
    | { cA?: boolean }
    | undefined
  const isCA = basicConstraints?.cA === true

  return {
    pem,
    der,
    subject,
    issuer,
    serial,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    isCA,
    friendlyName,
  }
}

function detectKeyAlgo(key: forge.pki.PrivateKey): string {
  const rsaKey = key as forge.pki.rsa.PrivateKey
  if (rsaKey.n) {
    const bits = rsaKey.n.bitLength()
    return `RSA ${bits}`
  }
  return "Unknown"
}

export function parsePkcs12(bytes: Uint8Array, password: string): Pkcs12Result {
  const binaryStr = forge.util.binary.raw.encode(new Uint8Array(bytes))
  const asn1 = forge.asn1.fromDer(binaryStr)
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)

  let certificate: Pkcs12Cert | null = null
  let privateKey: forge.pki.PrivateKey | null = null
  const caChain: Pkcs12Cert[] = []

  for (const safeContent of p12.safeContents) {
    for (const bag of safeContent.safeBags) {
      if (bag.type === forge.pki.oids.certBag && bag.cert) {
        const name =
          (bag.attributes?.friendlyName as string[] | undefined)?.[0] ?? ""
        const info = forgeCertToInfo(bag.cert, name)

        if (info.isCA) {
          caChain.push(info)
        } else if (!certificate) {
          certificate = info
        } else {
          caChain.push(info)
        }
      } else if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && bag.key) {
        privateKey = bag.key
      }
    }
  }

  if (!certificate && caChain.length > 0) {
    certificate = caChain.shift()!
  }

  let privateKeyPem = ""
  let privateKeyAlgo = ""
  if (privateKey) {
    privateKeyPem = forge.pki.privateKeyToPem(privateKey)
    privateKeyAlgo = detectKeyAlgo(privateKey)
  }

  return { certificate, privateKeyPem, privateKeyAlgo, caChain }
}
