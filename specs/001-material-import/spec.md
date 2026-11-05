# Feature Specification: Material Import

**Feature Branch**: `001-material-import`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "The main scenario is copy and paste: a pupil copies text from one source (a digital textbook, the school's learning platform, a web page or a PDF) and pastes it into LearnFlow, which goes straight on to simplify it (002) and make audio from the simplified text (003). Seeing the original text is not important. Photographing a printed page and importing files are secondary ways in."

## Clarifications

### Session 2026-11-05

- Q: What should be kept from the page photo after processing? → A: Originally "figure crops only", for source-figure cards. Updated after visual cards moved to a later phase (see below): in the first release the full photo is deleted after processing and only complex-formula crops are kept. Figure crops return when visual cards are built.
- Q: How should the first release handle maths and science notation? → A: Simple inline notation (½, x², H₂O, km/t, 3 · 4 = 12) is extracted as text; complex or multi-line formulas (stacked fractions, roots, integrals, multi-line equations) are kept as image crops and never paraphrased. Full formula recognition is out of scope for the first release.
- Q: What happens to material that has not finished processing? → A: It stays only on the device, shown as "Unfinished" on the home screen, and is deleted automatically after 7 days. Any copy sent for processing is deleted from servers within 24 hours.
- Q: Can the pupil choose which parts of the material go into the lesson? → A: Yes, by unticking sections. Everything is included by default. Updated: there is no preview step, so this is done optionally from "Show original", and the simplified text and audio update to match.
- Q: Which source languages does the first release accept? → A: Bokmål, Nynorsk and English only. Sámi and school foreign languages (German, French, Spanish) are out of scope for the first release and get a clear "not supported yet" message.
- Q: What is the main way material gets into LearnFlow? → A: Copy and paste from one source text. One lesson is built from one pasted source. Photographing a printed page and importing PDF or image files are secondary input paths.
- Q: Should the pupil see the pasted text before simplification? → A: No. Pasting goes straight to simplification and audio. Page furniture is removed automatically, and the original is available only through an optional "Show original".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paste a text and get it simplified straight away (Priority: P1)

A pupil has the text they need to learn in a digital textbook, on the learning platform, on a web page or in a
PDF. They select and copy it, open LearnFlow and tap "Paste and simplify" (or share the selected text to
LearnFlow). LearnFlow cleans up the text, removing page numbers, headers and web menus, and goes straight on
to simplify it and make the audio. The pupil does not have to look at the original.

**Why this priority**: This is the main way material gets into LearnFlow and the first step of the vertical
slice. One action takes the pupil from copied text to a simplified text with audio.

**Independent Test**: Paste texts from the paste reference set (copied from digital textbooks, web pages and
PDFs in both rich and plain form); verify the source document handed to 002 keeps every character of the
real content, has the right structure, and has page furniture removed.

**Acceptance Scenarios**:

1. **Given** the pupil has copied text from a source, **When** they tap "Paste and simplify" on the home
   screen, **Then** processing starts immediately with visible progress, and no preview or confirmation step
   is shown.
2. **Given** the copied text carries formatting (from a web page or digital textbook), **When** it is pasted,
   **Then** headings, lists, emphasis and tables are kept from that formatting.
3. **Given** the copied text comes from a PDF with hard line breaks, words hyphenated across lines, and
   repeated page headers, footers or page numbers, **When** it is pasted, **Then** lines are joined into
   paragraphs, hyphenated words are re-joined, and the page furniture is left out automatically.
4. **Given** LearnFlow is installed on an Android phone and the pupil has selected text in another app,
   **When** they share it to LearnFlow, **Then** it is processed exactly as with "Paste and simplify". (iOS
   does not let web apps receive shared text; there, pasting is the only text path.)
5. **Given** a text has been processed, **When** the lesson is created, **Then** it gets a title from the
   first heading (or first line), which the pupil can change later, and the pupil can optionally note where
   the text came from (for example "Naturfag 9, kapittel 3").
6. **Given** the clipboard is empty or holds no text (for example an image), **When** the pupil taps "Paste
   and simplify", **Then** the app explains in plain language how to copy text and offers the photo option
   instead.
