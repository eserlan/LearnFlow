# Feature Specification: Playback, Resume and Offline Access

**Feature Branch**: `004-playback-resume-offline`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Let the pupil control lesson playback, pick up exactly where they left off, find earlier lessons and play them without a connection."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resume exactly where I left off (Priority: P1)

A pupil listening to a lesson is interrupted by a phone call, closes the app, or the phone runs out of
battery. When they come back, the lesson offers to continue from the same sentence.

**Why this priority**: Study sessions are short and interrupted. Resume is the final step of the vertical
slice.

**Independent Test**: Start a lesson, interrupt it in various ways (background, force-close, restart device),
reopen and verify the resume position.

**Acceptance Scenarios**:

1. **Given** a lesson was paused or interrupted mid-section, **When** the pupil reopens the app, **Then** a
   "Continue" option resumes at the start of the sentence that was playing, with that sentence highlighted in the text.
2. **Given** the pupil resumes after more than a day, **When** playback continues, **Then** it rewinds to the
   start of the current section so the pupil gets context back.
3. **Given** a lesson was completed, **When** the pupil opens it again, **Then** it starts from the beginning
   and shows that it has been completed.
4. **Given** the pupil has an unfinished lesson, **When** they open the app, **Then** the home screen shows
   that lesson with a single "Continue" action, without the pupil having to search for it.

---

### User Story 2 - Control playback (Priority: P2)

The pupil can pause, play, go back one sentence, skip to the previous or next section, scrub through the lesson,
and change speed (0.75× to 1.5×).

**Why this priority**: Pupils need to replay hard parts and adjust pace. A lesson that only plays forward
still works for the slice.

**Independent Test**: Exercise every control on a test lesson and verify audio and text highlighting remain in
sync.

**Acceptance Scenarios**:

1. **Given** a lesson is playing, **When** the pupil taps "Back one sentence", **Then** the audio restarts at
   the previous sentence and that sentence is highlighted.
2. **Given** a lesson is playing, **When** the pupil sets speed to 0.75×, **Then** the audio slows without
   changing pitch, and the text highlighting stays in sync.
3. **Given** headphones are disconnected, **When** a lesson is playing, **Then** playback pauses.
4. **Given** the screen is locked, **When** a lesson is playing, **Then** audio continues and can be
   controlled from the lock screen.

---

### User Story 3 - Play lessons without a connection (Priority: P2)

Lessons the pupil has generated are available on the device, so they can be played on the school bus or at a
cabin without mobile data.

**Why this priority**: Connectivity is unreliable, and many pupils have limited data plans. It is not needed
to prove the core flow.

**Independent Test**: Generate a lesson, switch the device to airplane mode, and play it fully, including
the simplified text and the original.

**Acceptance Scenarios**:

1. **Given** a lesson has finished generating, **When** the device goes offline, **Then** the lesson plays
   completely, including the simplified text with highlighting and "Show original".
2. **Given** the device is offline, **When** the pupil opens the library, **Then** lessons available offline
   are clearly distinguished from those that are not.
3. **Given** the device is low on storage, **When** a new lesson would exceed the storage budget, **Then**
   the pupil is told and offered to remove old offline copies.

---

### User Story 4 - Find my lessons (Priority: P3)

The pupil sees their lessons in a simple library, most recent first, with the subject, a title derived from
the first heading, the optional source note ("where it came from"), progress, and the source type
(pasted, photo or file). They can rename or delete a lesson.

**Why this priority**: Becomes important once a pupil has several lessons. The slice needs only one.

**Independent Test**: Create several lessons, then verify ordering, titles, progress display, rename and
delete.

**Acceptance Scenarios**:

1. **Given** the pupil has several lessons, **When** they open the library, **Then** lessons are listed most
   recent first with title, subject, progress and offline status.
2. **Given** the pupil deletes a lesson, **When** they confirm, **Then** it disappears from the library and is
   deleted according to 006.

### Edge Cases

- The lesson was regenerated after the pupil corrected the source: resume uses the closest matching sentence
  in the new version; if none matches, it starts the section over and tells the pupil the lesson was updated.
- Playback is interrupted by another app's audio (navigation prompt, alarm): playback pauses and offers to
  resume, rather than continuing silently underneath.
- The pupil uses the app on two devices: progress follows the most recent activity. Offline copies are
  per device. [See Assumptions on accounts.]
- A lesson is still generating when the pupil goes offline: ready sections play, and the rest shows as
  "Waiting for connection".
- The app is updated and stored lessons use an older format: they remain playable or are migrated without
  loss of progress.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST save playback position (section, sentence) at least every few seconds and on
  every pause, interruption or app backgrounding.
- **FR-002**: System MUST offer to resume from the saved position when a partially played lesson is opened,
  and MUST surface the most recent unfinished lesson on the home screen.
- **FR-003**: System MUST provide play/pause, back one sentence, previous/next section, scrubbing, and speed
  control from 0.75× to 1.5× in steps of 0.25×.
- **FR-004**: Speed changes MUST preserve pitch and keep text highlighting in sync.
- **FR-005**: System MUST support background playback and lock-screen/system media controls.
- **FR-006**: System MUST pause on headphone disconnect and on audio interruptions from calls or other apps.
- **FR-007**: System MUST store generated lessons on the device so they play fully offline, including the
  simplified text with timing for highlighting, and the original text.
- **FR-008**: System MUST enforce an on-device storage budget and let the pupil remove offline copies without
  deleting the lesson itself.
- **FR-009**: System MUST provide a library listing lessons with title, subject, date, progress and offline
  status, most recent first.
- **FR-010**: Pupils MUST be able to rename and delete lessons; deletion follows the rules in 006.
- **FR-011**: System MUST mark lessons as completed when the final section has been played.
- **FR-012**: Offline data on the device MUST be stored so that it is not readable by other apps.

### Key Entities *(include if feature involves data)*

- **Playback State**: The pupil's position in a lesson (section, sentence, time offset), speed setting
  and last-played time.
- **Lesson Library Entry**: A pupil-facing view of a lesson: title, subject, source note and type, progress, completion
  and offline status.
- **Offline Copy**: The device-stored package of a lesson's audio, simplified text with word timing, and original text. Audio is never
  exported as a file (003).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any interruption, 99% of resumes start within one sentence of the interrupted position.
- **SC-002**: From tapping "Continue" to audio playing takes under 2 seconds for offline lessons.
- **SC-003**: 100% of completed lessons in the test suite play fully in airplane mode.
- **SC-004**: The offline copy of a lesson from about one textbook page uses less than 15 MB on the device.
- **SC-005**: In pupil testing, at least 90% find and resume a lesson from the previous day unaided.

## Assumptions

- Each pupil has an identity in LearnFlow (see 006). Syncing progress across devices depends on how accounts
  are designed there; offline playback itself does not require an account.
- Offline means playing lessons that have already been generated. Creating new lessons offline (import,
  extraction, simplification, narration) is out of scope unless the plan chooses on-device processing.
- Subjects are assigned automatically from page content and can be changed by the pupil. No
  curriculum-structured library is in scope.
