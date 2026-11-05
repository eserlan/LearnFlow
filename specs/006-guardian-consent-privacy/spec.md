# Feature Specification: Guardian Consent, Privacy and Data Controls

**Feature Branch**: `006-guardian-consent-privacy`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Make sure children can use LearnFlow lawfully and safely: guardian consent where required, minimal data, short retention, and simple ways to see, export and delete everything."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guardian consent before a younger pupil starts (Priority: P1)

When a pupil under 13 sets up LearnFlow, the app asks for a guardian. The guardian receives a request,
reads a short, plain-language explanation of what LearnFlow does with the child's data, and gives consent
before any photo is processed.

**Why this priority**: Under GDPR and the Norwegian Personal Data Act, consent for information society services
to children under 13 must come from a guardian. No real-pupil release is possible without this.

**Independent Test**: Set up as a pupil under 13; verify adding material and processing are blocked until consent is
recorded, and that a pupil aged 13 or over can consent themselves.

**Acceptance Scenarios**:

1. **Given** a pupil states they are under 13, **When** they finish setup, **Then** they can explore the app
   but cannot process any page until a guardian has consented.
2. **Given** a guardian opens the consent request, **When** they read it, **Then** it explains in plain
   Norwegian what data is processed, by whom, where, for how long, and how to withdraw consent.
3. **Given** consent is given, **When** the pupil returns to the app, **Then** full functionality is
   unlocked.
4. **Given** a guardian withdraws consent, **When** withdrawal is confirmed, **Then** processing stops
   immediately and the pupil's data is deleted according to FR-009.

---

### User Story 2 - Delete a lesson or everything (Priority: P1)

The pupil, or a guardian for a pupil under 13, can delete any single lesson and everything derived from it,
or delete the whole account and all data.

**Why this priority**: Deletion is a non-negotiable constitution requirement and a legal right. It must exist
from the first release.

**Independent Test**: Create lessons, delete one, then delete the account; verify the data is gone from the
device, LearnFlow storage, backups (after the backup window) and processors.

**Acceptance Scenarios**:

1. **Given** a lesson exists, **When** the pupil deletes it and confirms, **Then** the lesson, its source text,
   any kept photos or formula crops, audio, questions and answers are removed from the device immediately and from all
   other storage within the documented period.
2. **Given** the pupil deletes their account, **When** they confirm, **Then** all their data is deleted and
   they get a confirmation stating when deletion will be complete everywhere.
3. **Given** a deletion is requested, **When** the documented period has passed, **Then** an internal check
   can show that no data linked to the deleted lesson or account remains, including at processors.

---

### User Story 3 - See what is stored and download it (Priority: P2)

The pupil or guardian can open "My data" and see, in plain language, what LearnFlow stores (number of lessons,
whether any photos are kept, practice history), and download a copy.

**Why this priority**: Transparency and data portability are legal rights and support trust, but they matter
less than consent and deletion for a first release.

**Independent Test**: With a populated account, open "My data", verify the summary matches stored data, and
download an export that contains all personal data in a readable format.

**Acceptance Scenarios**:

1. **Given** a pupil has lessons, **When** they open "My data", **Then** they see a summary of every category
   of stored data.
2. **Given** the pupil requests an export, **When** it is ready, **Then** it contains their own data
   (source texts, simplified texts, answers, settings) in a common readable format. It does not include
   generated audio that redistributes textbook content beyond the pupil's own use.

---

### User Story 4 - Short retention by default (Priority: P2)

Photos of pages are deleted as soon as they have been processed. Lessons the pupil has not opened
for a long time are deleted automatically, with advance notice.

**Why this priority**: Data minimisation by default reduces risk without the pupil doing anything.

**Independent Test**: Process a photo and verify the photo is gone; simulate inactivity and verify the
notice and deletion.

**Acceptance Scenarios**:

1. **Given** a photo has been processed, **When** the pupil has not chosen "Keep photo", **Then** the photo
   is deleted from all storage.
2. **Given** a lesson has not been opened for the inactivity period, **When** the period is about to expire,
   **Then** the pupil is notified in the app and can keep the lesson.

### Edge Cases

- A pupil gives a false age: the system relies on the stated age but asks again in a neutral way if usage
  strongly suggests otherwise. It never asks for documents.
- The guardian never responds to the consent request: the request expires, and the pupil is told how to ask
  again. No data is processed in the meantime, and the request itself is deleted on expiry.
