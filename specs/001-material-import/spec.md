# Feature Specification: Material Import

**Status:** Draft  
**Priority:** P1 / MVP

## Overview
A student can capture a page, upload a PDF/image or paste text, and see an accurate, ordered source preview.

## User Scenario & Testing
### User Story 1 — Material Import (P1)
As a student, I want to photograph textbook pages so I can start a lesson without typing.

**Independent test:** A student can complete the scenario using a mobile device without a parent or teacher guiding them.

### Acceptance Scenarios
1. Given camera permission, when I photograph multiple pages, then the app orders them and lets me correct the order.
2. Given a readable PDF or image, when extraction completes, then the student can review the extracted text before continuing.
3. Given blurred, rotated or unreadable material, when extraction is unreliable, then the app identifies the affected pages and offers a simple retry.
4. Given an interrupted upload, when the student returns, then the app offers a safe retry without silently duplicating material.

## Functional Requirements
- **FR-001:** Support camera, PDF and pasted text in MVP.
- **FR-002:** Detect text extraction confidence and preserve page/source references.
- **FR-003:** Do not upload material before clear user action.

## Edge Cases
- Poor connectivity, incomplete source material, and interrupted sessions must not cause silent data loss.
- Errors must be actionable and accessible.

## Success Criteria
- In moderated usability testing, at least 4 of 5 target-age participants can complete the primary scenario independently after a short introduction. (Initial product hypothesis; revise after pilot.)
- No critical accessibility defects in the core workflow.

## Open Questions
- What are the actual limits and formats of typical school materials?
- What content and interaction patterns do target users prefer after hands-on testing?
