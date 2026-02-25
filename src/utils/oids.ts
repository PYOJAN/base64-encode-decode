/** Comprehensive OID → human-readable name dictionary */
export const OID_NAMES: Record<string, string> = {
  // ── Distinguished Name Attributes (2.5.4.x) ──
  "2.5.4.3": "Common Name (CN)",
  "2.5.4.4": "Surname (SN)",
  "2.5.4.5": "Serial Number",
  "2.5.4.6": "Country (C)",
  "2.5.4.7": "Locality (L)",
  "2.5.4.8": "State/Province (ST)",
  "2.5.4.9": "Street Address",
  "2.5.4.10": "Organization (O)",
  "2.5.4.11": "Organizational Unit (OU)",
  "2.5.4.12": "Title",
  "2.5.4.13": "Description",
  "2.5.4.15": "Business Category",
  "2.5.4.17": "Postal Code",
  "2.5.4.20": "Telephone Number",
  "2.5.4.41": "Name",
  "2.5.4.42": "Given Name (GN)",
  "2.5.4.43": "Initials",
  "2.5.4.44": "Generation Qualifier",
  "2.5.4.46": "DN Qualifier",
  "2.5.4.65": "Pseudonym",
  "1.2.840.113549.1.9.1": "Email Address",
  "0.9.2342.19200300.100.1.25": "Domain Component (DC)",
  "0.9.2342.19200300.100.1.1": "User ID (UID)",

  // ── Signature Algorithms — RSA (1.2.840.113549.1.1.x) ──
  "1.2.840.113549.1.1.1": "RSA Encryption",
  "1.2.840.113549.1.1.2": "MD2 with RSA",
  "1.2.840.113549.1.1.4": "MD5 with RSA",
  "1.2.840.113549.1.1.5": "SHA-1 with RSA",
  "1.2.840.113549.1.1.7": "RSA-OAEP",
  "1.2.840.113549.1.1.10": "RSASSA-PSS",
  "1.2.840.113549.1.1.11": "SHA-256 with RSA",
  "1.2.840.113549.1.1.12": "SHA-384 with RSA",
  "1.2.840.113549.1.1.13": "SHA-512 with RSA",
  "1.2.840.113549.1.1.14": "SHA-224 with RSA",

  // ── Signature Algorithms — ECDSA (1.2.840.10045.x) ──
  "1.2.840.10045.2.1": "EC Public Key",
  "1.2.840.10045.4.1": "ECDSA with SHA-1",
  "1.2.840.10045.4.3.1": "ECDSA with SHA-224",
  "1.2.840.10045.4.3.2": "ECDSA with SHA-256",
  "1.2.840.10045.4.3.3": "ECDSA with SHA-384",
  "1.2.840.10045.4.3.4": "ECDSA with SHA-512",

  // ── EdDSA (1.3.101.x) ──
  "1.3.101.110": "X25519",
  "1.3.101.111": "X448",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",

  // ── Hash Algorithms ──
  "2.16.840.1.101.3.4.2.1": "SHA-256",
  "2.16.840.1.101.3.4.2.2": "SHA-384",
  "2.16.840.1.101.3.4.2.3": "SHA-512",
  "2.16.840.1.101.3.4.2.4": "SHA-224",
  "2.16.840.1.101.3.4.2.5": "SHA-512/224",
  "2.16.840.1.101.3.4.2.6": "SHA-512/256",
  "1.3.14.3.2.26": "SHA-1",
  "1.2.840.113549.2.5": "MD5",
  "1.2.840.113549.2.2": "MD2",

  // ── Named Elliptic Curves ──
  "1.2.840.10045.3.1.1": "P-192 (secp192r1)",
  "1.2.840.10045.3.1.7": "P-256 (secp256r1)",
  "1.3.132.0.1": "sect163k1 (NIST K-163)",
  "1.3.132.0.10": "secp256k1",
  "1.3.132.0.33": "P-224 (secp224r1)",
  "1.3.132.0.34": "P-384 (secp384r1)",
  "1.3.132.0.35": "P-521 (secp521r1)",
  "1.3.36.3.3.2.8.1.1.7": "brainpoolP256r1",
  "1.3.36.3.3.2.8.1.1.11": "brainpoolP384r1",
  "1.3.36.3.3.2.8.1.1.13": "brainpoolP512r1",

  // ── X.509v3 Extensions (2.5.29.x) ──
  "2.5.29.9": "Subject Directory Attributes",
  "2.5.29.14": "Subject Key Identifier",
  "2.5.29.15": "Key Usage",
  "2.5.29.17": "Subject Alternative Name",
  "2.5.29.18": "Issuer Alternative Name",
  "2.5.29.19": "Basic Constraints",
  "2.5.29.20": "CRL Number",
  "2.5.29.21": "CRL Reason Code",
  "2.5.29.24": "Invalidity Date",
  "2.5.29.30": "Name Constraints",
  "2.5.29.31": "CRL Distribution Points",
  "2.5.29.32": "Certificate Policies",
  "2.5.29.33": "Policy Mappings",
  "2.5.29.35": "Authority Key Identifier",
  "2.5.29.36": "Policy Constraints",
  "2.5.29.37": "Extended Key Usage",
  "2.5.29.46": "Freshest CRL (Delta CRL)",
  "2.5.29.54": "Inhibit Any-Policy",

  // ── PKIX Private Extensions ──
  "1.3.6.1.5.5.7.1.1": "Authority Information Access",
  "1.3.6.1.5.5.7.1.11": "Subject Information Access",
  "1.3.6.1.5.5.7.1.12": "Logo Type",
  "1.3.6.1.4.1.11129.2.4.2": "CT Precertificate SCTs",
  "1.3.6.1.4.1.11129.2.4.5": "CT Precertificate Poison",

  // ── AIA Access Methods ──
  "1.3.6.1.5.5.7.48.1": "OCSP",
  "1.3.6.1.5.5.7.48.2": "CA Issuers",

  // ── Extended Key Usage (1.3.6.1.5.5.7.3.x) ──
  "1.3.6.1.5.5.7.3.1": "TLS Web Server Authentication",
  "1.3.6.1.5.5.7.3.2": "TLS Web Client Authentication",
  "1.3.6.1.5.5.7.3.3": "Code Signing",
  "1.3.6.1.5.5.7.3.4": "Email Protection (S/MIME)",
  "1.3.6.1.5.5.7.3.5": "IPSec End System",
  "1.3.6.1.5.5.7.3.6": "IPSec Tunnel",
  "1.3.6.1.5.5.7.3.7": "IPSec User",
  "1.3.6.1.5.5.7.3.8": "Time Stamping",
  "1.3.6.1.5.5.7.3.9": "OCSP Signing",
  "1.3.6.1.5.5.7.3.14": "EAP over LAN",
  "1.3.6.1.5.5.7.3.36": "Document Signing",

  // ── Microsoft EKU ──
  "1.3.6.1.4.1.311.10.3.1": "MS Certificate Trust List Signing",
  "1.3.6.1.4.1.311.10.3.3": "MS Server Gated Crypto",
  "1.3.6.1.4.1.311.10.3.4": "MS Encrypted File System",
  "1.3.6.1.4.1.311.10.3.12": "MS Document Signing",
  "1.3.6.1.4.1.311.20.2.2": "MS Smartcard Login",
  "2.16.840.1.113730.4.1": "Netscape Server Gated Crypto",

  // ── Microsoft Extensions ──
  "1.3.6.1.4.1.311.21.2": "MS Previous CA Cert Hash",
  "1.3.6.1.4.1.311.21.7": "MS Certificate Template",

  // ── PKCS#7 / CMS ──
  "1.2.840.113549.1.7.1": "PKCS#7 Data",
  "1.2.840.113549.1.7.2": "PKCS#7 Signed Data",
  "1.2.840.113549.1.7.3": "PKCS#7 Enveloped Data",
  "1.2.840.113549.1.7.5": "PKCS#7 Digested Data",
  "1.2.840.113549.1.7.6": "PKCS#7 Encrypted Data",
  "1.2.840.113549.1.9.3": "Content Type",
  "1.2.840.113549.1.9.4": "Message Digest",
  "1.2.840.113549.1.9.5": "Signing Time",
  "1.2.840.113549.1.9.6": "Counter Signature",
  "1.2.840.113549.1.9.7": "Challenge Password",
  "1.2.840.113549.1.9.14": "Extension Request",
  "1.2.840.113549.1.9.15": "S/MIME Capabilities",
  "1.2.840.113549.1.9.16.2.14": "Timestamp Token",
  "1.2.840.113549.1.9.52": "CMS Algorithm Protection",

  // ── PKCS#12 ──
  "1.2.840.113549.1.12.1.3": "pbeWithSHAAnd3-KeyTripleDES-CBC",
  "1.2.840.113549.1.12.1.6": "pbeWithSHAAnd40BitRC2-CBC",
  "1.2.840.113549.1.12.10.1.1": "PKCS#12 Key Bag",
  "1.2.840.113549.1.12.10.1.2": "PKCS#12 PKCS8 Shrouded Key Bag",
  "1.2.840.113549.1.12.10.1.3": "PKCS#12 Cert Bag",
  "1.2.840.113549.1.12.10.1.5": "PKCS#12 Secret Bag",
  "1.2.840.113549.1.12.10.1.6": "PKCS#12 Safe Contents Bag",

  // ── PKCS#5 ──
  "1.2.840.113549.1.5.12": "PBKDF2",
  "1.2.840.113549.1.5.13": "PBES2",

  // ── Certificate Policies — Any ──
  "2.5.29.32.0": "Any Policy",

  // ── India CCA (2.16.356.100.x) ──
  "2.16.356.100": "CCA India",
  "2.16.356.100.1": "Licensed CAs",
  "2.16.356.100.1.1": "Safescrypt",
  "2.16.356.100.1.2": "IDRBT",
  "2.16.356.100.1.3": "TCS",
  "2.16.356.100.1.4": "NIC",
  "2.16.356.100.1.5": "MTNL",
  "2.16.356.100.1.7": "(n)Code Solutions",
  "2.16.356.100.1.8": "eMudhra",
  "2.16.356.100.1.9": "CDAC",
  "2.16.356.100.1.13": "Capricorn Identity Services",
  "2.16.356.100.1.15": "Verasys (VSSign)",
  "2.16.356.100.1.21": "NSDL e-Governance (Protean)",
  "2.16.356.100.2": "CCA Certificate Policy",
  "2.16.356.100.2.1": "CCA Class 1",
  "2.16.356.100.2.2": "CCA Class 2",
  "2.16.356.100.2.3": "CCA Class 3",
  "2.16.356.100.2.4.1": "CCA eKYC Single Factor",
  "2.16.356.100.2.4.2": "CCA eKYC Multi Factor",
  "2.16.356.100.10.1": "CCA Document Signer",
  "2.16.356.100.10.2": "CCA Key Generation Witness",

  // ── AES ──
  "2.16.840.1.101.3.4.1.2": "AES-128-CBC",
  "2.16.840.1.101.3.4.1.6": "AES-128-GCM",
  "2.16.840.1.101.3.4.1.22": "AES-192-CBC",
  "2.16.840.1.101.3.4.1.26": "AES-192-GCM",
  "2.16.840.1.101.3.4.1.42": "AES-256-CBC",
  "2.16.840.1.101.3.4.1.46": "AES-256-GCM",
}

export function resolveOid(oid: string): string {
  return OID_NAMES[oid] ?? oid
}

/** Resolve OID with both name and raw OID */
export function resolveOidFull(oid: string): { name: string; oid: string; known: boolean } {
  const name = OID_NAMES[oid]
  return { name: name ?? oid, oid, known: !!name }
}
