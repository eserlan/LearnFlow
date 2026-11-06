# Validation guide

## Local commands

Install dependencies with `bun install`, start the development server with `bun run dev`, and run checks with `bun run check`, `bun run test:unit`, `bun run test:integration`, `bun run test` (both suites), `bun run test:browser`, and `bun run build`.

Automated unit, integration and desktop Chromium suites cover exact clipboard preservation, storage lifecycle, the injected raw-input handoff boundary and basic paste/recovery interface. No production Flash call is enabled until the 006 consent and server-verification path is implemented. iOS Safari, Android Chrome, full accessibility, privacy, reviewed-fixture, consent and production end-to-end checks below remain release work and have not been completed.

1. Paste reviewed rich and plain fixtures from textbooks, webpages and copied PDFs. Compare exact original content, safe structure, source spans, excluded furniture and notation against reviewed references. Measure SC-001–003 and SC-005; include tables, genuine hyphens, x2/CO2, exercises, mixed languages and malicious markup.
2. Exercise empty input, unsupported languages, under 30 words, over 2,000 words, duplicate paste, storage failure, offline interruption, retry and source replacement. Confirm no silent loss, duplication, early network send or content in logs/URLs. Verify consent before off-device processing.
3. Restore excluded content and toggle sections in Show original. Verify versioning, source links and affected text/audio regeneration, including stale response handling.
4. Test native paste on current iOS Safari, Android Chrome and desktop. On installed Android test the share target, including worker-unavailable and offline paths; verify no source text leaks to a URL, logs or unapproved server. Check 200% zoom, keyboard, VoiceOver/TalkBack, contrast and reduced motion.
5. Verify seven-day inactivity expiry, warning and deletion while active and on reopening after expiry, including device restart and storage eviction.
6. Run moderated first-use sessions with target-age pupils and assess SC-004. Before release, review and expand the golden dataset, verify 002–004 integration and faithfulness gates, and complete 006 consent, processor, deletion and DPIA checks.
