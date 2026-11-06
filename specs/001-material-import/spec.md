# Feature Specification: Material Import

**Feature Branch**: `001-material-import`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "The main scenario is copy and paste: a pupil copies text from one source (a digital textbook, the school's learning platform, a web page or a PDF) and pastes it into LearnFlow, which goes straight on to simplify it (002) and make audio from the simplified text (003). Seeing the original text is not important."

## Clarifications

### Session 2026-11-06

- Q: Which clipboard representation controls the text when HTML formatting differs from plain text? → A: Use the plain-text clipboard exactly as copied. Formatting may inform structure, but must not change its characters or silently restore subscripts or superscripts. Offer notation fixes as suggestions requiring the pupil's choice.
- Q: What happens when the main language is uncertain? → A: Make the best supported-language guess and continue without asking the pupil. Keep the original text unchanged; clearly unsupported main languages are still declined.
- Q: When is an unfinished draft deleted if its seven-day inactivity period ends while the app is closed? → A: Delete it when the app next opens; while the app is active, check for expiry and delete it when due.

### Session 2026-11-05

- Q: What happens to material that has not finished processing? → A: It stays only on the device and is shown as "Unfinished" on the home screen. It expires after 7 days of inactivity; the 2026-11-06 clarification defines when deletion occurs. Any copy sent for processing is deleted from servers within 24 hours.
- Q: Can the pupil choose which parts of the material go into the lesson? → A: Yes, by unticking sections. Everything is included by default. Updated: there is no preview step, so this is done optionally from "Show original", and the simplified text and audio update to match.
- Q: Which source languages does the first release accept? → A: Bokmål, Nynorsk and English only. Sámi and school foreign languages (German, French, Spanish) are out of scope for the first release and get a clear "not supported yet" message.
- Q: What is the main way material gets into LearnFlow? → A: Copy and paste from one source text. One lesson is built from one pasted source.
- Q: Should the pupil see the pasted text before simplification? → A: No. Pasting goes straight to simplification and audio. Page furniture is removed automatically, and the original is available only through an optional "Show original".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paste a text and get it simplified straight away (Priority: P1)

A pupil has the text they need to learn in a digital textbook, on the learning platform, on a web page or in a
PDF. They select and copy it, open LearnFlow and tap "Paste and simplify" (or share the selected text to
LearnFlow). LearnFlow keeps the exact paste locally and, after the 006 consent gate, sends the plain text and
optional rich HTML to Gemini Flash. Flash cleans and structures the source, simplifies it, and goes straight
on to make the audio. The pupil does not have to look at the original.

**Why this priority**: This is the main way material gets into LearnFlow and the first step of the vertical
slice. One action takes the pupil from copied text to a simplified text with audio.

**Independent Test**: Paste texts from the paste reference set (copied from digital textbooks, web pages and
PDFs in both rich and plain form); verify LearnFlow sends the copied representations unchanged after consent,
and that Flash's cleaned source and simplification pass deterministic source-mapping and faithfulness checks.

**Acceptance Scenarios**:

1. **Given** the pupil has copied text from a source, **When** they tap "Paste and simplify" on the home
   screen, **Then** processing starts immediately with visible progress, and no preview or confirmation step
   is shown.
2. **Given** the copied text carries formatting (from a web page or digital textbook), **When** it is pasted,
   **Then** LearnFlow gives both available clipboard representations to Flash, which returns headings, lists,
   emphasis and tables without changing authoritative plain-text characters.
3. **Given** the copied text comes from a PDF with hard line breaks, words hyphenated across lines, and
   repeated page headers, footers or page numbers, **When** it is pasted, **Then** Flash joins lines into
   paragraphs, rejoins line-break hyphenation where appropriate, and leaves page furniture out of the cleaned
   source while the exact pasted original remains stored locally.
4. **Given** LearnFlow is installed on an Android phone and the pupil has selected text in another app,
   **When** they share it to LearnFlow, **Then** it is processed exactly as with "Paste and simplify". (iOS
   does not let web apps receive shared text; there, pasting is the only text path.)
5. **Given** a text has been processed, **When** the lesson is created, **Then** it gets a title from the
   first heading (or first line), which the pupil can change later, and the pupil can optionally note where
   the text came from (for example "Naturfag 9, kapittel 3").
6. **Given** the clipboard is empty or holds no text (for example an image), **When** the pupil taps "Paste
   and simplify", **Then** the app explains in plain language how to copy text and offers a way to try again.
7. **Given** the pasted text is longer than the per-lesson limit, **When** it is pasted, **Then** the app
   lists the text's sections by heading and asks the pupil to pick what to use. This is the only choice the
   pupil may need to make before simplification.

---

### User Story 2 - Leave out or put back parts of the text (Priority: P3)

Sometimes the pasted text includes something the pupil doesn't need, such as an exercise list or a fact box,
or the automatic clean-up removed something that was actually part of the text. From the lesson, the pupil
can open "Show original", untick a section to leave it out, or tick a removed part to put it back. The
simplified text and audio update to match.

**Why this priority**: Seeing the original is not part of the main flow. This is an optional correction for
the few cases where the automatic clean-up gets it wrong or the pupil wants less.

