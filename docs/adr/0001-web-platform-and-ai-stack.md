# ADR-0001: Installable SvelteKit web app, stateless EU functions on Vercel, Gemini Flash via the Gemini API

**Status:** Accepted. The simplification model was chosen on pilot results and is confirmed on the full
practice split (see Decision 4).
**Date:** 2026-11-05. **Revised:** 2026-11-06, three times. First the language model moved from Gemini on Vertex AI
(EU endpoint) to Claude through the Anthropic API with global inference. Then, after the first harness
pilots, simplification moved to **Gemini 3.8 Flash through the Gemini API** (not Vertex AI), because it
gave the shortest, most bite-sized texts at the target speed. Decision 4, the options and the action items
changed accordingly. Third, copied-text cleanup moved from local TypeScript parsing into the Gemini Flash
pipeline at the user's direction; exact source is still retained locally and validated before display.
**Deciders:** Espen Erlandsen (product owner)

## Context

LearnFlow lets a pupil paste a text from their school material, get a faithful simplified version, and listen
to it read aloud with read-along highlighting (specs 001–004; constitution v2.0.0). The technical choices are
shaped by:

- **Users are minors in Norway.** GDPR and the Norwegian Personal Data Act apply. Personal data must stay in
  the EU/EEA or have a documented legal basis for transfer, must never be used for model training, and must
  be deletable (Constitution Principle II, spec 006).
  The core flow must not require an account.
- **Mobile-first, used alone, often offline.** Lessons must play offline once made, resume exactly, and keep
  playing with the screen locked (004).
- **The AI steps carry the product risk.** Simplification must be faithful (002: at least 99% of sentences
  supported by the source, every kept number and name exact, the main points kept) and, at the "Lettere"
  level, short: the main points in bite-sized sections (002 FR-017). Audio must read the text exactly, in Bokmål,
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
4. **Simplification model: Gemini 3.8 Flash at low thinking, through the Gemini API** (Google's paid
   tier, not Vertex AI), with structured output against the schema in `eval/src/simplify.ts` and the prompt
   `simplify-v3` from the same file. The prompt can be tuned later; every change is re-run on the golden
   data set first.
   - **Why Gemini Flash:** in the harness pilots (2 items, judged by Claude Opus 5.5) it came closest to what
     the product needs: texts at 25–29% of the source's length, sections of at most 4 short sentences, in
     about 10 seconds. Claude Sonnet 5.5 was the most faithful, but kept about half the text. Claude Haiku 5.5
     thought for up to a minute and a half, and GPT-6 Luna mostly split sentences.
   - **The known risk:** Gemini Flash made more faithfulness errors than Sonnet. In the pilots it dropped
     hedges ("direkte eller indirekte", "ofte"), merged two facts into one, and left out a few main points.
     The faithfulness check (Decision 5) is therefore not optional, and the full practice-split run must
     confirm the choice before release.
   - **Processing location:** the Gemini API does not let us choose where it processes requests, so
     processing outside the EEA needs the documented legal basis that Principle II requires (see Action
     Items).
   - The API key is a Vercel encrypted environment variable, available to server functions only, in a
     dedicated Google Cloud project with a budget alert.
   - Evaluation runs go through the team's own command-line logins (`agy` for Gemini, `claude -p` for the
     Claude judge), so the eval needs no API key. Production calls the API directly; the harness gets a
     Gemini API backend so the production path can be measured too.
5. **Faithfulness checking has two layers.** Deterministic TypeScript checks run first: every number, date,
   name, unit and key term the text keeps must be exact, and readability (LIX) is computed. Then a model call
   checks each simplified sentence against its linked source sections, and checks that nothing left out makes
   the rest misleading. The check model is chosen by the golden data set (it must catch at least 95% of the
   seeded errors, 002 SC-005). A model from another family than Gemini, such as Claude Sonnet 5.5 through the
   Anthropic API, is the first candidate, since it is less likely to share the generator's blind spots.
6. **Text-to-speech: not decided yet.** It will be chosen through an experiment (see Action Items) against
   these requirements: Bokmål, Nynorsk and English; correct pronunciation of subject terms; word-level timing
   (native, or by running speech-to-text over the generated audio); no retention of inputs; a processing
   location with a documented legal basis; acceptable cost.
7. **Copied-text cleanup runs through Gemini Flash.** The browser's paste event captures exact `text/plain`
   and optional `text/html`; the client retains both locally and sends them unchanged only after the pupil's
   explicit action and 006 consent gate. Gemini Flash extracts structure, classifies content, removes page
   furniture, joins lines and handles line-break hyphenation as part of the source-to-simplified pipeline.
   Deterministic server checks validate exact source excerpts, offsets, limits and faithfulness before results
   are returned. Clipboard HTML is never rendered. This supersedes local deterministic cleanup to avoid a
   second, heuristic copy of the same parsing work; raw source remains available for faithfulness checks and
   optional original viewing.
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
| Google Cloud Run in an EU region | Viable. One cloud with the Gemini API, which makes the DPIA simpler, but more setup and no built-in preview deployments. This is the fallback if Vercel's data protection terms or region limits don't work out. |

### Language model access

