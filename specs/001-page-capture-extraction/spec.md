# Feature Specification: Page Capture and Text Extraction

**Feature Branch**: `001-page-capture-extraction`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "A pupil photographs a page from a school textbook (or imports a PDF, image or pasted text) and sees a preview of the extracted content before anything is generated from it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Photograph a page and preview what was read (Priority: P1)

A pupil opens LearnFlow, points the phone at a textbook page and takes a photo. Within a few seconds they see
a clean preview of the text the app read from the page: headings, paragraphs, lists and figure captions, in
the same order as the page.

**Why this priority**: This is the entry point of the whole product and the first step of the vertical slice.
Nothing else works without trustworthy extraction.

**Independent Test**: Photograph pages from the reference set and compare the preview against the
ground-truth transcription. This delivers value on its own as a "read my page" tool.

**Acceptance Scenarios**:

1. **Given** a well-lit, flat, printed textbook page, **When** the pupil takes a photo, **Then** a preview
   shows the page's text in reading order, with headings, paragraphs and lists visually distinguished.
2. **Given** a page with a figure and a caption, **When** extraction completes, **Then** the preview marks the
   figure as a figure region and shows its caption text.
3. **Given** a two-column page, **When** extraction completes, **Then** the text follows column reading order,
   not line-by-line across columns.
4. **Given** the pupil has taken a photo, **When** extraction is in progress, **Then** the pupil sees progress
   feedback and can cancel.

---

### User Story 2 - Get help taking a usable photo (Priority: P2)

While the pupil frames the page, the app guides them when the photo is likely to fail: too dark, blurred,
glare, page cut off, or tilted too far.

**Why this priority**: Pupils working alone in poor conditions are the main cause of bad extraction. Catching
problems before capture avoids frustration and wrong lessons.

**Independent Test**: Use deliberately degraded captures (blur, glare, cropping, low light) and verify the
guidance appears and that following it produces a capture that passes quality checks.

**Acceptance Scenarios**:

1. **Given** the camera view shows a blurred page, **When** the pupil tries to capture, **Then** the app
   shows a short plain-language hint ("Hold still", "Move closer") and offers to retry.
2. **Given** part of the page is outside the frame, **When** the pupil captures, **Then** the app tells them
   which side is cut off.
3. **Given** a captured photo is below the minimum quality, **When** the pupil continues anyway, **Then**
   the preview clearly warns that some text may be wrong.

---

### User Story 3 - Review and correct the extraction (Priority: P2)

In the preview, words the app was unsure about are highlighted. The pupil can tap a highlighted word to see
the matching part of the photo and fix it, retake the photo, or accept the preview as it is.

**Why this priority**: Errors in extraction flow into every later step. Letting the pupil confirm the input
supports Principle I (Faithful to the Source) and Principle VI (Honest, Visible AI).

**Independent Test**: Use pages with known hard-to-read words; verify low-confidence words are highlighted,
corrections are saved, and the confirmed text is what later steps receive.

**Acceptance Scenarios**:

1. **Given** the preview contains low-confidence words, **When** it is shown, **Then** those words are
   highlighted and a count of uncertain words is visible.
2. **Given** the pupil taps a highlighted word, **When** the detail opens, **Then** the corresponding crop of
   the photo is shown next to an editable field.
3. **Given** the pupil has corrected words, **When** they confirm the preview, **Then** the confirmed text
   includes the corrections and is marked as pupil-confirmed.
4. **Given** the preview is poor, **When** the pupil chooses "Take new photo", **Then** the old capture is
   discarded and capture restarts.

---

### User Story 4 - Combine several pages into one lesson (Priority: P3)

A pupil studying a topic that spans a page spread or a few pages captures them one after another, reorders
them if needed, and confirms them as one source for a single lesson.

**Why this priority**: Useful and common, but the vertical slice works with one page.

**Independent Test**: Capture three pages in the wrong order, reorder, confirm, and verify the combined
source preserves the chosen order and the boundaries between pages.

**Acceptance Scenarios**:

1. **Given** one page has been captured, **When** the pupil chooses "Add page", **Then** capture reopens and
   the new page is appended.
2. **Given** several pages are captured, **When** the pupil drags a page thumbnail, **Then** the order
   changes and the combined preview updates.
3. **Given** the maximum number of pages is reached, **When** the pupil tries to add another, **Then** they
   are told the limit and offered to start a new lesson.
4. **Given** several pages are captured with printed page numbers, **When** they are added out of order,
   **Then** the app suggests the order based on page numbers, and the pupil can accept or change it.

---

### User Story 5 - Import a PDF, image or pasted text (Priority: P2)

Some material arrives digitally: a worksheet PDF from the learning platform, a screenshot, or text copied from
a web page. The pupil can pick a PDF or image file, or paste text, and gets the same preview and review step
as with a photo.

**Why this priority**: Much school material is shared digitally, and importing it avoids photographing a
screen. Photo capture alone is enough for the vertical slice.

**Independent Test**: Import a text-based PDF, a scanned (image-only) PDF, an image file and a block of pasted
text; verify each produces a reviewable preview with reading order and page references.

**Acceptance Scenarios**:

1. **Given** a PDF with selectable text, **When** the pupil imports it, **Then** the text is used directly
   (no OCR needed) and shown in the preview with page references.
2. **Given** a scanned PDF or image file, **When** the pupil imports it, **Then** it goes through the same
   extraction and review as a photo.
3. **Given** a PDF with more pages than the per-lesson limit, **When** it is imported, **Then** the pupil
   chooses which pages to use.
4. **Given** the pupil pastes text, **When** they continue, **Then** the text is shown in the preview,
   structured into paragraphs and headings where possible, and is marked as pasted (no page references).
