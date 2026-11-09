import { db, type StoredLesson, type StoredAudio } from './db';

const DIRECTORY = 'learnflow-audio';
const fileName = (lessonId: string) => encodeURIComponent(lessonId) + '.wav';

async function audioDirectory(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIRECTORY, { create });
  } catch { return null; }
}

async function removeOpfs(id: string): Promise<void> {
  const dir=await audioDirectory(false);
  if (!dir) return;
  try { await dir.removeEntry(fileName(id)); } catch { /* Already removed or unavailable. */ }
}

/** A saved lesson has one local audio file. Never upload it to server storage. */
export async function storeLessonAudio(lesson: StoredLesson, blob: Blob): Promise<void> {
  if (blob.type !== 'audio/wav' || blob.size < 44 || blob.size > 24*1024*1024) {
    throw new Error('Unsupported audio file');
  }
  const current=await db.lessons.get(lesson.id);
  if (!current || current.sourceVersion !== lesson.sourceVersion ||
      current.draftId !== lesson.draftId) throw new Error('Lesson changed before audio could be saved');

  let saved: StoredAudio={
    id:lesson.id, draftId:lesson.draftId, createdAt:Date.now(), storage:'indexeddb', blob
  };
  const dir=await audioDirectory(true);
  if (dir) {
    try {
      const handle=await dir.getFileHandle(fileName(lesson.id),{create:true});
      const stream=await handle.createWritable();
      await stream.write(blob);
      await stream.close();
      saved={id:lesson.id,draftId:lesson.draftId,createdAt:Date.now(),storage:'opfs'};
    } catch {
      await removeOpfs(lesson.id);
    }
  }
  try {
    // Recheck after async file writes to avoid restoring stale lessons.
    const latest=await db.lessons.get(lesson.id);
    if (!latest || latest.sourceVersion !== lesson.sourceVersion ||
        latest.draftId !== lesson.draftId) throw new Error('Lesson changed before audio could be saved');
    await db.audioAssets.put(saved);
  } catch (error) {
    if (saved.storage==='opfs') await removeOpfs(lesson.id);
    throw error;
  }
}

/** Returns a play-ready Blob on reopen, even when the user is offline. */
export async function getLessonAudio(lessonId: string): Promise<Blob | null> {
  const [lesson,meta]=await Promise.all([db.lessons.get(lessonId), db.audioAssets.get(lessonId)]);
  if (!lesson || !meta) return null;
  if (meta.storage==='indexeddb') return meta.blob ?? null;
  const dir=await audioDirectory(false);
  if (!dir) return null;
  try {
    const handle=await dir.getFileHandle(fileName(lessonId));
    const file=await handle.getFile();
    return file.size >= 44 ? file : null;
  } catch { return null; }
}

/** Ids of the lessons that have saved audio, so the lesson list can offer a play button without loading files. */
export async function listLessonIdsWithAudio(): Promise<string[]> {
  const [ids, lessons] = await Promise.all([
    db.audioAssets.toCollection().primaryKeys(), db.lessons.toCollection().primaryKeys()
  ]);
  const existing = new Set(lessons.map(String));
  return ids.map(String).filter((id) => existing.has(id));
}

/** Remove one lesson's audio without affecting other lessons from the same source. */
export async function deleteAudioForLesson(lessonId: string): Promise<void> {
  const asset = await db.audioAssets.get(lessonId);
  if (!asset) return;
  if (asset.storage === 'opfs') await removeOpfs(lessonId);
  await db.audioAssets.delete(lessonId);
}

/** Also used on editing, explicit deletion, and the seven-day draft expiry. */
export async function deleteAudioForDraft(draftId: string): Promise<void> {
  const assets=await db.audioAssets.where('draftId').equals(draftId).toArray();
  for (const asset of assets) await deleteAudioForLesson(asset.id);
}
