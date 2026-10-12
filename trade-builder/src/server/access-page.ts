export function accessPage(message = "", status = 200) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char] ?? char
    )
  return new Response(
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Trade Machine</title><link rel="icon" href="/favicon.svg"><style>
*{box-sizing:border-box}body{margin:0;background:#f7f9f8;color:#202524;font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{width:100%;max-width:400px}header{display:flex;align-items:center;gap:10px;color:#087b57;font-size:18px;font-weight:650;margin-bottom:40px}header img{width:28px;height:28px}h1{font-size:30px;line-height:1.2;letter-spacing:-.7px;margin:0 0 12px}p{color:#616b66;margin:0 0 28px}label{display:block;font-size:14px;font-weight:600;margin-bottom:8px}input{width:100%;font:inherit;background:#fff;border:1px solid #cbd4ce;border-radius:10px;padding:12px 14px;margin-bottom:16px;min-height:48px}input:focus-visible{outline:3px solid #9bd9bf;outline-offset:2px;border-color:#087b57}button{width:100%;border:0;border-radius:10px;background:#087b57;color:#fff;font:inherit;font-weight:600;min-height:48px;cursor:pointer}button:hover{background:#056646}button:focus-visible{outline:3px solid #9bd9bf;outline-offset:3px}.error{color:#a02b2b;font-size:14px;margin:0 0 16px}.note{font-size:13px;margin:20px 0 0}
</style></head><body><main><header><img src="/favicon.svg" alt="">Trade Machine</header><form method="post" action="/access/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" aria-describedby="${message ? "error note" : "note"}">${message ? `<p class="error" id="error" role="alert">${escape(message)}</p>` : ""}<button type="submit">Open trade machine</button><p class="note" id="note">This browser remembers you for 30 days.</p></form></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      },
    }
  )
}