7. **Given** the pasted text is longer than the per-lesson limit, **When** it is pasted, **Then** the app
   lists the text's sections by heading and asks the pupil to pick what to use. This is the only choice the
   pupil may need to make before simplification.

---

### User Story 2 - Photograph a printed page (Priority: P2)

When the material is only on paper, the pupil photographs the textbook page instead. The app reads the text
and goes on to simplify it. Only if some words were hard to read is the pupil asked to check those words
first.

**Why this priority**: Many pupils still have printed textbooks and worksheets, but the main scenario is
pasted text, which needs no text recognition.

**Independent Test**: Photograph pages from the page reference set and compare the recognised text against
the ground-truth transcription; verify that pages without uncertain words go straight to simplification.

**Acceptance Scenarios**:

1. **Given** a well-lit, flat, printed textbook page, **When** the pupil takes a photo, **Then** the text is
   recognised in reading order, with headings, paragraphs and lists distinguished, and goes straight on to
   simplification.
2. **Given** a two-column page, **When** text is recognised, **Then** the text follows column reading order,
   not line-by-line across columns.
3. **Given** some words could not be read reliably, **When** recognition finishes, **Then** the pupil sees
   only those words, each next to the matching part of the photo, and can fix or accept them before
   simplification continues.
4. **Given** the pupil has taken a photo, **When** recognition is in progress, **Then** the pupil sees
   progress feedback and can cancel or retake the photo.

---

### User Story 3 - Get help taking a usable photo (Priority: P3)

While the pupil frames the page, the app guides them when the photo is likely to fail: too dark, blurred,
glare, page cut off, or tilted too far.

**Why this priority**: Improves the secondary photo path; pasted text avoids the problem entirely.

**Independent Test**: Use deliberately degraded captures (blur, glare, cropping, low light) and verify the
guidance appears and that following it produces a photo that passes quality checks.

**Acceptance Scenarios**:

1. **Given** the camera view shows a blurred page, **When** the pupil tries to capture, **Then** the app
   shows a short plain-language hint ("Hold still", "Move closer") and offers to retry.
2. **Given** part of the page is outside the frame, **When** the pupil captures, **Then** the app tells them
   which side is cut off.
3. **Given** a captured photo is below the minimum quality, **When** the pupil continues anyway, **Then**
   the app warns that some text may be wrong.

---

### User Story 4 - Import a PDF or image file (Priority: P3)

Some material arrives as a file: a worksheet PDF from the learning platform or a screenshot. The pupil picks
the file, and it is processed like pasted text (for PDFs with selectable text) or like a photo (for scans and
images).

**Why this priority**: Most digital material can be copied and pasted directly. File import helps when copying
is impractical (many pages, scanned PDFs, screenshots).

**Independent Test**: Import a text-based PDF, a scanned (image-only) PDF and an image file; verify each
produces a correct source document for simplification.

**Acceptance Scenarios**:

1. **Given** a PDF with selectable text, **When** the pupil imports it, **Then** the embedded text is used
   directly (no text recognition needed) and goes straight on to simplification.
2. **Given** a scanned PDF or image file, **When** the pupil imports it, **Then** it is handled like a photo.
3. **Given** a PDF with more pages than the per-lesson limit, **When** it is imported, **Then** the pupil
   chooses which pages to use.
4. **Given** an import was interrupted (app closed, connection lost), **When** the pupil returns, **Then** the
   app offers to retry, and retrying does not create a duplicate of the material.

---

### User Story 5 - Combine several photographed pages into one lesson (Priority: P3)

A pupil whose printed material spans a page spread or a few pages photographs them one after another,
reorders them if needed, and gets one lesson from all of them.

**Why this priority**: Useful for the photo path; pasted text already arrives as one continuous source.

**Independent Test**: Capture three pages in the wrong order, reorder, and verify the combined source
preserves the chosen order.

**Acceptance Scenarios**:

1. **Given** one page has been captured, **When** the pupil chooses "Add page", **Then** capture reopens and
   the new page is appended.
2. **Given** several pages are captured, **When** the pupil drags a page thumbnail, **Then** the order
   changes.
