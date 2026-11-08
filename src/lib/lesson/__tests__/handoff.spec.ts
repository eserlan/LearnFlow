import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, type StoredDocument } from '../../storage/db';
import { createDraft } from '../../storage/drafts';
import { simplifyDraft, HandoffError } from '../handoff';
import type { SourceDraft } from '../../import/types';

const sourceDraft = (id: string): SourceDraft => ({
	id,
	plainText: 'A source text',
	title: 'Source',
	createdAt: Date.now(),
	lastActivityAt: Date.now(),
	status: 'pending',
	version: 1
});

const sourceDocument = (id: string): StoredDocument => ({
	id: `${id}:1`, draftId: id, version: 1, wordCount: 3, language: 'en',
	blocks: [{ id: 'block-1', type: 'paragraph' as const, text: 'A source text', language: 'en' as const,
		spans: [{ representation: 'text/plain' as const, start: 0, end: 13 }], included: true }]
});

afterEach(async () => { await db.delete(); await db.open(); });

describe('simplification handoff boundary', () => {
	it('fails closed when consent is missing or cannot be checked', async () => {
		await createDraft(sourceDraft('denied'), sourceDocument('denied'));
		const processor = { simplify: vi.fn() };
		await expect(simplifyDraft('denied', { canProcess: async () => false }, processor))
			.rejects.toMatchObject({ code: 'consent-required' });
		await expect(simplifyDraft('denied', { canProcess: async () => { throw new Error('offline'); } }, processor))
			.rejects.toMatchObject({ code: 'consent-required' });
		expect(processor.simplify).not.toHaveBeenCalled();
		expect(await db.attempts.count()).toBe(0);
	});

	it('sends unmodified plain text while retaining rich HTML locally', async () => {
		const draft = sourceDraft('allowed');
		draft.plainText = 'A source\r\nwith exact line breaks';
		draft.html = '<h1>A source</h1><p>with <strong>exact</strong> line breaks</p>';
		await createDraft(draft, sourceDocument('allowed'));
		const processor = { simplify: vi.fn(async (request) => ({ sourceVersion: request.sourceVersion, verified: true, result: 'lesson' })) };
		const result = await simplifyDraft('allowed', { canProcess: async () => true }, processor);
		expect(result.result).toBe('lesson');
		expect(processor.simplify).toHaveBeenCalledWith(expect.objectContaining({
			plainText: 'A source\r\nwith exact line breaks'
		}));
		expect(processor.simplify.mock.calls[0][0]).not.toHaveProperty('html');
		expect((await db.drafts.get('allowed'))?.html)
			.toBe('<h1>A source</h1><p>with <strong>exact</strong> line breaks</p>');
		expect((await db.drafts.get('allowed'))?.status).toBe('processed');
		await expect(simplifyDraft('allowed', { canProcess: async () => true }, processor))
			.rejects.toMatchObject({ code: 'duplicate-attempt' });
	});

	it('rejects stale and unverified responses and marks attempts retryable', async () => {
		await createDraft(sourceDraft('stale'), sourceDocument('stale'));
		const staleProcessor = { simplify: async () => {
			await db.drafts.update('stale', { version: 2 });
			return { sourceVersion: 1, verified: true, result: 'obsolete' };
		} };
		await expect(simplifyDraft('stale', { canProcess: async () => true }, staleProcessor))
			.rejects.toMatchObject({ code: 'stale-source' });
		expect((await db.attempts.get('stale:1'))?.status).toBe('failed');

		await createDraft(sourceDraft('unverified'), sourceDocument('unverified'));
		const unverified = { simplify: async () => ({ sourceVersion: 1, verified: false, result: 'bad' }) };
		await expect(simplifyDraft('unverified', { canProcess: async () => true }, unverified))
			.rejects.toBeInstanceOf(HandoffError);
		expect((await db.drafts.get('unverified'))?.status).toBe('failed');
	});
});
