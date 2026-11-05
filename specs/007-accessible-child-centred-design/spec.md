# Feature Specification: Accessible, Child-Centred Design Constraints

**Feature Branch**: `007-accessible-child-centred-design`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Cross-cutting design constraints that every LearnFlow screen and feature must meet: accessible, usable alone by pupils, respectful rather than childish, calm and honest, predictable, in Bokmål and Nynorsk."

> **Cross-cutting feature**: This specification is not built on its own. Its requirements are acceptance
> criteria for every user-facing story in 001–006 and must be implemented alongside them, starting with the
> vertical slice in 001–004.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A pupil with dyslexia completes the core flow comfortably (Priority: P1)

A pupil with dyslexia uses LearnFlow with larger text, more line spacing and a dyslexia-friendly typeface,
reads along with highlighted captions, and never meets a wall of text in the interface.

**Why this priority**: Pupils with reading difficulties are a primary audience. If the core flow does not work
for them, the product misses its purpose.

**Independent Test**: With text settings at maximum and the alternative typeface on, a pupil with dyslexia
completes paste → lesson → resume. Verify no truncated or overlapping text.

**Acceptance Scenarios**:

1. **Given** the pupil increases text size to 200%, **When** they use any screen in the core flow, **Then**
   all text remains readable and all controls usable without horizontal scrolling.
2. **Given** the pupil chooses the alternative typeface and wider spacing, **When** they view the simplified
   text and its read-along highlighting, **Then** the settings apply everywhere.

---

### User Story 2 - A pupil using a screen reader completes the core flow (Priority: P1)

A blind or partially sighted pupil uses VoiceOver or TalkBack to paste text (or capture a page, with guidance
by speech and haptics), and listen to the lesson while navigating the simplified text sentence by sentence.

**Why this priority**: WCAG 2.2 AA is a constitution requirement, and Norwegian regulations on universal
design apply to digital services.

**Independent Test**: Complete the core flow using only a screen reader on iOS and Android.

**Acceptance Scenarios**:

1. **Given** a screen reader is on, **When** the pupil frames a page, **Then** framing guidance is given by
   speech and haptics ("Move the phone up", "Page found").
2. **Given** a lesson is playing with a screen reader, **When** the pupil moves focus through the text,
   **Then** the screen reader does not talk over the lesson audio (it pauses or ducks the audio), and
   sentence highlighting does not steal focus.
3. **Given** any interactive element, **When** focused, **Then** it has a meaningful label in the interface
   language.
4. **Given** the pupil navigates with an external keyboard or switch control, **When** they move through the
   core flow, **Then** every core action is reachable, focus is always visible, and the order is logical.

---

### User Story 3 - One obvious next step, every time (Priority: P1)

A pupil opening LearnFlow for the first time sees one clear primary action, "Paste text", that starts a lesson.
On later visits, the home screen offers "Continue" for their unfinished lesson. Every screen has one obvious
next action, and advanced options stay out of the way until the pupil looks for them.

**Why this priority**: Progressive complexity (Constitution Principle III) is what makes unaided use possible,
especially for pupils with attention difficulties or low confidence with apps.

**Independent Test**: First-time pupils in moderated testing start a lesson by pasting text from the home
screen without instruction; returning pupils resume their last lesson in one tap.

**Acceptance Scenarios**:

1. **Given** a new pupil on the home screen, **When** it loads, **Then** one primary action, "Paste text",
   clearly starts a new lesson, with photo and file import as secondary options, and no setup or settings are
   required first.
2. **Given** an error occurs anywhere in the core flow, **When** it is shown, **Then** it explains in plain
   language what happened and offers one obvious recovery action.
3. **Given** a screen with advanced options (speed, levels, typeface), **When** it is shown, **Then** those
   options are available but visually secondary and never block the main action.
4. **Given** an input field receives focus, **When** the on-screen keyboard opens, **Then** the field and its
   confirm action remain visible and usable.

---

### User Story 4 - A pupil uses LearnFlow in a noisy or quiet place (Priority: P2)

