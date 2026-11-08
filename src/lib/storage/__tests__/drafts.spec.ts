import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { createDraft, deleteDraft, saveAttempt, saveDraftVersion, updateSelection } from '../drafts';
import { purgeExpiredDrafts, shouldWarnExpiry, DRAFT_TTL } from '../expiry';
import type { SourceDraft } from '../../import/types';

const draft = (id: string, lastActivityAt = Date.now()): SourceDraft => ({ id, plainText: 'One two', title: id, createdAt: lastActivityAt, lastActivityAt, status: 'pending', version: 1 });
const doc = (id: string) => ({ id: `${id}:1`, draftId: id, version: 1, wordCount: 2, language: 'en', blocks: [
  { id: 'a', type: 'paragraph' as const, text: 'One', language: 'en' as const, spans: [{ representation: 'text/plain' as const, start: 0, end: 3 }], included: true },
  { id: 'b', type: 'paragraph' as const, text: 'two', language: 'en' as const, spans: [{ representation: 'text/plain' as const, start: 4, end: 7 }], included: true }
] });

afterEach(async () => { await db.delete(); await db.open(); });

describe('draft lifecycle', () => {
  it('creates a draft atomically and refuses duplicate ids', async () => {
    await createDraft(draft('d1'), doc('d1'));
    await expect(createDraft(draft('d1'), doc('d1'))).rejects.toThrow('Draft already exists');
    expect(await db.documents.count()).toBe(1);
  });
  it('requires source text and at least one selected block', async () => {
    await expect(createDraft({ ...draft('empty'), plainText: ' ' }, doc('empty'))).rejects.toThrow('pasted text');
    const allExcluded = doc('excluded');
    allExcluded.blocks.forEach((block) => { block.included = false; });
    await expect(createDraft(draft('excluded'), allExcluded)).rejects.toThrow('selected section');
    await createDraft(draft('valid'), doc('valid'));
    await expect(updateSelection('valid', ['unknown'], 1)).rejects.toThrow('unknown section');
  });
  it('deduplicates attempts and removes draft data on deletion', async () => {
    await createDraft(draft('d2'), doc('d2'));
    const attempt = { idempotencyKey: 'k', draftId: 'd2', sourceVersion: 1, status: 'pending' as const, createdAt: Date.now() };
    expect(await saveAttempt(attempt)).toBe(true);
    expect(await saveAttempt(attempt)).toBe(false);
    await db.attempts.update('k', { status: 'failed' });
    expect(await saveAttempt(attempt)).toBe(true);
    await deleteDraft('d2');
    expect(await db.drafts.count()).toBe(0);
    expect(await db.documents.count()).toBe(0);
    expect(await db.attempts.count()).toBe(0);
  });
  it('creates a new version on selection and rejects empty selections', async () => {
    await createDraft(draft('d3'), doc('d3'));
    const next = await updateSelection('d3', ['b'], 1);
    expect(next.version).toBe(2);
    expect(next.blocks.map((b) => b.included)).toEqual([false, true]);
    expect((await db.drafts.get('d3'))?.status).toBe('pending');
    await expect(updateSelection('d3', [], 0)).rejects.toThrow('Select at least one section');
  });
  it('saves resumed draft versions atomically and rejects stale versions', async () => {
    await createDraft(draft('d4'), doc('d4'));
    const base = doc('d4');
    expect(await saveDraftVersion('d4', 1, {
      blocks: base.blocks,
      wordCount: base.wordCount,
      language: base.language
    }, { title: 'Updated', origin: undefined, plainText: 'Edited one two', html: '<p>Edited one two</p>' })).toBe(2);
    expect((await db.drafts.get('d4'))?.title).toBe('Updated');
    expect((await db.drafts.get('d4'))?.plainText).toBe('Edited one two');
    expect((await db.drafts.get('d4'))?.html).toBe('<p>Edited one two</p>');
    await expect(saveDraftVersion('d4', 1, {
      blocks: base.blocks,
      wordCount: base.wordCount,
      language: base.language
    }, { title: 'Stale', origin: undefined })).rejects.toThrow('Stale source version');
    expect((await db.drafts.get('d4'))?.version).toBe(2);
  });
  it('purges expired drafts on invocation and warns only in the final two days', async () => {
    const now = Date.now();
    await createDraft(draft('expired', now - DRAFT_TTL - 1), doc('expired'));
    await createDraft(draft('soon', now - DRAFT_TTL + 1), doc('soon'));
    expect(shouldWarnExpiry(now - DRAFT_TTL + 1, now)).toBe(true);
    expect(await purgeExpiredDrafts(now)).toEqual(['expired']);
    expect(await db.drafts.get('soon')).toBeDefined();
  });
});
