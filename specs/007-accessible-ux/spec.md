# Feature Specification: Accessible Independent UX

**Status:** Draft  
**Priority:** P1 / MVP

## Overview
The full core workflow is usable by a teenager with minimal reading, predictable interactions and accessible controls.

## User Scenario & Testing
### User Story 1 — Accessible Independent UX (P1)
As a student, I want to create and play a lesson on my phone without asking someone else for help.

**Independent test:** A student can complete the scenario using a mobile device without a parent or teacher guiding them.

### Acceptance Scenarios
1. Given the home screen, when a new student arrives, then one primary action clearly starts material capture.
2. Given an error, when it occurs, then the app explains what happened in plain language and offers one obvious recovery action.
3. Given a mobile software keyboard, when an input receives focus, then the active control remains visible and usable.
4. Given keyboard or assistive technology navigation, when moving through the app, then every core action is reachable and labelled.
5. Given a paused session, when the student returns, then the last lesson and progress are easy to find.

## Functional Requirements
- **FR-001:** MVP cross-cutting requirement.
- **FR-002:** Target WCAG 2.2 AA and test with actual devices and assistive technologies.
- **FR-003:** Do not assume one universal ADHD/autism interface; offer preferences without overwhelming setup.

## Edge Cases
- Poor connectivity, incomplete source material, and interrupted sessions must not cause silent data loss.
- Errors must be actionable and accessible.

## Success Criteria
- In moderated usability testing, at least 4 of 5 target-age participants can complete the primary scenario independently after a short introduction. (Initial product hypothesis; revise after pilot.)
- No critical accessibility defects in the core workflow.

## Open Questions
- What are the actual limits and formats of typical school materials?
- What content and interaction patterns do target users prefer after hands-on testing?
