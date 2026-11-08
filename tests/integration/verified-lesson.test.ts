import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/storage/db';
import { createDraft, deleteDraft } from '../../src/lib/storage/drafts';
import { getVerifiedSentences, saveVerifiedLesson } from '../../src/lib/lesson/saved-lesson';

const real = {sourceVersion:1,verified:true,result:{
  kind:'simplified-lesson',schemaVersion:1,
  sentences:[{text:'De fleste planter trenger lys.',kind:'statement',sources:['original']}] }};

async function makeDraft(){
  await createDraft({id:'lesson-1',plainText:'De fleste planter trenger lys for å vokse.',
    title:'Planter',createdAt:Date.now(),lastActivityAt:Date.now(),status:'processed',version:1},
    {id:'lesson-1:1',draftId:'lesson-1',version:1,wordCount:8,language:'nb',
      blocks:[{id:'source-1',type:'paragraph',text:'De fleste planter trenger lys for å vokse.',
        language:'nb',spans:[{representation:'text/plain',start:0,end:42}],included:true}]});
}
afterEach(async()=>{await db.delete();await db.open();});

describe('verified lessons stay on device',()=>{
  it('rejects smoke fixtures and unverified payloads',()=>{
    expect(getVerifiedSentences({sourceVersion:1,verified:true,result:{kind:'smoke-fixture',forLearning:false}})).toBeNull();
    expect(getVerifiedSentences({...real,verified:false})).toBeNull();
    expect(getVerifiedSentences({...real,result:{kind:'simplified-lesson',schemaVersion:1,
      sentences:[{text:'Added text',kind:'statement',sources:['missing']}]}})).toBeNull();
  });
  it('saves and deletes verified lessons alongside their source',async()=>{
    await makeDraft();
    const lesson=await saveVerifiedLesson('lesson-1',real);
    expect(lesson.sentences[0].text).toBe('De fleste planter trenger lys.');
    expect(await db.lessons.count()).toBe(1);
    await deleteDraft('lesson-1');
    expect(await db.lessons.count()).toBe(0);
    expect(await db.documents.count()).toBe(0);
  });
  it('rejects result from a different source version',async()=>{
    await makeDraft();
    await expect(saveVerifiedLesson('lesson-1',{...real,sourceVersion:2})).rejects.toThrow('source changed');
    expect(await db.lessons.count()).toBe(0);
  });
});
