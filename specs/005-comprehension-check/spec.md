# Feature Specification: Comprehension Check and Recall Practice

**Feature Branch**: `005-comprehension-check`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "After a lesson, give the pupil a few short questions, answerable from the page itself, to check understanding, with feedback that points back to the source, plus light recall practice later."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Answer a few questions after the lesson (Priority: P1)

When a lesson ends, the pupil is offered 3–5 short questions about the page: multiple choice, true/false, or
matching a term to its meaning. Every question can be answered from the source page alone.

**Why this priority**: Retrieval practice turns passive listening into learning and lets the pupil see what
they understood. It is the most valuable feature beyond the core slice.

**Independent Test**: Generate questions for the reference set; reviewers verify each is answerable from the
source, has exactly one correct answer, and is age-appropriate.

**Acceptance Scenarios**:

1. **Given** a lesson has been completed, **When** it ends, **Then** the pupil is offered an optional
   question set and can skip it with one tap.
2. **Given** a question set, **When** it is generated, **Then** every question and correct answer is linked
   to the source passage that supports it.
3. **Given** a multiple-choice question, **When** it is displayed, **Then** it has exactly one correct option,
   and the wrong options are plausible but clearly wrong according to the source.
4. **Given** the pupil skips the questions, **When** they leave the lesson, **Then** the lesson is still
   marked as listened to, and the questions stay available without reminders or nagging.

---

### User Story 2 - Learn from feedback (Priority: P2)

After answering, the pupil sees whether they were right. If they were wrong, they see the correct answer, a
short explanation based on the source, and a button that replays the card where the topic was covered.

**Why this priority**: Feedback that links back to the lesson closes the learning loop, but questions alone
already give value.

**Independent Test**: Answer questions incorrectly and verify the feedback shows the source passage and that
"Replay this part" plays the correct card.

**Acceptance Scenarios**:

1. **Given** the pupil answered incorrectly, **When** feedback is shown, **Then** it gives the correct answer,
   quotes or points to the source passage, and offers "Replay this part".
2. **Given** the pupil finishes a question set, **When** the summary appears, **Then** it shows which topics to
   look at again, framed encouragingly and without a grade or ranking.
3. **Given** the pupil answered incorrectly, **When** feedback is shown, **Then** the wording explains the
   concept without shaming, penalties or lost points.

---

### User Story 3 - Recall key terms later (Priority: P3)

A day or a few days after a lesson, the pupil can open a short recall session (under 2 minutes) with key terms
and facts from recent lessons, spaced by how well they knew them.

**Why this priority**: Spaced repetition helps long-term retention, but it requires a history of lessons and is
not needed early on.

**Independent Test**: Complete several lessons with mixed results; verify the recall session prioritises items
answered wrongly and spaces items answered correctly.

**Acceptance Scenarios**:

1. **Given** the pupil has completed lessons, **When** they open "Practice", **Then** they get at most 10
   items drawn from those lessons, prioritising ones they got wrong.
2. **Given** the pupil has turned reminders on, **When** practice is due, **Then** they receive at most one
   neutral reminder per day, at a time they chose.

### Edge Cases

- A question turns out to be ambiguous or wrong: the pupil can report it. Reported questions are removed from
  that pupil's practice immediately and queued for quality review.
- The source page has too little content for meaningful questions: fewer questions are generated, or none,
  and nothing is padded.
- The source consists of exercises/tasks: questions are about the explanatory content, never the textbook's
  own exercises, so LearnFlow does not answer homework (Constitution Principle VI).
- Literary text: questions focus on content (who, what, where) and terms, not on interpretation, where the
  textbook expects the pupil's own reasoning.
- The pupil answers by guessing quickly: no penalty or time pressure. Feedback remains the same.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate questions only from the source document and the faithful simplified text,
  with each question and answer linked to a source passage.
- **FR-002**: System MUST validate each question before use: answerable from the source, exactly one correct
  answer, and age-appropriate language.
- **FR-003**: System MUST support multiple choice, true/false and term-matching formats.
- **FR-004**: Question sets MUST be optional and skippable, and MUST NOT be timed.
- **FR-005**: Feedback for wrong answers MUST show the correct answer, point to the source passage and offer
  to replay the relevant card.
- **FR-006**: System MUST NOT show grades, scores relative to others, leaderboards or streak counters.
- **FR-007**: System MUST provide an optional spaced recall session drawing on key terms and missed questions
  from the pupil's lessons.
- **FR-008**: Reminders MUST be off by default, limited to one per day, scheduled at a time the pupil sets,
  and neutral in tone (no loss framing).
- **FR-009**: Pupils MUST be able to report a question; reported questions are withdrawn for that pupil
  immediately.
- **FR-010**: Answer history is personal data of the pupil, MUST NOT be shared with anyone else, and is
  deletable under 006.

### Key Entities *(include if feature involves data)*

- **Question**: Generated item with format, prompt, options, correct answer, source link and validation
  result.
- **Question Set**: The questions offered for one lesson.
- **Answer Record**: The pupil's answer to a question, correctness and time answered.
- **Recall Item**: A key term or fact scheduled for practice, with its next due time.
- **Question Report**: A pupil's flag on a question, with reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 98% of generated questions are judged answerable from the source with exactly one
  correct answer by reviewers on the reference set.
- **SC-002**: At least 60% of pupils who complete a lesson choose to answer its questions, in pilot testing.
- **SC-003**: Pupils who use recall practice score at least 15% higher on a delayed test (one week later) than
  pupils who only listened to the lesson, in a pilot study.
- **SC-004**: Reported-question rate stays below 2% of questions shown.

## Assumptions

- This feature builds on 001–004 and is not part of the first vertical slice.
- Answer data stays with the pupil. Teacher or guardian dashboards are out of scope and would need a separate
  specification and DPIA update.
- Free-text answers and AI grading of open answers are out of scope for the first release.
