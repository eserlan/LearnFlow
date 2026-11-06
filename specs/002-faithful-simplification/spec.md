# Feature Specification: Faithful Simplification

**Feature Branch**: `002-faithful-simplification`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "As soon as the pupil pastes a text, turn it into an easier-to-read version that keeps every key fact and adds nothing that is not in the source. The simplified text is what the pupil reads and what the audio (003) is made from; seeing the original is optional."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read an easier version of the text (Priority: P1)

As soon as the pupil pastes a text (001), they get a simplified version, with no review step in between:
shorter sentences, everyday words where possible, and small pieces under clear headings. The simplified text
is the main thing the pupil sees, and the audio (003) is made from it. At "Lettere" it is also shorter: it
keeps the main points and leaves out examples, side remarks and secondary detail, so the pupil can take it in
bite by bite. What it keeps is still right, and nothing new has been added.

**Why this priority**: Faithful simplification is the core value of LearnFlow and the input to narrated
lessons (003). It is the riskiest step for hallucination.

**Independent Test**: Run the reference set through simplification and score with the faithfulness
evaluation (coverage of key facts, unsupported statements, preserved numbers/terms) and a readability index.
Delivers value as a stand-alone "easy read" view.

**Acceptance Scenarios**:

1. **Given** the pupil has pasted a text, **When** simplification completes, **Then** the pupil sees a
   simplified text that is measurably easier to read than the source, without having reviewed the original
   first.
2. **Given** the source contains numbers, dates, names, units and formulas, **When** simplification
   completes, **Then** each one the simplified text keeps appears exactly as in the source.
3. **Given** the source states a main point, **When** the simplified version is produced, **Then** that point is
   present in the simplified version.
4. **Given** the simplified text fails the automatic faithfulness check (after an automatic retry), **When**
   the pupil would otherwise see it, **Then** the pupil is instead shown the original text with a short
   explanation and the option to try again, and the audio is made from the original text.
