import { db } from '../storage/db';
import { saveAttempt, touchDraft } from '../storage/drafts';

export interface ConsentGate { canProcess(draftId: string): Promise<boolean> }
/** Absent: write in the language of the source. English is the only alternative. */
export type OutputLanguage = 'en';
export interface SimplificationRequest { draftId: string; sourceVersion: number; idempotencyKey: string; plainText: string; html?: string; outputLanguage?: OutputLanguage }
export interface SimplificationResult { sourceVersion: number; verified: boolean; result: unknown }
/** Progress while a streamed simplification runs. Streamed sentences are provisional drafts; the result replaces them. */
export interface StreamHooks {
  onAccepted?(): void;
  onSentence?(sentence: { text: string; kind: string }, index: number): void;
  /** The service is retrying: drop every sentence shown so far. */
  onReset?(): void;
}
export interface SimplificationProcessor {
  simplify(request: SimplificationRequest): Promise<SimplificationResult>;
  simplifyStream?(request: SimplificationRequest, hooks: StreamHooks): Promise<SimplificationResult>;
}
export type HandoffErrorCode = 'consent-required' | 'processor-unavailable' | 'stale-source' | 'duplicate-attempt' | 'unverified-result';
export class HandoffError extends Error { constructor(readonly code: HandoffErrorCode, message: string) { super(message); } }

/** Only this boundary may send pupil text off device. Consent and a real processor are mandatory. */
export async function simplifyDraft(draftId: string, consent: ConsentGate, processor?: SimplificationProcessor, hooks?: StreamHooks, outputLanguage?: OutputLanguage): Promise<SimplificationResult> {
  const draft = await db.drafts.get(draftId);
  if (!draft) throw new HandoffError('stale-source', 'This saved text no longer exists.');
  const allowed = await consent.canProcess(draftId).catch(() => false);
  if (!allowed) throw new HandoffError('consent-required', 'Processing is not allowed until the privacy and consent check passes.');
  if (!processor) throw new HandoffError('processor-unavailable', 'The simplification service is not configured.');

  const idempotencyKey = `${draftId}:${draft.version}`;
  const created = await saveAttempt({ idempotencyKey, draftId, sourceVersion: draft.version, status: 'pending', createdAt: Date.now() });
  if (!created) throw new HandoffError('duplicate-attempt', 'This source version has already been submitted.');
  await touchDraft(draftId, 'processing');
  try {
    const request = {
      draftId,
      sourceVersion: draft.version,
      idempotencyKey,
      // Pasted HTML stays on-device; the Worker accepts plain text only.
      plainText: draft.plainText,
      ...(outputLanguage ? { outputLanguage } : {})
    };
    const result = processor.simplifyStream && hooks
      ? await processor.simplifyStream(request, hooks)
      : await processor.simplify(request);
    const current = await db.drafts.get(draftId);
    if (!current || current.version !== result.sourceVersion || current.version !== draft.version) throw new HandoffError('stale-source', 'The source changed while it was processing.');
    if (!result.verified) throw new HandoffError('unverified-result', 'The result did not pass its faithfulness check.');
    await db.transaction('rw', db.attempts, db.drafts, async () => {
      await db.attempts.update(idempotencyKey, { status: 'complete' });
      await db.drafts.update(draftId, { status: 'processed', lastActivityAt: Date.now() });
    });
    return result;
  } catch (error) {
    await db.transaction('rw', db.attempts, db.drafts, async () => {
      await db.attempts.update(idempotencyKey, { status: 'failed' });
      const current = await db.drafts.get(draftId);
      if (current?.version === draft.version) await db.drafts.update(draftId, { status: 'failed', lastActivityAt: Date.now() });
    });
    throw error;
  }
}