3. **Given** the maximum number of pages is reached, **When** the pupil tries to add another, **Then** they
   are told the limit and offered to start a new lesson.
4. **Given** several pages are captured with printed page numbers, **When** they are added out of order,
   **Then** the app orders them by page number, and the pupil can change the order.

---

### User Story 6 - Leave out or put back parts of the text (Priority: P3)

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
- The copied text lost formatting for notation (x2 for x², CO2 for CO₂, m2 for m², 10-3 for 10⁻³): the text
  is kept as pasted, and likely cases are marked in the simplified text with a one-tap suggested fix. The app
  never changes notation without the pupil's choice.
- A word hyphenated across a line break might be a genuine hyphenated word (for example "Nord-Norge"): the
  hyphen is kept when the joined form is not a known word.
- The copied text includes web-page clutter (menus, "Del" and "Skriv ut" buttons, cookie notices, link lists,
  citation markers): it is detected as page furniture and left out automatically. The pupil can put it back
  from "Show original".
- The clipboard also contains images: images are not imported in the first release.
- The copied text contains the textbook's exercises: they are marked as exercises, so later features explain
  them but never answer them (Constitution Principle VI).
- The source app blocks copying (copy-protected digital textbook or PDF): the app suggests photographing the
  page instead.

**Photos and files**

- A two-page spread is captured in one photo: the system detects two pages and treats them as separate pages
  in left-to-right order.
- The page contains handwriting, highlighting or sticky notes from the pupil: handwriting is excluded from the
  recognised text by default and is not treated as source content.
- The page is mostly an image (map, diagram, photo) with little text: the app warns that there is little text
  to build a lesson from.
- The photo contains no text, or is not a textbook page at all (for example a face or a screen): the app says
  it could not find a textbook page and offers to retry. No further processing happens.
- The photo contains people, such as a classmate in the background: only the detected page area is processed
  further; the rest of the image is discarded.
- A PDF is password-protected: the app explains that it cannot open the file and suggests copying the text
  or photographing the page instead.

**All inputs**

- The material contains mathematical formulas, chemical notation or tables: simple inline notation (½, x²,
  H₂O, km/t, 3 · 4 = 12) is kept as text. In photos and scans, complex or multi-line formulas are kept as
  formula crops (images), never converted to text and never paraphrased. Tables are kept as distinct sections
  with their cell values.
- The material is in a language other than Bokmål, Nynorsk or English (for example Sámi, German, French or
  Spanish): the pupil is told in plain language that this language is not supported yet, and no lesson is
  generated. Material that is mostly in a supported language with short quotes in another language is
  accepted, and the quotes are kept unchanged.
- The pupil leaves out every section in "Show original": this is not allowed, and a hint says at least one
  section must be included.
- Processing does not finish (offline, app closed): the material appears as "Unfinished" on the home screen
  and continues when possible. Two days before it expires, the home screen shows when it will be deleted.
  After 7 days without activity it is deleted without further prompts.
- Connectivity drops during processing: the material is kept locally and processing resumes or is retried
  without the pupil pasting or photographing again, and without creating duplicates.

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
- **FR-003**: System MUST keep pasted text exactly as copied. The only allowed automatic normalisations are
  whitespace clean-up, joining hard line breaks into paragraphs, re-joining words hyphenated across line
  breaks, and leaving out page furniture (FR-005).
- **FR-004**: System MUST use structure carried with the copied text (headings, lists, emphasis, tables) when
  available, and MUST infer headings, paragraphs and lists from plain text when it is not.
- **FR-005**: System MUST detect page furniture (repeated headers and footers, page numbers, web navigation,
  share/print buttons, cookie notices, link lists) and leave it out automatically, recording what was left
  out so the pupil can put it back (FR-013).
- **FR-006**: System MUST NOT change likely lost notation in pasted text (for example x2, CO2, m2, 10-3)
  automatically. Likely cases MUST be marked in the simplified text with a one-tap suggested fix.
- **FR-007**: A lesson MUST be built from one source: one pasted text, or one set of photos or one file.
  Pasting while a text is being processed MUST ask whether to replace it or start a new lesson.
