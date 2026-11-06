import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleRequest } from './index.ts';

const env = { ALLOWED_ORIGINS: 'http://localhost:5173,https://preview.example.test' };
const api = 'https://api.example.test';

describe('stateless LearnFlow Worker scaffold', () => {
  it('serves a no-store health response without any server-side storage', async () => {
    const response = handleRequest(new Request(api + '/health'), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  it('allows only explicitly listed frontend origins', () => {
    const allowed = handleRequest(new Request(api + '/health', { headers: { Origin: 'http://localhost:5173' } }), env);
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');

    const denied = handleRequest(new Request(api + '/health', { headers: { Origin: 'https://evil.example' } }), env);
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  });

  it('handles allowed preflight without wildcard origins', () => {
    const response = handleRequest(new Request(api + '/api/simplify', {
      method: 'OPTIONS',
      headers: { Origin: 'https://preview.example.test', 'Access-Control-Request-Method': 'POST' }
    }), env);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://preview.example.test');
  });

  it('does not process or persist pupil content before service readiness', async () => {
    const response = handleRequest(new Request(api + '/api/simplify', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ plainText: 'private textbook material' })
    }), env);
    assert.equal(response.status, 501);
    assert.deepEqual((await response.json()).error, 'not_implemented');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  it('fails closed when allowed origins are not configured', () => {
    const response = handleRequest(new Request(api + '/api/speak', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' }
    }), {});
    assert.equal(response.status, 403);
  });
});
