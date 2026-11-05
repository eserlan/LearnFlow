# LearnFlow — GitHub Spec Kit starter pack

A mobile-first, audio-visual learning companion for independent use with school materials.

## Structure
- `.specify/memory/constitution.md` — non-negotiable product principles
- `specs/001-*` through `specs/007-*` — feature specifications with user stories and acceptance scenarios

## Recommended Spec Kit workflow
1. Initialise a GitHub Spec Kit repository using the official tooling, or copy this package into an existing Spec Kit-enabled repository.
2. Review the constitution with `/speckit.constitution`.
3. Refine each draft with `/speckit.clarify` and `/speckit.specify` as needed.
4. For each feature, use `/speckit.plan`, `/speckit.tasks`, then `/speckit.implement`.
5. Implement 007 as cross-cutting design constraints alongside 001–004.

## Suggested vertical slice
Photo of one textbook page → extraction preview → faithful simplification → short narrated lesson with two synchronised visual cards → resume playback.

## Architecture decisions to resolve during planning
- Local-first versus hosted processing; child data handling and consent requirements.
- OCR, LLM, TTS and image-generation providers and costs.
- Data retention, school textbook copyright/licensing, deletion, and Norwegian/EU privacy compliance.
- Offline playback and caching; provenance and hallucination evaluation.

These are initial feature specifications, not yet implementation plans or task lists.
