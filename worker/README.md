# LearnFlow Cloudflare Worker

The Vercel app uses this stateless API for text simplification. Lesson text, drafts and progress stay on the pupil's device in Dexie/IndexedDB. **No R2, D1, KV, Workflows or server-side pupil content storage.**

## Endpoints

- GET /health: returns { "status": "ok" }.
- GET /capabilities: returns { "simplify": true } when Gemini credentials, model and rate-limiter binding are configured, otherwise false. Safe to call without source text.
- POST /api/simplify: accepts up to 2,000 source words (plain text only). Uses Google Gemini alone to simplify. Structural checks reject malformed output, new numbers and incorrect source IDs; the result is **not independently fact-checked**. Pupils can compare it with the original.
- POST /api/speak: accepts the *simplified lesson transcript* (up to 12,000 characters / 2,000 words) and returns a binary WAV. Uses Gemini 3.8 Flash-Lite TTS via the Interactions API. One calm single-speaker voice (Kore). Rate-limited before reading the text, no response caching or cloud file storage. The UI only sends text when the learner clicks **Lag lyd**.
- Test fixture remains accessible **only** in APP_ENV=test with ENABLE_MOCK_PROCESSING=true. Never configure test mode publicly.

## Configuration and deployment

Use **the existing Worker named learnflow**, so its public address stays https://learnflow.espen-erlandsen.workers.dev. The Wrangler project root is worker/. The Vercel frontend is configured with public VITE_LEARNFLOW_API_URL to this Worker.

In Cloudflare Workers → learnflow → Settings → Variables and Secrets, configure:

| Variable | Purpose |
| --- | --- |
| ALLOWED_ORIGINS | Optional Text: additional exact frontend origins (preview/local). The production URL https://learnflow-nine-pied.vercel.app is allowed by default. |
| GEMINI_API_KEY | **Secret**: paid-tier Gemini API key (not an AI Studio free-tier key) |
| GEMINI_MODEL | Text: actual Gemini **API** model ID; CLI aliases from the evaluation harness are not necessarily valid API names |

For narration, the TTS model is built in as `gemini-3.8-flash-lite-tts` and uses the existing `GEMINI_API_KEY`. No new Cloudflare environment variable or secret is needed. This model supports Bokmål and Nynorsk. TTS outputs WAV, not MP3; the browser stores audio locally in OPFS where available, with IndexedDB Blob fallback. Playing a saved lesson again does not call Google and works offline until browser storage is evicted. Deleting/editing a lesson also removes its local audio.\n\nThe source defines a RATE_LIMITER binding (8 requests per 60 seconds per IP per Cloudflare location) in wrangler.jsonc. This is **approximate**, not hard authentication or a guaranteed global ceiling. Add stronger abuse/cost controls before public use. You must also verify the namespace is unique in your account.

There are no manual AI enablement or privacy-approval environment flags. When the model credentials and RATE_LIMITER binding exist, the Gemini API is available immediately after deploy. If required infrastructure is missing, the Worker rejects requests without reading the input body. The Cloudflare dashboard variables `ENABLE_AI_PROCESSING` and `PRIVACY_REVIEW_APPROVED` are obsolete and can be deleted.

You can manually deploy from Cloudflare or via the GitHub workflow (which requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN production secrets). Run checks in worker/ with npm run check && npm run test. Frontend checks run from repository root.

## Public access

The Vercel site and Cloudflare API are publicly reachable. Availability is derived from required infrastructure only; the code does not gate access on a manual privacy-approval flag. Do not interpret this as completion of any legal/privacy review.

The standard UI has **one explicit Forenkle med AI action** for everyone: it shows a clear transfer notice beside the action, saves the source locally, checks API capabilities **without sending source text**, then calls Gemini when processing is enabled. There is no age selector or separate consent checkbox. The button itself is the user's deliberate action; it is not proof of parental authority. No private token is required once production is properly approved.

To enable Gemini for all visitors, deploy the Worker with `GEMINI_API_KEY` Secret, a supported `GEMINI_MODEL` (for example `gemini-3.8-flash`) Text, `RATE_LIMITER` binding, plus any extra exact `ALLOWED_ORIGINS` entries for preview/local URLs. There is no additional manual enablement flag. Refer to Google’s model documentation for supported IDs.

**Public deployment caution:** Cloudflare rate limiting is 8 requests per 60 seconds per IP/location, not a global spending cap. Configure provider-level spend alerts/quotas and appropriate abuse controls. Review Google’s actual data-handling, training/retention status and transfer terms before accepting real pupil material.

## Privacy and release blockers

**Do not send real pupil content until spec 006 / issue #8 is complete.**

- Decide controller/legal basis and approve DPIA, processor agreements, cross-border handling, retention and training settings for Cloudflare and Google. Neither cloud company automatically guarantees EEA-only processing for this setup.
- Implement an appropriate, verified guardian consent policy where required for under-13 pupils **before processing real children's content**. The frontend no longer asks for an age band and cannot enforce this requirement; the Worker does not perform guardian verification.
- Perform human-reviewed quality evaluations using school texts in Bokmål, Nynorsk and English; check missed qualifiers, numbers, attribution and exercises against spec 002. No independent model reviewer runs for each request. Structural checks are not a guarantee of factual faithfulness.
- Improve abuse controls beyond CORS and approximate per-IP rate limiting; enforce cost budgets. CORS is **not** authentication.
- No pupil source/result content logging, cache, or persistent server state. Provider calls may nevertheless involve provider-side transient processing/retention subject to their terms.
- Run physical Android/iOS mobile and offline audio playback tests; assess browser storage eviction and long-lesson output durations.

See docs/adr/0002-cloudflare-worker-local-first.md and issues #6, #7 and #8.
