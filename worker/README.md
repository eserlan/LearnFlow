# LearnFlow Cloudflare Worker

The Vercel app uses this stateless API for text simplification. Lesson text, drafts and progress stay on the pupil's device in Dexie/IndexedDB. **No R2, D1, KV, Workflows or server-side pupil content storage.**

## Endpoints

- GET /health: returns { "status": "ok" }.
- GET /capabilities: returns { "simplify": false } until **all** production release gates are enabled. Safe to call without pupil text.
- POST /api/simplify: accepts up to 2,000 source words (plain text only). Uses Google Gemini alone to simplify. Structural checks reject malformed output, new numbers and incorrect source IDs; the result is **not independently fact-checked**. Pupils can compare it with the original.
- POST /api/speak: remains 501 until narrated lessons are implemented.
- Test fixture remains accessible **only** in APP_ENV=test with ENABLE_MOCK_PROCESSING=true. Never configure test mode publicly.

## Configuration and deployment

Use **the existing Worker named learnflow**, so its public address stays https://learnflow.espen-erlandsen.workers.dev. The Wrangler project root is worker/. The Vercel frontend is configured with public VITE_LEARNFLOW_API_URL to this Worker.

In Cloudflare Workers → learnflow → Settings → Variables and Secrets, configure:

| Variable | Purpose |
| --- | --- |
| ALLOWED_ORIGINS | Text: exact allowed production origin e.g. https://learnflow-nine-pied.vercel.app |
| GEMINI_API_KEY | **Secret**: paid-tier Gemini API key (not an AI Studio free-tier key) |
| GEMINI_MODEL | Text: actual Gemini **API** model ID; CLI aliases from the evaluation harness are not necessarily valid API names |
| ENABLE_AI_PROCESSING | Text: set to true **only after all gates** |
| PRIVACY_REVIEW_APPROVED | Text: set to true **only after documented approval** of processing and transfer terms |

The source defines a RATE_LIMITER binding (8 requests per 60 seconds per IP per Cloudflare location) in wrangler.jsonc. This is **approximate**, not hard authentication or a guaranteed global ceiling. Add stronger abuse/cost controls before public use. You must also verify the namespace is unique in your account.

By default, **do not set** either enablement variable, and GET /capabilities will report false. The Worker also checks that all model secrets and RATE_LIMITER are configured before reading a request body.

You can manually deploy from Cloudflare or via the GitHub workflow (which requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN production secrets). Run checks in worker/ with npm run check && npm run test. Frontend checks run from repository root.

## Privacy and release blockers

**Do not send real pupil content until spec 006 / issue #8 is complete.**

- Decide controller/legal basis and approve DPIA, processor agreements, cross-border handling, retention and training settings for Cloudflare and Google. Neither cloud company automatically guarantees EEA-only processing for this setup.
- Implement verifiable guardian consent for under-13 pupils. The frontend blocks this age band, but a frontend age selector alone is **not** server-side guardian verification.
- Perform human-reviewed quality evaluations using school texts in Bokmål, Nynorsk and English; check missed qualifiers, numbers, attribution and exercises against spec 002. No independent model reviewer runs for each request. Structural checks are not a guarantee of factual faithfulness.
- Improve abuse controls beyond CORS and approximate per-IP rate limiting; enforce cost budgets. CORS is **not** authentication.
- No pupil source/result content logging, cache, or persistent server state. Provider calls may nevertheless involve provider-side transient processing/retention subject to their terms.
- Implement mobile device test suite, TTS and offline audio separately.

See docs/adr/0002-cloudflare-worker-local-first.md and issues #6, #7 and #8.