**Independent Test**: Paste a text with page furniture and a fact box; in "Show original", put back a removed
part and leave out the fact box; verify the simplified text and audio change only for those sections.

**Acceptance Scenarios**:

1. **Given** a lesson made from pasted text, **When** the pupil opens "Show original", **Then** the cleaned
   original is shown with automatically removed parts marked as left out.
2. **Given** the original view is open, **When** the pupil unticks a section, **Then** it is removed from the
   simplified text and audio; ticking it again brings it back.
3. **Given** the clean-up wrongly removed a part, **When** the pupil ticks it, **Then** it is included and
   simplified like the rest.

### Edge Cases

**Pasted text**

- The pupil pastes again while a text is being processed: the app asks whether to replace it or start a new
  lesson. Two sources are never silently merged, because each lesson is built from one source.
- The pasted text is very short (under about 30 words): the pupil is told there is little to build a lesson
  from, and can still continue.
- The copied text lost formatting for notation (x2 for x², CO2 for CO₂, m2 for m², 10-3 for 10⁻³): the exact
  paste is kept locally and likely cases are marked in the simplified text with a one-tap suggested fix. The
  app never silently changes notation.
- A word hyphenated across a line break might be a genuine hyphenated word (for example "Nord-Norge"): Flash
  uses context to decide how to clean it. The original remains available, and unverifiable source changes fail
  closed.
- The copied text includes web-page clutter (menus, "Del" and "Skriv ut" buttons, cookie notices, link lists,
  citation markers): it is detected as page furniture and left out automatically. The pupil can put it back
  from "Show original".
- The clipboard also contains images: images are not imported in the first release.
- The copied text contains the textbook's exercises: they are marked as exercises, so later features explain
  them but never answer them (Constitution Principle VI).
- The source app blocks copying: the pupil is told that selectable text is needed.

**All inputs**

- The material contains mathematical formulas, chemical notation or tables: simple inline notation (½, x²,
  H₂O, km/t, 3 · 4 = 12) is kept as text. Tables are kept as distinct sections
  with their cell values.
- The material is in a language other than Bokmål, Nynorsk or English (for example Sámi, German, French or
  Spanish): the pupil is told in plain language that this language is not supported yet, and no lesson is
  generated. Material that is mostly in a supported language with short quotes in another language is
  accepted, and the quotes are kept unchanged.
- The pupil leaves out every section in "Show original": this is not allowed, and a hint says at least one
  section must be included.
- Processing does not finish (offline, app closed): the material appears as "Unfinished" on the home screen
  and continues when possible. Two days before it expires, the home screen shows when it will be deleted.
  After 7 days without activity it is deleted without further prompts when the app is active, or when it next opens.
- Connectivity drops during processing: the material is kept locally and processing resumes or is retried
  without the pupil pasting again, and without creating duplicates.

## Requirements *(mandatory)*

### Functional Requirements

**Pasted text (main path)**

- **FR-001**: System MUST offer "Paste and simplify" as the primary way to add material: a paste area with a
  clear action on the home screen and when starting a new lesson. Where the platform allows an installed web
  app to receive shared text (Android), System MUST also accept text shared from other apps.
- **FR-002**: System MUST take clipboard content only when the pupil pastes into the paste area or taps
  "Paste and simplify", never automatically or in the background. Pasting, or sharing text to LearnFlow, is
  the pupil's clear action to process the material (Constitution Principle II). When the pasted content
  includes formatting (HTML), System MUST use it for structure (FR-004).
- **FR-003**: System MUST store the exact plain-text clipboard value and optional HTML locally as the source of
  record. It MUST NOT rewrite the source in place. Gemini Flash may produce a separate cleaned representation
  for simplification; every omission or normalisation in that representation MUST link to the original and pass
  validation before use.
- **FR-004**: After the pupil's processing action and the applicable 006 gate, System MUST send the unmodified
  plain-text clipboard value and optional unmodified HTML to Gemini Flash. Plain text is authoritative for
  characters; HTML may inform structure but MUST NOT silently replace or add plain-text characters. When HTML
  is absent, Flash infers structure from plain text.
- **FR-005**: Gemini Flash MUST identify page furniture (repeated headers and footers, page numbers, web
  navigation, share/print buttons, cookie notices, link lists) as excluded, recoverable source content.
  Deterministic validation MUST ensure exclusions map to the original before accepting the simplified result.
- **FR-006**: System MUST NOT change likely lost notation in pasted text (for example x2, CO2, m2, 10-3)
  automatically. Likely cases MUST be marked in the simplified text with a one-tap suggested fix.
- **FR-007**: A lesson MUST be built from one source: one pasted text.
  Pasting while a text is being processed MUST ask whether to replace it or start a new lesson.
- **FR-008**: System MUST accept up to 2,000 words per lesson. Above the limit, the pupil MUST choose which
  sections to use from a list of headings; the text is never cut silently. Below about 30 words, the pupil is
  warned but may continue.
