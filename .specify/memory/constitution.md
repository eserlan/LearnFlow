<!--
Sync Impact Report
- Version change: (none) → 1.0.0 (initial ratification)
- Origin: merges the local draft constitution with the draft from PR #1 (docs/initial-spec-kit).
  From PR #1: "test with actual users", respectful (non-childish, non-diagnostic) design, preserving
  relationships and caveats, simplification vs summarisation, audio-first with optional text, avoiding
  unnecessary accounts, progressive complexity, failure handling, and the delivery-gate test matrix.
- Principles: I. Faithful to the Source; II. Child Privacy by Default; III. Independent Learner First;
  IV. Audio and Visual in Concert; V. Accessible, Inclusive and Respectful; VI. Honest, Visible AI;
  VII. Small, Verifiable Slices
- Sections: Child Safety, Legal and Content Constraints; Quality Gates and Development Workflow; Governance
- Templates requiring updates: ⚠ pending. Spec Kit templates (.specify/templates/) are not yet initialised in
  this repository; the Constitution Check in plan-template.md should reference principles I–VII once they are.
- Follow-up TODOs: none
-->

# LearnFlow Constitution

LearnFlow is a mobile-first, audio-visual learning companion that pupils use independently with their own
school materials. These principles are non-negotiable product rules. Every specification, plan, task list and
implementation is measured against them.

## Core Principles

### I. Faithful to the Source (NON-NEGOTIABLE)

The pupil's school material is the authority. LearnFlow makes material easier to take in but never changes
what it says.

- Lesson content (simplified text, summaries, narration, visual cards and questions) MUST NOT introduce facts,
  numbers, names, dates, causal claims or conclusions that are absent from the source material.
- Lesson content MUST preserve the source's key facts, the relationships between them, and its caveats and
  qualifications ("usually", "some scientists think", "around 1850").
- Every statement in lesson content MUST be traceable to one or more passages of the source material.
- Numbers, units, proper names, dates, formulas, scientific and mathematical notation, and curriculum
  vocabulary MUST be preserved exactly as written in the source.
- Simplification and summarisation are different products. A summary MUST be labelled as a summary and MUST
  NOT replace the full simplified lesson.
- **Added help** is any content that goes beyond the source: term explanations, simpler rewordings of a
  concept, examples, and answers to the pupil's own questions. Added help MUST be visibly labelled, MUST NOT
  contradict the source, MUST be kept separate from lesson content, and MUST say so when it draws on general
  knowledge rather than the pupil's material.
- When faithfulness cannot be verified, the system MUST signal the uncertainty and fall back to the extracted
  original text rather than show unverified content.
- LearnFlow MUST NOT silently correct apparent errors in the source; it may flag them.

**Rationale**: Pupils are tested on their curriculum and cannot be expected to detect machine hallucination.
A wrong but fluent simplification does more harm than no simplification.

### II. Child Privacy by Default (NON-NEGOTIABLE)

Users are minors. Their data is collected minimally, kept briefly, never monetised and always deletable.

- Collect only data needed to deliver the feature in use; no advertising, no behavioural profiling, no
  third-party analytics SDKs that track individuals.
- Avoid unnecessary accounts: the core flow MUST NOT require the pupil to register contact details. Accounts
  are introduced only where a feature or legal requirement (such as guardian consent) needs one.
- Material is private by default and MUST NOT leave the device until the pupil takes a clear action to
  process it.
- Children's content (photos, documents, text, audio, questions, answers) MUST NOT be used to train or
  fine-tune models, by LearnFlow or any provider, and provider agreements MUST guarantee this.
- Source photos and files MUST be deleted once extraction is confirmed unless the pupil explicitly chooses to
  keep them.
- Users MUST be able to delete any lesson, and all their data, with deletion completed across all storage and
  processors within a defined, documented period.
- Processing and storage MUST comply with GDPR and the Norwegian Personal Data Act
  (personopplysningsloven), including the rules on the age of digital consent and guardian involvement.
  A Data Protection Impact Assessment (DPIA) MUST exist before any release to real pupils.
- Personal data MUST stay within the EU/EEA, or in a jurisdiction with an adequacy decision, unless a
  documented legal basis exists.

**Rationale**: Minors are a specially protected group under GDPR. Trust from pupils, guardians and schools is
a precondition for the product existing at all.

### III. Independent Learner First

A pupil MUST be able to go from school material to a finished lesson without help from an adult.

- The core flow (capture → review → lesson → resume) MUST be completable unaided by a pupil in the target age
  group on their first attempt. This MUST be verified with actual target-age users, never assumed.
- Progressive complexity: every screen MUST have one obvious next action. Advanced controls and settings are
  optional and MUST NOT be required to complete the core flow.
- Design for a phone held in one hand, in short sessions, in imperfect conditions (poor light, noise,
  intermittent connectivity, interruptions).
- Every error state MUST tell the pupil, in plain language, what happened and offer one obvious way to
  recover. Interruptions and failures MUST NOT cause silent loss of material or progress.
- The product MUST NOT rely on engagement-maximising patterns: no streak pressure, loss framing, leaderboards,
  infinite feeds, forced gamification or manipulative notifications.

**Rationale**: The product's purpose is independent study. If it needs an adult to operate, it has failed.

### IV. Audio and Visual in Concert

Lessons are audio-first, supported by visuals, with text always available. They follow dual-coding
principles.

- Narration and visual cards MUST be synchronised; each card MUST correspond to the narration playing while it
  is shown.
