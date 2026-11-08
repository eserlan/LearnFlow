import { simplifyWithAi, validatePayload, AiError, type AiEnv } from './simplify.ts';
import { synthesizeLesson, validateSpeakPayload } from './speak.ts';

/**
 * LearnFlow's stateless Cloudflare API. No content, lesson or audio persistence.
 * Mock mode accepts one fixed, non-personal fixture and is disabled in production.
 */
export interface Env extends AiEnv {
  RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
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
const ROUTES = new Set(['/health', '/capabilities', ...API_PATHS]);

// Permit only exact production origins. Keep the old Vercel origin during
// the migration so users can retrieve their device-local lessons there.
// Pages project slug: "learnflow-web"; preview domains are NOT auto-allowed.
const PRODUCTION_ORIGINS = [
  'https://learnflow-web.pages.dev',
  'https://learnflow-nine-pied.vercel.app'
] as const;

function allowedOrigins(env: Env): Set<string> {
  const extraOrigins = (env.ALLOWED_ORIGINS ?? '').split(',')
    .map((value) => value.trim()).filter(Boolean);
  return new Set([...PRODUCTION_ORIGINS, ...extraOrigins]);
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

/**
 * Gemini availability depends only on the actual required infrastructure.
 * No manual feature flag or approval flag gates normal requests.
 * CORS is not authentication; public access also requires abuse/cost controls.
 */
type CapabilityReason = 'missing_api_key' | 'missing_model' | 'missing_rate_limiter';
function capabilityReason(env:Env): CapabilityReason | null {
  if (!env.GEMINI_API_KEY) return 'missing_api_key';
  if (!env.GEMINI_MODEL) return 'missing_model';
  if (!env.RATE_LIMITER) return 'missing_rate_limiter';
  return null;
}

function processingEnabled(env:Env): boolean {
  return capabilityReason(env) === null;
}

async function liveSimplify(request: Request, origin: string, env: Env,
  fetcher: (url:string, init:RequestInit)=>Promise<Response>): Promise<Response> {
  if (!processingEnabled(env)) {
    return json({error:'processing_not_enabled'}, 503, origin, env);
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({error:'unsupported_media_type'},415,origin,env);
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json({error:'rate_limit_unavailable'},503,origin,env);
  const limiter = env.RATE_LIMITER;
  if (!limiter) return json({error:'rate_limit_unavailable'},503,origin,env);
  try {
    const limit = await limiter.limit({key: ip});
    if (!limit.success) return json({error:'rate_limited'},429,origin,env);
  } catch { return json({error:'rate_limit_unavailable'},503,origin,env); }
  // Cap request bytes before parsing. No storage or request body logging.
  if (Number(request.headers.get('Content-Length') ?? 0) > 40_000) {
    return json({error:'invalid_request'},413,origin,env);
  }
  const reader = request.body?.getReader();
  if (!reader) return json({error:'invalid_request'},400,origin,env);
  const chunks: Uint8Array[] = [];
  let size=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>40_000){await reader.cancel();return json({error:'invalid_request'},413,origin,env);}
      chunks.push(value);
    }
  } catch { return json({error:'invalid_request'},400,origin,env); }
  const bytes = new Uint8Array(size);
  let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let raw: unknown;
  try { raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { return json({error:'invalid_request'},400,origin,env); }
  const input=validatePayload(raw);
  if(!input)return json({error:'invalid_request'},422,origin,env);
  try {
    const result=await simplifyWithAi(input,env,fetcher);
    // 'verified' is a legacy client contract flag meaning basic validation passed.
    // It must NOT be presented to pupils as independent factual verification.
    return json({sourceVersion:input.sourceVersion,verified:true,result},200,origin,env);
  }catch(error){
    if(error instanceof AiError){
      const status=error.code==='invalid-output' || error.code==='provider_bad_request' ? 502 :
        error.code==='provider_quota' ? 429 : 503;
      return json({error:error.code},status,origin,env);
    }
    return json({error:'processing_failed'},503,origin,env);
  }
}

/**
 * Speech uses the same origin and per-IP rate limiter as simplification.
 * No audio or transcript is persisted on Cloudflare.
 */
async function liveSpeak(request: Request, origin: string, env: Env,
  fetcher: (url: string, init: RequestInit) => Promise<Response>): Promise<Response> {
  if (!env.GEMINI_API_KEY || !env.RATE_LIMITER) {
    return json({error:'processing_not_enabled'},503,origin,env);
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({error:'unsupported_media_type'},415,origin,env);
  }
  const ip=request.headers.get('CF-Connecting-IP');
  if (!ip) return json({error:'rate_limit_unavailable'},503,origin,env);
  try {
    const limit=await env.RATE_LIMITER.limit({key:ip});
    if (!limit.success) return json({error:'rate_limited'},429,origin,env);
  } catch { return json({error:'rate_limit_unavailable'},503,origin,env); }

  const MAX_BODY=25_000;
  if (Number(request.headers.get('Content-Length') ?? 0)>MAX_BODY) {
    return json({error:'invalid_request'},413,origin,env);
  }
  const reader=request.body?.getReader();
  if (!reader) return json({error:'invalid_request'},400,origin,env);
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if (size>MAX_BODY) { await reader.cancel(); return json({error:'invalid_request'},413,origin,env); }
      chunks.push(value);
    }
  } catch { return json({error:'invalid_request'},400,origin,env); }
  const bytes=new Uint8Array(size);
  let offset=0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
  let parsed:unknown;
  try { parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { return json({error:'invalid_request'},400,origin,env); }
  const input=validateSpeakPayload(parsed);
  if (!input) return json({error:'invalid_request'},422,origin,env);
  try {
    const wav=await synthesizeLesson(input,env,fetcher);
    const headers=headersFor(origin,env);
    headers.set('Content-Type','audio/wav');
    headers.set('Content-Disposition','attachment; filename="learnflow-lesson.wav"');
    return new Response(wav,{status:200,headers});
  } catch (error) {
    if (error instanceof AiError) {
      const status=error.code==='invalid-output' || error.code==='provider_bad_request' ? 502 :
        error.code==='provider_quota' ? 429 : 503;
      return json({error:error.code},status,origin,env);
    }
    return json({error:'processing_failed'},503,origin,env);
  }
}

