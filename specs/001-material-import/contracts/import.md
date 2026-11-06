# Import contracts

## Input

A user-triggered paste supplies exact plain text and optional exact HTML, or a supported installed Android share supplies text. Plain-text characters are authoritative; HTML can inform structure but cannot replace or add plain-text characters. Empty or non-text input produces a recoverable error. No background clipboard reads. HTML is untrusted and is never rendered as executable markup. Raw input stays on device until the explicit processing action and required consent.

## Local preparation

Client-side preparation is limited to empty-input checks, word count, local draft persistence and the over-limit route. It does not clean up, segment, classify or alter pasted content. Above 2,000 words, Flash returns a section outline before simplification and the pupil chooses without silent truncation; below 30 words the app warns and allows continuation.

## Handoff to 002

After the pupil action and 006 gate, send the unchanged plain-text value and optional unchanged HTML to the server-side 002 adapter. Gemini Flash cleans and structures the source and simplifies it. The result includes exact source excerpts; the server maps them to plain-text offsets and runs the 002 faithfulness checks before returning it. The server never logs content or persists it; the temporary copy is deleted within 24 hours. 001 retains the local draft for retry. Idempotency keys and source version prevent duplicate or stale results.

## Original and lifecycle

Show original can restore excluded blocks and exclude included sections, but never exclude everything. A changed selection creates a new version and invalidates affected outputs; 002–004 regenerate them. Offline, permission, quota and processing failures have plain-language recovery. Deletion removes local derived material and follows 006 for any processors. Check expiry while active and on startup; delete drafts that expired while closed when the app next opens.
