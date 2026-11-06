import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareSource } from '../../src/lib/import/prepare';
import { db } from '../../src/lib/storage/db';
import { createDraft } from '../../src/lib/storage/drafts';
import { simplifyDraft } from '../../src/lib/lesson/handoff';
import type { SourceDraft } from '../../src/lib/import/types';

afterEach(async () => { await db.delete(); await db.open(); });

describe('local paste flow', () => {
	it('recovers from empty text and leaves language classification to Flash', () => {
		expect(() => prepareSource({ plainText: '' })).toThrow(/No text found/);
		const spanish = prepareSource({ plainText: 'Este texto habla sobre los animales y las plantas del bosque.' });
		expect(spanish.language).toBe('uncertain');
		expect(spanish.plainText).toBe('Este texto habla sobre los animales y las plantas del bosque.');
	});

	it('allows short uncertain text and requires section selection above 2,000 words', () => {
		expect(prepareSource({ plainText: 'Dette er bra' }).warnings.length).toBeGreaterThan(0);
		const large = prepareSource({ plainText: Array.from({ length: 2001 }, (_, i) => `term${i}`).join(' ') });
		expect(large.needsSectionChoice).toBe(true);
		expect(large.wordCount).toBe(2001);
		expect(large.blocks.map((block) => block.text).join(' ')).toContain('term2000');
	});

	it('keeps repeated pastes as separate sources and leaves source notation unchanged', async () => {
		const source = 'CO2 is used by plants.';
		const first = prepareSource({ plainText: source, html: '<p>CO<sub>2</sub> is used by plants.</p>' });
		const second = prepareSource({ plainText: source });
		expect(first.blocks[0].text).toBe(source);
		expect(second.blocks[0].text).toBe(source);
		const draft = (id: string): SourceDraft => ({ id, plainText: source, title: source, createdAt: Date.now(), lastActivityAt: Date.now(), status: 'pending', version: 1 });
		await createDraft(draft('paste-a'), { id: 'paste-a:1', draftId: 'paste-a', version: 1, blocks: first.blocks, wordCount: first.wordCount, language: first.language });
		await createDraft(draft('paste-b'), { id: 'paste-b:1', draftId: 'paste-b', version: 1, blocks: second.blocks, wordCount: second.wordCount, language: second.language });
		expect(await db.drafts.count()).toBe(2);
	});

	it('keeps failed offline processing local and permits an explicit retry', async () => {
		const prepared = prepareSource({ plainText: 'This is an English source text for learning.' });
		const draft: SourceDraft = { id: 'offline', plainText: 'This is an English source text for learning.', title: 'Source', createdAt: Date.now(), lastActivityAt: Date.now(), status: 'pending', version: 1 };
		await createDraft(draft, { id: 'offline:1', draftId: draft.id, version: 1, blocks: prepared.blocks, wordCount: prepared.wordCount, language: prepared.language });
		const fail = { simplify: vi.fn(async () => { throw new Error('offline'); }) };
		await expect(simplifyDraft(draft.id, { canProcess: async () => true }, fail)).rejects.toThrow('offline');
		expect((await db.drafts.get(draft.id))?.status).toBe('failed');
		expect((await db.attempts.get('offline:1'))?.status).toBe('failed');
		const retry = { simplify: async (request: { sourceVersion: number }) => ({ sourceVersion: request.sourceVersion, verified: true, result: 'ready' }) };
		expect((await simplifyDraft(draft.id, { canProcess: async () => true }, retry)).result).toBe('ready');
		expect((await db.drafts.get(draft.id))?.status).toBe('processed');
	});
});
