import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db, type StoredDocument } from '../../src/lib/storage/db';
import { createDraft } from '../../src/lib/storage/drafts';
import { DRAFT_TTL, purgeExpiredDrafts } from '../../src/lib/storage/expiry';
import type { SourceDraft } from '../../src/lib/import/types';

const makeDraft = (id: string, lastActivityAt: number): SourceDraft => ({
	id,
	plainText: 'A saved source',
	title: id,
	createdAt: lastActivityAt,
	lastActivityAt,
	status: 'pending',
	version: 1
});

const makeDocument = (id: string): StoredDocument => ({
	id: `${id}:1`,
	draftId: id,
	version: 1,
	wordCount: 3,
	language: 'en',
	blocks: [{
		id: `${id}-block`,
		type: 'paragraph',
		text: 'A saved source',
		language: 'en',
		spans: [{ representation: 'text/plain', start: 0, end: 14 }],
		included: true
	}]
});

afterEach(async () => {
	await db.delete();
	await db.open();
});

describe('draft expiry lifecycle', () => {
	it('deletes expired source data while the app is open', async () => {
		const now = Date.now();
		await createDraft(makeDraft('active-expired', now - DRAFT_TTL), makeDocument('active-expired'));
		await db.attempts.add({ idempotencyKey: 'active-expired:1', draftId: 'active-expired', sourceVersion: 1, status: 'failed', createdAt: now - DRAFT_TTL });

		expect(await purgeExpiredDrafts(now)).toEqual(['active-expired']);
		expect(await db.drafts.get('active-expired')).toBeUndefined();
		expect(await db.documents.where('draftId').equals('active-expired').count()).toBe(0);
		expect(await db.attempts.where('draftId').equals('active-expired').count()).toBe(0);
	});

	it('deletes expired source data when the app reopens', async () => {
		const now = Date.now();
		await createDraft(makeDraft('reopened-expired', now - DRAFT_TTL - 1), makeDocument('reopened-expired'));

		await db.close();
		await db.open();
		expect(await db.drafts.get('reopened-expired')).toBeDefined();
		expect(await purgeExpiredDrafts(now)).toEqual(['reopened-expired']);
		expect(await db.drafts.get('reopened-expired')).toBeUndefined();
		expect(await db.documents.where('draftId').equals('reopened-expired').count()).toBe(0);
	});
});
