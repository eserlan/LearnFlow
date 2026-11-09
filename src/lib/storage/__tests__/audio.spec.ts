import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, type StoredLesson } from '../../storage/db';
import { storeLessonAudio, getLessonAudio, deleteAudioForDraft, listLessonIdsWithAudio } from '../../storage/audio';
import { createDraft, deleteDraft, saveDraftVersion } from '../../storage/drafts';
import { narratedText, speakLesson } from '../../lesson/speak';
import type { SourceDraft } from '../../import/types';

const lesson=(id='story:1',draftId='story'):StoredLesson=>({
  id,draftId,sourceVersion:1,title:'Fotosyntese',createdAt:Date.now(),
  sentences:[
    {text:'Planter bruker lys.',kind:'statement',sources:['original']},
    {text:'De trenger vann.',kind:'statement',sources:['original']}
  ]
});
const wavBytes=()=>{
  const bytes=new Uint8Array(48);
  bytes.set(new TextEncoder().encode('RIFF'),0);
  bytes.set(new TextEncoder().encode('WAVE'),8);
  return bytes;
};
const wav=()=>new Blob([wavBytes()],{type:'audio/wav'});
const draft=(id:string,at=Date.now()):SourceDraft=>({
  id,title:'Fotosyntese',plainText:'Planter bruker lys og trenger vann.',
  version:1,status:'pending',createdAt:at,lastActivityAt:at
});
afterEach(async()=>{await db.delete();await db.open();});

describe('local narration',()=>{
  it('speaks only the simplified lesson and validates the returned WAV',async()=>{
    const instance=lesson();
    expect(narratedText(instance)).toBe('Planter bruker lys.\nDe trenger vann.');
    const outbound=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const sent=JSON.parse(String(init?.body));
      expect(sent.lessonId).toBe(instance.id);
      expect(sent.text).toBe(narratedText(instance));
      expect(sent).not.toHaveProperty('plainText');
      return new Response(wav(),{status:200,headers:{'Content-Type':'audio/wav'}});
    });
    const result=await speakLesson(instance,'https://api.example.test/',outbound);
    expect(result.type).toBe('audio/wav');
    expect(outbound).toHaveBeenCalledOnce();
  });

  it('keeps audio on-device across reopening and removes it on deletion',async()=>{
    const entry=lesson();
    await createDraft(draft('story'));
    await db.lessons.put(entry);
    await storeLessonAudio(entry,wav());
    const reloaded=await getLessonAudio(entry.id);
    expect(reloaded?.type).toBe('audio/wav');
    expect(new Uint8Array(await reloaded!.arrayBuffer())).toEqual(wavBytes());
    expect((await db.audioAssets.get(entry.id))?.storage).toBe('indexeddb');
    await deleteDraft('story');
    expect(await getLessonAudio(entry.id)).toBeNull();
    expect(await db.audioAssets.count()).toBe(0);
  });

  it('drops old audio when editing a source version',async()=>{
    await createDraft(draft('edited'));
    const entry=lesson('edited:1','edited');
    await db.lessons.put(entry);
    await storeLessonAudio(entry,wav());
    await saveDraftVersion('edited',1,{blocks:[{id:'p',type:'paragraph',text:'Nytt',language:'nb',
      spans:[{representation:'text/plain',start:0,end:4}],included:true}],wordCount:1,language:'nb'},
    {title:'Ny tekst',origin:undefined,plainText:'Nytt'});
    expect(await db.audioAssets.count()).toBe(0);
    expect(await getLessonAudio(entry.id)).toBeNull();
  });

  it('refuses to store audio for deleted or stale lessons',async()=>{
    await expect(storeLessonAudio(lesson(),wav())).rejects.toThrow('Lesson changed');
    await deleteAudioForDraft('no-such-draft');
  });

  it('categorises Worker errors without revealing response bodies',async()=>{
    const result=speakLesson(lesson(),'https://api.example.test/',async()=>Response.json(
      {error:'provider_quota',message:'Secret or pupil text would be filtered'},
      {status:429,headers:{'Content-Type':'application/json'}}
    ));
    await expect(result).rejects.toMatchObject({code:'http-error',status:429,backendCode:'provider_quota'});
  });
});

describe('lessons with audio',()=>{
  it('lists only existing lessons that have saved audio',async()=>{
    for (const id of ['a','b']) {
      await createDraft(draft(id),{id:id+':1',draftId:id,version:1,blocks:[{id:'b-'+id,type:'paragraph',text:'Planter bruker lys.',language:'nb',spans:[],included:true}],wordCount:3,language:'nb'});
      await db.lessons.put(lesson(id+':1',id));
    }
    await storeLessonAudio(lesson('a:1','a'),wav());
    expect(await listLessonIdsWithAudio()).toEqual(['a:1']);
    // A leftover audio row for a lesson that no longer exists is not offered.
    await db.audioAssets.put({id:'ghost:1',draftId:'ghost',createdAt:Date.now(),storage:'indexeddb',blob:wav()});
    expect(await listLessonIdsWithAudio()).toEqual(['a:1']);
    await deleteAudioForDraft('a');
    expect(await listLessonIdsWithAudio()).toEqual([]);
  });
});
