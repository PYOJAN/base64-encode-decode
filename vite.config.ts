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
    include: [],
  },
})
