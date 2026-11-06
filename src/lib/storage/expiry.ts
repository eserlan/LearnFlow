import { db } from './db';
import { deleteDraft } from './drafts';

const DAY = 24 * 60 * 60 * 1000;
export const DRAFT_TTL = 7 * DAY;
export const DRAFT_WARNING_AGE = 5 * DAY;

export async function purgeExpiredDrafts(now = Date.now()): Promise<string[]> {
  const expired = await db.drafts.where('status').anyOf('pending', 'processing', 'failed')
    .filter((draft) => now - draft.lastActivityAt >= DRAFT_TTL).primaryKeys();
  for (const id of expired) await deleteDraft(String(id));
  return expired.map(String);
}

export function daysUntilExpiry(lastActivityAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((lastActivityAt + DRAFT_TTL - now) / DAY));
}

export function shouldWarnExpiry(lastActivityAt: number, now = Date.now()): boolean {
  return now - lastActivityAt >= DRAFT_WARNING_AGE && now - lastActivityAt < DRAFT_TTL;
}