- Neither channel may be required on its own: narration MUST have captions/transcript, and visuals MUST have
  spoken or text descriptions. Text is optional for the pupil but always available.
- Visuals MUST carry meaning tied to the source. Purely decorative imagery is permitted only when clearly
  secondary and never when it could be mistaken for factual content.
- Playback and navigation MUST be predictable: the same controls in the same places, and no automatic jumps
  the pupil did not ask for.
- Lessons MUST be short and segmented; one page of material SHOULD produce a lesson of a few minutes, not a
  long monologue.

**Rationale**: Combined, synchronised audio and visuals improve comprehension and retention, especially for
pupils who struggle with dense text.

### V. Accessible, Inclusive and Respectful by Design

LearnFlow serves pupils with dyslexia, ADHD, autism, visual or hearing impairments, and pupils learning in a
second language, without treating any of them as a diagnosis.

- All user-facing surfaces MUST meet WCAG 2.2 level AA as a minimum.
- Language and visuals MUST be age-appropriate and respectful: plain, but never childish or patronising.
- The product MUST NOT assume a single interface suits a given condition, and MUST NOT ask for or infer
  diagnoses. Preferences (text size, typeface, spacing, motion, density, speed) are offered to everyone,
  without an overwhelming setup.
- The product MUST support Norwegian Bokmål and Nynorsk for both interface and content, and MUST keep the
  source's language variant unless the pupil chooses otherwise.

**Rationale**: The pupils who most need help with school texts are often the ones least well served by
standard tools. Accessibility is part of the core product, not an extra.

### VI. Honest, Visible AI

Pupils and guardians MUST always be able to tell what the machine did.

- AI-generated content (simplified text, narration voice, generated images, questions, added help) MUST be
  identifiable as such.
- Generated explanations MUST NOT be presented as authoritative. Uncertainty MUST be shown, not hidden:
  low-confidence extraction, unverifiable statements and failed checks are surfaced to the pupil in
  understandable terms.
- The pupil MUST always be able to compare generated content with the original source.
- LearnFlow MUST NOT complete graded assignments on the pupil's behalf; it explains source material, it does
  not answer homework tasks.

**Rationale**: Transparency is what makes it safe to rely on the tool, and it supports rather than replaces the
pupil's own learning.

### VII. Small, Verifiable Slices

Build in thin, end-to-end vertical slices that can be demonstrated and measured.

- Each feature MUST be delivered as independently testable user stories, prioritised P1 first, each with
  acceptance scenarios, accessibility checks and defined failure handling.
- Every AI-dependent step (extraction, simplification, narration, visuals, questions, added help) MUST have an
  automated evaluation suite with a fixed reference set of real Norwegian school material, and quality
  thresholds that block release when not met.
- Choose the simplest approach that meets the principles above; added complexity must be justified in the
  plan's Complexity Tracking.

**Rationale**: AI quality regresses silently. Only measured, small increments keep faithfulness and privacy
guarantees credible.

## Child Safety, Legal and Content Constraints

- **Copyright**: School material is processed for the individual pupil's private study only. Lessons MUST NOT
  be publicly shareable, publishable or exportable in a form that redistributes textbook content. Licensing
  with publishers is resolved before any shared-content feature is considered.
- **Content safety**: Generated text and images MUST pass safety filtering appropriate for minors. Generated
  images MUST NOT depict real, identifiable people.
- **Provider selection**: OCR, language-model, speech and image providers MUST be assessed against
  Principle II (data residency, no training on inputs, deletion guarantees, data processing agreement) before
  adoption. Cost per lesson MUST be tracked as a planning constraint.
- **Age range**: Unless a specification states otherwise, users are pupils aged roughly 10–16 (Norwegian
  grades 5–10). Teenagers are the primary design audience. Guardian consent rules apply to users below the age
  of digital consent in Norway (13).

## Quality Gates and Development Workflow

- Follow the Spec Kit flow per feature: specify → clarify → plan → tasks → implement.
- Every plan MUST include a Constitution Check against principles I–VII; violations block progress unless
  justified and approved in Complexity Tracking.
- Feature 007 (accessible, child-centred design) applies as cross-cutting constraints to every other feature.
  Its requirements are acceptance criteria for all user-facing work.
- Release gates for any build used by real pupils:
  1. Faithfulness evaluation meets the thresholds set in feature 002, on representative Norwegian school
     material including factual, mathematical and scientific notation.
  2. Extraction evaluation meets the thresholds set in feature 001.
  3. Changed screens pass testing with screen readers, keyboard navigation, mobile touch, reduced motion,
     text scaling and contrast, on real devices.
  4. Recovery from interruptions (connectivity loss, app restart, incoming calls) is tested for the changed
     flows, with no silent loss of material or progress.
  5. The DPIA is current and covers every data flow in the release.
  6. Deletion has been verified end to end for every new data store or processor.
- Reviews MUST verify compliance with this constitution; reviewers reject changes that weaken a
  NON-NEGOTIABLE principle regardless of other merit.

## Governance

- This constitution supersedes all other practices, specifications and plans. Where a specification
  conflicts with it, the constitution wins and the specification is amended.
- Amendments require a written proposal stating the change, its rationale and its impact on existing
  specifications, plus approval from the product owner. Changes to Principles I or II also require review by
  whoever is accountable for data protection.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR for adding a
  principle or materially expanding guidance, PATCH for clarifications and wording.
- Compliance is reviewed at every plan's Constitution Check and before each release.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05
