import type { StoredLesson } from '../storage/db';
import { WorkerProcessorError } from './worker-processor';
import { stripMarkdown } from '../markdown';

export function narratedText(lesson: StoredLesson): string {
  return lesson.sentences.map((sentence) => stripMarkdown(sentence.text).trim()).filter(Boolean).join('\n');
}

/** Returns a binary WAV only. The key, origin policy and rate limiting live on the Worker. */
export async function speakLesson(
  lesson: StoredLesson,
  apiBaseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<Blob> {
  const base=new URL(apiBaseUrl);
  if ((base.protocol!=='https:' &&
      !(base.protocol==='http:' && ['localhost','127.0.0.1'].includes(base.hostname))) ||
      base.username || base.password || base.search || base.hash || base.pathname!=='/') {
    throw new WorkerProcessorError('unavailable');
  }
  let response:Response;
  try {
    response=await fetcher(new URL('/api/speak',base),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({lessonId:lesson.id,text:narratedText(lesson)}),
      credentials:'omit',cache:'no-store',redirect:'error'
    });
  } catch { throw new WorkerProcessorError('unavailable'); }

  if (!response.ok) {
    let code: string | undefined;
    try {
      if (response.headers.get('Content-Type')?.startsWith('application/json')) {
        const payload:unknown=await response.json();
        if (payload && typeof payload==='object') {
          const error=(payload as Record<string,unknown>).error;
          if (typeof error==='string' && /^[a-z_]{1,64}$/.test(error)) code=error;
        }
      }
    } catch { /* No private response details in UI. */ }
    throw new WorkerProcessorError('http-error',response.status,code);
  }
  if (response.headers.get('Content-Type')?.split(';')[0]?.trim()!=='audio/wav') {
    throw new WorkerProcessorError('invalid-response');
  }
  let wav:Blob;
  try { wav=await response.blob(); }
  catch { throw new WorkerProcessorError('invalid-response'); }
  if (wav.size < 44 || wav.size > 24*1024*1024) throw new WorkerProcessorError('invalid-response');
  const header=new Uint8Array(await wav.slice(0,12).arrayBuffer());
  const ascii=(start:number,end:number)=>String.fromCharCode(...header.slice(start,end));
  if (ascii(0,4)!=='RIFF' || ascii(8,12)!=='WAVE') throw new WorkerProcessorError('invalid-response');
  return new Blob([wav],{type:'audio/wav'});
}
