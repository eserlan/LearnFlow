# LearnFlow Cloudflare Worker: integration and deployment

## Architecture

- Existing SvelteKit PWA stays at the repository root; Vercel hosts it.
- Cloudflare Worker in worker/ is the stateless API for eventual simplification and speech.
- Student source text, lesson progress and other metadata are stored in IndexedDB/Dexie **on device**.
- Generated audio is planned for local OPFS. **No R2, D1, Workflows, KV or other server-side pupil-file persistence.**
- Source content must never be sent until spec 006's privacy/consent gate has approved it. Cloudflare and AI processors will still transiently receive content when real features are enabled, subject to verified contracts and legal transfer grounds.

## API today

- GET /health → JSON { "status": "ok" }.
- POST /api/simplify → HTTP 501 by default, until production processing and its guardrails are implemented.
- POST /api/speak → HTTP 501.
- The only successful simplification response is **test-only**: APP_ENV=test and ENABLE_MOCK_PROCESSING=true, both required; it accepts only the fixed synthetic SMOKE_FIXTURE declared in worker/src/index.ts, echoes it unchanged, and marks it forLearning:false. **Never enable this mode on a public deployment or show it as a real lesson.**

## Local development

1. From worker/, run npm install, then copy .dev.vars.example to .dev.vars (gitignored).
2. Set ALLOWED_ORIGINS to exact local frontend origins, for example http://localhost:5173 (no wildcard).
3. Run npm run dev; check GET http://localhost:8787/health.
4. In a separate terminal, from the repository root run bun install and bun run dev.
5. In tests, the browser request is modelled by tests/integration/worker-handoff.test.ts, calling the existing simplifyDraft consent boundary and createWorkerProcessor HTTP adapter.
6. Run npm run check and npm run test in worker/; from root run bun run check, bun run test:unit, bun run test:integration.

The user-facing page intentionally does **not** invoke the Worker with real material, because the guardian/privacy consent implementation is not yet complete. The integration test uses a synthetic source and a simulated approval explicitly limited to the test.

## Deployment

The connected tools cannot currently deploy to your Cloudflare account. A manual workflow is included in .github/workflows/deploy-worker.yml so that GitHub can perform the deployment after the user sets up credentials.

1. Merge the PR after CI passes.
2. In GitHub repository Settings → Secrets and variables → Actions, configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (prefer the production environment's secrets with approval).
3. In Cloudflare, configure the learnflow-api Worker environment variable ALLOWED_ORIGINS with the **exact** Vercel production and selected preview origins; leave test toggles unset.
4. Run Actions → Deploy Cloudflare Worker → Run workflow on main. Verify the resulting Worker URL and GET /health.
5. Create/connect the Vercel project from the repository root with framework SvelteKit; configure its public Worker origin when the real consent-backed UI integration is enabled.

Avoid exposing broad *.vercel.app wildcard origins. If ephemeral preview URLs need live API access, prefer an approved proxy strategy or explicit preview origin registration with the Worker. CORS alone is not authentication or rate limiting.

## Release gates for real student material

- Spec 006 consent, including the correct policy for users under 13; legal/privacy documentation and provider retention evaluation.
- Abuse prevention, payload size limits, safe errors, and never logging private content.
- Faithfulness/provenance gate from the model evaluation suite.
- Real device and offline playback tests; audio persisted on device and deleted on request.
- Verified Cloudflare/AI provider data processing locations and cross-border transfer mechanism. Cloudflare does not guarantee EEA-only processing by default.

Related: ADR-0002, issue #3, issue #2 (photo/PDF import).
