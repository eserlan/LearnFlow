# Feature Specification: Narrated Lesson from the Simplified Text

**Feature Branch**: `003-narrated-lesson`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Create audio from the simplified text, played inside LearnFlow with the text alongside. Visual cards that change in step with the narration come in a later phase, as does asking about a word or part while listening."

## Clarifications

### Session 2026-11-05

- Q: Should the audio be playable only in LearnFlow, or also saved or shared as an audio file? → A: In-app audio only. No export, download or sharing as an audio file.
- Q: Should synchronised visual cards be in the first release? → A: No. The first release is simplified text plus audio with read-along highlighting. Visual cards (and generated illustrations) move to a later phase.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listen to the simplified text (Priority: P1)

As soon as the simplified text is ready (002), LearnFlow makes audio from it. The pupil taps Play and hears a
clear, natural voice read the simplified text, section by section, in a few minutes.

**Why this priority**: Simplified text plus audio is the core of LearnFlow and the end of the vertical slice.

**Independent Test**: Generate audio for the reference set and verify that it reads the simplified text
exactly, pronounces key terms correctly, and stays within the target length.

**Acceptance Scenarios**:

1. **Given** a simplified text that passed the faithfulness check, **When** it is ready, **Then** audio
   generation starts automatically, with no extra step for the pupil, and the first section is playable
   within 5 seconds.
2. **Given** the audio is playing, **When** it is compared with the simplified text on screen, **Then** it
   reads exactly that text, with no added or changed content apart from announcing section headings.
3. **Given** a simplified text from about one textbook page (300–500 words), **When** the audio is generated,
   **Then** it lasts between 2 and 6 minutes and is divided into sections of at most about 90 seconds.
4. **Given** the source is in Nynorsk, **When** the audio plays, **Then** it is spoken in Nynorsk.
5. **Given** the simplified text failed the faithfulness check and the pupil is shown the original text
   (002), **When** audio is generated, **Then** it reads the original text.

---

### User Story 2 - Read along while listening (Priority: P1)

While the audio plays, the simplified text is on screen with the current sentence and word highlighted. The
pupil can tap any sentence to play from there, or read without sound (in class or on a bus).

**Why this priority**: The text and the audio are the two halves of the lesson. Reading along supports
pupils who learn best with both, and makes sure nothing is audio-only (Principles IV and V).

**Independent Test**: Play a lesson and verify highlighting stays in sync with the audio; tap sentences and
verify playback jumps there; play muted and verify all content is readable.

**Acceptance Scenarios**:

1. **Given** the audio is playing, **When** it moves through the text, **Then** the current sentence is
   highlighted and the current word is marked, within 300 ms of the audio.
2. **Given** the simplified text is shown, **When** the pupil taps a sentence, **Then** playback starts from
   that sentence.
3. **Given** the device is muted, **When** the pupil opens a lesson, **Then** the full simplified text is
   available to read.
4. **Given** the text is longer than the screen, **When** the audio moves on, **Then** the view scrolls to
   keep the current sentence visible, unless the pupil has scrolled away themselves.

---

### User Story 3 - Audio that follows changes to the text (Priority: P2)

When the pupil makes a section easier, switches simplification level, or leaves out or puts back part of the
original (001 "Show original"), the audio is updated for the changed sections only.

**Why this priority**: Keeps text and audio consistent when the pupil adjusts the lesson, without regenerating
everything.

**Independent Test**: Make one section easier; verify only that section's audio changes, playback position is
kept, and highlighting still matches.

**Acceptance Scenarios**:

1. **Given** the pupil makes one section easier (002), **When** the new text is ready, **Then** only that
   section's audio is regenerated, and the rest of the lesson is unchanged.
2. **Given** a section's audio is being regenerated, **When** playback reaches it, **Then** the pupil is told
   it is updating, and playback continues as soon as it is ready.

---

### User Story 4 - See visual cards in step with the narration (Priority: P3, later phase)

In a later phase, the screen can show visual cards next to the text: a key term with its explanation, a key
fact, a timeline, or (for photographed pages) a figure from the page, changing as the narration moves on.

