export type SourceBlockType = 'heading' | 'paragraph' | 'list-item' | 'table' | 'exercise' | 'page-furniture';
export type Language = 'nb' | 'nn' | 'en' | 'unsupported' | 'uncertain';
export interface SourceSpan { representation: 'text/plain'; start: number; end: number }
export interface InlineMark { type: 'strong' | 'emphasis'; start: number; end: number }
export interface SourceBlock { id: string; type: SourceBlockType; text: string; language: Language; spans: SourceSpan[]; inlineMarks?: InlineMark[]; included: boolean; excludedReason?: 'page-furniture' }
export type DraftStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'discarded' | 'expired';
export interface SourceDraft { id: string; plainText: string; html?: string; title: string; origin?: string; createdAt: number; lastActivityAt: number; status: DraftStatus; version: number }
export interface ProcessingAttempt { idempotencyKey: string; draftId: string; sourceVersion: number; status: 'pending' | 'complete' | 'failed'; createdAt: number }
export interface ClipboardInput { plainText: string; html?: string }
