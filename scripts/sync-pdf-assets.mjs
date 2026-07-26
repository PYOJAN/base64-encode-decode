// Copies the PDF.js companion assets VerifyKit needs into public/.
//
// Before SDK 0.6.0 these came from node_modules/pdfjs-dist. That package is no
// longer a dependency (pdf.js ships inside @trexolab/verifykit-react as a lazy
// chunk), so the assets are now sourced from the SDK package itself.
//
// The worker is not shipped by the SDK and must match the bundled pdf.js exactly:
//   npm pack pdfjs-dist@<version> --pack-destination .
//   tar -xzOf pdfjs-dist-<version>.tgz package/legacy/build/pdf.worker.min.mjs > public/pdf.worker.min.mjs

import { cpSync, existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const pkgRoot = path.dirname(require.resolve("@trexolab/verifykit-react/package.json"))
const publicDir = path.resolve(import.meta.dirname, "..", "public")

for (const asset of ["cmaps", "standard_fonts"]) {
  const from = path.join(pkgRoot, asset)
  if (!existsSync(from)) {
    console.error(`missing ${asset} in ${pkgRoot} — is @trexolab/verifykit-react installed?`)
    process.exit(1)
  }

  cpSync(from, path.join(publicDir, asset), { recursive: true })
  console.log(`synced ${asset}/`)
}

// The worker is served from public/ and is version-locked to the bundled pdf.js.
const expected = findBundledPdfjsVersion(pkgRoot)
const worker = path.join(publicDir, "pdf.worker.min.mjs")

if (!existsSync(worker)) {
  console.error(`missing public/pdf.worker.min.mjs — fetch pdfjs-dist@${expected ?? "<version>"} (see header)`)
  process.exit(1)
}

if (expected && !readFileSync(worker, "utf8").includes(expected)) {
  console.error(`public/pdf.worker.min.mjs does not report ${expected} — refetch it (see header)`)
  process.exit(1)
}

console.log(`worker matches bundled pdf.js ${expected ?? "(version undetermined)"}`)

function findBundledPdfjsVersion(root) {
  const bundle = path.join(root, "dist")
  if (!existsSync(bundle)) return null

  for (const entry of ["index.mjs", "index.cjs"]) {
    const file = path.join(bundle, entry)
    if (!existsSync(file)) continue

    const match = readFileSync(file, "utf8").match(/pdfjs-dist@(\d+\.\d+\.\d+)/)
    if (match) return match[1]
  }

  return null
}
