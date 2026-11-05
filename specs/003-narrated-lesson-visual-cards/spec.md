# Feature Specification: Narrated Lesson with Synchronised Visual Cards

**Feature Branch**: `003-narrated-lesson-visual-cards`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Turn the simplified text into a short narrated lesson where visual cards change in step with the narration, and let the pupil ask about a word or part without losing their place."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listen to a short narrated lesson (Priority: P1)

From the simplified text (002), the pupil starts a lesson and hears a clear, natural Norwegian voice explain
the page in a few minutes, structured into short segments.

**Why this priority**: Audio is the main way LearnFlow helps pupils who struggle with dense text, and it is
part of the vertical slice.

**Independent Test**: Generate lessons for the reference set and verify the narration covers the simplified
text, pronounces key terms correctly and stays within the target length. Delivers value as an audio-only
lesson.

**Acceptance Scenarios**:

1. **Given** a simplified text that passed the faithfulness check, **When** the pupil starts the lesson,
   **Then** narration begins within 3 seconds.
2. **Given** a one-page source, **When** the lesson is generated, **Then** its total length is between 2 and 6
   minutes and it is divided into segments of at most about 90 seconds.
3. **Given** the narration script, **When** it is compared with the simplified text, **Then** every narrated
   statement is traceable to a simplified sentence, and through it to the source.
4. **Given** the source is in Nynorsk, **When** narration plays, **Then** it is spoken in Nynorsk.

---

### User Story 2 - See visual cards in step with the narration (Priority: P1)

While narration plays, the screen shows a sequence of visual cards. Each card shows what is being said at
that moment, such as a key term with its explanation, a key fact or a figure from the page, and the card
changes when the narration moves on.

**Why this priority**: Synchronised audio and visuals are Constitution Principle IV and the defining
experience of LearnFlow. The vertical slice requires at least two synchronised cards.

**Independent Test**: For a generated lesson, verify each card's display window matches the narration span it
belongs to, and that every card is linked to source content.

**Acceptance Scenarios**:

1. **Given** a lesson is playing, **When** the narration reaches the start of a card's span, **Then** that
   card appears within 300 ms.
2. **Given** a card shows a key fact, **When** the pupil taps "Source", **Then** the corresponding passage of
   the original page is shown.
3. **Given** the page contains a figure, **When** the narration refers to it, **Then** a card shows the
   figure cropped from the pupil's own page, with its caption.
4. **Given** a one-page lesson, **When** it is generated, **Then** it contains at least two visual cards.
5. **Given** the source lists dated events or a sequence of steps, **When** cards are generated, **Then** a
   timeline or step card can be built, using only the dates, events and steps stated in the source.
6. **Given** a card fails to generate or load, **When** playback reaches it, **Then** a readable text card
   is shown instead and narration continues uninterrupted.

---

### User Story 3 - Follow along with captions (Priority: P2)

The pupil can turn on captions that show the narration text, with the current words highlighted, so they can
follow without sound (in class or on a bus) or read along.

**Why this priority**: Required by Principles IV and V so that no information is audio-only, but the lesson
already works without captions for most pupils.

**Independent Test**: Play a lesson muted with captions on; verify all narrated content is visible as text and
highlighting stays in sync.

**Acceptance Scenarios**:

1. **Given** captions are on, **When** the lesson plays, **Then** the current sentence is shown and the
   current word is highlighted.
2. **Given** the device is muted, **When** the pupil starts a lesson, **Then** they are offered captions.

---

### User Story 4 - Illustrations that support understanding (Priority: P3)

Where the page has no suitable figure, some cards may show a simple generated illustration that supports a
concept (for example, a plant with arrows for "sunlight", "water", "CO₂"), clearly labelled as an
illustration.

**Why this priority**: Visuals improve retention, but generated images carry cost and accuracy risk. Source
figures and text/icon cards meet the vertical slice without them.

**Independent Test**: For concepts in the reference set, generate illustrations and have reviewers rate them
for accuracy against the source and for child safety; verify labelling.

**Acceptance Scenarios**:

1. **Given** a card uses a generated illustration, **When** it is displayed, **Then** it carries a visible
   "Illustration" label.
2. **Given** a concept involves specific data (a map, a chart, a timeline, a diagram with values), **When**
   cards are generated, **Then** no generated image is used for it. Only source figures, text cards, or
   timeline/step cards built from source data are allowed.

---

### User Story 5 - Ask about a word or part without losing my place (Priority: P3)

While listening, the pupil can tap "What does this mean?" on a word, or "Explain differently" on the current
part. The lesson pauses, a short explanation appears (read aloud if the pupil wants), and "Back to lesson"
continues exactly where they were.

**Why this priority**: On-the-spot help supports independent study, but it is Phase 2. Key-term explanations
(002) cover the most common need in the first release.

**Independent Test**: During a lesson, request explanations for terms and sections from the reference set;
verify each is labelled as added help, is consistent with the source, and that playback resumes at the same
position.

**Acceptance Scenarios**:

1. **Given** a lesson is playing, **When** the pupil taps "What does this mean?" on a word, **Then** playback
   pauses and a short explanation is shown, labelled as added help, using the source's own definition where
   one exists.
2. **Given** an explanation is open, **When** the pupil taps "Back to lesson", **Then** playback resumes at
   the sentence where it paused.
3. **Given** the pupil asks about the current part, **When** the explanation is generated, **Then** it is
   tied to that section, consistent with the source, and passes the same checks as other added help.
