import Dexie, { type EntityTable } from 'dexie';
import type { ProcessingAttempt, SourceBlock, SourceDraft } from '../import/types';

export interface StoredDocument { id: string; draftId: string; version: number; blocks: SourceBlock[]; wordCount: number; language: string }
class LearnFlowDB extends Dexie {
  drafts!: EntityTable<SourceDraft, 'id'>;
  documents!: EntityTable<StoredDocument, 'id'>;
  attempts!: EntityTable<ProcessingAttempt, 'idempotencyKey'>;
  constructor() {
    super('learnflow');
    this.version(1).stores({ drafts: 'id, status, lastActivityAt', documents: 'id, draftId, version', attempts: 'idempotencyKey, draftId, sourceVersion, status' });
  }
}
export const db = new LearnFlowDB();
