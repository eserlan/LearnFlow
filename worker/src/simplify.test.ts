import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { simplifyWithAi, validatePayload, type SimplifyPayload } from './simplify.ts';
import { handleRequest, type Env } from './index.ts';

const input: SimplifyPayload = {
  draftId:'unit-test',sourceVersion:1,idempotencyKey:'unit-test:1',
  plainText:'De fleste humler kan fly langt. Noen arter flyr opptil 20 kilometer.'
};
const lesson = {sentences:[{text:'De fleste humler kan fly langt.',kind:'statement',sources:['original']},
  {text:'Noen arter flyr opptil 20 kilometer.',kind:'statement',sources:['original']}]};
const configured: Env = {ALLOWED_ORIGINS:'https://preview.example.test',
  ENABLE_AI_PROCESSING:'true',PRIVACY_REVIEW_APPROVED:'true',
  GEMINI_API_KEY:'unit-test-secret',GEMINI_MODEL:'fake-gemini',
  RATE_LIMITER:{limit:async()=>({success:true})}};

function provider(output:unknown=lesson) {
  const calls: string[] = [];
  const fetcher = async (url:string, _init:RequestInit):Promise<Response> => {
    calls.push(url);
    if(!url.includes('generativelanguage.googleapis.com')) throw new Error('Unexpected non-Gemini provider call');
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]});
  };
  return {fetcher,calls};
}

describe('real AI adapter (synthetic content only)',()=>{
  it('rejects empty, oversized and manipulated draft payloads',()=>{
    assert.equal(validatePayload({...input,idempotencyKey:'wrong'}),null);
    assert.equal(validatePayload({...input,plainText:'word '.repeat(2001)}),null);
    assert.equal(validatePayload({...input,html:'<p>private</p>'}),null);
    assert.notEqual(validatePayload(input),null);
  });
  it('generates one structurally validated Gemini output without Claude',async()=>{
    const p=provider();
    const result=await simplifyWithAi(input,configured,p.fetcher);
    assert.equal(result.kind,'simplified-lesson');
    assert.equal(result.sentences[0].text,lesson.sentences[0].text);
    assert.equal(p.calls.length,1);
  });
  it('rejects numbers that were not in the original text',async()=>{
    const p=provider({sentences:[{text:'Humler flyr 900 kilometer.',kind:'statement',sources:['original']}]});
    await assert.rejects(simplifyWithAi(input,configured,p.fetcher),{code:'invalid-output'});
    assert.equal(p.calls.length,1);
  });
  it('rejects incorrect source references without further model calls',async()=>{
    const p=provider({sentences:[{text:'Noen humler flyr.',kind:'statement',sources:['unknown']}]});
    await assert.rejects(simplifyWithAi(input,configured,p.fetcher),{code:'invalid-output'});
    assert.equal(p.calls.length,1);
  });
  it('returns only capability metadata when backend is disabled',async()=>{
    const r=await handleRequest(new Request('https://api.example.test/capabilities',
      {headers:{Origin:'https://preview.example.test'}}),{ALLOWED_ORIGINS:'https://preview.example.test'});
    assert.deepEqual(await r.json(),{simplify:false});
  });
  it('blocks unapproved release without consuming the request body or calling providers',async()=>{
    const req=new Request('https://api.example.test/api/simplify',
      {method:'POST',headers:{Origin:'https://preview.example.test','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.42'},
        body:JSON.stringify(input)});
    const p=provider();
    const response=await handleRequest(req,{...configured,PRIVACY_REVIEW_APPROVED:'false'},p.fetcher);
    assert.equal(response.status,503);
    assert.equal(req.bodyUsed,false);
    assert.equal(p.calls.length,0);
  });
  it('enforces rate limiting before reading sensitive content',async()=>{
    const req=new Request('https://api.example.test/api/simplify',
      {method:'POST',headers:{Origin:'https://preview.example.test','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.42'},
        body:JSON.stringify(input)});
    const p=provider();
    const response=await handleRequest(req,{...configured,RATE_LIMITER:{limit:async()=>({success:false})}},p.fetcher);
    assert.equal(response.status,429);
    assert.equal(req.bodyUsed,false);
    assert.equal(p.calls.length,0);
  });
  it('the stateless Worker accepts a checked Gemini result after one provider call',async()=>{
    const p=provider();
    const req=new Request('https://api.example.test/api/simplify',
      {method:'POST',headers:{Origin:'https://preview.example.test','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.42'},
        body:JSON.stringify(input)});
    const response=await handleRequest(req,configured,p.fetcher);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    const body=await response.json() as {verified:boolean;result:{kind:string}};
    assert.equal(body.verified,true);
    assert.equal(body.result.kind,'simplified-lesson');
    assert.equal(p.calls.length,1);
  });
  it('rejects unapproved public AI without reading request bodies or using Gemini',async()=>{
    const restricted={...configured,ENABLE_AI_PROCESSING:'true',PRIVACY_REVIEW_APPROVED:'false'};
    const req=new Request('https://api.example.test/api/simplify',{
      method:'POST',headers:{Origin:'https://preview.example.test',
        'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.42'},
      body:JSON.stringify(input)
    });
    const p=provider();
    const denied=await handleRequest(req,restricted,p.fetcher);
    assert.equal(denied.status,503);
    assert.equal(req.bodyUsed,false);
    assert.equal(p.calls.length,0);
  });
  it('does not allow private token header in CORS preflight',async()=>{
    const preflight=await handleRequest(new Request('https://api.example.test/capabilities',{
      method:'OPTIONS',headers:{Origin:'https://preview.example.test',
        'Access-Control-Request-Method':'GET',
        'Access-Control-Request-Headers':'X-LearnFlow-Test-Token'}
    }),configured);
    assert.equal(preflight.status,403);
  });

});