On a bus or in a classroom, the pupil uses the app without sound and with one hand, and gets the same
information.

**Why this priority**: Real study conditions. Supports Principle IV (no information in one channel only).

**Independent Test**: Complete the core flow muted and one-handed on a large phone.

**Acceptance Scenarios**:

1. **Given** the device is muted, **When** a lesson starts, **Then** captions are offered and all content is
   available as text.
2. **Given** the pupil holds the phone in one hand, **When** they use playback controls, **Then** primary
   controls are reachable within the lower part of the screen.

---

### User Story 5 - The interface speaks the pupil's written language (Priority: P2)

A pupil whose school uses Nynorsk sets the interface to Nynorsk; all menus, messages and help texts are in
Nynorsk.

**Why this priority**: Norwegian pupils use either Bokmål or Nynorsk as their main written form, and schools
must offer learning materials in both.

**Independent Test**: Switch the interface language and verify no untranslated strings remain in the core
flow.

**Acceptance Scenarios**:

1. **Given** the pupil chooses Nynorsk, **When** they use the app, **Then** all interface text is in Nynorsk.
2. **Given** content and interface languages differ, **When** a lesson plays, **Then** the content stays in
   its own language variant (see 002) while the interface follows the pupil's choice.

---

### User Story 6 - Settings that suit me, without a diagnosis (Priority: P2)

A pupil who finds busy screens distracting turns on a calmer layout (fewer elements, no animation, one
section of text at a time). Another prefers captions always on and slower narration. Nobody is asked about diagnoses, and no
setting is labelled as "for ADHD" or "for dyslexia".

**Why this priority**: Needs vary within any group of pupils, and one fixed "accessible mode" fails many of
them. Defaults must work well first, so this follows the P1 stories.

**Independent Test**: Change each preference and verify it applies across all core-flow screens; review all
interface copy for diagnostic labels.

**Acceptance Scenarios**:

1. **Given** a pupil opens settings, **When** they browse preferences, **Then** they see plain descriptions of
   what each setting does ("Fewer things on screen", "Captions always on"), not diagnoses.
2. **Given** a pupil turns on the calmer layout, **When** they use the core flow, **Then** secondary elements
   and animations are removed everywhere, and all functions remain available.
3. **Given** a first-time pupil, **When** they start, **Then** they are not required to go through a
   preferences setup; a single optional "Adjust how LearnFlow looks and sounds" entry point is offered.

### Edge Cases

- The system font size is set very large in the operating system: LearnFlow respects it and layouts reflow.
- The pupil has reduce-motion enabled: auto-scrolling and highlight transitions become instant changes.
- Colour vision deficiency: no state (correct/incorrect, low-confidence, selected) is communicated by colour
  alone.
- Very small or older phones: the core flow stays usable at the smallest supported screen size.
- A pupil taps quickly or by mistake on destructive actions: deletion and discarding always require
  confirmation and, where possible, offer undo.
- The pupil is interrupted mid-flow (call, app switch, low battery): returning puts them back on the same
  step with their material and progress intact.
- The on-screen keyboard covers part of the screen: the focused input and its confirm action stay visible.

## Requirements *(mandatory)*

### Functional Requirements

**Accessibility**

- **FR-001**: All screens MUST conform to WCAG 2.2 level AA.
- **FR-002**: All functionality MUST be operable with VoiceOver and TalkBack, with meaningful labels and a
  logical focus order.
- **FR-003**: Text MUST scale to 200% without loss of content or function, and MUST respect the operating
  system's text size setting.
- **FR-004**: Users MUST be able to choose an alternative, dyslexia-friendly typeface and increased line and
  letter spacing, applied across the app.
- **FR-005**: Touch targets MUST be at least 44×44 points.
- **FR-006**: Colour MUST NOT be the only means of conveying information, and text contrast MUST meet AA
  ratios in both light and dark themes.
