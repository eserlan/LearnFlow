# Research: pasted material import

## Clipboard and sharing

**Decision:** Prefer the native paste event and a labelled editable target, capturing `text/plain` and `text/html` when provided. Optional programmatic clipboard read must handle permission denial and lack of support. Android share-target support is conditional on real-device privacy and recovery verification. **Rationale:** browser clipboard access differs and can require user activation or permission. **Alternative:** assume one-tap programmatic reads everywhere; rejected as unreliable. See [paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event), [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), [Web Share Target](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target).

## Source representation

**Decision:** Keep exact plain-text and optional HTML clipboard payloads locally. Send both unchanged to Gemini Flash after the explicit pupil action and 006 consent gate. Plain text is authoritative for characters; HTML can inform structure. Flash handles cleanup and structure. The server validates exact source excerpts and the 002 faithfulness result; clipboard HTML is never rendered. This replaces the earlier local-parser decision in the initial implementation plan, following the user's direction to give the copied text to Flash.

## Local storage and lifecycle

**Decision:** Dexie/IndexedDB transactions for drafts, blocks, versioning and idempotency, following ADR-0001. Check expiry while active and on startup; delete drafts that expired while closed when the app next opens. Request persistent storage when possible, handle quota/eviction and make limits visible. **Alternative:** memory-only state loses interrupted work. Browser background execution is not assumed.

## Detection and evaluation

**Decision:** Use Gemini Flash for cleanup, structure and language classification, with deterministic validation for source mapping and 002 faithfulness. Preserve the exact input locally and reject output that cannot be mapped or verified. The local-first boundary applies to storage and transfer gates; it does not require local-language processing. Reference fixtures must be reviewed and expanded for grade, layout, language and copied PDF coverage. Existing NDLA importer is useful for fixture generation but is not a production parser or ground truth.

**Superseded implementation diagnostic (2026-11-06):** The initial local clue-word plus `franc-min` detector matched labels on the ten draft NDLA fixtures, but those fixtures were also used during implementation and this is not held-out accuracy or release evidence. The user has since directed source cleanup and language classification to Gemini Flash. T012 now requires a held-out evaluation of Flash extraction/classification, including short and mixed passages; the local detector result is not a release measure.

## Accessibility and security

**Decision:** Native labelled controls, semantic headings, status announcements, visible focus and real-device screen-reader testing; reject active HTML and avoid content in logs or URLs. The modern-web-guidance accessibility, security and privacy guides were consulted. No third-party analytics or speculative data collection.
