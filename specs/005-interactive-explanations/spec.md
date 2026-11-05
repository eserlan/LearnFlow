# Feature Specification: Interactive Explanations

**Status:** Draft  
**Priority:** P2 / Phase 2

## Overview
A student can ask for a simpler explanation or an example without losing their place.

## User Scenario & Testing
### User Story 1 — Interactive Explanations (P1)
As a student, I want to ask what a word means while listening.

**Independent test:** A student can complete the scenario using a mobile device without a parent or teacher guiding them.

### Acceptance Scenarios
1. Given a lesson section, when Explain simpler is selected, then the app provides a shorter explanation tied to that section.
2. Given an explanation, when Back to lesson is selected, then the original playback position is retained.
3. Given a question outside the supplied source, when answering, then the app distinguishes general knowledge from source-backed content.

## Functional Requirements
- **FR-001:** Phase 2.
- **FR-002:** Prefer one-tap actions; voice input is optional.
- **FR-003:** Apply safeguards for minor users and avoid unnecessary retention of questions.

## Edge Cases
- Poor connectivity, incomplete source material, and interrupted sessions must not cause silent data loss.
- Errors must be actionable and accessible.

## Success Criteria
- In moderated usability testing, at least 4 of 5 target-age participants can complete the primary scenario independently after a short introduction. (Initial product hypothesis; revise after pilot.)
- No critical accessibility defects in the core workflow.

## Open Questions
- What are the actual limits and formats of typical school materials?
- What content and interaction patterns do target users prefer after hands-on testing?
