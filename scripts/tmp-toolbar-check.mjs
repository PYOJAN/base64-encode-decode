// Temporary: open the settings sheet, flip every remaining toolbar switch off, and confirm
// the toolbar actually loses buttons. Proves the switches left behind are live.
import { spawn } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { PDFDocument, StandardFonts } from "pdf-lib"

const PORT = process.argv[2] ?? "5299"
const DEBUG_PORT = Number(process.env.DEBUG_PORT ?? 9271)
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const BROWSER_INTERNAL = /^(edge|chrome|devtools|chrome-extension):/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = await mkdtemp(path.join(tmpdir(), "toolbarcheck-"))
const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
for (let i = 0; i < 3; i++) doc.addPage([612, 792]).drawText(`Hello page ${i + 1}`, { x: 72, y: 700, size: 28, font })
const pdf = path.join(profile, "p.pdf")
await writeFile(pdf, await doc.save())

const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--disable-features=Translate,CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--window-size=1500,950", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] })

let target
for (let i = 0; i < 80; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json())
    target = list.find((t) => t.type === "page" && !BROWSER_INTERNAL.test(t.url))
    if (target) break
  } catch { /* not up yet */ }
  await sleep(300)
}
if (!target) { edge.kill(); throw new Error("could not attach") }

const sock = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id !== undefined) { const p = pending.get(m.id); pending.delete(m.id); p?.(m) } }
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej })
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => {
  const m = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (m.result?.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails).slice(0, 300))
  return m.result?.result?.value
}
const frame = async () => { await send("Page.captureScreenshot", { format: "jpeg", quality: 10 }); await sleep(600) }

const COUNT_BUTTONS = `(() => {
  const tb = document.querySelector('.verifykit-toolbar')
  if (!tb) return 'no toolbar'
  return { buttons: tb.querySelectorAll('button').length, inputs: tb.querySelectorAll('input').length }
})()`

try {
  await send("Runtime.enable"); await send("Page.enable"); await send("DOM.enable")
  await send("Page.navigate", { url: `http://localhost:${PORT}/base64-encode-decode/pdf-verification` })
  await sleep(11000)

  const { root } = (await send("DOM.getDocument", { depth: -1 })).result
  const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type="file"]' })).result
  await send("DOM.setFileInputFiles", { nodeId, files: [pdf] })
  await frame(); await sleep(3000); await frame()

  console.log("toolbar before:", JSON.stringify(await evaluate(COUNT_BUTTONS)))

  // Open the settings sheet, go to the Viewer tab, expand "Toolbar controls".
  console.log("open settings:", await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Open Settings'))
    if (!b) return 'no settings button'; b.click(); return 'clicked'
  })()`))
  await sleep(1200); await frame()
  console.log("viewer tab:", await evaluate(`(() => {
    const t = [...document.querySelectorAll('[role=tab],button')].find(e => e.textContent?.trim() === 'Viewer')
    if (!t) return 'no Viewer tab'; t.click(); return 'clicked'
  })()`))
  await sleep(1200); await frame()

  const labels = await evaluate(`[...document.querySelectorAll('label')].map(l => l.textContent?.trim()).filter(Boolean)`)
  console.log("switches shown:", JSON.stringify(labels))

  // Flip every checkbox inside the toolbar-controls group off.
  console.log("flipped off:", await evaluate(`(() => {
    const ls = [...document.querySelectorAll('label')]
    const names = ${JSON.stringify([
      "Page Navigation", "Zoom", "Rotation", "Search", "Print", "Download",
      "Theme Toggle", "Fullscreen", "Cursor Tool", "More Menu",
    ])}
    let n = 0
    for (const name of names) {
      const l = ls.find(l => l.textContent?.trim() === name)
      const cb = l?.querySelector('input[type=checkbox]')
      if (cb && cb.checked) { cb.click(); n++ }
    }
    return n
  })()`))
  await sleep(2500); await frame(); await sleep(1500); await frame()

  console.log("toolbar after: ", JSON.stringify(await evaluate(COUNT_BUTTONS)))
} finally {
  sock.close(); edge.kill(); await sleep(600)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
