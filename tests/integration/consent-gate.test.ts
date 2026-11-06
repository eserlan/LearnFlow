import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/lib/storage/db';
import { createDraft } from '../../src/lib/storage/drafts';
import { simplifyDraft } from '../../src/lib/lesson/handoff';
import type { SourceDraft } from '../../src/lib/import/types';

afterEach(async () => {
	await db.delete();
	await db.open();
});

describe('consent gate integration', () => {
	it('keeps pasted material local when consent is denied or cannot be checked', async () => {
		const draft: SourceDraft = {
			id: 'consent-denied',
			plainText: 'A private source text',
			title: 'Source',
			createdAt: Date.now(),
			lastActivityAt: Date.now(),
			status: 'pending',
			version: 1
		};
		const document = {
			id: `${draft.id}:1`,
			draftId: draft.id,
			version: 1,
			wordCount: 4,
			language: 'en',
			blocks: [{
				id: 'source-block',
				type: 'paragraph' as const,
				text: draft.plainText,
				language: 'en' as const,
				spans: [{ representation: 'text/plain' as const, start: 0, end: draft.plainText.length }],
				included: true
			}]
		};
		await createDraft(draft, document);
		const processor = { simplify: vi.fn() };

		await expect(simplifyDraft(draft.id, { canProcess: async () => false }, processor))
			.rejects.toMatchObject({ code: 'consent-required' });
		await expect(simplifyDraft(draft.id, { canProcess: async () => { throw new Error('offline'); } }, processor))
			.rejects.toMatchObject({ code: 'consent-required' });

		expect(processor.simplify).not.toHaveBeenCalled();
		expect(await db.attempts.count()).toBe(0);
		expect((await db.drafts.get(draft.id))?.plainText).toBe(draft.plainText);
	});
});