5. **Given** the source states something with a qualification ("usually", "about", "some researchers
   believe"), **When** the claim is kept, **Then** the qualification is kept with it.
6. **Given** a passage is ambiguous or incomplete (for example cut off at the page edge or where the copied selection ended), **When** it is
   simplified, **Then** the app marks it as uncertain instead of filling in the gap.

---

### User Story 2 - Keep and explain subject terms (Priority: P2)

Key subject terms from the textbook ("fotosyntese", "demokrati", "brøk") are kept in the simplified text, not
replaced with everyday words, so the pupil learns the vocabulary they will be tested on. Each term has a short
explanation, clearly marked as added help.

**Why this priority**: Replacing curriculum terms would make the simplification less useful for school.
Explanations are the main place where content goes beyond the source, so they need explicit labelling.

**Independent Test**: For pages with a known list of key terms, verify all terms are retained and every
explanation is marked as added help.

**Acceptance Scenarios**:

1. **Given** the source uses a subject term, **When** it is simplified, **Then** the term is kept and visually
   marked as a key term.
2. **Given** the pupil taps a key term, **When** the explanation opens, **Then** it is labelled as an
   explanation added by LearnFlow, and uses the textbook's own definition if one exists in the source.

---

### User Story 3 - Make one part easier (Priority: P2)

While reading or listening, the pupil gets stuck on one paragraph. They tap "Make this easier" on that
section and get an even simpler version of just that part. The rest of the lesson and the original source
are unchanged.

**Why this priority**: Difficulty is usually local. Rewriting only the hard part is less disruptive than
switching the whole lesson's level, and directly helps independent study.

**Independent Test**: For sections in the reference set, request an easier version; verify only that section
changes, the result passes the faithfulness check, and the pupil can return to the previous version.

**Acceptance Scenarios**:

1. **Given** a simplified section, **When** the pupil taps "Make this easier", **Then** only that section is
   rewritten, and the new version passes the same faithfulness check as the full text.
2. **Given** a section has been made easier, **When** the pupil taps "Show previous version", **Then** the
   earlier version is restored.
3. **Given** a section is already as simple as it can be without losing a main point, **When** the pupil asks
   for easier, **Then** the app says so and offers the term explanations instead of dropping that point.

---

### User Story 4 - Choose how much to simplify (Priority: P3)

The pupil can choose between two levels: "Lettere" (much easier) and "Nærmere originalen" (closer to the
original), and switch at any time.

**Why this priority**: Pupils' needs differ, but one good default level is enough for the vertical slice.

**Independent Test**: Generate both levels for the reference set; verify both pass faithfulness thresholds
and that readability differs measurably between them.

**Acceptance Scenarios**:

1. **Given** a simplified text at one level, **When** the pupil switches level, **Then** the text at the other
   level is shown, and the pupil's position is kept.
2. **Given** the pupil has chosen a level, **When** they create their next lesson, **Then** that level is the
   default.

---

### User Story 5 - Get a short summary (Priority: P3)

After reading or listening, the pupil can open a short summary of the main points, for quick revision before
a test. The summary is clearly labelled as a summary and does not replace the full simplified lesson.

**Why this priority**: Useful for revision, but summarisation leaves things out by design, so it must stay a
secondary, clearly labelled view (Constitution Principle I).

**Independent Test**: Generate summaries for the reference set; verify every point is supported by the source,
covers the annotated main points, and is labelled as a summary.

**Acceptance Scenarios**:

1. **Given** a simplified text, **When** the pupil opens "Summary", **Then** they see 3–6 main points, each
   linked to its source passage, under a visible "Summary" label.
2. **Given** a summary is shown, **When** the pupil wants the details, **Then** one tap opens the full
   simplified text at the relevant point.

---

### User Story 6 - See the original if I want to (Priority: P3)

Seeing the original is not part of the main flow, but a pupil (or a teacher or guardian) who wants to check
something can tap "Show original" and see the passage a simplified sentence is based on, highlighted in
context.

**Why this priority**: The pupil's goal is the simplified text and its audio, not the original. Links from
each sentence to the source are still kept internally, because the faithfulness check depends on them
(Constitution Principle I); showing them is an optional extra.

**Independent Test**: For every simplified sentence on the reference set, "Show original" shows a non-empty
source passage; spot-check that the passage supports the sentence.

**Acceptance Scenarios**:

1. **Given** a simplified sentence, **When** the pupil chooses "Show original" for it (from the sentence's
   menu, since tapping a sentence plays the audio from there, see 003), **Then** the matching source passage
   is shown and highlighted in the original-text view.
2. **Given** the pupil is reading the simplified version, **When** they switch to "Original", **Then** the
   original text opens at the corresponding position.

### Edge Cases

- The source appears to contain a factual error: the simplification preserves the source statement and does
  not silently correct it. Flagging suspected errors is out of scope for the first release.
- The source is literary text (poem, short story, quoted excerpt): it is not rewritten. The pupil gets the
  original text with term explanations only, because the wording is the subject of study.
- The source consists mostly of exercises or tasks: tasks are rephrased as clearer instructions, but they are
  never answered (Constitution Principle VI).
- The source is very short (a caption or a few lines): simplification returns it essentially unchanged and
  does not pad it with extra material.
- The source covers sensitive topics (war, illness, sexuality in health education): the simplification keeps
  the textbook's framing and does not soften, editorialise or omit it.
- The source contains a table: table content is kept as a table, or as a list with every kept value exact. At
  "Lettere", rows that are not main points may be left out, but values are never summarised into approximate
  statements.
- The pupil fixed uncertain words in a photo (001) and introduced errors of their own: the simplification is
  faithful to the text as the pupil left it, and that text is what "Show original" shows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST start simplification automatically as soon as the source document is ready (001),
  without a review or confirmation step.
- **FR-002**: System MUST link every simplified sentence to one or more extracted blocks of the source
  document.
- **FR-003**: System MUST NOT introduce facts, numbers, names, dates, causal claims, examples or conclusions
  that are not present in the source document. Added term explanations are the only allowed exception and are
  governed by FR-007.
- **FR-004**: System MUST keep every number, unit, date, proper name, formula and subject term it uses exactly
  as in the source, and MUST keep the relationships between the facts it keeps and their caveats and
  qualifications.
- **FR-005**: System MUST run an automatic faithfulness check on every simplified text before showing it,
  covering unsupported statements, missing main points, misleading omissions and altered numbers or terms.
- **FR-006**: When the faithfulness check fails, System MUST retry once automatically. If it fails again,
  System MUST NOT show the failing simplification; it MUST show the original text, explain why, offer to try
  again, and let 003 make the audio from the original text.
- **FR-007**: Term explanations MUST be visibly labelled as added help, MUST prefer definitions present in the
  source, and MUST be checked for age-appropriateness and safety.
- **FR-008**: System MUST keep the source's language variant (Bokmål stays Bokmål, Nynorsk stays Nynorsk)
  by default.
- **FR-009**: System MUST make the original text available on request ("Show original"), opening at the
  position matching the current simplified sentence. Viewing the original MUST never be a required step.
- **FR-010**: System MUST support at least two simplification levels, with the pupil's last choice remembered.
- **FR-011**: System MUST NOT rewrite literary text and MUST NOT answer exercise/task blocks.
- **FR-012**: System MUST let the pupil request an easier version of a single section, leaving the rest of
  the text and the source unchanged, with the previous version recoverable. Section rewrites MUST pass the
  faithfulness check.
- **FR-013**: System MUST offer an optional summary, separate from and never replacing the full simplified
  text, labelled as a summary, with every point linked to the source.
- **FR-014**: System MUST mark ambiguous or incomplete passages as uncertain rather than completing them.
- **FR-015**: System MUST let the pupil report a sentence as wrong or confusing; reports are stored with the
  sentence and its source link for quality review, without other personal data.
- **FR-017**: At the "Lettere" level, System SHOULD reduce the text to its main points, in the source's order,
  as short sections under headings, leaving out examples, side remarks, repetition and secondary detail. It
  MUST NOT leave anything out in a way that makes the rest misleading (one side of a contrast, an exception
  that limits a rule, the framing of a sensitive topic), and MUST keep every task. At "Nærmere originalen"
  every detail is kept.
- **FR-016**: Simplification into a language other than the source's language variant is supported only if
  confirmed in scope [NEEDS CLARIFICATION: Is translation, for example to English, Ukrainian or Arabic for recently arrived
  pupils, in scope for the first release, or should output always stay in the source language? Translation
  greatly increases faithfulness risk and evaluation effort.]

### Key Entities *(include if feature involves data)*

- **Simplified Text**: A generated version of a source document at a given level and language; has a
  version, a faithfulness check result and a creation time.
- **Simplified Sentence**: One sentence of simplified text; links to one or more extracted blocks; may be
  marked as containing key terms.
- **Key Term**: A subject term found in the source; has the source occurrence(s), an optional source
  definition and an added explanation flagged as LearnFlow-generated.
- **Faithfulness Check Result**: Pass/fail plus findings (unsupported statements, missing key facts, altered
  values), stored for evaluation and audit.
- **Sentence Report**: A pupil's flag on a simplified sentence, with reason category.
- **Section Rewrite**: An easier version of one section requested by the pupil; links to the section it
  replaces and keeps the previous version.
- **Summary**: A short list of main points for a simplified text, each linked to the source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the faithfulness reference set, at least 99% of simplified sentences are judged supported by
  the source by human reviewers, and no lesson contains more than one unsupported sentence.
- **SC-002**: 100% of numbers, dates, names, units and formulas in the simplified text match the source exactly
  on the reference set; at "Nærmere originalen", 100% of those in the source are kept.
- **SC-003**: At "Lettere", at least 95% of the main points annotated in the reference set are present in the
  simplified text; at "Nærmere originalen", at least 95% of all annotated key facts.
- **SC-004**: At the "Lettere" level, the readability index (LIX) is at least 10 points lower than the source,
  or at most 30, whichever is higher. LIX is counted without the text's subject terms and must-preserve
  values as long words, since the simplified text must keep them (provisional floor; to be checked with
  teachers).
- **SC-005**: The automatic faithfulness check catches at least 95% of seeded unsupported statements in a
  red-team set.
- **SC-006**: Summaries cover at least 90% of the annotated main points on the reference set, with no
  unsupported points.
- **SC-007**: In testing with pupils, at least 80% rate the simplified version as easier to understand than
  the original, without lower scores on comprehension questions based on the original.
- **SC-008**: For pasted texts of about one textbook page (300–500 words), the simplified text appears within
  10 seconds of pasting for 90% of texts.

## Assumptions

- Input is the source document from 001 (pasted text in the main scenario); for photos, text-recognition
  quality is 001's responsibility.
- Human-annotated key facts, with the main points marked, and key terms exist for each page in the reference set.
- Choice of language model and of the method for checking faithfulness are planning decisions. The check may
  use a different model or method than generation.
- The two level names are working titles and will be validated with pupils.
