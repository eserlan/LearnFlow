import Dexie, { type EntityTable } from 'dexie';
import type { ProcessingAttempt, SourceBlock, SourceDraft } from '../import/types';

export interface StoredLesson { id: string; draftId: string; sourceVersion: number; title: string; createdAt: number; sentences: Array<{ text: string; kind: 'heading' | 'statement' | 'list-item' | 'task' | 'quote'; sources: string[] }> }
export interface StoredDocument { id: string; draftId: string; version: number; blocks: SourceBlock[]; wordCount: number; language: string }
/** Binary audio lives on the device: OPFS when available, otherwise IndexedDB. */
export interface StoredAudio { id: string; draftId: string; createdAt: number; storage: 'opfs' | 'indexeddb'; blob?: Blob }
class LearnFlowDB extends Dexie {
  drafts!: EntityTable<SourceDraft, 'id'>;
  documents!: EntityTable<StoredDocument, 'id'>;
  attempts!: EntityTable<ProcessingAttempt, 'idempotencyKey'>;
  lessons!: EntityTable<StoredLesson, 'id'>;
  audioAssets!: EntityTable<StoredAudio, 'id'>;
  constructor() {
    super('learnflow');
    this.version(1).stores({ drafts: 'id, status, lastActivityAt', documents: 'id, draftId, version', attempts: 'idempotencyKey, draftId, sourceVersion, status' });
    this.version(2).stores({ lessons: 'id, draftId, sourceVersion, createdAt' });
    this.version(3).stores({ audioAssets: 'id, draftId, createdAt' });
  }
}
export const db = new LearnFlowDB();
