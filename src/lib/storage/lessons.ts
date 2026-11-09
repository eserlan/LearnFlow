import { db, type StoredLesson } from './db';
import { deleteAudioForLesson } from './audio';

const DAY = 24 * 60 * 60 * 1000;
export const LESSON_TTL = 30 * DAY;

function isExpired(lesson: StoredLesson, now: number): boolean {
  return lesson.pinned !== true &&
    now - (lesson.lastAccessedAt ?? lesson.createdAt) >= LESSON_TTL;
}

/** Only an intentional open or playback updates the last-access timestamp. */
export async function touchLesson(id: string, now = Date.now()): Promise<StoredLesson | undefined> {
  return db.transaction('rw', db.lessons, async () => {
    const lesson = await db.lessons.get(id);
    if (!lesson) return undefined;
    const updated = { ...lesson, lastAccessedAt: Math.max(lesson.lastAccessedAt ?? lesson.createdAt, now) };
    await db.lessons.put(updated);
    return updated;
  });
}

/** Unpinning also renews the 30-day window so it cannot expire immediately. */
export async function setLessonPinned(id: string, pinned: boolean, now = Date.now()): Promise<StoredLesson | undefined> {
  return db.transaction('rw', db.lessons, async () => {
    const lesson = await db.lessons.get(id);
    if (!lesson) return undefined;
    const updated = { ...lesson, pinned, lastAccessedAt: Math.max(lesson.lastAccessedAt ?? lesson.createdAt, now) };
    await db.lessons.put(updated);
    return updated;
  });
}

/**
 * Clean up saved lessons on the device; never send lesson content to a server.
 * Active/playing lessons are protected by the caller. A record is rechecked in
 * the write transaction to avoid deleting a lesson that was accessed or pinned
 * after the initial scan.
 */
export async function purgeExpiredLessons(now = Date.now(), protectedIds: readonly string[] = []): Promise<string[]> {
  const protectedSet = new Set(protectedIds);
  const candidates = (await db.lessons.toArray())
    .filter((lesson) => !protectedSet.has(lesson.id) && isExpired(lesson, now));
  const deleted: string[] = [];
  for (const candidate of candidates) {
    const removed = await db.transaction('rw', db.drafts, db.documents, db.attempts, db.lessons, async () => {
      const current = await db.lessons.get(candidate.id);
      if (!current || protectedSet.has(current.id) || !isExpired(current, now)) return false;
      await db.lessons.delete(current.id);
      const remaining = await db.lessons.where('draftId').equals(current.draftId).count();
      const source = await db.drafts.get(current.draftId);
      // Don't delete newer versions, unfinished work, or another lesson's source.
      if (!remaining && source?.status === 'processed' && source.version === current.sourceVersion) {
        await db.drafts.delete(current.draftId);
        await db.documents.where('draftId').equals(current.draftId).delete();
        await db.attempts.where('draftId').equals(current.draftId).delete();
      }
      return true;
    });
    if (removed) {
      await deleteAudioForLesson(candidate.id);
      deleted.push(candidate.id);
    }
  }
  return deleted;
}
