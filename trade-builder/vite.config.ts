import { defineConfig, loadEnv } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { chatReviewAssets } from "./tools/ux-review/vite-plugin.ts"
import { cloudflare } from "@cloudflare/vite-plugin"
import { fileURLToPath } from "node:url"

const config = defineConfig(({ mode, command }) => {
  const cloud = mode === "cloudflare"
  const env = loadEnv(mode, process.cwd(), "")
  const portIndex = process.argv.indexOf("--port")
  const port =
    process.argv.find((argument) => argument.startsWith("--port="))?.slice(7) ??
    (portIndex >= 0 ? process.argv[portIndex + 1] : "3000")
  // Unprefixed values stay server-only; never expose credentials through VITE_*.
  for (const key of ["OPENAI_API_KEY", "GAMBIT_EXECUTION_MODEL"]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key]
  }
  return {
    build: { outDir: cloud ? "dist-cloudflare" : "dist" },
    // Isolate concurrent servers, but keep dependency URLs stable on restart.
    // Cached router modules must import the same React as the renderer.
    ...(command === "serve"
      ? { cacheDir: `node_modules/.vite/${mode}-${port}` }
      : {}),
    resolve: {
      dedupe: ["react", "react-dom"],
      tsconfigPaths: true,
      alias: cloud
        ? [
            {
              find: /^(?:.*\/)?conversation-store(?:\.ts)?$/,
              replacement: fileURLToPath(
                new URL(
                  "./src/server/cloud-conversation-store.ts",
                  import.meta.url
                )
              ),
            },
          ]
        : [],
    },
    plugins: [
      ...(cloud
        ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
        : [chatReviewAssets()]),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
