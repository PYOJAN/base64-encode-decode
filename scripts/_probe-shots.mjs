/**
 * Captures what is actually on screen while the verifier blocks the main thread.
 *
 * Screenshots are taken by the browser process, so they still land while the page's main
 * thread is frozen — unlike anything the page could measure about itself.
 *
 *   npm run dev -- --port 5199
 *   node scripts/_probe-shots.mjs fixtures/signed-not-certified.pdf 5199
 */
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { launch, sleep } from "./_cdp.mjs"

const FIXTURE = path.resolve(process.argv[2] ?? "fixtures/signed-not-certified.pdf")
const PORT = process.argv[3] ?? "5199"
const OUT = path.resolve(".screenshots")
const URL = `http://localhost:${PORT}/base64-encode-decode/pdf-verification`
const AT = [800, 1600, 2400, 3600, 7000]

await mkdir(OUT, { recursive: true })
const cdp = await launch({ port: 9406, url: URL })
try {
  await sleep(6000)
  const t0 = Date.now()
  await cdp.setFile(FIXTURE)

  for (const at of AT) {
    const wait = at - (Date.now() - t0)
    if (wait > 0) await sleep(wait)
    const shot = (await cdp.send("Page.captureScreenshot", { format: "png" })).result
    const file = path.join(OUT, `at-${String(at).padStart(5, "0")}ms.png`)
    await writeFile(file, Buffer.from(shot.data, "base64"))
    console.log(`captured +${at}ms -> ${path.relative(process.cwd(), file)}`)
  }
} finally {
  await cdp.close()
}
