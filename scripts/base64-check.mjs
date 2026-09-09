import assert from "node:assert/strict"
import {
  bytesToBase64,
  base64ToBytes,
  base64ByteLength,
  textToBase64,
  base64ToText,
  extractBase64Data,
} from "../src/utils/base64.ts"
import { isBase64 } from "../src/utils/file-reader.ts"
import { normalizeBase64 } from "../src/utils/smart-base64.ts"

let checks = 0
const check = (name, fn) => {
  fn()
  checks += 1
  console.log(`  ok  ${name}`)
}

console.log("\nencode/decode round-trips")

check("every byte value survives a round trip", () => {
  const bytes = new Uint8Array(256).map((_, i) => i)
  const b64 = bytesToBase64(bytes)
  assert.equal(b64, Buffer.from(bytes).toString("base64"))
  assert.deepEqual(base64ToBytes(b64), bytes)
})

check("all three padding remainders encode correctly", () => {
  for (const size of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const bytes = new Uint8Array(size).map((_, i) => (i * 37) % 256)
    const b64 = bytesToBase64(bytes)
    assert.equal(b64, Buffer.from(bytes).toString("base64"), `size ${size}`)
    assert.deepEqual(base64ToBytes(b64), bytes, `size ${size}`)
    assert.equal(base64ByteLength(b64), size, `byteLength ${size}`)
  }
})

check("chunk boundaries do not corrupt the stream", () => {
  // BYTE_CHUNK is 32760 and CHAR_CHUNK is 65536; straddle both.
  for (const size of [32_759, 32_760, 32_761, 49_151, 49_152, 49_153, 98_304]) {
    const bytes = new Uint8Array(size).map((_, i) => (i * 31 + 7) % 256)
    const b64 = bytesToBase64(bytes)
    assert.equal(b64, Buffer.from(bytes).toString("base64"), `size ${size}`)
    assert.deepEqual(base64ToBytes(b64), bytes, `size ${size}`)
  }
})

check("multi-byte text survives a round trip", () => {
  // Devanagari, an em dash, a check mark, an astral-plane emoji, and combining accents.
  const text = "नमस्ते — Base64 ✅ \u{1F680} éüñ"
  assert.equal(textToBase64(text), Buffer.from(text, "utf8").toString("base64"))
  assert.equal(base64ToText(textToBase64(text)), text)
})

console.log("\nisBase64")

check("accepts well-formed payloads", () => {
  for (const value of ["QUJD", "QUJDRA==", "QUJDREU=", Buffer.from("hello world").toString("base64")]) {
    assert.equal(isBase64(value), true, value)
  }
})

check("rejects malformed payloads", () => {
  for (const value of ["", "QUJ", "QUJDR", "QUJD!", "QU=D", "QUJD====", "QU JD", "-_QU"]) {
    assert.equal(isBase64(value), false, JSON.stringify(value))
  }
})

check("agrees with the btoa(atob(x)) === x check it replaced", () => {
  // The exact implementation this replaced, guard clause included.
  const legacy = (s) => {
    if (!s || s.trim() === "") return false
    try {
      return btoa(atob(s)) === s
    } catch {
      return false
    }
  }

  const samples = ["QUJD", "QUJDRA==", "QUJDREU=", "QUJ", "QUJD!", "", "QU=D", "////", "++++", "AAAA"]
  for (const value of samples) {
    assert.equal(isBase64(value), legacy(value), `disagreement on ${JSON.stringify(value)}`)
  }
})

console.log("\nnormalizeBase64")

check("strips line wrapping and whitespace", () => {
  const b64 = Buffer.from("a".repeat(200)).toString("base64")
  const wrapped = b64.match(/.{1,64}/g).join("\n")
  assert.equal(normalizeBase64(wrapped), b64)
})

check("strips a data URI header", () => {
  assert.equal(normalizeBase64("data:application/pdf;base64,QUJDRA=="), "QUJDRA==")
})