**Why this priority**: Visual cards strengthen learning, but the first release focuses on simplified text and
audio.

**Independent Test**: For a generated lesson, verify each card's display window matches the narration span it
belongs to, and that every card is linked to source content.

**Acceptance Scenarios**:

1. **Given** a lesson with cards is playing, **When** the narration reaches the start of a card's span,
   **Then** that card appears within 300 ms.
2. **Given** the source lists dated events or a sequence of steps, **When** cards are generated, **Then** a
   timeline or step card can be built, using only the dates, events and steps stated in the source.
3. **Given** a card fails to generate or load, **When** playback reaches it, **Then** a readable text card
   is shown instead and narration continues uninterrupted.
4. **Given** a concept involves specific data (a map, a chart, a timeline, a diagram with values), **When**
   cards are generated, **Then** no generated image is used for it.

---

### User Story 5 - Ask about a word or part without losing my place (Priority: P3, later phase)

While listening, the pupil can tap "What does this mean?" on a word, or "Explain differently" on the current
part. The audio pauses, a short explanation appears (read aloud if the pupil wants), and "Back to lesson"
continues exactly where they were.

**Why this priority**: On-the-spot help supports independent study, but it is a later phase. Key-term
explanations (002) cover the most common need in the first release.

**Independent Test**: During a lesson, request explanations for terms and sections from the reference set;
verify each is labelled as added help, is consistent with the source, and that playback resumes at the same
position.

**Acceptance Scenarios**:

1. **Given** a lesson is playing, **When** the pupil taps "What does this mean?" on a word, **Then** playback
   pauses and a short explanation is shown, labelled as added help, using the source's own definition where
   one exists.
2. **Given** an explanation is open, **When** the pupil taps "Back to lesson", **Then** playback resumes at
   the sentence where it paused.
3. **Given** the pupil asks a question the source does not cover, **When** the app answers, **Then** the
   answer is clearly marked as general knowledge, not from their material, and never presented as part of
   the lesson. If no safe, reliable answer can be given, the app says so and suggests asking a teacher.
4. **Given** the pupil prefers not to type, **When** they ask for help, **Then** one-tap actions are
   available. Typing or voice input is optional.

### Edge Cases

- A key term is mispronounced by the voice: the pronunciation can be corrected from a curated subject-term
  lexicon, and pupils can report mispronunciations.
- The text contains simple notation (H₂O, ¾, km/t, x²): the audio reads it in the conventional spoken form,
  and the text shows the written form exactly.
- The text contains a complex formula kept as an image (photo path, 001): the audio says "see the formula on
  screen" and the image is shown in the text.
- The text contains a likely lost notation marked for checking (x2 for x², 001): the audio reads it as
  written until the pupil applies the fix, then that sentence's audio is regenerated.
- The source is literary text: the audio reads the original text, because literary text is not simplified
  (002).
- Audio generation fails partway: the pupil can play the sections that are ready, and the rest is retried in
  the background. Playback progress and the text are never lost by a retry.
- The text contains a table: the audio reads it row by row in a consistent pattern ("Row 1: …"), and the
  table is shown as a table on screen.
- Very long texts (up to the 2,000-word limit in 001): the lesson is split into chapters, each within the
  length limits.

## Requirements *(mandatory)*

### Functional Requirements

**First release**

- **FR-001**: System MUST start audio generation automatically as soon as a simplified text that passed the
  faithfulness check is ready (002), without a pupil step. If 002 fell back to the original text, the audio
  MUST read the original text.
- **FR-002**: The audio MUST read the displayed text exactly. The only allowed additions are announcing the
  lesson title and section headings; no connecting phrases, summaries or commentary.
- **FR-003**: System MUST produce natural-sounding audio in Bokmål, Nynorsk and English, matching each
  section's language variant.
- **FR-004**: System MUST split audio into sections of about 90 seconds or less. A lesson from about one
  textbook page (300–500 words) MUST total 2–6 minutes; longer texts are split into chapters, each within
  these limits.
