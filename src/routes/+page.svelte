<script lang="ts">
 import { onMount } from 'svelte';
 import { readClipboardEvent } from '../lib/import/clipboard';
 import { prepareSource } from '../lib/import/prepare';
 import { createDraft, deleteDraft, getCurrentDocument, saveDraftVersion, updateSelection, touchDraft } from '../lib/storage/drafts';
 import { purgeExpiredDrafts, shouldWarnExpiry, daysUntilExpiry } from '../lib/storage/expiry';
 import { db } from '../lib/storage/db';
 import { getCopy } from '../lib/i18n';
 import type { SourceDraft } from '../lib/import/types';

 let text = $state(''); let html = $state<string | undefined>(); let origin = $state('');
 let error = $state(''); let status = $state(''); let busy = $state(false);
 let drafts = $state<SourceDraft[]>([]); let overLimit = $state(false); let sections = $state<string[]>([]);
 let selectedDraft = $state<SourceDraft | null>(null); let selectedBlocks = $state<import('../lib/import/types').SourceBlock[]>([]);
 let resumeId = $state<string | null>(null);
 let pendingReplacement = $state<import('../lib/import/types').SourceBlock[] | null>(null); let replacementTitle=$state(''); let replacementWords=$state(0);
 let language = $state<'nb'|'nn'>('nb');
 const copy = $derived(getCopy(language));
 $effect(() => { document.documentElement.lang = language; });
 onMount(()=>{ void (async()=>{await purgeExpiredDrafts(); await refresh();})(); const timer=setInterval(async()=>{ await purgeExpiredDrafts(); await refresh(); },60_000); return ()=>clearInterval(timer); });
 async function refresh(){ drafts=(await db.drafts.where('status').anyOf('pending','failed','processing').toArray()).sort((a,b)=>b.lastActivityAt-a.lastActivityAt); }
 function pasted(e: ClipboardEvent){ if(!e.clipboardData || !e.clipboardData.getData('text/plain')) return; e.preventDefault(); const data=readClipboardEvent(e); text=data.plainText; html=data.html; }
 function makeLesson(){
  error=''; status='';
  try { const prepared=prepareSource({plainText:text,html}); if(prepared.language==='unsupported'){ error=copy.other; return; }
   if(prepared.needsSectionChoice){ overLimit=true; sections=prepared.blocks.filter(b=>b.included).map(b=>b.id); pendingBlocks=prepared.blocks; pendingTitle=prepared.title; return; }
   if(!resumeId && drafts.length){pendingReplacement=prepared.blocks;replacementTitle=prepared.title;replacementWords=prepared.wordCount;return;}
   void save(prepared.blocks,prepared.wordCount,prepared.title);
  } catch(e){ error=e instanceof Error?e.message:copy.empty; }
 }
 async function save(blocks: import('../lib/import/types').SourceBlock[], words:number,title:string){ busy=true; status=copy.progress;
  try { const now=Date.now();const id=resumeId??crypto.randomUUID();const draft=resumeId?await db.drafts.get(id):undefined;
   if(resumeId&&!draft)throw new Error('Draft no longer exists');
   if(draft){await saveDraftVersion(id,draft.version,{blocks,wordCount:words,language:blocks[0]?.language??'uncertain'},{title,origin:origin.trim()||undefined});}
   else {const fresh:SourceDraft={id,plainText:text,html,title,origin:origin.trim()||undefined,createdAt:now,lastActivityAt:now,status:'pending',version:1};await createDraft(fresh,{id:`${id}:1`,draftId:id,version:1,blocks,wordCount:words,language:'uncertain'});}
   status=copy.saved; text=''; html=undefined; origin=''; resumeId=null; await refresh();
  }catch(e){error=e instanceof Error?e.message:'Could not save this text on this device.';}finally{busy=false;}
 }
 let pendingBlocks=$state<import('../lib/import/types').SourceBlock[]>([]); let pendingTitle=$state('');
 function proceed(){const chosen=new Set(sections);const blocks=pendingBlocks.filter(b=>chosen.has(b.id));if(!blocks.length){error=copy.section;return;}const words=blocks.reduce((n,b)=>n+(b.text.match(/[\p{L}\p{N}]+/gu)?.length??0),0);if(words>2000){error=copy.sectionTooLong;return;}overLimit=false;void save(blocks,words,pendingTitle);}
 async function applyReplacement(replace:boolean){const blocks=pendingReplacement;if(!blocks)return;if(replace&&drafts.length){await deleteDraft(drafts[0].id);await refresh();}pendingReplacement=null;await save(blocks,replacementWords,replacementTitle);}
 async function discard(id:string){await deleteDraft(id);await refresh();}
 async function showOriginal(draft:SourceDraft){selectedDraft=draft;selectedBlocks=(await db.documents.get(`${draft.id}:${draft.version}`))?.blocks??prepareSource({plainText:draft.plainText,html:draft.html}).blocks;}
 async function continueDraft(draft:SourceDraft){const document=await getCurrentDocument(draft.id);text=draft.plainText;html=draft.html;origin=draft.origin??'';resumeId=draft.id;pendingBlocks=document?.blocks??prepareSource({plainText:draft.plainText,html:draft.html}).blocks;pendingTitle=draft.title;sections=pendingBlocks.filter(b=>b.included).map(b=>b.id);selectedDraft=null;status=copy.restored;await touchDraft(draft.id);}
 async function saveSelection(){if(!selectedDraft)return;try{const ids=selectedBlocks.filter(b=>b.included).map(b=>b.id);if(!ids.length)throw new Error(copy.selectionEmpty);const words=selectedBlocks.filter(b=>b.included).reduce((n,b)=>n+(b.text.match(/[\p{L}\p{N}]+/gu)?.length??0),0);await updateSelection(selectedDraft.id,ids,words);selectedDraft=null;await refresh();}catch(e){error=e instanceof Error?e.message:'Could not save selection.';}}
