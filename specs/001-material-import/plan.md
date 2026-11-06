# Implementation Plan: Pasted Material Import

**Feature:** 001-material-import | **Date:** 2026-11-06 | **Spec:** [spec.md](spec.md)

## Summary

Build the paste entry point for one source per lesson. Retain the exact original locally and send its available plain-text and rich-text representations to Gemini Flash through 002 after the 006 gate. Flash performs source extraction, cleanup, structure, language classification and simplification; deterministic validation checks the response and its source mapping. Photo and file import are deferred to issue #2; text copied from a PDF remains supported.

## Technical context

SvelteKit, Svelte 5 and TypeScript, with Dexie/IndexedDB for local drafts and source documents as decided in ADR-0001. Target current iOS Safari, Android Chrome and desktop browsers. Use native paste events to capture exact HTML and plain text in a labelled editable control; programmatic clipboard access is optional and must fall back to native paste when denied or unavailable. Android installed-app text sharing requires a separately verified share target. Only empty checks, word counts, persistence and retry remain local; Flash cleanup and simplification require connectivity and the 002 service.

## Design and sequence

1. Scaffold the SvelteKit shell and accessible, localised paste surface. Capture a paste event once, persist a local draft before processing, and process immediately without a preview. Handle empty clipboard, repeated paste and denied clipboard access with explicit recovery.
2. Do not parse or normalize content on the client. Store the exact `text/plain` value and optional `text/html` as the authoritative source. Never render clipboard HTML. After the explicit action and 006 gate, send both representations unchanged to the server-side 002 adapter.
3. Gemini Flash extracts structure, classifies language and exercises, removes page furniture from a separate cleaned representation, repairs line breaks and hyphenation, and simplifies. It returns exact source excerpts and offsets. Server-side validation confirms every excerpt against the plain text, applies 002's faithfulness checks, and fails closed on malformed or unverifiable results. Handle short text and the 2,000-word selection flow without truncation.
4. Persist state and versioned blocks transactionally. Enforce idempotent retry, cancellation and deletion. Check seven-day inactivity expiry while the app is active and on startup; if the app was closed when expiry occurred, delete the draft when it next opens. Browser storage can be evicted; request persistence where available and communicate failures.
5. Connect selected source blocks to 002, preserving IDs and source spans. Integrate 003/004 separately for audio and resume. Require the consent/privacy gate in 006 before off-device processing, and do not show unverified simplification. Failed or unavailable downstream processing keeps an unfinished draft and offers retry.
6. Implement optional Show original and section inclusion, with source versions and invalidation of only affected derived sections. Coordinate regeneration and audio replacement with 002–004; avoid presenting stale results as current.
7. Add Android share target after an on-device proof that shared content is captured safely and survives interruption. Use POST, never URL query strings for source text; verify service-worker interception, fail-closed behavior and log redaction before enabling. Native paste remains the cross-platform path.

## Constitution check

| Principle | Design and gate |
| --- | --- |
| I Faithfulness | Original and mapping retained; no silent ambiguous edits; 002 checks and original fallback required. Update the notation fixtures to match the clarified rule. |
| II Privacy | Explicit pupil action, local draft, no content logs, consent and deletion under 006, provider agreements and DPIA before pupil release. |
| III Independence | One primary action, no routine preview, clear recovery and user testing. |
| IV Text and audio | Import supplies the source; integrated lesson/audio and resume require 002–004. |
| V Accessibility | 007 applies: native labelled controls, keyboard and screen readers, 200% text, Bokmål/Nynorsk UI and real-device checks. |
| VI Honest AI | Original remains available; uncertain processing and failures are visible; exercises are marked, not answered. |
| VII Verifiable slices | Use reference data, automated checks and actual pupil testing against 001 SC-001–005. |

**Post-design status:** conditionally viable for implementation; real-pupil release remains blocked until the reference set, downstream faithfulness and audio gates, consent, DPIA and deletion checks pass. No constitutional exception is proposed.

## Open decisions and constraints

- Plain-text clipboard characters are authoritative, even when HTML contains subscript or superscript formatting. `eval/src/html.ts` converts such formatting in existing fixtures; update the fixtures and evaluation to match the clarified rule before using them as a release oracle.
- FR-011 requires character ranges, but HTML text and `text/plain` may differ. The contract must identify the representation and support multiple spans; do not invent offsets in a different representation.
- FR-014 requires per-block Bokmål/Nynorsk/English detection and rejection of clearly unsupported main languages. Choose and evaluate a local detector, including short and mixed passages; uncertain results use the best supported-language guess without asking.
- Share-target delivery when the worker is unavailable needs device experiments; do not claim guaranteed behavior based on browser timers.
- The paste set currently has 10 draft NDLA items and zero reviewed items; it lacks representative younger-grade and copied PDF cases. Review and expand it before using it as a release gate.

## Planned source structure

```text
src/routes/                     home and source view
src/lib/import/                 clipboard adapters, parsing, classification, source maps
src/lib/storage/                Dexie schema, expiry and draft lifecycle
src/lib/lesson/                 002 handoff and version invalidation
src/service-worker.ts           offline shell and, if validated, share handling
tests/                          import unit, integration and browser scenarios
eval/                           golden fixtures and import measurements
```

This is a proposed layout, not existing application code. See [research.md](research.md), [data-model.md](data-model.md), [contracts/import.md](contracts/import.md), and [quickstart.md](quickstart.md). Tasks are a separate phase.
