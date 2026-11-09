import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { db, type StoredLesson } from '../db';
import { createDraft } from '../drafts';
import { getLessonAudio } from '../audio';
import { LESSON_TTL, purgeExpiredLessons, setLessonPinned, touchLesson } from '../lessons';
import type { SourceDraft } from '../../import/types';

const now = Date.now();
const makeDraft = (id: string, at = now): SourceDraft => ({
  id, title: id, plainText: 'Some source text', createdAt: at, lastActivityAt: at,
  status: 'processed', version: 1
});
const makeLesson = (id: string, at = now, pinned = false): StoredLesson => ({
  id: id + ':1', draftId: id, sourceVersion: 1, title: id,
  createdAt: at, lastAccessedAt: at, pinned,
  sentences: [{ text: 'Simplified.', kind: 'statement', sources: ['original'] }]
});
async function addLesson(id: string, at = now, pinned = false) {
  await createDraft(makeDraft(id, at), {
    id: id + ':1', draftId: id, version: 1, wordCount: 3, language: 'en',
    blocks: [{ id: 'b', type: 'paragraph', text: 'Some source text',
      spans: [], included: true, language: 'en' }]
  });
  const lesson = makeLesson(id, at, pinned);
  await db.lessons.put(lesson);
  return lesson;
}

afterEach(async () => {
  await db.delete();
  await db.open();
});

describe('saved lesson retention', () => {
  it('deletes lessons at 30 days but leaves recently used and pinned lessons alone', async () => {
    const expired = await addLesson('expired', now - LESSON_TTL);
    await addLesson('recent', now - LESSON_TTL + 1);
    await addLesson('pinned', now - LESSON_TTL - 10, true);
    await db.attempts.put({ idempotencyKey: 'expired:1', draftId: 'expired',
      sourceVersion: 1, status: 'complete', createdAt: now - LESSON_TTL });
    await db.audioAssets.put({ id: expired.id, draftId: 'expired', storage: 'indexeddb',
      createdAt: now - LESSON_TTL, blob: new Blob(['test'], { type: 'audio/wav' }) });

    expect(await purgeExpiredLessons(now)).toEqual(['expired:1']);
    expect(await db.lessons.get(expired.id)).toBeUndefined();
    expect(await db.drafts.get('expired')).toBeUndefined();
    expect(await db.documents.where('draftId').equals('expired').count()).toBe(0);
    expect(await db.attempts.where('draftId').equals('expired').count()).toBe(0);
    expect(await db.audioAssets.get(expired.id)).toBeUndefined();
    expect(await getLessonAudio(expired.id)).toBeNull();
    expect(await db.drafts.get('recent')).toBeDefined();
    expect(await db.lessons.get('pinned:1')).toBeDefined();
  });

  it('opening or replaying renews inactivity, while pinning protects and unpinning renews it', async () => {
    const original = await addLesson('keep', now - LESSON_TTL + 500);
    expect((await touchLesson(original.id, now))?.lastAccessedAt).toBe(now);
    expect(await purgeExpiredLessons(now + LESSON_TTL - 1)).toEqual([]);
    const pinned = await setLessonPinned(original.id, true, now + 1);
    expect(pinned?.pinned).toBe(true);
    expect(await purgeExpiredLessons(now + LESSON_TTL * 3)).toEqual([]);
    const unpinned = await setLessonPinned(original.id, false, now + LESSON_TTL * 3);
    expect(unpinned?.lastAccessedAt).toBe(now + LESSON_TTL * 3);
    expect(await purgeExpiredLessons(now + LESSON_TTL * 4 - 1)).toEqual([]);
    expect(await purgeExpiredLessons(now + LESSON_TTL * 4)).toEqual([original.id]);
  });

  it('does not delete a lesson being read or played even if its expiry has passed', async () => {
    const first = await addLesson('reading', now - LESSON_TTL - 1);
    const second = await addLesson('playing', now - LESSON_TTL - 1);
    expect(await purgeExpiredLessons(now, [first.id, second.id])).toEqual([]);
    expect(await db.lessons.count()).toBe(2);
    expect(await purgeExpiredLessons(now, [first.id])).toEqual([second.id]);
    expect(await db.lessons.get(first.id)).toBeDefined();
  });

  it('preserves a shared source when another lesson from that source remains', async () => {
    const old = await addLesson('shared', now - LESSON_TTL);
    await db.lessons.put({ ...makeLesson('shared', now, true), id: 'shared:extra' });
    expect(await purgeExpiredLessons(now)).toEqual([old.id]);
    expect(await db.drafts.get('shared')).toBeDefined();
    expect(await db.documents.where('draftId').equals('shared').count()).toBe(1);
  });

  it('grants pre-existing lessons a full new retention period on the Dexie v4 upgrade', async () => {
    await db.delete();
    const legacy = new Dexie('learnflow');
    legacy.version(1).stores({
      drafts: 'id, status, lastActivityAt',
      documents: 'id, draftId, version',
      attempts: 'idempotencyKey, draftId, sourceVersion, status'
    });
    legacy.version(2).stores({ lessons: 'id, draftId, sourceVersion, createdAt' });
    legacy.version(3).stores({ audioAssets: 'id, draftId, createdAt' });
    const { lastAccessedAt: _lastAccessedAt, pinned: _pinned, ...record } =
      makeLesson('legacy', now - LESSON_TTL * 3);
    await legacy.table('lessons').put(record);
    legacy.close();

    await db.open();
    const migrated = await db.lessons.get('legacy:1');
    expect(migrated?.pinned).toBe(false);
    expect(migrated?.lastAccessedAt).toBeGreaterThanOrEqual(now);
    expect(await purgeExpiredLessons(Date.now())).toEqual([]);
  });
});