</script>

<svelte:head><title>{copy.title}</title><meta name="description" content={copy.description} /></svelte:head>
<main>
 <header><h1>{copy.title}</h1><label for="language">{copy.languageLabel}</label><select id="language" bind:value={language}><option value="nb">{copy.bokmal}</option><option value="nn">{copy.nynorsk}</option></select></header>
 <section aria-labelledby="paste-title"><h2 id="paste-title">{copy.action}</h2>
 <label for="source">{copy.prompt}</label><textarea id="source" bind:value={text} onpaste={pasted} rows="12" autocomplete="off"></textarea>
 <label for="origin">{copy.origin}</label><input id="origin" bind:value={origin} maxlength="120" />
 <button onclick={makeLesson} disabled={busy}>{copy.start}</button>
 {#if error}<p role="alert">{error}</p>{/if}{#if status}<p role="status">{status}</p>{/if}
 </section>
 {#if overLimit}<section aria-labelledby="sections-title"><h2 id="sections-title">{copy.tooLong}</h2><p>{sections.reduce((n,id)=>n+(pendingBlocks.find(b=>b.id===id)?.text.match(/[\p{L}\p{N}]+/gu)?.length??0),0)} {copy.count}</p>{#each pendingBlocks as block (block.id)}<label><input type="checkbox" bind:group={sections} value={block.id}/><strong>{block.type==='heading'?copy.part:''}</strong>{block.text}</label>{/each}<button onclick={proceed}>{copy.continueAction}</button></section>{/if}
 {#if pendingReplacement}<section aria-labelledby="replace-title"><h2 id="replace-title">{copy.replaceTitle}</h2><p>{copy.replaceBody}</p><button onclick={()=>applyReplacement(true)}>{copy.replaceAction}</button><button onclick={()=>applyReplacement(false)}>{copy.newAction}</button><button onclick={()=>pendingReplacement=null}>{copy.cancel}</button></section>{/if}
 {#if drafts.length}<section aria-labelledby="unfinished-title"><h2 id="unfinished-title">{copy.unfinished}</h2><ul>{#each drafts as draft}<li><strong>{draft.title}</strong> — {daysUntilExpiry(draft.lastActivityAt)} {copy.days}{#if shouldWarnExpiry(draft.lastActivityAt)} <span>{copy.deleteSoon}</span>{/if}<button onclick={()=>continueDraft(draft)}>{copy.continue}</button><button onclick={()=>showOriginal(draft)}>{copy.original}</button><button onclick={()=>discard(draft.id)}>{copy.discard}</button></li>{/each}</ul></section>{/if}
 {#if selectedDraft}<section aria-labelledby="original-title"><h2 id="original-title">{copy.originalTitle.replace('{title}', selectedDraft.title)}</h2><ul>{#each selectedBlocks as block (block.id)}<li><label><input type="checkbox" bind:checked={block.included}/>{block.text}{#if block.excludedReason}<small>{copy.excluded}</small>{/if}</label></li>{/each}</ul><button onclick={saveSelection}>{copy.saveSelection}</button><button onclick={()=>selectedDraft=null}>{copy.close}</button></section>{/if}
</main>

<style>
 main{max-width:42rem;margin:0 auto;padding:1.25rem;font:1.125rem/1.6 system-ui,sans-serif}header{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}h1{margin-right:auto}section{margin-block:2rem}label{display:block;margin-block:.75rem .25rem}textarea,input:not([type=checkbox]),select{box-sizing:border-box;width:100%;padding:.75rem;font:inherit}button{margin:.75rem 0;padding:.75rem 1.2rem;font:inherit}button:focus-visible,textarea:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #175cd3;outline-offset:2px}li{margin-block:1rem} [role=alert]{color:#9b1c1c}
</style>
