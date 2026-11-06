# LearnFlow API Worker (scaffold)

The frontend remains a SvelteKit PWA on Vercel. This separate Cloudflare Worker is the future home of the stateless AI API. **No R2, D1, KV, Workflows, object storage or central lesson database.** Lesson documents/text and playback progress stay in the browser's IndexedDB; generated audio will use OPFS when implemented.

## Current API

- `GET /health` — health JSON; no content read.
- `POST /api/simplify` — returns HTTP 501 until implementation, intentionally does not read or store the body.
- `POST /api/speak` — returns HTTP 501 until implementation.

This scaffold **does not** simplify or generate audio and must not be presented as a usable student-facing service.

## Local setup

From `worker/`:

1. Install dependencies with `bun install` (or `npm install`).
2. Copy `.dev.vars.example` to `.dev.vars` (gitignored). Adjust exact frontend origins; do not use `*`.
3. Run `bun run dev`.
4. Run `bun run check` and `bun run test` (tests use Node 22+).

For deploy, configure `ALLOWED_ORIGINS` with **exact** production/preview Vercel origins through Cloudflare's environment configuration; `.dev.vars` is local-only. Running `bun run deploy` requires an authenticated Wrangler session or appropriately scoped CI credentials. Do **not** set production API/model secrets in committed files.

## Release blockers

- The Worker has not been deployed or connected to the SvelteKit UI.
- Implement spec 006 consent enforcement and confirm provider terms, data processing region/transfer mechanism and log retention before sending real pupil material.
- Implement rate limiting and abuse prevention independent of CORS.
- Supply the evaluated simplification/TTS adapters; preserve source provenance and faithfulness verification. No content-bearing request or response logs, cache, or durable storage.
- Confirm real Vercel preview origin policy (no loose suffix or wildcard matching) and EEA/privacy requirements.
- Benchmark Worker request limits and streaming behaviour using representative input sizes.

See [ADR-0002](../docs/adr/0002-cloudflare-worker-local-first.md) and issue #3.
