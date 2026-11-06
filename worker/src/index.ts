/**
 * LearnFlow's stateless Cloudflare API. No content, lesson or audio persistence.
 * Mock mode accepts one fixed, non-personal fixture and is disabled in production.
 */
export interface Env {
  ALLOWED_ORIGINS?: string;
  APP_ENV?: string;
  ENABLE_MOCK_PROCESSING?: string;
}

export const SMOKE_FIXTURE = {
  draftId: 'learnflow-smoke',
  sourceVersion: 1,
  idempotencyKey: 'learnflow-smoke:1',
  plainText: 'Planter trenger lys for å vokse.'
} as const;

const JSON_TYPE = 'application/json; charset=utf-8';
const API_PATHS = new Set(['/api/simplify', '/api/speak']);
const ROUTES = new Set(['/health', ...API_PATHS]);

function allowedOrigins(env: Env): Set<string> {
  return new Set((env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
}

function headersFor(origin: string | null, env: Env): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  });
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '600');
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null, env: Env): Response {
  const headers = headersFor(origin, env);
  headers.set('Content-Type', JSON_TYPE);
  return new Response(JSON.stringify(body), { status, headers });
}

function demoEnabled(env: Env): boolean {
  return env.APP_ENV === 'test' && env.ENABLE_MOCK_PROCESSING === 'true';
}

async function mockSimplify(request: Request, origin: string, env: Env): Promise<Response> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'unsupported_media_type' }, 415, origin, env);
  }
  // Accept only a fixed synthetic fixture; never use the mock on real school material.
  if (Number(request.headers.get('Content-Length') ?? 0) > 2048) {
    return json({ error: 'fixture_only' }, 422, origin, env);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 2048) {
    return json({ error: 'fixture_only' }, 422, origin, env);
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400, origin, env); }
  if (!payload || typeof payload !== 'object') return json({ error: 'fixture_only' }, 422, origin, env);
  const record = payload as Record<string, unknown>;
  const fixture = SMOKE_FIXTURE;
  if (record.draftId !== fixture.draftId || record.sourceVersion !== fixture.sourceVersion ||
      record.idempotencyKey !== fixture.idempotencyKey || record.plainText !== fixture.plainText ||
      record.html !== undefined) {
    return json({ error: 'fixture_only' }, 422, origin, env);
  }
  // The result is an exact echo, not an AI explanation. It is not for pupil learning.
  return json({
    sourceVersion: fixture.sourceVersion,
    verified: true,
    result: { kind: 'smoke-fixture', text: fixture.plainText, forLearning: false }
  }, 200, origin, env);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get('Origin');
  const approved = origin !== null && allowedOrigins(env).has(origin);

  if (request.method === 'OPTIONS') {
    if (!ROUTES.has(pathname) || !approved ||
        request.headers.get('Access-Control-Request-Method') !== (pathname === '/health' ? 'GET' : 'POST') ||
        (request.headers.get('Access-Control-Request-Headers') ?? '').toLowerCase().split(',').some(
          (h) => h.trim() !== '' && h.trim() !== 'content-type')) {
      return json({ error: 'preflight_not_allowed' }, 403, null, env);
    }
    return new Response(null, { status: 204, headers: headersFor(origin, env) });
  }

  if (origin !== null && !approved) return json({ error: 'origin_not_allowed' }, 403, null, env);
  if (pathname === '/health' && request.method === 'GET') {
    return json({ status: 'ok' }, 200, origin, env);
  }
  if (API_PATHS.has(pathname) && request.method === 'POST') {
    // Origin is not authentication; proper abuse controls remain a release gate.
    if (!approved) return json({ error: 'origin_required' }, 403, null, env);
    if (pathname === '/api/simplify' && demoEnabled(env)) return mockSimplify(request, origin!, env);
    return json({ error: 'not_implemented', message: 'AI provider and privacy checks pending.' }, 501, origin, env);
  }
  return json({ error: 'not_found' }, 404, origin, env);
}

export default { fetch: handleRequest };