- **FR-007**: System MUST respect reduce-motion settings and MUST NOT use flashing content.
- **FR-008**: All audio content MUST have a text equivalent, and all visual content MUST have a text
  alternative.
- **FR-009**: All core actions MUST be operable with an external keyboard and switch control, with visible
  focus at all times.

**Child-centred design**

- **FR-010**: Interface copy MUST be plain language understandable by the youngest supported age, with short
  sentences and no jargon, while staying respectful and never childish or patronising toward teenagers.
- **FR-011**: Error and status messages MUST say what happened and what to do next, without blaming the
  pupil.
- **FR-012**: The core flow MUST NOT require typing beyond optional corrections and renaming.
- **FR-013**: System MUST NOT use dark patterns or engagement-maximising mechanics: no streaks, loss framing,
  countdowns, leaderboards, infinite feeds, or variable rewards.
- **FR-014**: Notifications MUST be off by default and opt-in per type.
- **FR-015**: Destructive actions MUST require confirmation, and SHOULD offer undo where feasible.
- **FR-016**: AI-generated content MUST be identifiable as such in a consistent, non-alarming visual way
  (Constitution Principle VI).
- **FR-017**: Primary actions in the core flow MUST be reachable one-handed on common phone sizes.
- **FR-018**: Every screen MUST have one visually dominant primary action. Advanced controls MUST be
  optional and secondary (progressive complexity).
- **FR-019**: The home screen MUST offer "Paste text" as the primary action for new pupils (with photo and
  file import as secondary options) and "Continue" for the most recent unfinished lesson for returning
  pupils.
- **FR-020**: System MUST offer preferences (calmer layout, captions default, speed default, text and
  typeface settings) described by what they do, MUST NOT ask for or infer diagnoses, and MUST NOT require
  preference setup before first use.
- **FR-021**: Inputs MUST remain visible and usable when the on-screen keyboard is open.
- **FR-022**: Interruptions MUST return the pupil to the same step with material and progress intact.

**Language**

- **FR-023**: The interface MUST be available in Norwegian Bokmål and Nynorsk, chosen independently of
  content language. English interface support is optional for the first release.
- **FR-024**: All interface strings MUST be externalised so that further languages can be added without code
  changes.

### Key Entities *(include if feature involves data)*

- **Accessibility Preferences**: Text size, typeface, spacing, theme, reduce-motion, calmer layout, captions
  default, playback speed default. Stored with the pupil profile and applied across features.
- **Interface Language**: Bokmål or Nynorsk (optionally English), independent of content language.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 WCAG 2.2 AA violations in automated accessibility testing of every core-flow screen, and an
  annual manual audit with no unresolved critical findings.
- **SC-002**: Pupils using a screen reader complete the core flow unaided in moderated testing (at least 4 of
  5 participants).
- **SC-003**: Pupils with self-reported reading difficulties complete the core flow at a rate within 10
  percentage points of other pupils.
- **SC-004**: 100% of interface strings in the core flow exist in both Bokmål and Nynorsk at every release.
- **SC-005**: In moderated testing, at least 4 of 5 first-time pupils start a lesson by pasting text from the
  home screen without instruction, and returning pupils resume their last lesson in one tap.
- **SC-006**: 0 interface strings use diagnostic labels, verified by copy review at each release.
- **SC-007**: In testing, teenagers rate the tone as respectful (not childish) at least 4 out of 5.
- **SC-008**: In testing, at least 90% of pupils aged 10–12 can explain what to do next after each error
  message they encounter.

## Assumptions

- Applies to every feature; plans for 001–006 must list the 007 requirements their screens are tested against.
- Testing with real pupils, including pupils with disabilities, requires guardian consent and is arranged
  together with the DPIA from 006.
- The specific dyslexia-friendly typeface is a design decision; the requirement is that an alternative with
  proven readability benefits is offered.
- LearnFlow is an installable web app (ADR-0001). Phones running current iOS Safari and Android Chrome are
  the primary targets, tested with VoiceOver and TalkBack; desktop browsers must meet the same constraints.
