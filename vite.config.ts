import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import path from "path"
import { readFileSync } from "fs"

const verifykitVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, "node_modules/@trexolab/verifykit-react/package.json"), "utf-8")
).version as string

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  base: "/base64-encode-decode/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  define: {
    "global": "globalThis",
    "process.env": {},
    "__VERIFYKIT_VERSION__": JSON.stringify(verifykitVersion),
  },
  optimizeDeps: {
    // The verification engine is a real `.wasm` that the wasm-bindgen glue locates with
    // `new URL('verifykit_core_wasm_bg.wasm', import.meta.url)`. Rollup understands that and
    // emits the binary next to the production chunks, which is why `npm run build` works with
    // no configuration at all. The dev-time dep optimizer does not: esbuild rewrote the glue
    // into `node_modules/.vite/deps/`, left the `.wasm` behind in the package, and the lookup
    // resolved to a path Vite answers with the SPA `index.html` — so the engine was handed
    // `<!DOCTYPE` where it expected the WASM magic word and every verification failed with
    // `expected magic word 00 61 73 6d, found 3c 21 44 4f`.
    //
    // Excluding the engine package keeps that glue in its own directory during dev, where the
    // relative lookup finds the binary sitting beside it. Only `-core` is listed: it is the
    // package that owns the glue and it has no dependencies of its own, so serving it raw
    // cannot hit the CJS-interop gaps that pre-bundling exists to paper over. Excluding
    // `-react` as well does hit one — it reaches pdf-lib, which reaches pako, whose CJS
    // default export a raw ESM fetch cannot synthesise, and the route dies on
    // "does not provide an export named 'default'". Vite externalises an excluded dep from
    // the bundles it builds for the others, so `-react` and `-plugin-revocation` stay
    // optimised and still share this one engine instance.
    exclude: ["@trexolab/verifykit-core"],
  },
})
