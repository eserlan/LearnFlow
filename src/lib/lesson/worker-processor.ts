import type { SimplificationProcessor, SimplificationRequest, SimplificationResult, StreamHooks } from './handoff';

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

/** Read only a short machine-readable error code, never the raw provider response. */
async function httpError(response: Response): Promise<WorkerProcessorError> {
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
  return new WorkerProcessorError('http-error', response.status, backendCode);
}

/** The frames of a server-sent event stream: {event, data}, with data parsed as JSON. */
export async function* readEventFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      const frames = buffer.split('\n\n');
      buffer = done ? '' : frames.pop() ?? '';
      for (const frame of frames) {
        let event = 'message', data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue; // comments and keep-alives
        try { yield { event, data: JSON.parse(data) }; } catch { throw new WorkerProcessorError('invalid-response'); }
      }
      if (done) return;
    }
  } finally { reader.cancel().catch(() => {}); }
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
            idempotencyKey: request.idempotencyKey, plainText: request.plainText,
            ...(request.outputLanguage ? { outputLanguage: request.outputLanguage } : {}) }),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error'
        });
      } catch {
        // Never embed source content, raw fetch errors, or service response bodies in messages.
        throw new WorkerProcessorError('unavailable');
      }
      if (!response.ok) throw await httpError(response);
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
    },

    /**
     * Same request, but the service streams each sentence as the model writes it. The streamed sentences are
     * only a preview for the hooks; the returned result is the service's complete, validated lesson.
     */
    async simplifyStream(request: SimplificationRequest, hooks: StreamHooks): Promise<SimplificationResult> {
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({ draftId: request.draftId, sourceVersion: request.sourceVersion,
            idempotencyKey: request.idempotencyKey, plainText: request.plainText,
            ...(request.outputLanguage ? { outputLanguage: request.outputLanguage } : {}) }),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error'
        });
      } catch { throw new WorkerProcessorError('unavailable'); }
      if (!response.ok) throw await httpError(response);
      if (!response.body || !response.headers.get('Content-Type')?.toLowerCase().startsWith('text/event-stream')) {
        throw new WorkerProcessorError('invalid-response');
      }
      let final: unknown;
      try {
        for await (const { event, data } of readEventFrames(response.body)) {
          const x = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
          if (event === 'accepted') hooks.onAccepted?.();
          else if (event === 'reset') hooks.onReset?.();
          else if (event === 'sentence') {
            const sentence = x.sentence as Record<string, unknown> | undefined;
            if (typeof x.index === 'number' && sentence && typeof sentence.text === 'string' && typeof sentence.kind === 'string') {
              hooks.onSentence?.({ text: sentence.text, kind: sentence.kind }, x.index);
            }
          } else if (event === 'done') { final = x; break; }
          else if (event === 'error') {
            const code = typeof x.error === 'string' && /^[a-z_-]{1,64}$/.test(x.error) ? x.error : undefined;
            throw new WorkerProcessorError('http-error', 502, code);
          }
        }
      } catch (e) {
        if (e instanceof WorkerProcessorError) throw e;
        throw new WorkerProcessorError('unavailable');
      }
      const candidate = final as Record<string, unknown> | undefined;
      if (!candidate || !Number.isSafeInteger(candidate.sourceVersion) || candidate.sourceVersion !== request.sourceVersion ||
          typeof candidate.verified !== 'boolean' || !Object.hasOwn(candidate, 'result')) {
        throw new WorkerProcessorError('invalid-response');
      }
      return candidate as unknown as SimplificationResult;
    }
  };
}