| Option | Assessment |
|--------|------------|
| **Gemini 3.8 Flash via the Gemini API, paid tier** | **Chosen for simplification.** The shortest, most bite-sized output at about 10 s in the pilots. More faithfulness errors than Sonnet, which the check must catch. No choice of processing location. |
| Claude via the Anthropic API, global inference | Chosen in the second version of this ADR. Sonnet 5.5 was the most faithful in the pilots but cut less; Haiku 5.5 was slow because it thinks at length. Remains the first candidate for the check model (Decision 5), and the judge in the eval. Inference may run outside the EEA (`global` or `us` only). |
| Claude via Amazon Bedrock with EU routing | Fallback for the check model if EU processing becomes a requirement. AWS's model cards list EU geo routing for Haiku, Sonnet and Opus 5.5, but not in-region serving from Stockholm (`eu-north-1`). |
| Gemini via Vertex AI on an EU endpoint | Chosen in the first version of this ADR, then dropped: the team does not want to use Vertex AI. It is still the only way to run Gemini in the EU, if that ever becomes a requirement. |
| GPT-6 Luna, Muse Wonder 1.0 | Tested in the pilots through their CLIs. GPT mostly split sentences and was slowest; Muse was fast and faithful on the pilot items and is the runner-up. Neither offered a clear advantage over Gemini Flash for bite-sized output. |
| Claude on Microsoft Foundry | Rejected for now. Secondary reports say Azure-hosted Claude has only Global and US data zones. |
| Gemini API free tier / AI Studio | Rejected. The terms allow use of data to improve products. |

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
- **Bite-sized vs most faithful.** Gemini Flash gives the product's main promise, short pieces fast, but
  makes more faithfulness errors than Claude Sonnet. We take the faster, shorter model and make the
  faithfulness check carry the risk: a failing text is retried once and otherwise replaced by the original
  (002 FR-006). If the check fails too often on Gemini's output, switching the generator to Sonnet is a
  configuration change in the client module.
- **Global processing vs EU-only.** Both the Gemini API and the Claude API process outside the EEA. The cost
  is a transfer that needs a legal basis in the DPIA and a clear line in the privacy notice. The pasted
  texts are school material, not pupil data, but a pupil can paste anything, so the transfer is treated as
  personal data. If the DPIA or a school customer requires EU processing, the options are Gemini on Vertex
  AI (which the team does not want) or Claude through Bedrock with EU routing.
- **Vercel vs Google Cloud Run.** Vercel gives the best SvelteKit developer experience, but adds more
  processors (Vercel, Google and, for the check, Anthropic) to the DPIA. That is an acceptable cost if
  Vercel's data processing agreement and EU region pinning hold up.

## Consequences

**Easier:**
- Shipping and iterating, with a preview deployment per pull request alongside the eval results.
- GDPR compliance: no server-side store of personal data.
- Comparing models: the harness runs Gemini, Claude, GPT and Muse side by side (`eval/src/configs.ts`).

**Harder:**
- Data protection: inference outside the EEA must be justified in the DPIA.
- Two model providers (Google for simplification, likely Anthropic for the check), each with its own SDK,
  terms and DPIA entry. Changing provider means rewriting that client module.
- Gemini Flash's faithfulness errors must be caught by the check, which adds a model call before the pupil
  sees the text and works against the 10-second target (002 SC-008).
- iOS storage persistence and background audio need explicit design and testing.
- No iOS share target; spec 001 is updated to make sharing Android-only.
- Abuse protection is weaker without device attestation.
- Every audio change regenerates a whole chapter's audio file, because audio is one file per chapter.

**To revisit:**
- The simplification model after the full practice-split run, and through the Gemini API rather than the CLI.
- The check model, chosen by how many seeded errors it catches.
- The TTS provider after the experiment.
- Wrapping as a native app if iOS limits hurt pupils.
- Cross-device sync, if pupils ask for it; that would need accounts and a new DPIA.

## Action Items

1. [x] Update specs for the web platform: 001 (sharing is Android-only, paste area), 004 (storage
   persistence and eviction), 007 (platform assumption).
2. [ ] Google terms for the Gemini API paid tier, and Anthropic's if Claude does the check: confirm in the
   terms and data processing agreements that inputs are not used for training, how long inputs and outputs
   are kept (including for abuse monitoring), and which transfer mechanism covers processing outside the
   EEA. Record the result in the DPIA.
3. [ ] Experiment, TTS: 10 real texts in Bokmål and Nynorsk through 3–4 providers (including Google Cloud and
   Azure AI Speech, plus Norwegian specialists such as Lingit and Acapela). Score naturalness and subject
   terms, and confirm word timing and EU processing.
4. [ ] Experiment, iOS Safari: confirm storage persists for a home-screen app, that one long audio file keeps
   playing with the screen locked, that Media Session lock-screen controls work, and that paste events
   carry `text/html` from NDLA, a publisher's digital textbook and PDFs.
5. [ ] Golden data set: 40–60 texts (NDLA as the openly licensed base), annotated with key facts, key terms,
   and the numbers and names that must survive, plus a seeded-error set. The harness in `eval/` reports
   checks, LIX, judge score, latency and cost per model and effort level. Started: 10 items drafted, harness
   built, three pilots run.
6. [ ] Confirm Gemini 3.8 Flash on the full practice split, then add a Gemini API backend to the harness
   and measure the production path (structured output, thinking level, latency). Choose the check model on
   the seeded-error set.
7. [ ] Confirm Vercel's region pinning for functions on the chosen plan, its data processing agreement and
   its log retention. Add Vercel, Google, Anthropic (if it does the check) and the TTS provider to the DPIA's
   list of processors.
8. [ ] Run `/speckit-plan` for 001–004 using this ADR.