- **FR-008**: System MUST accept up to 2,000 words per lesson. Above the limit, the pupil MUST choose which
  sections to use from a list of headings; the text is never cut silently. Below about 30 words, the pupil is
  warned but may continue.
- **FR-009**: System MUST give each lesson a title from the first heading (or first line), which the pupil can
  change, and MUST let the pupil optionally note where the text came from. Images in the clipboard are not
  imported in the first release.

**All input paths**

- **FR-010**: System MUST classify content into blocks: heading, paragraph, list item, figure, figure caption,
  table, formula, sidebar/fact box, exercise/task, and page furniture.
- **FR-011**: System MUST record, for every block, its location in the source (character range for pasted
  text; page and region for photos and files) and, for recognised text, a confidence value, so that 002 can
  link simplified sentences back to it and check faithfulness.
- **FR-012**: System MUST hand the source document to simplification (002) automatically, without a preview or
  confirmation step. The only exceptions are choosing sections when the text is over the limit (FR-008) and
  checking uncertain words in photos (FR-024).
- **FR-013**: System MUST offer an optional "Show original" view of the cleaned source, with left-out parts
  marked, where the pupil can leave out or put back whole sections with one tap each. Changes MUST update the
  simplified text and audio for the affected sections only. Region drawing is out of scope.
- **FR-014**: System MUST support Norwegian Bokmål, Nynorsk and English source text, MUST record the
  detected language variant per block, and MUST decline material whose main language is anything else with a
  "not supported yet" message. Sámi and school foreign languages are out of scope for the first release.
- **FR-015**: Exercise/task blocks MUST be marked so that later features can treat them as instructions to
  explain, not questions to answer (Constitution Principle VI).
- **FR-016**: System MUST keep simple inline maths and science notation (fractions written inline,
  superscripts and subscripts, units, basic arithmetic and equations on one line) as text, preserving symbols
  exactly.
- **FR-017**: System MUST NOT send any material off the device until the pupil takes a clear action to
  process it: tapping "Paste and simplify", sharing to LearnFlow, or taking or importing a photo or file for a
  lesson (Constitution Principle II).
- **FR-018**: Material whose processing has not finished MUST be kept only on the device, MUST be listed as
  "Unfinished" on the home screen so the pupil can continue or discard it, and MUST be deleted automatically
  7 days after the last activity. Any copy sent off the device for processing MUST be deleted from server-side
  storage within 24 hours of processing.
- **FR-019**: Interrupted pastes, captures and imports MUST be resumable or retryable without silent loss of
  material and without creating duplicates.

**Photos and files (secondary paths)**

- **FR-020**: System MUST let the pupil photograph a printed page with the device camera, choose an image
  file, or import a PDF.
- **FR-021**: System MUST detect the page boundary, correct perspective and crop to the page before text
  recognition.
- **FR-022**: System MUST check photo quality (focus, lighting, glare, completeness) and give plain-language
  guidance when quality is insufficient.
- **FR-023**: System MUST recognise printed text in reading order, including multi-column layouts.
- **FR-024**: When recognised text contains low-confidence words, System MUST show the pupil only those words,
  each with the matching photo crop, to fix or accept before simplification continues. When there are none,
  processing MUST continue without a pupil step.
- **FR-025**: System MUST exclude handwriting and annotations from the recognised text by default.
- **FR-026**: System MUST support combining up to 4 photographed or imported pages into one source, with
  reordering.
- **FR-027**: For PDFs with a text layer, System MUST use the embedded text and its page structure instead of
  text recognition; for scanned PDFs and image files it MUST use the same recognition as photos.
- **FR-028**: After processing, System MUST delete the full photo or imported image. In the first release it
  MUST keep only crops of complex formulas (FR-029), tightly cropped, for as long as the lesson exists. The
  full photo is kept only if the pupil explicitly chooses to keep it (see 006). Figure crops for visual cards
  are deferred to the visual-cards phase (003).
- **FR-029**: In photos and scans, System MUST keep complex or multi-line formulas as formula crops linked to
  a formula block, MUST NOT convert them to text or paraphrase them, and later features MUST show them as
  images in the text (for example, narration says "see the formula on screen" rather than attempting to read
  it).

