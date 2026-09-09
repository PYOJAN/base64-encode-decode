/**
 * Loads a PDF on a route, clicks a sidebar link, and reports whether the app actually navigated.
 *
 *   npm run dev -- --port 5199
 *   node scripts/_probe-nav.mjs [route] [port]
 */
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { launch, sleep } from "./_cdp.mjs"

const ROUTE = process.argv[2] ?? "pdf-to-base64"
const PORT = process.argv[3] ?? "5199"
const TARGET = "json-formatter"
const URL = `http://localhost:${PORT}/base64-encode-decode/${ROUTE}`

const SNAPSHOT = `(() => ({
  path: location.pathname,
  h1: document.querySelector('h1')?.textContent ?? null,
  canvases: document.querySelectorAll('canvas').length,
  toolbar: !!document.querySelector('.verifykit-toolbar'),
}))()`

const cdp = await launch({ port: 9401, url: URL })
try {
  await sleep(6000)
  console.log("ON LOAD:  ", JSON.stringify(await cdp.evaluate(SNAPSHOT)))
  console.log(
    "inputs:   ",
    JSON.stringify(
      await cdp.evaluate(`(() => ({
        fileInputs: document.querySelectorAll('input[type=file]').length,
        links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(Boolean).length,
      }))()`)
    )
  )

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    doc.addPage([612, 792]).drawText(`Repro page ${i + 1}`, { x: 72, y: 700, size: 24, font })
  }
  const pdf = path.join(cdp.profile, "repro.pdf")
  await writeFile(pdf, await doc.save())

  await cdp.setFile(pdf)
  console.log("\nPDF handed to the file input")
  await sleep(8000)
  console.log("AFTER PDF:", JSON.stringify(await cdp.evaluate(SNAPSHOT)))

  const clicked = await cdp.evaluate(`(() => {
    const a = [...document.querySelectorAll('a')].find(a => a.getAttribute('href')?.endsWith('/${TARGET}'))
    if (!a) return 'link not found'
    a.click()
    return a.getAttribute('href')
  })()`)
  console.log("\nCLICKED:  ", JSON.stringify(clicked))

  for (const wait of [1000, 2000, 4000]) {
    await sleep(wait)
    console.log(`  +${wait}ms  `, JSON.stringify(await cdp.evaluate(SNAPSHOT)))
  }

  const lines = cdp.console()
  console.log(`\n=== CONSOLE (${lines.length}) ===`)
  for (const m of lines.slice(0, 25)) console.log("  " + m.slice(0, 300))
} finally {
  await cdp.close()
}
