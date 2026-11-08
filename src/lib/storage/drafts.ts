import { db, type StoredDocument } from './db';
import type { ProcessingAttempt, SourceDraft } from '../import/types';

function assertSelectableDocument(blocks: StoredDocument['blocks']): void {
  if (!blocks.length || !blocks.some((block) => block.included)) {
    throw new Error('A source document must contain at least one selected section');
  }
}

export async function createDraft(draft: SourceDraft, document?: StoredDocument): Promise<void> {
	if (document && (document.draftId !== draft.id || document.version !== draft.version)) throw new Error('Draft/document mismatch');
  if (!draft.plainText.trim()) throw new Error('A source draft must contain pasted text');
	if (document) assertSelectableDocument(document.blocks);
  await db.transaction('rw', db.drafts, db.documents, async () => {
    if (await db.drafts.get(draft.id)) throw new Error('Draft already exists');
    await db.drafts.add(draft);
		if (document) await db.documents.add(document);
  });
}

export async function saveAttempt(attempt: ProcessingAttempt): Promise<boolean> {
  return db.transaction('rw', db.attempts, async () => {
    const existing = await db.attempts.get(attempt.idempotencyKey);
    if (existing && existing.status !== 'failed') return false;
    if (existing) { await db.attempts.put({ ...attempt, createdAt: Date.now() }); return true; }
    await db.attempts.add(attempt);
    return true;
  });
}

export async function getCurrentDocument(draftId: string): Promise<StoredDocument | undefined> {
  const draft = await db.drafts.get(draftId);
  return draft ? db.documents.get(`${draftId}:${draft.version}`) : undefined;
}

export async function saveDraftVersion(
  draftId: string,
  expectedVersion: number,
  document: Omit<StoredDocument, 'id' | 'draftId' | 'version'>,
  updates: Pick<SourceDraft, 'title' | 'origin'> & Partial<Pick<SourceDraft, 'plainText' | 'html'>>
): Promise<number> {
  assertSelectableDocument(document.blocks);
  return db.transaction('rw', db.drafts, db.documents, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft || draft.version !== expectedVersion) throw new Error('Stale source version');
    const version = expectedVersion + 1;
    await db.documents.add({ ...document, id: `${draftId}:${version}`, draftId, version });
    await db.drafts.update(draftId, {
      ...updates,
      version,
      status: 'pending',
      lastActivityAt: Date.now()
    });
    return version;
  });
}

export async function touchDraft(draftId: string, status: SourceDraft['status'] = 'pending'): Promise<void> {
  await db.drafts.update(draftId, { status, lastActivityAt: Date.now() });
}

export async function deleteDraft(id: string): Promise<void> {
  await db.transaction('rw', db.drafts, db.documents, db.attempts, db.lessons, async () => {
    await db.drafts.delete(id);
    await db.documents.where('draftId').equals(id).delete();
    await db.attempts.where('draftId').equals(id).delete();
    await db.lessons.where('draftId').equals(id).delete();
  });
}

export async function putDocument(document: StoredDocument): Promise<void> {
  await db.transaction('rw', db.drafts, db.documents, async () => {
    const draft = await db.drafts.get(document.draftId);
    if (!draft || draft.version !== document.version) throw new Error('Stale source version');
    await db.documents.put(document);
  });
}

export async function updateSelection(draftId: string, selectedBlockIds: string[], wordCount: number): Promise<StoredDocument> {
  if (!selectedBlockIds.length) throw new Error('Select at least one section');
  return db.transaction('rw', db.drafts, db.documents, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) throw new Error('Draft not found');
    const current = await db.documents.get(`${draftId}:${draft.version}`);
    if (!current) throw new Error('Source document not found');
    const selected = new Set(selectedBlockIds);
    const knownIds = new Set(current.blocks.map((block) => block.id));
    if ([...selected].some((id) => !knownIds.has(id))) throw new Error('Selection contains an unknown section');
    const nextVersion = draft.version + 1;
    const next: StoredDocument = { ...current, id: `${draftId}:${nextVersion}`, version: nextVersion, wordCount,
      blocks: current.blocks.map((block) => ({ ...block, included: selected.has(block.id) })) };
    assertSelectableDocument(next.blocks);
    await db.documents.add(next);
    await db.drafts.update(draftId, { version: nextVersion, status: 'pending', lastActivityAt: Date.now() });
    return next;
  });
}