5. **Given** an import was interrupted (app closed, connection lost), **When** the pupil returns, **Then** the
   app offers to retry, and retrying does not create a duplicate of the material.

### Edge Cases

- A two-page spread is captured in one photo: the system detects two pages and treats them as separate pages
  in left-to-right order.
- The page contains handwriting, highlighting or sticky notes from the pupil: handwriting is excluded from the
  extracted text by default and is not treated as source content.
- The page contains mathematical formulas, chemical notation or tables: these are captured as distinct regions
  and are never paraphrased. Formulas the system cannot read reliably are marked as unreadable rather than
  guessed.
- The page is mostly an image (map, diagram, photo) with little text: the preview shows the figure region and
  any labels, and warns that there is little text to build a lesson from.
- The photo contains no text, or is not a textbook page at all (for example a face or a screen): the app says
  it could not find a textbook page and offers to retry. No further processing happens.
- The page is in a language other than Bokmål, Nynorsk or English: the pupil is told the language is not
  supported yet.
- The photo contains people, such as a classmate in the background: only the detected page area is processed
  further; the rest of the image is discarded.
- Connectivity drops during extraction: the capture is kept locally and extraction resumes or is retried
  without the pupil retaking the photo, and without creating duplicates.
- A PDF is password-protected or copy-protected: the app explains that it cannot open the file and suggests
  photographing the page instead.
- Pasted text is very long or contains several topics: the pupil is told the limit and asked to choose the part
  they want a lesson about.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the pupil capture a textbook page with the device camera and MUST also allow
  choosing an existing photo or image file, importing a PDF, or pasting text.
- **FR-002**: System MUST detect the page boundary, correct perspective and crop to the page before
  extraction.
- **FR-003**: System MUST check capture quality (focus, lighting, glare, completeness) and give
  plain-language guidance when quality is insufficient.
- **FR-004**: System MUST extract printed text in reading order, including multi-column layouts.
- **FR-005**: System MUST classify extracted content into blocks: heading, paragraph, list item, figure,
  figure caption, table, formula, sidebar/fact box, and exercise/task.
- **FR-006**: System MUST record, for every extracted block, its location on the source page and a
  confidence value, so that later features can link generated content back to it.
- **FR-007**: System MUST highlight low-confidence words or blocks in the preview and show the corresponding
  photo crop on request.
- **FR-008**: Pupils MUST be able to correct extracted text, retake a page, or remove a page before
  confirming.
- **FR-009**: System MUST NOT pass content to later steps (002 onward) until the pupil has confirmed the
  preview.
- **FR-010**: System MUST support Norwegian Bokmål, Nynorsk and English source text, and MUST record the
  detected language variant per block.
- **FR-011**: System MUST exclude handwriting and annotations from the extracted text by default.
- **FR-012**: System MUST support combining up to 4 pages into one source, with reordering.
- **FR-013**: System MUST delete source photos once the pupil confirms extraction, unless the pupil chooses
  to keep them (see 006).
- **FR-014**: Exercise/task blocks MUST be marked so that later features can treat them as instructions to
  explain, not questions to answer (Constitution Principle VI).
- **FR-015**: For PDFs with a text layer, System MUST use the embedded text and its page structure instead of
  OCR; for scanned PDFs and image files it MUST use the same extraction as photos.
- **FR-016**: Pasted text MUST be recorded as a pasted source without page references, and MUST go through the
  same preview and confirmation step.
- **FR-017**: Interrupted captures and imports MUST be resumable or retryable without silent loss of material
  and without creating duplicates.
- **FR-018**: System MUST NOT send any material off the device until the pupil takes a clear action to
  process it (Constitution Principle II).

### Key Entities *(include if feature involves data)*

- **Capture**: One photo, image file, PDF or block of pasted text provided by the pupil; has a source type,
  quality assessment results where relevant, and a lifecycle status (pending, extracted, confirmed,
  discarded).
- **Source Page**: A cropped, perspective-corrected page derived from a capture; has an order within its
  source document.
- **Extracted Block**: A unit of content on a source page; has type, text, language variant, page location,
  confidence, reading-order index and a flag for pupil correction.
- **Source Document**: The confirmed, ordered set of source pages and blocks that feeds a lesson. Treated as
  immutable once confirmed. Later corrections create a new version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the reference set of printed Norwegian textbook pages photographed with a mid-range phone in
  normal indoor light, character accuracy is at least 98% and reading order is correct for at least 95% of
  pages.
- **SC-002**: For 90% of captures, the preview appears within 10 seconds of taking the photo.
- **SC-003**: At least 90% of words that are actually wrong in the extraction are flagged as low-confidence
  (recall of uncertainty).
- **SC-004**: In moderated testing, at least 85% of pupils aged 10–16 complete capture → confirmed preview
  unaided on their first attempt.
- **SC-005**: Formulas and numbers are never silently altered: 0 cases on the reference set where a number or
  formula in the confirmed text differs from the page without being flagged.

## Assumptions

- Source material is printed text in physical textbooks or printouts, PDFs and images the pupil has on the
  device, or pasted text. Handwritten notes, and content locked inside publishers' digital textbook platforms,
  are out of scope for this feature.
- Target devices are smartphones from roughly the last five years with a working camera.
- Whether extraction runs on the device or on a server is a planning decision, constrained by Constitution
  Principle II.
- The limit of 4 pages per lesson keeps lessons short (Principle IV) and can be revisited after testing.
- A reference set of real textbook pages, covering subjects, layouts and both written forms of Norwegian, will
  be assembled with publisher permission or from openly licensed material.