export async function handleRequest(request: Request, env: Env, fetcher: (url:string, init:RequestInit)=>Promise<Response> = fetch): Promise<Response> {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get('Origin');
  const approved = origin !== null && allowedOrigins(env).has(origin);

  if (request.method === 'OPTIONS') {
    if (!ROUTES.has(pathname) || !approved ||
        request.headers.get('Access-Control-Request-Method') !== (pathname === '/health' || pathname === '/capabilities' ? 'GET' : 'POST') ||
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
  if (pathname === '/capabilities' && request.method === 'GET') {
    const reason = capabilityReason(env);
    return json(reason === null ? {simplify:true} : {simplify:false,reason},200,origin,env);
  }
  if (API_PATHS.has(pathname) && request.method === 'POST') {
    // Origin is not authentication; proper abuse controls remain a release gate.
    if (!approved) return json({ error: 'origin_required' }, 403, null, env);
    if (pathname === '/api/simplify' && demoEnabled(env)) return mockSimplify(request, origin!, env);
    if (pathname === '/api/simplify') return liveSimplify(request, origin!, env, fetcher);
    if (pathname === '/api/speak') return liveSpeak(request, origin!, env, fetcher);
    return json({ error: 'not_found' }, 404, origin, env);
  }
  return json({ error: 'not_found' }, 404, origin, env);
}

// Cloudflare invokes the exported fetch handler as (request, env, ctx).
// Do not expose handleRequest directly: its optional third argument is a
// test-only fetcher injection, not Cloudflare's ExecutionContext.
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};