- **FR-009**: System MUST give each lesson a title from the first heading (or first line), which the pupil can
  change, and MUST let the pupil optionally note where the text came from. Images in the clipboard are not
  imported in the first release.

**Pasted source processing**

- **FR-010**: Gemini Flash MUST return structured source blocks: heading, paragraph, list item, figure, figure
  caption, table, formula, sidebar/fact box, exercise/task, and page furniture.
- **FR-011**: Gemini Flash MUST link each returned block and simplified sentence to exact source excerpts.
  Server-side deterministic validation MUST map the excerpts to character ranges in the authoritative plain
  text; excerpts that cannot be verified MUST fail closed and retain the draft for retry.
- **FR-012**: System MUST send the source to Gemini Flash automatically after the pupil's processing action and
  applicable 006 gate, without a preview or second confirmation step. The only exception is choosing sections
  when the text is over the limit (FR-008).
- **FR-013**: System MUST offer an optional "Show original" view of the cleaned source, with left-out parts
  marked, where the pupil can leave out or put back whole sections with one tap each. Changes MUST update the
  simplified text and audio for the affected sections only. Region drawing is out of scope.
- **FR-014**: Gemini Flash MUST support Norwegian Bokmål, Nynorsk and English source text, return the detected
  language variant per block, and decline material whose main language is anything else with a "not supported
  yet" message when it is clearly unsupported. When detection is uncertain, it MUST use its best supported-
  language guess without asking. Malformed or unsupported model results MUST be rejected; the source remains
  unchanged.
  Sámi and school foreign languages are out of scope for the first release.
- **FR-015**: Exercise/task blocks MUST be marked so that later features can treat them as instructions to
  explain, not questions to answer (Constitution Principle VI).
- **FR-016**: System MUST keep simple inline maths and science notation (fractions written inline,
  superscripts and subscripts, units, basic arithmetic and equations on one line) as text, preserving symbols
  exactly.
- **FR-017**: System MUST NOT send any material off the device until the pupil takes a clear action to
  process it: tapping "Paste and simplify" or sharing text to LearnFlow (Constitution Principle II).
- **FR-018**: Material whose processing has not finished MUST be kept only on the device, MUST be listed as
  "Unfinished" on the home screen so the pupil can continue or discard it, and MUST be deleted automatically
  after 7 days of inactivity while the app is active, or when the app next opens if it was closed at expiry.
  Any copy sent off the device for processing MUST be deleted from server-side
  storage within 24 hours of processing.
- **FR-019**: Interrupted pastes MUST be resumable or retryable without silent loss of
  material and without creating duplicates.

### Key Entities *(include if feature involves data)*

- **Source Draft**: One pasted text being added for a lesson, with an optional pupil-entered origin, title,
  last-activity time and lifecycle status. Unfinished drafts expire 7 days after last activity and are deleted
  while the app is active or when it next opens.
- **Extracted Block**: A unit of content with type, text, language variant, character range in the pasted
  source, reading-order index, and included/left-out status (page furniture is left out by default).
- **Source Document**: The processed, ordered set of blocks that feeds simplification. Changes made through
  "Show original" create a new version.
## Success Criteria *(mandatory)*

### Measurable Outcomes

**Pasted text (main path)**

- **SC-001**: For pasted texts up to 2,000 words, the exact source is saved locally and sent to the 002 service
  within 2 seconds for 95% of pastes after the required consent check.
- **SC-002**: On the paste reference set, every content item retained in Flash's cleaned source is supported
  by an exact excerpt from the copied plain text; all unmatched or altered excerpts are rejected.
- **SC-003**: On the paste reference set, Flash identifies headings, paragraphs and lists correctly for at
  least 90% of blocks; at least 90% of page furniture is left out, and less than 1% of real content is wrongly
  left out.
- **SC-004**: In moderated testing, at least 90% of pupils get from copied text to a simplified text unaided
  on their first attempt, with one tap in LearnFlow.
- **SC-005**: At least 90% of seeded lost-notation cases (x2, CO2, m2) are marked with a correct suggested
  fix.

## Assumptions

- In the main scenario, the pupil has access to the material as selectable digital text: digital textbooks,
  the school's learning platform, web pages or PDFs. Material that cannot be copied is outside this scope.
- The pupil's goal is the simplified text and its audio. The original text is kept for faithfulness checks and
  optional viewing, not as a step in the flow.
- How much formatting travels with copied text varies by source app and platform; structure detection must
  work from plain text alone.
- Images are not imported from pasted content in the first release.
- The 2,000-word limit keeps lessons short (Principle IV) and can be revisited after testing.
- Handwritten notes, and content locked inside publishers' digital textbook platforms that cannot be copied,
  are out of scope for this feature.
- LearnFlow is an installable web app (ADR-0001). Target devices are smartphones from roughly the last five
  years running current iOS Safari or Android Chrome; desktop browsers are also supported.
- Whether processing runs on the device or on a server is a planning decision, constrained by Constitution
  Principle II.
- A paste reference set will be assembled with publisher permission or from openly licensed material,
  covering texts copied from digital textbooks, web pages and PDFs in rich and plain form, subjects, layouts,
  Bokmål and Nynorsk.
