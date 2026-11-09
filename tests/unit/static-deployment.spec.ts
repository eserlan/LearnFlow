import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const json=(path:string)=>JSON.parse(readFileSync(path,'utf8')) as Record<string,any>;

describe('Cloudflare Static Assets deployment separation',()=>{
  it('keeps frontend and Gemini API as two distinct Workers',()=>{
    const frontend=json('wrangler.jsonc');
    const api=json('worker/wrangler.jsonc');
    expect(frontend.name).toBe('learnflow');
    expect(frontend.assets.directory).toBe('./build');
    expect(frontend.main).toBeUndefined();
    expect(frontend.ratelimits).toBeUndefined();
    expect(api.name).toBe('learnflow-serv');
    expect(api.main).toBe('src/index.ts');
    expect(api.ratelimits).toHaveLength(1);
    expect(api.assets).toBeUndefined();
  });
  it('builds the public frontend against the renamed backend',()=>{
    const env=readFileSync('.env.production','utf8');
    expect(env).toContain('VITE_LEARNFLOW_API_URL=https://learnflow-serv.espen-erlandsen.workers.dev/');
    expect(env).not.toContain('GEMINI_API_KEY');
    expect(env).not.toContain('https://learnflow.espen-erlandsen.workers.dev/');
  });
});
