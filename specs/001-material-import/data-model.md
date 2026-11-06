# Data model: pasted material

- **SourceDraft**: `id`, exact local raw plain text and optional raw HTML, origin label and title, `createdAt`, `lastActivityAt`, `status` and current result version. One draft contains one pasted source. States: pending → processing → processed; failed/interrupted → retry or discard; inactive → expired after seven days. Drafts are local and deletion cascades to associated source data.
- **SourceDocument**: model-produced cleaned source and structured blocks, draft ID, version, selected word count and detected main language. A selection change creates a version; no empty selection and no silent cut above 2,000 words.
- **SourceBlock**: stable ID, document version, ordered type, model-produced cleaned content, language/variant or uncertainty, inclusion state and reason, optional inline emphasis ranges, and exact source excerpts. Server validation maps excerpts to character ranges in the authoritative plain text; unverified offsets are never trusted.
- **ProcessingAttempt**: locally stored draft ID, source version, stable idempotency key, state and retry metadata. Never store source content in logs. A changed source version invalidates affected derived sections; downstream responses for stale versions are discarded.

The detailed schema and migration strategy are implementation tasks. No provider or server stores drafts by design; any temporary processor copy must meet the 24-hour requirement in 001 and the stronger provider agreements in 006.
