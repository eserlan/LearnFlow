# LearnFlow

LearnFlow helps learners turn long school texts into shorter lessons and spoken audio.

- **Frontend:** static SvelteKit 3 site deployed through Cloudflare Workers Static Assets.
- **AI API:** separate stateless Cloudflare Worker (Gemini simplification and TTS).
- **Storage:** lesson drafts and generated audio live only in the browser's IndexedDB/OPFS.

## Local development

```sh
bun install --frozen-lockfile
bun run dev
```

## Checks and production build

```sh
bun run check
bun run test
bun run build
```

The static site is generated into `build/`. The production `VITE_LEARNFLOW_API_URL`
is public and defined in `.env.production`. There are **no Google API secrets in the frontend**.

## Deployment

See [Cloudflare Workers Static Assets setup](docs/cloudflare-workers-static-deployment.md). The intended
production domain is `https://learnflow.espen-erlandsen.workers.dev`; the AI Worker stays at
`https://learnflow-serv.espen-erlandsen.workers.dev`.

Do not retire the old Vercel origin before providing an export/import path for
locally stored lessons and audio.
