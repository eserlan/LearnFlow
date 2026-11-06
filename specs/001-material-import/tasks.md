# Tasks: Pasted Material Import

**Input:** [spec.md](spec.md), [plan.md](plan.md), [data model](data-model.md), [contract](contracts/import.md), [research](research.md), and [validation guide](quickstart.md).

`[P]` means a task can run alongside other marked tasks after their prerequisites are complete. Story labels map to the two stories in spec 001. Paths below are planned unless they already exist. Preserve existing work in `eval/`.

## Phase 1: Setup

- [x] T001 Scaffold a SvelteKit/Svelte 5 TypeScript application at the repository root in `package.json`, `vite.config.ts`, `tsconfig.json`, and `src/`, using Bun consistently with `eval/`.
- [x] T002 Configure the application's unit, integration and browser test commands in `package.json` and document actual setup and run commands in `specs/001-material-import/quickstart.md`.
- [x] T003 [P] Establish Bokmål and Nynorsk interface strings and a language selector in `src/lib/i18n/` for the paste and recovery flow.

## Phase 2: Foundation

- [x] T004 Define typed source drafts, ordered blocks, versioned documents, source spans and processing attempts in `src/lib/import/types.ts` per `data-model.md`; enforce one pasted source per draft and at least one selected section.
- [x] T005 Create the Dexie schema and versioned migrations in `src/lib/storage/db.ts` for local raw text, optional HTML, origin, title, activity timestamps, lifecycle status, blocks and attempts.
- [x] T006 Implement transactional draft creation, version changes, deletion, idempotency keys and stale-attempt rejection in `src/lib/storage/drafts.ts` using `src/lib/storage/db.ts`.
- [x] T007 Implement unfinished draft expiry and the two-day warning in `src/lib/storage/expiry.ts`: expire after seven days of inactivity, delete while active or on next open, and cascade local deletion.
- [x] T008 Define a fail-closed consent and downstream-processing boundary in `src/lib/lesson/handoff.ts` using `specs/001-material-import/contracts/import.md`; do not send material without the pupil action and applicable 006 gate.
- [x] T009 [P] Add storage lifecycle and consent-boundary tests in `tests/unit/storage.test.ts` and `tests/integration/consent-gate.test.ts`, including expiry while open, reopening after expiry, retry, duplicate attempts and deletion.
- [x] T010 [P] Revise the notation conversion in `eval/src/html.ts` and affected `eval/golden/items/*/expected-clean.md` fixtures to reflect authoritative plain-text clipboard characters; retain HTML only as evidence of mappable structure.
- [ ] T011 [P] Expand and obtain subject review of licensed paste fixtures in `eval/golden/items/` and `eval/README.md` for Bokmål, Nynorsk, English, younger grades, rich and plain copied PDFs, tables, notation and clutter; keep test items held out from tuning and record reviewer provenance.
- [ ] T012 [P] Evaluate Flash source extraction and language classification in `eval/src/` and record results in `specs/001-material-import/research.md`, covering short and mixed texts, supported variants and clearly unsupported languages; preserve raw source and use the best supported guess when uncertain.

**Checkpoint:** Source data and privacy boundaries are defined. Fixture review and release-quality language evaluation may proceed alongside application implementation but must finish before the release gate.

## Phase 3: User Story 1 — Paste and simplify (P1, MVP)

**Goal:** Preserve one pasted source locally and hand the unchanged clipboard representations to Flash without a routine preview.

**Independent test:** Paste rich and plain reference texts and inspect the exact request delivered to a controlled 002 adapter after consent. Verify Flash cleanup maps to the copied source and its simplification passes faithfulness checks; exercise recovery and accessibility without requiring a production model.

