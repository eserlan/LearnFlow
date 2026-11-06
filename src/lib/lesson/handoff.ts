import { db } from '../storage/db';
import { saveAttempt, touchDraft } from '../storage/drafts';

export interface ConsentGate { canProcess(draftId: string): Promise<boolean> }
export interface SimplificationRequest { draftId: string; sourceVersion: number; idempotencyKey: string; plainText: string; html?: string }
export interface SimplificationResult { sourceVersion: number; verified: boolean; result: unknown }
export interface SimplificationProcessor { simplify(request: SimplificationRequest): Promise<SimplificationResult> }
export type HandoffErrorCode = 'consent-required' | 'processor-unavailable' | 'stale-source' | 'duplicate-attempt' | 'unverified-result';
export class HandoffError extends Error { constructor(readonly code: HandoffErrorCode, message: string) { super(message); } }

/** Only this boundary may send pupil text off device. Consent and a real processor are mandatory. */
export async function simplifyDraft(draftId: string, consent: ConsentGate, processor?: SimplificationProcessor): Promise<SimplificationResult> {
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
    const result = await processor.simplify({
      draftId,
      sourceVersion: draft.version,
      idempotencyKey,
      plainText: draft.plainText,
      ...(draft.html ? { html: draft.html } : {})
    });
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
