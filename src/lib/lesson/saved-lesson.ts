import { db, type StoredLesson } from '../storage/db';
import type { SimplificationResult } from './handoff';

type Sentence = StoredLesson['sentences'][number];
const kinds = new Set(['heading','statement','list-item','task','quote']);

/** Strict client validation: never mistake a smoke fixture or bad model data for a lesson. */
export function getVerifiedSentences(response: SimplificationResult): Sentence[] | null {
  if (!response.verified || !response.result || typeof response.result !== 'object') return null;
  const value = response.result as Record<string, unknown>;
  if (value.kind !== 'simplified-lesson' || value.schemaVersion !== 1 ||
      !Array.isArray(value.sentences) || value.sentences.length < 1 || value.sentences.length > 180) return null;
  const result: Sentence[] = [];
  for (const item of value.sentences) {
    if (!item || typeof item !== 'object') return null;
    const x = item as Record<string, unknown>;
    if (typeof x.text !== 'string' || !x.text.trim() || x.text.length > 700 ||
      typeof x.kind !== 'string' || !kinds.has(x.kind) ||
      !Array.isArray(x.sources) || x.sources.length !== 1 || x.sources[0] !== 'original') return null;
    result.push({text:x.text,kind:x.kind as Sentence['kind'],sources:['original']});
  }
  return result;
}

export async function saveVerifiedLesson(draftId: string, response: SimplificationResult, outputLanguage?: 'en'): Promise<StoredLesson> {
  const sentences = getVerifiedSentences(response);
  if (!sentences) throw new Error('The AI result is not a verified lesson.');
  return db.transaction('rw', db.drafts, db.lessons, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft || draft.version !== response.sourceVersion || draft.status !== 'processed')
      throw new Error('The source changed before the lesson could be saved.');
    const lesson: StoredLesson = {
      id: draft.id + ':' + draft.version,
      draftId: draft.id,
      sourceVersion: draft.version,
      title: draft.title,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      pinned: false,
      ...(outputLanguage ? { outputLanguage } : {}),
      sentences
    };
    await db.lessons.put(lesson);
    return lesson;
  });
}
