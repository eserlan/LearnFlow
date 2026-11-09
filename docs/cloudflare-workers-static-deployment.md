# Deploy LearnFlow as Cloudflare Workers Static Assets

Two **separate** Cloudflare Workers share one GitHub repo:

| Purpose | Worker name | URL | Wrangler config |
| --- | --- | --- | --- |
| Frontend, static SvelteKit build | `learnflow` | `https://learnflow.espen-erlandsen.workers.dev` | `/wrangler.jsonc` |
| Gemini text simplification and WAV narration | `learnflow-serv` | `https://learnflow-serv.espen-erlandsen.workers.dev` | `/worker/wrangler.jsonc` |

**Never deploy from repo root using the API Worker's configuration, or deploy
from `worker/` using the static frontend's configuration.** Both are separate.

## Frontend: Workers Builds with GitHub

In Cloudflare → Workers & Pages → `learnflow` → Settings → Build,
connect the repository `eserlan/LearnFlow`, production branch `main`.
Use these values:

- **Build command:** `bun run check && bun run test && bun run build`
  (or simply `bun run build`, if GitHub CI handles checks)
- **Deploy command:** `npx wrangler deploy --config wrangler.jsonc`
- **Preview command:** leave the default, with **Enable Preview builds = off**.
- **Root directory / Path:** `/`.
- No `Output directory` field is needed in Workers Builds.

The **root** `wrangler.jsonc` explicitly declares:
```json
{
  "name": "learnflow",
  "compatibility_date": "2026-11-09",
  "workers_dev": true,
  "assets": { "directory": "./build" }
}
```

This deploys the *existing static site* written by SvelteKit adapter-static
and intentionally has **no `main` Worker script**. It does not run Cloudflare's
automatic SvelteKit server adapter setup, which is incompatible with this
static deployment.

`VITE_LEARNFLOW_API_URL` is public and set by `.env.production` at build
time to `https://learnflow-serv.espen-erlandsen.workers.dev/`. **Do not place
`GEMINI_API_KEY` on the frontend Worker.** The static site stores drafts,
lessons and audio on-device in IndexedDB/OPFS.

After the PR containing these config files merges to `main`, save the
Build/Deploy command settings and trigger **Retry deployment** or a new build.
Older builds won't include the root Wrangler config.

## API Worker: keep separate

The API Worker has its own config `worker/wrangler.jsonc` with
`name: "learnflow-serv"`, the rate limiter, and its existing runtime
`GEMINI_API_KEY` Secret plus `GEMINI_MODEL` variable. API deployment
uses `cd worker && npm run deploy`, **never** the repo root deployment
command.

The API allows the exact frontend origin
`https://learnflow.espen-erlandsen.workers.dev`, plus the Pages origin. All API endpoints remain on
`learnflow-serv`; the static Worker only serves app files.

If you renamed the API Worker in the dashboard rather than creating a new
service, verify that the renamed Worker still exposes `/capabilities`
and that its secrets and limiter binding survived.

## Smoke test after deployment

1. Visit `https://learnflow-serv.espen-erlandsen.workers.dev/capabilities`.
   It should return `{"simplify":true}` if the API still has the required
   bindings; a 404 or HTML means you are hitting the wrong Worker.
2. Visit `https://learnflow.espen-erlandsen.workers.dev/`.
   The frontend should display the LearnFlow editor.
3. With **fictional** Norwegian test text, simplify, select **Lag lyd**,
   play the WAV, reload the page and confirm it can play again.
4. Confirm the PWA manifests and `/service-worker.js` load.
5. Lessons and audio are stored in each browser per origin, so they stay on the
   address where they were created and are not migrated between addresses.

References:
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
