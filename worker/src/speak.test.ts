import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { synthesizeLesson, validateSpeakPayload, TTS_MODEL } from './speak.ts';
import { handleRequest, type Env } from './index.ts';

const text='Planter trenger lys og vann. De vokser best når de får nok av begge deler.';
const input={ lessonId:'lesson-123:1',text };
const origin='https://learnflow-nine-pied.vercel.app';
const env:Env={GEMINI_API_KEY:'test-key', GEMINI_MODEL:'test-model',
  RATE_LIMITER:{limit:async()=>({success:true})}};
const wav=new Uint8Array(48);
wav.set(new TextEncoder().encode('RIFF'),0);
wav.set(new TextEncoder().encode('WAVE'),8);
wav.set(new TextEncoder().encode('fmt '),12);
const pcm=Buffer.from(wav).toString('base64');
const answer={steps:[{type:'model_output',content:[{type:'audio',mime_type:'audio/wav',data:pcm}]}]};
const mockProvider=async(url:string,options:RequestInit):Promise<Response>=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(options.redirect,'manual');
  assert.equal(options.method,'POST');
  const body=JSON.parse(String(options.body)) as Record<string,any>;
  assert.equal(body.model,TTS_MODEL);
  assert.equal(body.input[0].content[0].text,text);
  assert.deepEqual(body.response_format,{type:'audio',mime_type:'audio/wav'});
  assert.equal(body.generation_config.speech_config[0].voice,'Kore');
  return Response.json(answer);
};
function speakRequest(body:unknown=input):Request {
  return new Request('https://api.example.test/api/speak',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
      'CF-Connecting-IP':'192.0.2.123'},body:JSON.stringify(body)
  });
}

describe('Gemini text to speech',()=>{
  it('sends the exact simplified transcript via Interactions and returns RIFF WAV',async()=>{
    const audio=await synthesizeLesson(input,env,mockProvider);
    assert.deepEqual(audio,wav);
    const response=await handleRequest(speakRequest(),env,mockProvider);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('Content-Type'),'audio/wav');
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),wav);
  });

  it('rejects malformed, oversized and extra-field audio requests without calling Google',async()=>{
    assert.equal(validateSpeakPayload({...input,text:'x'}),null);
    assert.equal(validateSpeakPayload({...input,text:'too many '.repeat(2001)}),null);
    assert.equal(validateSpeakPayload({...input,lessonId:'../secret'}),null);
    assert.equal(validateSpeakPayload({...input,html:'<p>private</p>'}),null);
    assert.deepEqual(validateSpeakPayload(input),input);
    const response=await handleRequest(speakRequest({...input,text:'x'}),env,async()=>{
      throw Error('should not invoke provider');
    });
    assert.equal(response.status,422);
  });

  it('denies unknown origins and CORS preflight, allows canonical origin',async()=>{
    const denied=speakRequest();
    denied.headers.set('Origin','https://evil.example');
    const response=await handleRequest(denied,env);
    assert.equal(response.status,403);
    const preflight=await handleRequest(new Request('https://api.example.test/api/speak',{
      method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'Content-Type'}
    }),env);
    assert.equal(preflight.status,204);
  });

  it('fails before reading source content when key or limiter missing',async()=>{
    const missing=speakRequest();
    const result=await handleRequest(missing,{RATE_LIMITER:env.RATE_LIMITER});
    assert.equal(result.status,503);
    assert.equal(missing.bodyUsed,false);
    const limited=speakRequest();
    const denied=await handleRequest(limited,{
      ...env,RATE_LIMITER:{limit:async()=>({success:false})}
    });
    assert.equal(denied.status,429);
    assert.equal(limited.bodyUsed,false);
  });

  it('rejects invalid audio and returns safe upstream error codes without echoing response',async()=>{
    await assert.rejects(synthesizeLesson(input,env,async()=>Response.json({
      steps:[{type:'model_output',content:[{type:'audio',mime_type:'audio/wav',data:'abc'}]}]
    })),{code:'invalid-output'});
    const rejected=await handleRequest(speakRequest(),env,async()=>
      Response.json({error:{message:'source text and key never echoed'}},{status:404}));
    assert.equal(rejected.status,503);
    assert.deepEqual(await rejected.json(),{error:'provider_model_not_found'});
  });
});
