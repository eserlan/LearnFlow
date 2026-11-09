# ADR-0002: Stateless Cloudflare Workers API with device-only lesson storage

**Status:** Accepted (hosting and storage decision); deployment and data protection gates remain open.
**Date:** 2026-11-06
**Decider:** Product owner

## Context

LearnFlow already has a SvelteKit 5 PWA, Dexie/IndexedDB source drafts, a consent-checked processing boundary, and a model-quality evaluation suite. ADR-0001 previously selected Vercel Node.js functions for the AI endpoints. The product owner has now chosen Cloudflare Workers for the AI backend while keeping Vercel's convenient web app deployment, **and has explicitly ruled out server-side file storage for the MVP**.

## Decision

1. **Frontend:** retain the existing SvelteKit application at the repository root, deployed as Cloudflare Workers Static Assets (originally planned on Vercel; Vercel is no longer used). Do not force a monorepo migration just for a Worker.
2. **AI API:** provide a separate, stateless Cloudflare Worker. The intended public contract is `POST /api/simplify`, `POST /api/speak`, and `GET /health`. Requests are transient; results are returned to the browser. Worker integration must use the existing consent-protected `SimplificationProcessor` boundary.
3. **Store all source and generated files on the pupil's device:** source text, source documents, lesson metadata and progress in Dexie/IndexedDB; generated audio in OPFS where supported (with a deliberate fallback). Keep the original source on-device for provenance and retry. Existing expiry and delete features continue to apply. Do not sync or back up files to the server.
4. **No cloud persistence in the MVP:** no R2, D1, KV, Durable Objects, server-side session database, Cloudflare Workflows, or other persistent stores of pupil content. Do not use a CDN/API cache for private processing results. Do not log source text, simplified responses, generated audio, or student-entered content.
5. **AI providers:** the Worker may call model/TTS providers using server-side secrets after the privacy and consent gates are satisfied; response bodies must be returned directly to the device, not durably saved by LearnFlow. The chosen simplification model, evaluation harness and faithfulness rules from ADR-0001 are not changed by this decision.
6. **Deployment boundaries:** browser ↔ Cloudflare Worker via explicitly allowed origins or a reviewed same-origin routing strategy. Never mistake CORS for authentication. Plan abuse protection for an account-free service. No production student processing until the consent flow and DPIA/provider requirements are implemented.

## Supersession and preserved decisions

This ADR **supersedes ADR-0001 Decision 3 (Vercel Node.js server functions) and its associated server-hosting comparison**. ADR-0001 remains authoritative for SvelteKit, local-first storage, golden evaluation/faithfulness gates, provider choice, and the unresolved TTS experiment. A new architecture review is required before introducing cloud file persistence.

## Device data and network boundaries

- **Persisted locally:** pasted text, future photo/PDF source files, cleaned/simplified lessons, reading position, user settings and audio assets.
- **Sent temporarily for processing:** only the minimum source segments needed by the AI provider, and only after user action plus the spec 006 privacy/consent gate.
- **Received:** verified simplified sections or speech audio streamed/returned over HTTPS and saved to IndexedDB/OPFS by the client.
- **Never retained by LearnFlow backend:** uploaded documents, audio files, lesson history, learning progress or source/response bodies.
- **Provider caveat:** cloud AI providers may have independent processing, logging or retention practices. Confirm contracts and actual geographic processing/transfer mechanisms before allowing real pupil content.

## Trade-offs

**Benefits:** simple file deletion and minimal persistent server-side personal data, predictable PWA deployments, reuse of Cloudflare Workers experience, no R2/D1/Workflows setup.

**Costs/constraints:** device storage can be evicted or unavailable, offline access is possible only once content/audio are saved, and no cross-device sync or recovery if a device is lost. Large PDFs or long-running audio generation may exceed practical Worker request limits and will need measured streaming or a later architecture decision.

**Regional caveat:** choosing Cloudflare Workers does **not** itself guarantee that every Worker execution or AI call occurs in the EEA. Validate Cloudflare controls and provider processing/transfer arrangements against spec 006 and the DPIA before production use.

## Delivery sequence / gates

1. Scaffold an isolated Worker (no persistence bindings), health endpoint, CORS policy, placeholder AI endpoints and tests.
2. Confirm the Static Assets frontend and independent Worker deployment. Set explicit preview/production allowed origins, no wildcard.
3. Implement request validation, rate limiting and appropriate authentication/abuse controls; document secret management, no-content logging and operational metrics.
4. Implement the spec 006 consent/privacy gate and provider privacy/DPIA approval **before** passing real student content to the Worker.
5. Implement source-grounded `/api/simplify` via the existing processor interface, preserving source IDs, verification and fallback; later implement `/api/speak` and client-side OPFS storage.
6. Test offline playback, storage eviction/recovery, deletion and user independence with actual mobile devices.

## Deferred by design

- R2, D1, Workflows, cross-device sync, central lesson library.
- Photo/PDF import (separate issue #2).
- No claim of production readiness until the conditions above pass.

**Tracks:** issue #3, specifications 001–007, ADR-0001.
