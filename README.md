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
2. Refine each draft with `/speckit-clarify` (and `/speckit-specify` for new features). Resolve the `[NEEDS CLARIFICATION]` markers in 002 and 006 first.
3. For each feature, use `/speckit-plan`, `/speckit-tasks`, then `/speckit-implement`.
4. Optionally, use `/speckit-checklist` after planning and `/speckit-analyze` before implementing.
5. Implement 007 as cross-cutting design constraints alongside 001–004.

## Suggested vertical slice
Text copied from one source (digital textbook, learning platform, web page or PDF) → "Paste and simplify" in LearnFlow → faithful simplified text → audio of the simplified text, played in the app with read-along highlighting → resume playback. No review of the original is needed; it is available on request. Photographing a printed page is a secondary input path, and visual cards come in a later phase.

## Architecture
See [ADR-0001](docs/adr/0001-web-platform-and-ai-stack.md): an installable SvelteKit web app (Dexie/IndexedDB, OPFS), stateless Vercel Node.js functions in an EU region, and Gemini 3.8 Flash through the Gemini API for simplification, with a model check before the pupil sees the text. Models, prompt and effort level are tested with the golden data set in `eval/`.

Still open: text-to-speech provider (Nynorsk and word timing), child data handling and consent model (006), textbook copyright/licensing, and the DPIA.

These are initial feature specifications, not yet implementation plans or task lists.
