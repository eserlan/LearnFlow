# Cloudflare Pages: static LearnFlow frontend

LearnFlow is a static SvelteKit application. Only the *existing* Cloudflare Worker
(`https://learnflow.espen-erlandsen.workers.dev`) handles Gemini simplification
and Gemini TTS. The static frontend has no server functions, secrets, or stored user
content. Lessons and audio remain on the device (IndexedDB/OPFS).

## One-time setup in the Cloudflare dashboard

1. Workers & Pages → Create application → **Pages** → Connect to Git.
2. Select GitHub repository `eserlan/LearnFlow`. Project name: **`learnflow-web`**.
   The name matters because the Worker has an exact CORS allowlist entry for
   `https://learnflow-web.pages.dev`. If the slug is unavailable, choose another
   name and update the Worker allowlist in `worker/src/index.ts` (or its existing
   `ALLOWED_ORIGINS` binding) before testing.
3. **Production branch:** `main`. **Root directory:** repository root `/`.
4. **Framework preset:** None / Custom (**do not** use the SvelteKit preset, which
   expects a server output at `.svelte-kit/cloudflare`).
5. **Build command:** `bun install --frozen-lockfile && bun run check && bun run test && bun run build`.
6. **Build output directory:** `build`.
7. Environment: no API secrets on Pages. `.env.production` already contains the
   **public** `VITE_LEARNFLOW_API_URL` and points to the existing Worker.
   `GEMINI_API_KEY`, `GEMINI_MODEL` and `RATE_LIMITER` remain on the Worker.
8. To avoid burning the Pages build quota on every coding-agent PR, under
   **Settings → Builds → Branch control**, set **Preview branch: None**.
   Keep automatic production builds on `main`. The Pages build command performs
   checks/tests before publishing.
9. Save and Deploy. Confirm the resulting Pages production URL is
   `https://learnflow-web.pages.dev`. If not, use the real origin as described in step 2.

## Verification

- Open `https://learnflow-web.pages.dev/`. Confirm the text editor, UI and PWA load.
- Paste a short *fictional* text, generate a simplified lesson, then **Lag lyd**.
- Play the WAV, reload and play it again. Try offline playback.
- Check that CORS preflight from the Pages origin works for both
  `POST /api/simplify` and `POST /api/speak`. Browser must not show
  `origin_not_allowed`.
- Check that `/manifest.webmanifest`, `/icon.svg` and
  `/service-worker.js` are served, and that `/index.html` is the static app.
- Check that the Worker still works at its original `workers.dev` URL.

## Important: local-first migration

Browser storage, including IndexedDB and OPFS, is isolated by **origin**.
Opening `learnflow-web.pages.dev` does **not** automatically transfer lessons,
saved drafts, or audio from `learnflow-nine-pied.vercel.app`.

**Do not turn off or redirect the Vercel site yet.** Keep it available so users
can access their saved content. Add a deliberate export/import flow before a
permanent cutover for existing learners. The new Pages site starts with empty
device-local storage; nothing is deleted from the old origin by this deployment.

## Rollback

Cloudflare Pages → Deployments → Roll back to the previous production build,
or continue using the old Vercel site. The AI Worker is independently deployed,
and no old user content should be deleted as part of frontend deployment.

References:
- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Cloudflare SvelteKit static adapter guidance:
  https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/
