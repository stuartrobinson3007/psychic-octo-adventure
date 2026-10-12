# Shared-password Cloudflare demo

The public demo runs on Cloudflare Workers at https://gambit-demo.stuartrobinson3007.workers.dev. Visitors enter one shared password. No account or email is required.

## Sessions and history

The server verifies the password and issues a signed, Secure, HttpOnly, SameSite=Lax cookie scoped to this host. Access lasts 30 days. The signed browser identity lasts a year so re-entering the password after access expires can restore that browser's history. A new browser or clearing cookies starts a new identity. Password or signing-secret rotation invalidates existing tokens and starts fresh identities.

Each verified browser is routed to its own SQLite-backed Durable Object. Its database contains only that visitor's conversation IDs, immutable trade revisions, messages and pending questions. Request context also scopes in-memory caches and locks to that browser. Supplying another visitor's conversation ID cannot select their database or cached history. Reset chat starts a new conversation within the same browser workspace. Bookmarks remain in browser storage and do not sync between devices.

This deployment starts with new cloud histories. The local `.gambit/conversations.sqlite` database is not uploaded. Browser caches may import their own history as before, but imported trade verdicts remain untrusted until rechecked.

## Access and usage limits

The Worker checks access before serving the app, its assets, chat endpoints and server functions. Favicon and robots.txt are public. The login form requires the same origin, as do every other write request. Non-authenticated API calls return 401; other navigation redirects to the password screen. Local review routes and assets are excluded from public use. Private app responses use no-store, and the demo discourages indexing.

A separate Durable Object coordinates atomic limits across Workers:

- 10 password submissions per IP per 15-minute window.
- 120 backend requests per browser per minute. Static assets do not count.
- 3 new model-backed chat turns per browser per minute.
- 100 new chat turns per browser per day.
- 300 new chat turns across the app per day.

Daily limits reset at midnight UTC (10 am Brisbane). These cap chat turns, not dollar spend. A single turn can make multiple model/tool calls. Idempotent replay of a previously recorded request does not reserve another model turn. API bodies are bounded to 512 KiB, and password submissions to 2 KiB. Shared-password holders can create new browser identities; the global chat limit remains shared across all identities.

## Local development and release

Ordinary `npm run dev` keeps the existing local Node/SQLite workflow without a password gate. Cloudflare mode uses the durable store adapter and the Worker entrypoint:

```sh
npm run dev:cloudflare
npm run typecheck
npm run typecheck:cloudflare
npm run lint
npm run test:deployment
npm run test:cloudflare-limits
npm run deploy
```

`npm run deploy` builds in Cloudflare mode and runs Wrangler against `dist-cloudflare/server/wrangler.json`. Cloudflare builds use `dist-cloudflare/` so local Node builds in `dist/` cannot overwrite the release artifacts. Generated types are in `worker-configuration.d.ts`; regenerate them with `npm run cf-typegen` when bindings change. Separate TypeScript projects avoid mixing browser DOM and Worker runtime globals.

Use `.dev.vars` for Cloudflare local secrets. Configure production secrets through Wrangler:

```sh
npx wrangler secret put GAMBIT_PASSWORD --config wrangler.jsonc
npx wrangler secret put GAMBIT_SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put OPENAI_API_KEY --config wrangler.jsonc
```

`GAMBIT_INTERPRETATION_MODEL` and `GAMBIT_EXECUTION_MODEL` are configured in `wrangler.jsonc`. Passwords and API keys stay out of committed source. The initial deployment credentials are retained in the ignored, mode-600 `.gambit/deployment-secrets.json`; this includes the configured OpenAI key and should remain private.

`node scripts/check-cloudflare-access.mjs <base-url>` checks the password gate, cross-origin rejection, forged cookies, server functions, persistence and isolation using two new browser identities. It reads the local ignored deployment credentials and the latest build's server-function registry. It creates only isolated smoke-test conversations and does not call the model.

## Validation scope

Prefer E2E checks of deployment behaviour and integration coverage for storage/runtime boundaries; do not add unit tests. `npm run test:deployment` checks visitor isolation, SQLite reopening and concurrent writes using local databases, with live network requests disabled. The access-session unit tests were removed; token-helper assertions are no longer part of this command. The live smoke script exercises the production Worker's password gate, forged cookies, request origins and actual Durable Object databases without calling the model. `npm run test:cloudflare-limits` uses an isolated local Worker runtime to check atomic login limits, the per-browser minute limit and the global 300-turn cap across distinct browser identities without calling OpenAI. Run only the checks relevant to the deployment change; see [testing guidance](testing.md).