### Key Entities *(include if feature involves data)*

- **Source Draft**: The material a pupil is adding for one lesson before processing has finished: one pasted
  text, or one set of photos, or one file. Has a source type (paste, photo, image file, PDF), an optional
  pupil-entered origin ("where it came from"), a title, a last-activity time, and a lifecycle status
  (pending, processing, processed, discarded, expired). Unfinished drafts expire 7 days after last activity.
- **Source Page**: A cropped, perspective-corrected page derived from a photo or file; has an order within its
  source document. Not used for pasted text.
- **Extracted Block**: A unit of content; has type, text, language variant, location (character range for
  pasted text, page and region for photos and files), confidence for recognised text, reading-order index, a
  flag for pupil correction, and an included/left-out flag (included by default, left out automatically for
  page furniture).
- **Source Document**: The processed, ordered set of blocks that feeds simplification. Changes made through
  "Show original" create a new version.
- **Formula Crop**: An image cropped from a photographed or imported page around a complex formula block; the
  only part of a photo kept after processing by default. Deleted together with the lesson.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Pasted text (main path)**

- **SC-001**: For pasted texts up to 2,000 words, the source document is ready for simplification within
  2 seconds for 95% of pastes.
- **SC-002**: On the paste reference set, 0 characters of real content differ from the copied text other than
  the documented normalisations (FR-003).
- **SC-003**: On the paste reference set, headings, paragraphs and lists are identified correctly for at least
  90% of blocks; at least 90% of page furniture is left out, and less than 1% of real content is wrongly left
  out.
- **SC-004**: In moderated testing, at least 90% of pupils get from copied text to a simplified text unaided
  on their first attempt, with one tap in LearnFlow.
- **SC-005**: At least 90% of seeded lost-notation cases (x2, CO2, m2) are marked with a correct suggested
  fix.

**Photos and files**

- **SC-006**: On the page reference set of printed Norwegian textbook pages photographed with a mid-range phone
  in normal indoor light, character accuracy is at least 98% and reading order is correct for at least 95% of
  pages.
- **SC-007**: For 90% of photos, recognised text is ready within 10 seconds of taking the photo.
- **SC-008**: At least 90% of words that are actually wrong in recognised text are flagged as low-confidence.
- **SC-009**: Numbers and formulas are never silently altered: 0 cases on the page reference set where a
  number or formula in the recognised text differs from the page without being flagged.
- **SC-010**: On the page reference set, at least 95% of simple inline notation is recognised correctly as
  text, and 100% of complex formulas are kept as formula crops rather than converted to text.

## Assumptions

- In the main scenario, the pupil has access to the material as selectable digital text: digital textbooks,
  the school's learning platform, web pages or PDFs. Material that cannot be copied (copy-protected sources or
  paper) goes through the photo or file path.
- The pupil's goal is the simplified text and its audio. The original text is kept for faithfulness checks and
  optional viewing, not as a step in the flow.
- How much formatting travels with copied text varies by source app and platform; structure detection must
  work from plain text alone.
- Images are not imported from pasted content in the first release.
- The 2,000-word limit corresponds roughly to the 4-page limit for photos (one textbook page is about
  300–500 words) and keeps lessons short (Principle IV). Both limits can be revisited after testing.
- Handwritten notes, and content locked inside publishers' digital textbook platforms that cannot be copied,
  are out of scope for this feature.
- LearnFlow is an installable web app (ADR-0001). Target devices are smartphones from roughly the last five
  years running current iOS Safari or Android Chrome; desktop browsers are also supported. The camera is
  needed only for the photo path.
- Whether processing runs on the device or on a server is a planning decision, constrained by Constitution
  Principle II.
- Full recognition of complex mathematical and chemical formulas in photos is out of scope for the first
  release; maths-heavy material will therefore get less benefit at first.
- Two reference sets will be assembled with publisher permission or from openly licensed material: a paste
  reference set (texts copied from digital textbooks, web pages and PDFs, in both rich and plain form) and a
  page reference set (photographed printed pages), both covering subjects, layouts and both written forms of
  Norwegian.
