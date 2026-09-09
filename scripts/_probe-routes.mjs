/**
 * Visits every route and reports anything that failed to render or logged an error.
 *
 *   npm run dev -- --port 5199
 *   node scripts/_probe-routes.mjs [port]
 */
import { launch, sleep } from "./_cdp.mjs"

const PORT = process.argv[2] ?? "5199"
const BASE = `http://localhost:${PORT}/base64-encode-decode`

const ROUTES = [
  "", "asn1-decoder", "base64-to-file", "base64-to-pdf", "base64-to-text",
  "certificate-decoder", "chain-validator", "color-converter", "crl-parser",
  "csr-decoder", "csr-generator", "csr-signer", "csv-json", "diff-viewer",
  "file-to-base64", "hash-generator", "json-formatter", "jwt-decoder",
  "number-base", "pdf-generator", "pdf-to-base64", "pdf-verification",
  "pem-converter", "pfx-converter", "pkcs7-viewer", "regex-tester",
  "timestamp", "url-encoder", "uuid-generator", "xml-formatter",
  "xml-json", "yaml-formatter", "yaml-json",
]

const SNAPSHOT = `(() => ({
  h1: document.querySelector('h1')?.textContent ?? null,
  textLen: document.body.innerText.trim().length,
  rootKids: document.getElementById('root')?.children.length ?? -1,
}))()`

const cdp = await launch({ port: 9403, url: `${BASE}/` })
const bad = []
try {
  await sleep(5000)
  for (const r of ROUTES) {
    const before = cdp.console().length
    await cdp.send("Page.navigate", { url: `${BASE}/${r}` })
    await sleep(2600)
    const s = await cdp.evaluate(SNAPSHOT)
    const fresh = cdp.console().slice(before)
    const broken = !s || s.__error || !s.h1 || s.textLen < 40 || s.rootKids < 1
    const label = (r || "(index)").padEnd(20)
    if (broken || fresh.length) {
      bad.push(r || "(index)")
      console.log(`FAIL ${label} ${JSON.stringify(s)}`)
      for (const m of fresh.slice(0, 4)) console.log(`       ${m.slice(0, 220)}`)
    } else {
      console.log(`ok   ${label} h1="${s.h1}"`)
    }
  }
} finally {
  await cdp.close()
}
console.log(`\n${ROUTES.length - bad.length}/${ROUTES.length} routes clean`)
if (bad.length) console.log("problem routes:", bad.join(", "))
