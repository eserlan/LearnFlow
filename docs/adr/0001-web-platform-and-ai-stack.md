# ADR-0001: Installable SvelteKit web app, stateless EU functions on Vercel, Gemini via Vertex AI

**Status:** Accepted. The model choice is provisional until the golden data set results are in (see Decision 4).
**Date:** 2026-11-05
**Deciders:** Espen Erlandsen (product owner)

## Context

LearnFlow lets a pupil paste a text from their school material, get a faithful simplified version, and listen
to it read aloud with read-along highlighting (specs 001–004; constitution v2.0.0). The technical choices are
shaped by:

- **Users are minors in Norway.** GDPR and the Norwegian Personal Data Act apply. Data must stay in the
  EU/EEA, must never be used for model training, and must be deletable (Constitution Principle II, spec 006).
  The core flow must not require an account.
- **Mobile-first, used alone, often offline.** Lessons must play offline once made, resume exactly, and keep
  playing with the screen locked (004).
- **The AI steps carry the product risk.** Simplification must be faithful (002: at least 99% of sentences
  supported by the source, 100% of numbers and names preserved). Audio must read the text exactly, in Bokmål,
  Nynorsk and English, with word timing for highlighting (003).
- **Cost per lesson matters**, because there are no accounts or payments in the first release.
- **Team:** a small team led by someone who prefers SvelteKit and does not want React.

## Decision

1. **Client: SvelteKit (Svelte 5, TypeScript) as an installable web app (PWA).** It targets iOS Safari and
   Android Chrome on phones first, with desktop browsers supported. SvelteKit's service worker provides
   offline use.
2. **Local data: Dexie on IndexedDB** for lessons, source and simplified text, progress and settings. **OPFS
   (Origin Private File System)** stores the audio files. The app asks for persistent storage
   (`navigator.storage.persist()`) and encourages pupils to add LearnFlow to the home screen.
3. **Server: SvelteKit server routes deployed as Vercel Node.js functions, pinned to an EU region** (`arn1`
   Stockholm, with `fra1` Frankfurt as fallback). Edge Functions are not used. The server is **stateless**: no
   database, no stored text or audio, and logs contain metadata only, never request or response content.
   - `POST /api/simplify`: simplification, automatic checks and the check call; streams sections as they are
     ready.
   - `POST /api/speak`: speech for one chapter; returns one continuous audio file plus word timings.
4. **Language model: Gemini via Vertex AI on an EU endpoint**, called through the **Vercel AI SDK**
   (`ai` + `@ai-sdk/google-vertex`, with `generateObject` and Zod schemas for structured output).
   - Candidates: **Gemini Flash 3.8** and **Gemini Flash Lite 3.5**, at different thinking settings. The final
     model and settings are whatever passes the golden data set thresholds at the lowest cost per lesson.
   - Vercel authenticates to Google Cloud with **OIDC federation** (short-lived tokens), so no long-lived
     service-account key is stored.
   - The free Gemini API tier is **not** used, because its terms allow Google to use the data to improve its
     products.
5. **Faithfulness checking has two layers.** Deterministic TypeScript checks run first: every number, date,
   name, unit and key term must be preserved, and readability (LIX) is computed. Then a model call checks
   each simplified sentence against its linked source sections. The check model is also chosen by the golden
   data set and may differ from the generation model.
6. **Text-to-speech: not decided yet.** It will be chosen through an experiment (see Action Items) against
   these requirements: Bokmål, Nynorsk and English; correct pronunciation of subject terms; word-level timing
   (native, or by running speech-to-text over the generated audio); EU processing; no retention of inputs;
   acceptable cost.
7. **Text clean-up runs in the browser.** Removing page furniture, joining lines and re-joining hyphenated
   words is deterministic TypeScript run on the device. Pasted text arrives through the browser's paste event
   on a paste area, which provides both `text/html` (for structure) and `text/plain`.
8. **Abuse and cost control without accounts:** an anonymous per-install token, per-token and per-IP rate
   limits, and the 2,000-word limit from 001. Cloudflare Turnstile is added only if misuse appears.
9. **A golden data set and test harness** live in the repository (`eval/`, TypeScript). They are used to
   choose models and settings, and they act as the release gate (constitution, Quality Gates).

## Options Considered

### Client platform

#### Option A: Native app with React Native / Expo
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium: two app stores, native modules for the share extension and audio |
| Cost | App store fees and review cycles |
| Scalability | Not a concern |
| Team familiarity | Low; the team does not want React |

**Pros:** iOS share extension; reliable background audio and storage; device attestation (App Attest, Play
Integrity).
**Cons:** React; app store releases slow down iteration; more for a small team to maintain.

#### Option B: Native app with Flutter
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | App store fees and review cycles |
| Scalability | Not a concern |
| Team familiarity | Low |

**Pros:** The same native capabilities as Option A, without React.
**Cons:** A new language (Dart) and ecosystem for the team; the same app store overhead.

#### Option C: Installable SvelteKit web app (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low to medium; the iOS web limits (below) need care |
| Cost | Hosting only; no app store |
| Scalability | Not a concern; the server is stateless |
| Team familiarity | High |

