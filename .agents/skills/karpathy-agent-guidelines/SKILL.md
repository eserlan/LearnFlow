---
name: karpathy-agent-guidelines
description: Apply Karpathy-inspired coding-agent guidance when implementing, reviewing, or refactoring code in this repository. Use it to surface consequential assumptions, keep changes proportionate, and verify observable outcomes. It supplements the LearnFlow constitution and feature plans.
---

# Karpathy-inspired agent development guidelines

This is a LearnFlow adaptation of four coding-agent principles associated with Andrej Karpathy: think before coding, simplicity first, surgical changes, and goal-driven execution. It is community-derived guidance, not text authored or endorsed by Karpathy. See the [original post](https://x.com/karpathy/status/2015883857489522876) and the [community guide](https://github.com/multica-ai/andrej-karpathy-skills).

These language-agnostic guidelines apply to all repository code, including JavaScript, TypeScript, and Svelte. Apply them alongside the LearnFlow constitution, the active feature spec and task list, and the user's full request. Higher-priority instructions, privacy, child safety, accessibility, and required release gates take precedence. Do not use brevity or simplicity as a reason to shrink explicit scope or skip necessary safeguards.

## 1. Think before coding

- Read the relevant source, project instructions, and acceptance criteria before editing.
- Identify assumptions that could change the behavior or deliverable. If a reasonable assumption is enough, state it and proceed; ask only when missing information materially affects correctness.
- Surface contradictions and meaningful tradeoffs instead of silently choosing a direction that changes the requested outcome.
- For multi-step work, state the outcome and the checks that will demonstrate it.

## 2. Choose the simplest complete solution

- Meet the full requested scope with the least complexity that remains clear, safe, accessible, and maintainable.
- Avoid speculative features, one-use abstractions, and configurability without a current requirement.
- Prefer existing project patterns and built-in capabilities when they meet the requirements.
- Keep necessary validation, error recovery, privacy, and accessibility even when they add code.

## 3. Keep changes surgical

- Make each change traceable to the request, its acceptance criteria, or a defect exposed while implementing it.
- Preserve unrelated work and local conventions. Do not reformat or refactor adjacent code without a concrete reason tied to the task.
- Remove only artifacts made obsolete by the change; report unrelated issues separately.

## 4. Define and verify done

- Turn each material requirement into an observable result and an appropriate check.
- Reproduce defects where practical, then verify the fix; for refactors, check behavior before and after.
- Run the relevant project checks and report their exact result. Do not call work complete while a required check or dependency remains unresolved.
- Distinguish verified behavior from assumptions, draft fixtures, unavailable services, and release gates that still need evidence.