- The pupil turns 13 while using the app: they are invited to take over consent themselves, and the guardian
  is informed.
- A photo accidentally contains a person's face or another child's work: only the detected page area is
  processed (001), and the full photo is deleted once processed.
- A processor (an OCR or language-model provider) has a security incident: the incident process includes
  notifying the supervisory authority (Datatilsynet) and affected guardians/pupils as required.
- A deletion is requested while the device is offline: on-device data is deleted immediately and server
  deletion is queued and completed on next connection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ask for the pupil's age range at setup, and MUST require verifiable guardian
  consent before processing personal data for pupils under 13.
- **FR-002**: Pupils aged 13 or over MUST be able to use the core flow without registering an account with
  contact details. A pseudonymous profile is enough. Accounts are introduced only for guardian consent,
  cross-device sync or recovery, and only when the pupil or guardian chooses them.
- **FR-003**: System MUST present privacy information in plain language adapted to the pupil's age, with a
  separate fuller version for guardians.
- **FR-004**: System MUST allow consent to be withdrawn as easily as it was given, with processing stopping
  immediately.
- **FR-005**: System MUST process only data needed for the features in use, and MUST NOT include advertising,
  behavioural profiling, or third-party trackers.
- **FR-006**: System MUST ensure that no pupil content is used to train or improve AI models, including by
  providers, through contractual guarantees and configuration.
- **FR-007**: System MUST delete source photos once they have been processed, keeping only tightly cropped
  complex-formula regions needed by the lesson (see 001 FR-028), unless the pupil chooses to keep the full
  photo. Material whose processing has not finished, including pasted text, follows 001 FR-018 (device only,
  deleted after 7 days).
- **FR-008**: System MUST support deletion of single lessons and of the whole account, covering the device,
  LearnFlow storage and all processors.
- **FR-009**: Deletion MUST be completed everywhere within 30 days, including backups, and the pupil MUST be
  told this period.
- **FR-010**: System MUST provide a "My data" overview and an export of the pupil's personal data.
- **FR-011**: System MUST automatically delete lessons not opened for 12 months, after an in-app notice at
  least 30 days in advance.
- **FR-012**: Lessons and source content MUST be private to the pupil. No public sharing links and no sharing
  between pupils (textbook copyright and privacy).
- **FR-013**: Personal data MUST be stored and processed in the EU/EEA, or in a jurisdiction with an adequacy
  decision, with a data processing agreement in place with every processor.
- **FR-014**: System MUST keep an internal log of consent, withdrawal and deletion events sufficient to
  demonstrate compliance. The log itself MUST contain minimal personal data.
- **FR-015**: The data controller and consent model MUST follow the chosen distribution model
  [NEEDS CLARIFICATION: Is LearnFlow offered directly to families, with LearnFlow as data controller and
  guardian consent, or through schools/municipalities, with the school as controller and LearnFlow as
  processor under a data processing agreement, or both? This changes the legal basis, the consent flow and
  account design.]

### Key Entities *(include if feature involves data)*

- **Pupil Profile**: The minimal identity of a pupil: pseudonymous identifier, age range, language
  preferences and consent status. No full name, school or exact birth date is required.
- **Guardian**: A person who consents for a pupil under 13; identified only by what verification requires.
- **Consent Record**: Who consented, for which pupil, to which version of the privacy information, when, and
  any withdrawal.
- **Deletion Request**: Scope (lesson or account), requested time, status per storage location/processor and
  completion time.
- **Data Export**: A generated package of the pupil's personal data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 pages processed for under-13 pupils without a recorded guardian consent, verified by automated
  tests and audit.
- **SC-002**: 100% of deletion requests are completed everywhere within 30 days, verified by periodic audit.
- **SC-003**: At least 85% of guardians in testing complete the consent flow in under 3 minutes and correctly
  answer two questions about what data is stored.
- **SC-004**: 0 third-party tracking requests from the app, verified by network inspection in release testing.
- **SC-005**: A DPIA covering all data flows is completed and approved before the first pilot with real pupils.

## Assumptions

- The age of digital consent in Norway is 13. This feature applies guardian consent below that age.
- Accounts are pseudonymous and avoided where possible (Constitution Principle II). Email or phone is needed
  only for the guardian and for account recovery or sync if chosen.
- The retention periods (30 days for deletion, 12 months of inactivity) are proposed defaults to be confirmed
  in the DPIA.
- Legal review of the privacy texts and consent mechanism will take place before release.
