/**
 * LearnFlow's stateless API edge. No content is retained, cached, or logged here.
 * AI endpoints intentionally return 501 until the provider, consent, and privacy gates are implemented.
 */
export interface Env {
  /** Comma-separated, exact origin allowlist; no wildcard matching. */
  ALLOWED_ORIGINS?: string;
}

const JSON_TYPE = 'application/json; charset=utf-8';
const ENDPOINTS = new Set(['/health', '/api/simplify', '/api/speak']);

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function corsHeaders(origin: string | null, env: Env): Headers {
  const headers = new Headers();
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '600');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null, env: Env): Response {
  const headers = corsHeaders(origin, env);
  headers.set('Content-Type', JSON_TYPE);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(body), { status, headers });
}

export function handleRequest(request: Request, env: Env): Response {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get('Origin');
  const approved = origin !== null && allowedOrigins(env).has(origin);

  if (request.method === 'OPTIONS') {
    if (!ENDPOINTS.has(pathname) || !approved) {
      return json({ error: 'origin_not_allowed' }, 403, null, env);
    }
    const headers = corsHeaders(origin, env);
    headers.set('Cache-Control', 'no-store');
    return new Response(null, { status: 204, headers });
  }

  // Restrict browser origins, but do not confuse CORS with authentication.
  // Production endpoints also need separate rate limiting and abuse controls.
  if (origin !== null && !approved) {
    return json({ error: 'origin_not_allowed' }, 403, null, env);
  }
  if (pathname === '/health' && request.method === 'GET') {
    return json({ status: 'ok' }, 200, origin, env);
  }
  if (pathname === '/api/simplify' && request.method === 'POST') {
    return json({ error: 'not_implemented', message: 'Simplification provider and consent integration pending.' }, 501, origin, env);
  }
  if (pathname === '/api/speak' && request.method === 'POST') {
    return json({ error: 'not_implemented', message: 'Speech provider integration pending.' }, 501, origin, env);
  }
  return json({ error: 'not_found' }, 404, origin, env);
}

export default {
  fetch(request: Request, env: Env): Response {
    return handleRequest(request, env);
  }
};
