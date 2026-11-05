# LearnFlow — GitHub Spec Kit starter pack

A mobile-first, audio-visual learning companion for independent use with school materials.

## Structure
- `.specify/memory/constitution.md` — non-negotiable product principles
- `specs/001-*` through `specs/007-*` — feature specifications with user stories and acceptance scenarios
- `.specify/templates/`, `.specify/scripts/`, `.specify/workflows/` — Spec Kit templates and scripts (Spec Kit 1.1.0)
- `.claude/skills/speckit-*` — Spec Kit commands for Claude Code

## Recommended Spec Kit workflow
Spec Kit is initialised with the Claude integration (`specify init --here --integration claude`).

1. Review the constitution with `/speckit-constitution`.
2. Refine each draft with `/speckit-clarify` (and `/speckit-specify` for new features). Resolve the `[NEEDS CLARIFICATION]` markers in 002, 003 and 006 first.
3. For each feature, use `/speckit-plan`, `/speckit-tasks`, then `/speckit-implement`.
4. Optionally, use `/speckit-checklist` after planning and `/speckit-analyze` before implementing.
5. Implement 007 as cross-cutting design constraints alongside 001–004.

## Suggested vertical slice
Photo of one textbook page → extraction preview → faithful simplification → short narrated lesson with two synchronised visual cards → resume playback.

## Architecture decisions to resolve during planning
- Local-first versus hosted processing; child data handling and consent requirements.
- OCR, LLM, TTS and image-generation providers and costs.
- Data retention, school textbook copyright/licensing, deletion, and Norwegian/EU privacy compliance.
- Offline playback and caching; provenance and hallucination evaluation.

These are initial feature specifications, not yet implementation plans or task lists.
