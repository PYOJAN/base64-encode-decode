/**
 * Loads a real signed fixture into /pdf-verification and reports what the app concluded.
 *
 *   npm run dev -- --port 5199
 *   node scripts/_probe-verify.mjs fixtures/signed-not-certified.pdf 5199
 */
import path from "node:path"
import { launch, sleep } from "./_cdp.mjs"

const FIXTURE = path.resolve(process.argv[2] ?? "fixtures/signed-not-certified.pdf")
const PORT = process.argv[3] ?? "5199"
const URL = `http://localhost:${PORT}/base64-encode-decode/pdf-verification`

const STATE = `(() => {
  const text = document.body.innerText
  const grab = (re) => (text.match(re) ?? [null])[0]
  return {
    canvases: document.querySelectorAll('canvas').length,
    toolbar: !!document.querySelector('.verifykit-toolbar'),
    loading: text.includes('Loading PDF'),
    unavailable: text.includes('PDF preview unavailable'),
    verdict: grab(/(Signed and all signatures are valid[^.]*\\.|At least one signature has problems\\.|The signature is invalid[^.]*\\.|Signature validity is unknown[^.]*\\.|is not signed[^.]*\\.)/i),
    signerLine: grab(/Signed by [^\\n]{0,80}/i),
    badges: [...document.querySelectorAll('[class*=badge], [class*=pill]')].map(e => e.textContent?.trim()).filter(Boolean).slice(0, 10),
  }
})()`

const cdp = await launch({ port: 9402, url: URL })
try {
  await sleep(6000)
  console.log("fixture:", FIXTURE)
  await cdp.setFile(FIXTURE)
  console.log("handed to the dropzone; waiting for verification\n")

  for (const t of [5000, 5000, 8000, 10000]) {
    await sleep(t)
    console.log(`  t+${t}`, JSON.stringify(await cdp.evaluate(STATE)))
  }

  const lines = cdp.console()
  console.log(`\n=== CONSOLE (${lines.length}) ===`)
  for (const m of lines.slice(0, 25)) console.log("  " + m.slice(0, 300))
} finally {
  await cdp.close()
}
