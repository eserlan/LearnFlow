# LearnFlow Cloudflare Worker

The Vercel app uses this stateless API for text simplification. Lesson text, drafts and progress stay on the pupil's device in Dexie/IndexedDB. **No R2, D1, KV, Workflows or server-side pupil content storage.**

## Endpoints

- GET /health: returns { "status": "ok" }.
- GET /capabilities: returns { "simplify": false } until production release gates pass. In private test mode it returns true **only** for a request with the correct `X-LearnFlow-Test-Token` header. Safe to call without pupil text.
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
| ENABLE_PRIVATE_TESTING | Text: set to `true` only for a controlled test period |
| PRIVATE_TEST_TOKEN | **Secret**: randomly generated, at least 32 characters; enter it in LearnFlow only when testing synthetic content |

The source defines a RATE_LIMITER binding (8 requests per 60 seconds per IP per Cloudflare location) in wrangler.jsonc. This is **approximate**, not hard authentication or a guaranteed global ceiling. Add stronger abuse/cost controls before public use. You must also verify the namespace is unique in your account.

By default, **do not set** either enablement variable, and GET /capabilities will report false. The Worker also checks that all model secrets and RATE_LIMITER are configured before reading a request body.

You can manually deploy from Cloudflare or via the GitHub workflow (which requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN production secrets). Run checks in worker/ with npm run check && npm run test. Frontend checks run from repository root.

## Private, general-purpose troubleshooting

This mode works on **any invented text in an existing LearnFlow draft**, not on one hard-coded smoke fixture.

1. Keep `ENABLE_AI_PROCESSING` and `PRIVACY_REVIEW_APPROVED` unset.
2. In Cloudflare Worker `learnflow`, configure `ENABLE_PRIVATE_TESTING=true` as text and `PRIVATE_TEST_TOKEN` as a **Secret** with a unique random 32+ character value. Do **not** place this value in GitHub, Vercel environment variables, URLs or chat.
3. Deploy this Worker version and ensure `ALLOWED_ORIGINS` lists the exact Vercel address. Keep `GEMINI_API_KEY`, `GEMINI_MODEL`, and `RATE_LIMITER` configured.
4. On Vercel, open an unfinished draft, choose **Forenkle**, consent, select **Privat testmodus**, enter the private token (never persisted), and confirm that the text is invented and contains no personal data.
5. The browser calls `GET /capabilities` with the token; only if approved does it POST the selected draft with the token. The Worker rejects requests without the token before reading the body or contacting Gemini.
6. For multiple invented drafts in one browser session the token stays only in component memory, but the synthetic-text acknowledgement is required for each draft. Reloading the page clears the token.
7. After troubleshooting, set `ENABLE_PRIVATE_TESTING=false` and remove/rotate `PRIVATE_TEST_TOKEN`.

**Important:** The `workers.dev` URL itself is publicly reachable. Vercel login protection on the frontend does not protect the Worker. The secret is the test-mode access boundary; do not use genuine pupil material in this mode. The presence of a test token does not imply the broader privacy/legal assessment is complete.

## Privacy and release blockers

**Do not send real pupil content until spec 006 / issue #8 is complete.**

- Decide controller/legal basis and approve DPIA, processor agreements, cross-border handling, retention and training settings for Cloudflare and Google. Neither cloud company automatically guarantees EEA-only processing for this setup.
- Implement verifiable guardian consent for under-13 pupils. The frontend blocks this age band, but a frontend age selector alone is **not** server-side guardian verification.
- Perform human-reviewed quality evaluations using school texts in Bokmål, Nynorsk and English; check missed qualifiers, numbers, attribution and exercises against spec 002. No independent model reviewer runs for each request. Structural checks are not a guarantee of factual faithfulness.
- Improve abuse controls beyond CORS and approximate per-IP rate limiting; enforce cost budgets. CORS is **not** authentication.
- No pupil source/result content logging, cache, or persistent server state. Provider calls may nevertheless involve provider-side transient processing/retention subject to their terms.
- Implement mobile device test suite, TTS and offline audio separately.

See docs/adr/0002-cloudflare-worker-local-first.md and issues #6, #7 and #8.
