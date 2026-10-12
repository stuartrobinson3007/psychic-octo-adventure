import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Plugin } from "vite"

/** Serve local captures in development only; they never enter production assets. */
export function chatReviewAssets(): Plugin {
  return {
    name: "gambit-chat-review-assets",
    apply: "serve",
    configureServer(server) {
      const directory = path.resolve(server.config.root, ".ux-review")
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split("?")[0] ?? ""
        if (!pathname.startsWith("/__ux-review-assets/")) return next()
        let file: string
        try {
          file = decodeURIComponent(
            pathname.slice("/__ux-review-assets/".length)
          )
        } catch {
          response.statusCode = 400
          response.end("Invalid capture path")
          return
        }
        if (!/^[\p{L}\p{N}\p{M}_.:-]+\.(json|html|jpg|png|svg)$/u.test(file)) {
          response.statusCode = 400
          response.end("Invalid capture path")
          return
        }
        try {
          const body = await readFile(path.join(directory, file))
          const extension = path.extname(file)
          response.setHeader(
            "content-type",
            extension === ".json"
              ? "application/json"
              : extension === ".html"
                ? "text/html; charset=utf-8"
                : extension === ".svg"
                  ? "image/svg+xml"
                  : extension === ".png"
                    ? "image/png"
                    : "image/jpeg"
          )
          response.setHeader("cache-control", "no-store")
          response.setHeader("x-content-type-options", "nosniff")
          if (extension === ".svg")
            response.setHeader(
              "content-security-policy",
              "default-src 'none'; img-src data:; script-src 'none'; form-action 'none'; base-uri 'none'"
            )
          if (extension === ".html")
            response.setHeader(
              "content-security-policy",
              "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://bball-gm.com; font-src 'self' data:; script-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'"
            )
          response.end(body)
        } catch {
          response.statusCode = 404
          response.end("Capture unavailable. See docs/chat-ux-review.md.")
        }
      })
    },
  }
}