4. **Given** the pupil asks a question the source does not cover, **When** the app answers, **Then** the
   answer is clearly marked as general knowledge, not from their material, and never presented as part of
   the lesson. If no safe, reliable answer can be given, the app says so and suggests asking a teacher.
5. **Given** the pupil prefers not to type, **When** they ask for help, **Then** one-tap actions are
   available. Typing or voice input is optional.

### Edge Cases

- A key term is mispronounced by the voice: the pronunciation can be corrected from a curated subject-term
  lexicon, and pupils can report mispronunciations.
- The source contains formulas or symbols (H₂O, ¾, km/t): narration reads them in the conventional spoken form
  and the card shows the written form exactly.
- The simplified text failed the faithfulness check and the pupil is viewing the original text: the lesson is
  narrated from the original text with text-only cards, and no generated content is added.
- The source is literary text: narration reads the original text faithfully, with no paraphrasing.
- Lesson generation fails partway: the pupil can play the segments that are ready, and the rest is retried in
  the background. Playback progress and the lesson text are never lost by a retry.
- The pupil asks something unsafe or unrelated to school in an explanation request: the app declines in a
  friendly way and steers back to the lesson. Questions are not stored beyond what is needed to answer them.
- A generated illustration fails the safety or accuracy check: the card falls back to a text/icon card. The
  pupil is never shown the rejected image.
- Very long multi-page sources: the lesson is split into chapters, each within the length limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a lesson only from a simplified text that passed the faithfulness check
  (002), or from the original text when simplification was not used.
- **FR-002**: System MUST produce a narration script in which every statement links to the simplified
  sentence(s) it is based on. Short connective phrases ("Now let's look at…") are allowed but MUST carry no
  factual content.
- **FR-003**: System MUST produce natural-sounding narration in Bokmål and Nynorsk matching the content's
  language variant.
- **FR-004**: System MUST segment lessons into segments of about 90 seconds or less, with a one-page lesson
  totalling 2–6 minutes.
- **FR-005**: System MUST generate visual cards of these types: key-term card, key-fact card, source-figure
  card (crop from the pupil's page), timeline/step card (built only from dates, events and steps in the
  source), summary card, and optionally illustration card. Cards are static; animated or video lessons are
  out of scope.
- **FR-006**: Every card MUST link to the source passage or figure it represents.
- **FR-007**: System MUST record precise timing of narration so that cards and caption highlighting stay
  within 300 ms of the audio.
- **FR-008**: System MUST provide captions for all narration, with current-word highlighting.
- **FR-009**: Generated illustrations, if enabled, MUST be labelled as illustrations, MUST pass child-safety
  filtering, MUST NOT depict real identifiable people, and MUST NOT be used for content that conveys specific
  data (maps, charts, timelines, labelled diagrams).
- **FR-010**: Every card MUST have a text alternative that a screen reader can announce.
- **FR-011**: System MUST maintain a pronunciation lexicon for subject terms, used by narration.
- **FR-012**: When a card cannot be generated or loaded, System MUST show a readable text card and keep
  narration playing.
- **FR-013**: (Phase 2) System MUST let the pupil pause and request an explanation of a word or the current
  section with one tap, and return to the exact playback position.
- **FR-014**: (Phase 2) Explanations and answers to the pupil's questions are added help (Constitution
  Principle I): they MUST be labelled, consistent with the source, marked as general knowledge when not
  based on the pupil's material, safety-filtered, and MUST NOT be stored beyond what is needed to answer.
- **FR-015**: Illustration cards (User Story 4) are included in the first release only if confirmed
  [NEEDS CLARIFICATION: Are AI-generated
  illustrations in scope for the first release, or should v1 use only source-figure and text/icon cards?
  This affects cost per lesson, provider choice and the evaluation workload.]

### Key Entities *(include if feature involves data)*

- **Lesson**: A playable unit made from one source document; has segments, total duration, language variant,
  generation status and versions of the inputs it was built from.
- **Segment**: A part of a lesson with its own narration audio, script and card sequence.
- **Narration Script Line**: A statement in the narration, linked to simplified sentence(s), with word-level
  timing.
- **Visual Card**: A visual element shown during a time span; has type, content, text alternative, source
  link and, for illustrations, a generation/safety record.
- **Pronunciation Entry**: A subject term with its correct spoken form for a given language variant.
- **Explanation Request** (Phase 2): A pupil's request for help on a word or section, with the playback
  position to return to and the labelled added-help response. Kept only as long as needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 90% of one-page lessons, the first segment is playable within 15 seconds of confirming the
  source.
- **SC-002**: Card changes and caption highlighting are within 300 ms of the matching narration on at least
  99% of transitions in the reference set.
- **SC-003**: Reviewers rate narration naturalness at least 4 out of 5 for both Bokmål and Nynorsk.
- **SC-004**: At least 98% of subject terms in the reference set are pronounced correctly.
- **SC-005**: 0 narrated statements without a source link on the reference set.
- **SC-006**: In pupil testing, comprehension scores after the narrated lesson are at least as high as after
  reading the original page alone, and at least 75% of pupils prefer the lesson format.

## Assumptions

- Input comes from 002 (or from 001's original text in fallback cases).
- Voice and image providers are planning decisions, constrained by Constitution Principle II and cost per
  lesson.
- A single default voice per language variant is enough for the first release.
- Playback controls, resume and offline storage are specified in 004.
- User Story 5 (interactive explanations) is Phase 2 and not part of the first vertical slice.