- [ ] T013 [P] [US1] Add Flash import acceptance fixtures and tests in `tests/unit/import-parser.test.ts` for rich/plain clipboard input, notation, tables, line breaks, genuine hyphens, exercises, excluded furniture, source mapping and malicious HTML; compare against reviewed examples in `eval/golden/items/`.
- [ ] T014 [P] [US1] Add paste-flow tests in `tests/integration/paste-flow.spec.ts` for empty input, Flash unsupported/uncertain language results, under 30 words, over 2,000 words, repeated paste, offline retry, permission denial and no off-device send before the 006 gate.
- [x] T015 [US1] Implement native paste capture in `src/lib/import/clipboard.ts`: collect plain text and optional HTML only after user action, treat plain characters as authoritative and provide a native-paste fallback when programmatic reads are denied.
- [ ] T016 [US1] Capture and preserve exact `text/plain` plus optional `text/html` in the local draft; send both unchanged through the server-side Flash adapter only after the pupil action and 006 gate.
- [x] T017 [US1] Remove local cleanup, segmentation, hyphenation and language heuristics; keep only exact source retention and deterministic word counting/size checks before Flash.
- [ ] T018 [US1] Define and validate Flash's structured cleaned-source response, including recoverable page furniture and exact source excerpts mapped to plain-text ranges.
- [ ] T019 [US1] Evaluate Flash language and variant classification through T012; reject clearly unsupported main languages and use the best supported guess without asking when uncertain.
- [ ] T020 [US1] Have Flash detect notation-loss suggestions while keeping pasted characters unchanged; require a pupil choice before applying any correction.
- [ ] T021 [US1] Keep only local empty-input and word-count checks in `src/lib/import/prepare.ts`; ask Flash for a section outline above 2,000 words and warn below about 30, never truncating content.
- [ ] T022 [US1] Build the labelled, localised paste surface and primary action in `src/routes/+page.svelte`, using `src/lib/i18n/`; start processing immediately and provide visible, announced progress and recoverable errors.
- [ ] T023 [US1] Add accessible section selection for texts above 2,000 words in `src/lib/components/SectionSelection.svelte`; prevent an empty selection and show the selected word count.
- [ ] T024 [US1] Connect paste, draft persistence, title/origin metadata, replace-or-new choice, unfinished drafts and retry in `src/routes/+page.svelte` and `src/lib/storage/drafts.ts` without creating duplicates.
- [ ] T025 [US1] Connect raw copied text and optional HTML to the actual 002 Flash interface through `src/lib/lesson/handoff.ts`; require the 006 gate, retain failed drafts, reject stale responses and rely on 002 verification before showing generated content.
- [ ] T026 [US1] Add the optional Android text share target in `src/service-worker.ts` and the web manifest after a real-device proof in `specs/001-material-import/quickstart.md`: use POST, test worker-unavailable/offline behavior, avoid source text in URLs or logs, and fail closed if safe delivery cannot be guaranteed.
- [ ] T027 [US1] Measure paste preparation and cleanup against SC-001–003 and SC-005 using `eval/scripts/` and reviewed `eval/golden/items/`; record the method and results in `specs/001-material-import/quickstart.md`.
- [ ] T028 [US1] Verify paste, share, retry and keyboard/screen-reader flows on iOS Safari, Android Chrome and desktop in `tests/browser/paste.spec.ts` and record manual results in `specs/001-material-import/quickstart.md`.

**Checkpoint:** The paste path can be demonstrated with a controlled downstream adapter. An end-to-end pupil lesson additionally requires implemented and verified 002–004 and 006; a stub is not a release-ready lesson.

## Phase 4: User Story 2 — Leave out or restore sections (P3)

**Goal:** Allow optional correction of source selection after a lesson exists.

**Independent test:** With a saved document containing a fact box and excluded furniture, restore one block and exclude another; verify the new source version, affected-only regeneration, unchanged unaffected sections and rejection of stale responses.

- [ ] T029 [P] [US2] Add selection/versioning tests in `tests/integration/source-selection.test.ts` for restoring removed material, excluding sections, rejecting an empty selection, retry and stale responses.
- [ ] T030 [US2] Build an accessible optional original view in `src/routes/lessons/[id]/original/+page.svelte`, showing included and automatically excluded sections and their selection state.
- [x] T031 [US2] Persist selection changes as a new source version in `src/lib/storage/drafts.ts`, preserving original spans and identifying affected blocks.
- [ ] T032 [US2] Coordinate affected-only simplification and audio invalidation/regeneration through `src/lib/lesson/handoff.ts` and the actual 002–004 contracts; keep unaffected sections and prevent stale playback.
- [ ] T033 [US2] Verify original-view controls, focus, screen-reader labels and regeneration outcomes in `tests/browser/original.spec.ts` and record device results in `specs/001-material-import/quickstart.md`.

**Checkpoint:** Story 2 is independently verifiable against a saved fixture with controlled downstream adapters; actual audio regeneration depends on 002–004.

## Phase 5: Release gates and cross-cutting validation

- [ ] T034 [P] Audit content handling, HTML safety, network traffic and metadata-only logs for `src/lib/import/`, `src/service-worker.ts` and `src/lib/lesson/handoff.ts`; record findings in `specs/001-material-import/quickstart.md`.
- [ ] T035 [P] Run moderated first-use sessions with target-age pupils for SC-004 and record methodology and results in `specs/001-material-import/quickstart.md`.
- [ ] T036 Verify the 006 consent and deletion flow, provider agreements, processing location and current DPIA against the implementation in `specs/001-material-import/quickstart.md`; block real-pupil release until complete.
- [ ] T037 Run the full reference-set, accessibility, interruption and end-to-end 002–004 checks in `specs/001-material-import/quickstart.md`; record threshold results and outstanding failures before release.

## Dependencies and execution order

Setup precedes the foundation. T004–T008 establish shared interfaces and local storage; tests, fixture work and Flash evaluation can proceed on their own files after the relevant interfaces exist. The raw clipboard handoff follows T015; T021 depends on the Flash outline and limit response, and UI integration follows T021. T025 depends on the real 002 and 006 interfaces; T026 depends on its device proof. US2 depends on the saved source and versioning from US1 and on 002–004 for actual regeneration. Release gates depend on the corresponding completed implementation, reviewed data and external decisions.

**Parallel examples:** For US1, after T004, work on T016 and T017 can proceed separately; T013 and T014 can be prepared alongside them. For US2, T029 and T030 can proceed independently after US1 provides the saved-document contract; T031 and T032 follow the version and downstream interfaces.

**MVP:** Complete setup, foundation and US1, starting with local preparation and a controlled adapter. Add US2 afterward. Demonstration with a stub is distinct from release: real-pupil use requires all applicable cross-cutting gates and the 002–004 and 006 dependencies.
