# Feature Specification: Faithful Simplification

**Feature Branch**: `002-faithful-simplification`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Turn the confirmed textbook text into an easier-to-read version that keeps every key fact and adds nothing that is not in the source."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read an easier version of the page (Priority: P1)

After confirming the extracted page (001), the pupil gets a simplified version: shorter sentences, everyday
words where possible, and a clear structure. All the key facts from the page are still there, and nothing new
has been added.

**Why this priority**: Faithful simplification is the core value of LearnFlow and the input to narrated
lessons (003). It is the riskiest step for hallucination.

**Independent Test**: Run the reference set through simplification and score with the faithfulness
evaluation (coverage of key facts, unsupported statements, preserved numbers/terms) and a readability index.
Delivers value as a stand-alone "easy read" view.

**Acceptance Scenarios**:

1. **Given** a confirmed source document, **When** simplification completes, **Then** the pupil sees a
   simplified text that is measurably easier to read than the source.
2. **Given** the source contains numbers, dates, names, units and formulas, **When** simplification
   completes, **Then** each of them appears exactly as in the source.
3. **Given** the source states a key fact, **When** the simplified version is produced, **Then** that fact is
   present in the simplified version.
4. **Given** the simplified text fails the automatic faithfulness check, **When** the pupil would otherwise
   see it, **Then** the pupil is instead shown the original text with a short explanation and the option to
   retry.
5. **Given** the source states something with a qualification ("usually", "about", "some researchers
   believe"), **When** it is simplified, **Then** the qualification is kept.
6. **Given** a passage is ambiguous or incomplete (for example cut off at the page edge), **When** it is
   simplified, **Then** the app marks it as uncertain instead of filling in the gap.

---

### User Story 2 - Check where a sentence came from (Priority: P1)

The pupil taps any sentence in the simplified version and sees the passage of the original page it is based
on, highlighted in context.

**Why this priority**: Traceability is required by Constitution Principles I and VI. It lets the pupil, and a
teacher or guardian, verify the simplification against the textbook.

**Independent Test**: For every simplified sentence on the reference set, tapping it shows a non-empty source
passage; spot-check that the passage supports the sentence.

**Acceptance Scenarios**:

1. **Given** a simplified sentence, **When** the pupil taps it, **Then** the matching source passage is shown
   and highlighted in the original-text view.
2. **Given** the pupil is reading the simplified version, **When** they switch to "Original", **Then** the
   original text opens at the corresponding position.

---

### User Story 3 - Keep and explain subject terms (Priority: P2)

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
   explanation added by LearnFlow, and uses the textbook's own definition if one exists on the page.

---

### User Story 4 - Make one part easier (Priority: P2)

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
3. **Given** a section is already as simple as it can be without losing facts, **When** the pupil asks for
   easier, **Then** the app says so and offers the term explanations instead of dropping content.

---

### User Story 5 - Choose how much to simplify (Priority: P3)

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

### User Story 6 - Get a short summary (Priority: P3)

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
- The source contains a table: table content is kept as a table, or as a list with every value preserved. It
  is never summarised into approximate statements.
- The pupil edited the extracted text in 001 with errors of their own: the simplification is faithful to the
  confirmed text, and the confirmed text is what the source view shows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a simplified version only from a confirmed source document (001).
- **FR-002**: System MUST link every simplified sentence to one or more extracted blocks of the source
  document.
- **FR-003**: System MUST NOT introduce facts, numbers, names, dates, causal claims, examples or conclusions
  that are not present in the source document. Added term explanations are the only allowed exception and are
  governed by FR-007.
- **FR-004**: System MUST preserve numbers, units, dates, proper names, formulas and subject terms exactly,
  and MUST preserve relationships between facts and the source's caveats and qualifications.
- **FR-005**: System MUST run an automatic faithfulness check on every simplified text before showing it,
  covering unsupported statements, missing key facts and altered numbers or terms.
- **FR-006**: When the faithfulness check fails, System MUST NOT show the failing simplification; it MUST
  show the original text and offer a retry.
- **FR-007**: Term explanations MUST be visibly labelled as added help, MUST prefer definitions present in the
  source, and MUST be checked for age-appropriateness and safety.
- **FR-008**: System MUST keep the source's language variant (Bokmål stays Bokmål, Nynorsk stays Nynorsk)
  by default.
- **FR-009**: System MUST provide a side-by-side or toggle view between simplified and original text, with
  position kept between views.
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
- **SC-002**: 100% of numbers, dates, names, units and formulas in the source are preserved exactly on the
  reference set.
- **SC-003**: At least 95% of key facts annotated in the reference set are present in the simplified text.
- **SC-004**: At the "Lettere" level, the readability index (LIX) is at least 10 points lower than the source,
  or at most 35, whichever is higher.
- **SC-005**: The automatic faithfulness check catches at least 95% of seeded unsupported statements in a
  red-team set.
- **SC-006**: Summaries cover at least 90% of the annotated main points on the reference set, with no
  unsupported points.
- **SC-007**: In testing with pupils, at least 80% rate the simplified version as easier to understand than
  the original, without lower scores on comprehension questions based on the original.

## Assumptions

- Input is always the pupil-confirmed source document from 001; quality of extraction is that feature's
  responsibility.
- Human-annotated key facts and key terms exist for each page in the reference set.
- Choice of language model and of the method for checking faithfulness are planning decisions. The check may
  use a different model or method than generation.
- The two level names are working titles and will be validated with pupils.