**Pros:** The team's preferred stack; instant releases and preview deployments; one codebase across phones
and desktop; no install required to try it.
**Cons:**
- iOS Safari can delete a website's storage after about 7 days without a visit, unless the app is added to
  the home screen.
- There is no share target on iOS.
- Background audio is reliable only within a single audio file.
- Device attestation is not available.

### Server hosting

| Option | Assessment |
|--------|------------|
| Vercel Edge Functions | Rejected. They run near the user by default, which makes "where is data processed" harder to answer; the runtime is reduced; LLM calls take seconds, so edge latency gains are irrelevant. |
| **Vercel Node.js functions pinned to `arn1`/`fra1`** | **Chosen.** A clear EU processing location, full Node APIs, native SvelteKit support, preview deployments, and secrets kept on the server. Vercel becomes a data processor. |
| Google Cloud Run in an EU region | Viable. One cloud with Vertex AI, which makes the DPIA simpler, but more setup and no built-in preview deployments. This is the fallback if Vercel's data protection terms or region limits don't work out. |

### Language model access

| Option | Assessment |
|--------|------------|
| **Gemini via Vertex AI on an EU endpoint** | **Chosen.** EU processing, enterprise data terms (no training on inputs), and low-cost Flash models suit a cost-sensitive product with no accounts. |
| Gemini API free tier / AI Studio | Rejected. The terms allow use of data to improve products, and there is no EU processing guarantee. |
| Claude via Bedrock or Vertex AI in the EU | Viable alternative. It can be added to the golden data set comparison through the same AI SDK if the Gemini candidates fall short. |
| Vercel AI Gateway | For evaluation runs only. Production calls go directly to Vertex AI unless the Gateway can guarantee EU routing and no retention. |

## Trade-off Analysis

- **Web app vs native.** The web limits matter, but each has a workaround:
  - **Share:** pasting is the main path, and sharing is a convenience that remains on Android.
  - **Storage:** lessons can be regenerated if lost, and installing to the home screen avoids eviction.
  - **Background audio:** one audio file per chapter avoids switching files with the screen locked.

  In return the team works in its preferred stack and ships without app store reviews. If the iOS limits
  prove to hurt pupils in testing, the app can be wrapped later (for example with Capacitor) without
  rewriting it.
- **A stateless server vs storing lessons centrally.** Keeping nothing on the server removes most of the GDPR
  burden: deletion, retention, breaches and access requests. The cost is no cross-device sync in the first
  release, which the specs already treat as optional (004, 006).
- **A cheap Flash model vs a stronger model.** Cost per lesson matters with no paying users. The risk of
  weaker faithfulness is handled by measuring it, not assuming it: the golden data set and the two-layer
  check decide, and a stronger model can be swapped in through the AI SDK.
- **Vercel vs Google Cloud Run.** Vercel gives the best SvelteKit developer experience, but adds a second
  processor (Vercel and Google) to the DPIA. That is an acceptable cost if Vercel's data processing agreement
  and EU region pinning hold up.

## Consequences

**Easier:**
- Shipping and iterating, with a preview deployment per pull request alongside the eval results.
- GDPR compliance: no server-side store of personal data.
- Comparing models, because the AI SDK makes switching a configuration change.

**Harder:**
- iOS storage persistence and background audio need explicit design and testing.
- No iOS share target; spec 001 is updated to make sharing Android-only.
- Abuse protection is weaker without device attestation.
- Every audio change regenerates a whole chapter's audio file, because audio is one file per chapter.

**To revisit:**
- The model choice after the first golden data set run.
- The TTS provider after the experiment.
- Wrapping as a native app if iOS limits hurt pupils.
- Cross-device sync, if pupils ask for it; that would need accounts and a new DPIA.

## Action Items

1. [x] Update specs for the web platform: 001 (sharing is Android-only, paste area), 004 (storage
   persistence and eviction), 007 (platform assumption).
2. [ ] Experiment, Vertex AI: confirm that Gemini Flash 3.8 and Flash Lite 3.5 are served from an EU regional
   endpoint, not only the global endpoint, and set up Vercel OIDC federation with Google Cloud.
3. [ ] Experiment, TTS: 10 real texts in Bokmål and Nynorsk through 3–4 providers (including Google Cloud and
   Azure AI Speech, plus Norwegian specialists such as Lingit and Acapela). Score naturalness and subject
   terms, and confirm word timing and EU processing.
4. [ ] Experiment, iOS Safari: confirm storage persists for a home-screen app, that one long audio file keeps
   playing with the screen locked, that Media Session lock-screen controls work, and that paste events
   carry `text/html` from NDLA, a publisher's digital textbook and PDFs.
5. [ ] Golden data set: 40–60 texts (NDLA as the openly licensed base), annotated with key facts, key terms,
   and the numbers and names that must survive, plus a seeded-error set. Add a test harness in `eval/` that
   reports checks, LIX, judge score, latency and cost for each model and thinking setting.
6. [ ] Confirm Vercel's region pinning for functions on the chosen plan, its data processing agreement and
   its log retention. Add Vercel, Google Cloud and the TTS provider to the DPIA's list of processors.
7. [ ] Run `/speckit-plan` for 001–004 using this ADR.