- **FR-005**: System MUST record word-level timing so that sentence and word highlighting stay within 300 ms
  of the audio.
- **FR-006**: System MUST show the simplified text alongside the audio, with the current sentence highlighted
  and the current word marked, and MUST let the pupil start playback from any sentence by tapping it.
- **FR-007**: System MUST maintain a pronunciation lexicon for subject terms and notation, used by the audio.
- **FR-008**: When the text changes (section made easier, level switched, sections left out or put back,
  notation fixed), System MUST regenerate audio for the changed sections only and keep the pupil's playback
  position.
- **FR-009**: Audio MUST be playable only inside LearnFlow. System MUST NOT offer export, download or sharing
  of the audio as a file, and MUST store audio so that other apps cannot read it (textbook copyright and
  Constitution Principle II).
- **FR-010**: When audio generation fails for a section, System MUST let the pupil play the sections that are
  ready, retry the rest in the background, and never lose progress or text.

**Later phase (visual cards and explanations)**

- **FR-011**: System MUST generate visual cards of these types: key-term card, key-fact card, source-figure
  card (crop from a photographed or imported page), timeline/step card (built only from dates, events and
  steps in the source), and summary card. Cards are static; animated or video lessons are out of scope.
- **FR-012**: Every card MUST link to the source passage or figure it represents, MUST have a text
  alternative that a screen reader can announce, and MUST appear within 300 ms of its narration span. When a
  card cannot be generated or loaded, System MUST show a readable text card and keep narration playing.
- **FR-013**: Generated illustrations, if they are included when visual cards are specified in detail, MUST
  be labelled as illustrations, MUST pass child-safety filtering, MUST NOT depict real identifiable people,
  and MUST NOT be used for content that conveys specific data (maps, charts, timelines, labelled diagrams).
- **FR-014**: System MUST let the pupil pause and request an explanation of a word or the current section
  with one tap, and return to the exact playback position.
- **FR-015**: Explanations and answers to the pupil's questions are added help (Constitution Principle I):
  they MUST be labelled, consistent with the source, marked as general knowledge when not based on the
  pupil's material, safety-filtered, and MUST NOT be stored beyond what is needed to answer.

### Key Entities *(include if feature involves data)*

- **Lesson**: The simplified text and its audio for one source document; has sections, total duration,
  language variant, generation status and versions of the inputs it was built from.
- **Audio Section**: The audio for one section of the simplified text, with word-level timing and a link to
  the text version it was made from.
- **Pronunciation Entry**: A subject term or notation with its correct spoken form for a given language
  variant.
- **Visual Card** (later phase): A visual element shown during a time span; has type, content, text
  alternative, source link and, for illustrations, a generation/safety record.
- **Explanation Request** (later phase): A pupil's request for help on a word or section, with the playback
  position to return to and the labelled added-help response. Kept only as long as needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For pasted texts of about one textbook page, the pupil can start listening within 20 seconds of
  tapping "Paste and simplify" for 90% of texts.
- **SC-002**: Sentence and word highlighting are within 300 ms of the audio for at least 99% of words in the
  reference set.
- **SC-003**: Reviewers rate audio naturalness at least 4 out of 5 for Bokmål, Nynorsk and English.
- **SC-004**: At least 98% of subject terms in the reference set are pronounced correctly.
- **SC-005**: An automatic transcript of the audio matches the displayed text for at least 99% of words on the
  reference set, with no added content.
- **SC-006**: In pupil testing, comprehension after listening to the simplified text (with read-along) is at
  least as high as after reading the original alone, and at least 75% of pupils prefer LearnFlow's version.

## Assumptions

- Input comes from 002 (simplified text, or the original text in fallback and literary cases).
- One default voice per language variant is enough for the first release.
- Playback controls, resume and offline playback are specified in 004.
- The choice of speech provider is a planning decision, constrained by Constitution Principle II and cost per
  lesson.
- Visual cards, generated illustrations and interactive explanations (User Stories 4 and 5) are a later phase
  and not part of the first vertical slice. Whether that phase includes AI-generated illustrations is decided
  when it is specified in detail.