check("folds base64url into standard base64", () => {
  const bytes = new Uint8Array([251, 255, 190, 239])
  const standard = Buffer.from(bytes).toString("base64")
  const urlSafe = Buffer.from(bytes).toString("base64url")
  assert.notEqual(standard, urlSafe)
  assert.equal(normalizeBase64(urlSafe), standard)
})

check("decodes percent-encoding", () => {
  assert.equal(normalizeBase64(encodeURIComponent("QUJDRA==")), "QUJDRA==")
})

check("repairs missing and excess padding", () => {
  assert.equal(normalizeBase64("QUJDRA"), "QUJDRA==")
  assert.equal(normalizeBase64("QUJDREU"), "QUJDREU=")
  assert.equal(normalizeBase64("QUJDRA========"), "QUJDRA==")
})

check("rejects an unrecoverable length", () => {
  assert.equal(normalizeBase64("QUJDRAA"), "QUJDRAA=") // 7 chars -> remainder 3, padded
  assert.equal(normalizeBase64("Q"), null) // remainder 1, unrecoverable
  assert.equal(normalizeBase64(""), null)
  assert.equal(normalizeBase64("!!!!"), null)
})

check("rejects padding found anywhere but the end", () => {
  // Two payloads pasted back to back. Repairing this would hand back plausible but wrong bytes.
  assert.equal(normalizeBase64("QUJDRA==QUJDRA=="), null)
  assert.equal(normalizeBase64("QU=DRA=="), null)
})

check("a non-null result never needs re-validating", () => {
  const inputs = [
    "QUJDRA",
    "  QUJDRA==  ",
    "data:image/png;base64,QUJDRA==",
    "QU\nJD\tRA==",
    "-_-_",
    "QUJDRA========",
    "QUJDRA==QUJDRA==",
    "!!!!",
    "Q",
    Buffer.from("hello world").toString("base64"),
  ]

  for (const value of inputs) {
    const out = normalizeBase64(value)
    if (out !== null) assert.equal(isBase64(out), true, `${JSON.stringify(value)} -> ${out}`)
  }
})

console.log("\nextractBase64Data")

check("splits data URIs and passes through raw payloads", () => {
  assert.deepEqual(extractBase64Data("data:application/pdf;base64,QUJD"), {
    data: "QUJD",
    mimeType: "application/pdf",
  })
  assert.deepEqual(extractBase64Data("  QUJD  "), { data: "QUJD", mimeType: null })
  assert.deepEqual(extractBase64Data("QUJD"), { data: "QUJD", mimeType: null })
  // A non-base64 data URI must not be mistaken for a payload.
  assert.deepEqual(extractBase64Data("data:text/plain,hello"), { data: "", mimeType: null })
})

console.log("\n10 MB performance (the case that used to hang)")

{
  const bytes = new Uint8Array(10 * 1024 * 1024).map((_, i) => (i * 17) % 256)

  const encodeStart = performance.now()
  const b64 = bytesToBase64(bytes)
  const encodeMs = performance.now() - encodeStart

  assert.equal(b64, Buffer.from(bytes).toString("base64"))

  const validateStart = performance.now()
  assert.equal(isBase64(b64), true)
  const validateMs = performance.now() - validateStart

  const normalizeStart = performance.now()
  assert.equal(normalizeBase64(b64), b64)
  const normalizeMs = performance.now() - normalizeStart

  const decodeStart = performance.now()
  const back = base64ToBytes(b64)
  const decodeMs = performance.now() - decodeStart

  assert.deepEqual(back, bytes)

  const legacyStart = performance.now()
  const legacyValid = btoa(atob(b64)) === b64
  const legacyMs = performance.now() - legacyStart
  assert.equal(legacyValid, true)

  console.log(`  ${b64.length.toLocaleString()} characters of Base64`)
  console.log(`  encode        ${encodeMs.toFixed(0)} ms`)
  console.log(`  decode        ${decodeMs.toFixed(0)} ms`)
  console.log(`  isBase64      ${validateMs.toFixed(0)} ms   (old btoa(atob(x)): ${legacyMs.toFixed(0)} ms)`)
  console.log(`  normalize     ${normalizeMs.toFixed(0)} ms`)
}

console.log(`\n${checks} checks passed\n`)
