import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, type StoredDocument } from '../../src/lib/storage/db';
import { createDraft } from '../../src/lib/storage/drafts';
import { simplifyDraft } from '../../src/lib/lesson/handoff';
import { createWorkerProcessor, WorkerProcessorError } from '../../src/lib/lesson/worker-processor';
import { handleRequest, SMOKE_FIXTURE } from '../../worker/src/index';
import type { SourceDraft } from '../../src/lib/import/types';

const API = 'https://api.example.test/';
const ORIGIN = 'https://preview.example.test';
const mockEnv = { ALLOWED_ORIGINS: ORIGIN, APP_ENV: 'test', ENABLE_MOCK_PROCESSING: 'true' };

function createSource(plainText = SMOKE_FIXTURE.plainText): SourceDraft {
  return { id: SMOKE_FIXTURE.draftId, plainText, title: 'Test fixture',
    createdAt: Date.now(), lastActivityAt: Date.now(), status: 'pending', version: 1 };
}
function createDocument(plainText = SMOKE_FIXTURE.plainText): StoredDocument {
  return { id: 'learnflow-smoke:1', draftId: SMOKE_FIXTURE.draftId, version: 1, wordCount: 7, language: 'nb',
    blocks: [{ id: 'source-1', type: 'paragraph', text: plainText, language: 'nb',
      spans: [{ representation: 'text/plain', start: 0, end: plainText.length }], included: true }] };
}
function mockFetch(env = mockEnv) {
  return vi.fn(async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set('Origin', ORIGIN); // Browser-managed header, simulated in this in-process test.
    return handleRequest(new Request(url, { ...init, headers }), env);
  });
}

afterEach(async () => { await db.delete(); await db.open(); });

describe('local draft → consent gate → HTTP Worker fixture → local result', () => {
  it('never transmits pupil text if consent is denied', async () => {
    await createDraft(createSource(), createDocument());
    const outbound = mockFetch();
    await expect(simplifyDraft(SMOKE_FIXTURE.draftId, { canProcess: async () => false },
      createWorkerProcessor(API, outbound))).rejects.toMatchObject({ code: 'consent-required' });
    expect(outbound).not.toHaveBeenCalled();
    expect((await db.drafts.get(SMOKE_FIXTURE.draftId))?.status).toBe('pending');
  });

  it('sends plain text but keeps pasted HTML only on the device', async () => {
    const pastedHtml = '<p><strong>Planter trenger lys for å vokse.</strong></p>';
    await createDraft({ ...createSource(), html: pastedHtml }, createDocument());
    const outbound = mockFetch();
    const result = await simplifyDraft(SMOKE_FIXTURE.draftId, { canProcess: async () => true },
      createWorkerProcessor(API, outbound));
    expect(result.verified).toBe(true);
    expect(JSON.parse(outbound.mock.calls[0][1].body as string)).toEqual(SMOKE_FIXTURE);
    expect((await db.drafts.get(SMOKE_FIXTURE.draftId))?.html).toBe(pastedHtml);
  });

  it('adds outputLanguage to the request only when English is chosen', async () => {
    await createDraft(createSource(), createDocument());
    const outbound = mockFetch();
    await simplifyDraft(SMOKE_FIXTURE.draftId, { canProcess: async () => true },
      createWorkerProcessor(API, outbound), undefined, 'en');
    expect(JSON.parse(outbound.mock.calls[0][1].body as string)).toEqual({ ...SMOKE_FIXTURE, outputLanguage: 'en' });
  });

  it('sends only the synthetic fixture after consent and marks the local draft processed', async () => {
    await createDraft(createSource(), createDocument());
    const outbound = mockFetch();
    const result = await simplifyDraft(SMOKE_FIXTURE.draftId, { canProcess: async () => true },
      createWorkerProcessor(API, outbound));
    expect(outbound).toHaveBeenCalledTimes(1);
    expect(JSON.parse(outbound.mock.calls[0][1].body as string)).toEqual(SMOKE_FIXTURE);
    expect(result).toEqual({ sourceVersion: 1, verified: true,
      result: { kind: 'smoke-fixture', text: SMOKE_FIXTURE.plainText, forLearning: false } });
    expect((await db.drafts.get(SMOKE_FIXTURE.draftId))?.status).toBe('processed');
    expect((await db.attempts.get(SMOKE_FIXTURE.idempotencyKey))?.status).toBe('complete');
  });

  it('fails safely without Gemini configuration when the Worker is not in test mode', async () => {
    await createDraft(createSource(), createDocument());
    const outbound = mockFetch({ ALLOWED_ORIGINS: ORIGIN, APP_ENV: 'production', ENABLE_MOCK_PROCESSING: 'true' });
    await expect(simplifyDraft(SMOKE_FIXTURE.draftId, { canProcess: async () => true },
      createWorkerProcessor(API, outbound))).rejects.toMatchObject({ code: 'http-error', status: 503 });
    expect((await db.drafts.get(SMOKE_FIXTURE.draftId))?.status).toBe('failed');
    expect((await db.attempts.get(SMOKE_FIXTURE.idempotencyKey))?.status).toBe('failed');
    expect(await db.documents.get('learnflow-smoke:1')).toBeDefined();
  });

  it('rejects malformed remote output instead of marking it verified', async () => {
    await createDraft(createSource(), createDocument());
    const invalidFetch = vi.fn(async () => new Response('{"sourceVersion":1,"verified":"yes","result":"wrong"}',
      { headers: { 'Content-Type': 'application/json' } }));
    await expect(simplifyDraft(SMOKE_FIXTURE.draftId, { canProcess: async () => true },
      createWorkerProcessor(API, invalidFetch))).rejects.toBeInstanceOf(WorkerProcessorError);
    expect((await db.drafts.get(SMOKE_FIXTURE.draftId))?.status).toBe('failed');
  });
});
