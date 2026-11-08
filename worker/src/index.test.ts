import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleRequest, SMOKE_FIXTURE } from './index.ts';

const env = { ALLOWED_ORIGINS: 'http://localhost:5173,https://preview.example.test' };
const mockEnv = { ...env, APP_ENV: 'test', ENABLE_MOCK_PROCESSING: 'true' };
const api = 'https://api.example.test';

function post(payload: unknown, configuration = mockEnv, origin = 'http://localhost:5173'): Promise<Response> {
  return handleRequest(new Request(api + '/api/simplify', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }), configuration);
}

describe('stateless Cloudflare Worker API', () => {
  it('serves health with no-store headers', async () => {
    const response = await handleRequest(new Request(api + '/health'), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  it('allowlists exact origins and rejects unknown origins', async () => {
    const allowed = await handleRequest(new Request(api + '/health', { headers: { Origin: 'http://localhost:5173' } }), env);
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
    const denied = await handleRequest(new Request(api + '/health', { headers: { Origin: 'https://evil.example' } }), env);
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  });

  it('allows canonical production frontend even when ALLOWED_ORIGINS is unset or stale', async () => {
    const production = 'https://learnflow-nine-pied.vercel.app';
    const missingOriginConfig = await handleRequest(new Request(api + '/capabilities', {
      headers: { Origin: production }
    }), {});
    assert.equal(missingOriginConfig.status, 200);
    assert.equal(missingOriginConfig.headers.get('Access-Control-Allow-Origin'), production);

    const staleConfig = await handleRequest(new Request(api + '/api/simplify', {
      method: 'POST',
      headers: { Origin: production, 'Content-Type': 'application/json' },
      body: JSON.stringify(SMOKE_FIXTURE)
    }), { ALLOWED_ORIGINS:'https://old-preview.example.test' });
    assert.equal(staleConfig.status, 503); // infrastructure absent, not 403 from origin rejection

    const preflight = await handleRequest(new Request(api + '/api/simplify', {
      method: 'OPTIONS',
      headers: { Origin: production, 'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'Content-Type' }
    }), {});
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), production);

    const other = await handleRequest(new Request(api + '/health', {
      headers: { Origin:'https://attacker.example.test' }
    }), {});
    assert.equal(other.status, 403);
  });

  it('handles only valid CORS preflight', async () => {
    const ok = await handleRequest(new Request(api + '/api/simplify', {
      method: 'OPTIONS', headers: { Origin: 'https://preview.example.test', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type' }
    }), env);
    assert.equal(ok.status, 204);
    const denied = await handleRequest(new Request(api + '/api/simplify', {
      method: 'OPTIONS', headers: { Origin: 'https://preview.example.test', 'Access-Control-Request-Method': 'DELETE' }
    }), env);
    assert.equal(denied.status, 403);
  });

  it('rejects text before reading its body when Gemini infrastructure is missing (returns 503)', async () => {
    const request = new Request(api + '/api/simplify', {
      method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ plainText: 'private pupil text' })
    });
    const response = await handleRequest(request, env);
    assert.equal(response.status, 503);
    assert.equal(request.bodyUsed, false);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  it('test fixture runs only in explicit test mode', async () => {
    assert.equal((await post(SMOKE_FIXTURE, env)).status, 503);
    assert.equal((await post(SMOKE_FIXTURE, { ...mockEnv, APP_ENV: 'production' })).status, 503);
    const response = await post(SMOKE_FIXTURE);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      sourceVersion: 1, verified: true,
      result: { kind: 'smoke-fixture', text: SMOKE_FIXTURE.plainText, forLearning: false }
    });
  });

  it('rejects real input even in fixture mode', async () => {
    const response = await post({ ...SMOKE_FIXTURE, plainText: 'Actual school work' });
    assert.equal(response.status, 422);
    assert.equal((await response.json() as { error: string }).error, 'fixture_only');
  });

  it('requires an approved browser origin for processing', async () => {
    assert.equal((await post(SMOKE_FIXTURE, mockEnv, 'https://evil.example')).status, 403);
    const noOrigin = await handleRequest(new Request(api + '/api/simplify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(SMOKE_FIXTURE)
    }), mockEnv);
    assert.equal(noOrigin.status, 403);
  });
});
