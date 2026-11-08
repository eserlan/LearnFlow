import type { SimplificationProcessor, SimplificationRequest, SimplificationResult } from './handoff';

export class WorkerProcessorError extends Error {
  readonly code: 'unavailable' | 'http-error' | 'invalid-response';
  readonly status?: number;
  readonly backendCode?: string;
  constructor(code: 'unavailable' | 'http-error' | 'invalid-response', status?: number, backendCode?: string) {
    super(code === 'unavailable' ? 'The processing service is not available. Try again later.' :
      code === 'invalid-response' ? 'The processing service returned an invalid response.' :
      status === 501 ? 'Simplification is not available yet.' : 'The processing service could not complete the request.');
    this.name = 'WorkerProcessorError';
    this.code = code;
    this.status = status;
    this.backendCode = backendCode;
  }
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

/** Only call this adapter through simplifyDraft(), which enforces the spec 006 consent gate. */
export function createWorkerProcessor(apiBaseUrl: string, fetcher: Fetcher = fetch): SimplificationProcessor {
  const base = new URL(apiBaseUrl);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Invalid LearnFlow API origin. Use an HTTPS origin, or localhost during development.');
  }
  const endpoint = new URL('/api/simplify', base).toString();

  return {
    async simplify(request: SimplificationRequest): Promise<SimplificationResult> {
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: request.draftId, sourceVersion: request.sourceVersion,
            idempotencyKey: request.idempotencyKey, plainText: request.plainText }),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error'
        });
      } catch {
        // Never embed source content, raw fetch errors, or service response bodies in messages.
        throw new WorkerProcessorError('unavailable');
      }
      if (!response.ok) {
        // Read only a short machine-readable error code, never the raw provider response.
        let backendCode: string | undefined;
        if (response.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
          try {
            const body: unknown = await response.json();
            if (body && typeof body === 'object' && !Array.isArray(body)) {
              const code = (body as Record<string, unknown>).error;
              if (typeof code === 'string' && /^[a-z_]{1,64}$/.test(code)) backendCode = code;
            }
          } catch { /* optional diagnostics only */ }
        }
        throw new WorkerProcessorError('http-error', response.status, backendCode);
      }
      if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
        throw new WorkerProcessorError('invalid-response');
      }
      let result: unknown;
      try { result = await response.json(); } catch { throw new WorkerProcessorError('invalid-response'); }
      if (!result || typeof result !== 'object') throw new WorkerProcessorError('invalid-response');
      const candidate = result as Record<string, unknown>;
      if (!Number.isSafeInteger(candidate.sourceVersion) || candidate.sourceVersion !== request.sourceVersion ||
          typeof candidate.verified !== 'boolean' || !Object.hasOwn(candidate, 'result')) {
        throw new WorkerProcessorError('invalid-response');
      }
      return candidate as unknown as SimplificationResult;
    }
  };
}
