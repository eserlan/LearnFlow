# LearnFlow Cloudflare Worker: integration and deployment

## Architecture

- Existing SvelteKit PWA stays at the repository root; Vercel hosts it.
- Cloudflare Worker in worker/ is the stateless API for eventual simplification and speech.
- Student source text, lesson progress and other metadata are stored in IndexedDB/Dexie **on device**.
- Generated audio is planned for local OPFS. **No R2, D1, Workflows, KV or other server-side pupil-file persistence.**
- The frontend sends source content only after the user explicitly clicks Forenkle med AI and the Worker reports that required infrastructure is configured. Cloudflare and AI processors will receive that content transiently; provider contracts and cross-border transfer grounds must still be reviewed before processing real pupil material.

## API today

- GET /health → JSON { "status": "ok" }.
- GET /capabilities → `{ "simplify": true }` when Gemini key, model and rate limiting are configured; false otherwise. The frontend checks this **before transmitting source text**. No separate approval or AI-enabled variables are used.
- POST /api/simplify → HTTP 503 if required infrastructure is missing; otherwise Gemini-only generation with schema, source-ID and numeric guardrails. The returned result is **not independently fact-checked** and the learner can compare it with the original.
- POST /api/speak → HTTP 501.
- The only successful simplification response is **test-only**: APP_ENV=test and ENABLE_MOCK_PROCESSING=true, both required; it accepts only the fixed synthetic SMOKE_FIXTURE declared in worker/src/index.ts, echoes it unchanged, and marks it forLearning:false. **Never enable this mode on a public deployment or show it as a real lesson.**

## Local development

1. From worker/, run npm install, then copy .dev.vars.example to .dev.vars (gitignored).
2. Set ALLOWED_ORIGINS to exact local frontend origins, for example http://localhost:5173 (no wildcard).
3. Run npm run dev; check GET http://localhost:8787/health.
4. In a separate terminal, from the repository root run bun install and bun run dev.
5. In tests, the browser request is modelled by tests/integration/worker-handoff.test.ts, calling the existing simplifyDraft consent boundary and createWorkerProcessor HTTP adapter.
6. Run npm run check and npm run test in worker/; from root run bun run check, bun run test:unit, bun run test:integration.

The user-facing page has a single explicit **Forenkle med AI** action, with transfer information displayed beside the button and no age selector or checkbox. It does **not** send source material when `/capabilities` reports unavailable. It also cannot verify guardian consent: processing real children's content remains a release blocker until the appropriate requirements are implemented and approved. This UI simplification is not a substitute for spec 006's legal/DPIA/provider approvals.

## Deployment

The connected tools cannot currently deploy to your Cloudflare account. A manual workflow is included in .github/workflows/deploy-worker.yml so that GitHub can perform the deployment after the user sets up credentials.

1. Merge the PR after CI passes.
2. In GitHub repository Settings → Secrets and variables → Actions, configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (prefer the production environment's secrets with approval).
3. In Cloudflare, configure `GEMINI_API_KEY` Secret and supported `GEMINI_MODEL` Text. The canonical Vercel production origin is allowed by default; use `ALLOWED_ORIGINS` only for additional exact preview/local origins. Retain the Wrangler `RATE_LIMITER` binding; leave mock-test toggles unset. Legacy `ENABLE_AI_PROCESSING` and `PRIVACY_REVIEW_APPROVED` variables are not read. Review worker/README.md and issue #8 before using real pupil content.
4. Run Actions → Deploy Cloudflare Worker → Run workflow on main (or use connected Cloudflare builds). Verify `learnflow.espen-erlandsen.workers.dev`, GET /health and GET /capabilities (true only when Gemini key/model/rate limiter are present).
5. Create/connect the Vercel project from the repository root with framework SvelteKit; configure its public Worker origin when the real consent-backed UI integration is enabled.

Avoid exposing broad *.vercel.app wildcard origins. If ephemeral preview URLs need live API access, prefer an approved proxy strategy or explicit preview origin registration with the Worker. CORS alone is not authentication or rate limiting.

## Release gates for real student material

- Spec 006 consent, including the correct policy for users under 13; legal/privacy documentation and provider retention evaluation.
- Abuse prevention, payload size limits, safe errors, and never logging private content.
- Faithfulness/provenance gate from the model evaluation suite.
- Real device and offline playback tests; audio persisted on device and deleted on request.
- Verified Cloudflare/AI provider data processing locations and cross-border transfer mechanism. Cloudflare does not guarantee EEA-only processing by default.

Related: ADR-0002, issue #3, issue #2 (photo/PDF import).
