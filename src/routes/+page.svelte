<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { readClipboardEvent } from '../lib/import/clipboard';
  import { prepareSource } from '../lib/import/prepare';
  import { createDraft, deleteDraft, getCurrentDocument, saveDraftVersion, updateSelection, touchDraft } from '../lib/storage/drafts';
  import { purgeExpiredDrafts, daysUntilExpiry, shouldWarnExpiry } from '../lib/storage/expiry';
  import { db, type StoredLesson } from '../lib/storage/db';
  import { getCopy } from '../lib/i18n';
  import { simplifyDraft } from '../lib/lesson/handoff';
  import { createWorkerProcessor } from '../lib/lesson/worker-processor';
  import { saveVerifiedLesson } from '../lib/lesson/saved-lesson';
  import type { SourceBlock, SourceDraft } from '../lib/import/types';

  let text = $state('');
  let html = $state<string | undefined>();
  let origin = $state('');
  let sourceElement: HTMLTextAreaElement;
  let error = $state('');
  let status = $state('');
  let busy = $state(false);
  let drafts = $state<SourceDraft[]>([]);
  let lessons = $state<StoredLesson[]>([]);
  let selectedLesson = $state<StoredLesson | null>(null);
  let selectedDraft = $state<SourceDraft | null>(null);
  let selectedBlocks = $state<SourceBlock[]>([]);
  let resumeId = $state<string | null>(null);
  let pendingReplacement = $state<{blocks:SourceBlock[];wordCount:number;title:string}|null>(null);
  let pendingConsentId = $state<string | null>(null);
  let ageBand = $state<'unknown'|'under13'|'13plus'>('unknown');
  let consentChecked = $state(false);
  let language = $state<'nb'|'nn'>('nb');
  const copy = $derived(getCopy(language));

  $effect(() => { document.documentElement.lang = language; });
  onMount(() => {
    void (async () => { await purgeExpiredDrafts(); await refresh(); })();
    const timer = setInterval(async () => { await purgeExpiredDrafts(); await refresh(); }, 60_000);
    return () => clearInterval(timer);
  });
  async function refresh() {
    drafts = (await db.drafts.where('status').anyOf('pending','failed','processing').toArray())
      .sort((a,b) => b.lastActivityAt - a.lastActivityAt);
    lessons = await db.lessons.orderBy('createdAt').reverse().toArray();
  }
  function pasted(event:ClipboardEvent) {
    if (!event.clipboardData?.getData('text/plain')) return;
    event.preventDefault();
    const input = readClipboardEvent(event);
    text = input.plainText;
    html = input.html;
  }
  async function persist(blocks:SourceBlock[], wordCount:number, title:string): Promise<string|null> {
    busy = true; error = ''; status = copy.progress;
    try {
      const now = Date.now();
      const id = resumeId ?? crypto.randomUUID();
      const existing = resumeId ? await db.drafts.get(id) : undefined;
      if (resumeId && !existing) throw new Error('Utkastet finnes ikke lenger.');
      if (existing) {
        await saveDraftVersion(id, existing.version, {blocks,wordCount,language:'uncertain'},
          {title,origin:origin.trim()||undefined,plainText:text,html});
      } else {
        const draft: SourceDraft = {id,plainText:text,html,title,origin:origin.trim()||undefined,
          createdAt:now,lastActivityAt:now,status:'pending',version:1};
        await createDraft(draft,{id:id+':1',draftId:id,version:1,blocks,wordCount,language:'uncertain'});
      }
      text = ''; html = undefined; origin = ''; resumeId = null;
      status = copy.saved;
      await refresh();
      return id;
    } catch {
      error = copy.saveFailed;
      return null;
    } finally { busy = false; }
  }
  async function prepareAndSave() {
    if (busy) return;
    error = ''; status = '';
    try {
      const prepared = prepareSource({plainText:text,html});
      if (prepared.needsSectionChoice) { error = copy.tooLong; return; }
      if (!resumeId && drafts.length) {
        pendingReplacement = {blocks:prepared.blocks,wordCount:prepared.wordCount,title:prepared.title};
        return;
      }
      const id = await persist(prepared.blocks,prepared.wordCount,prepared.title);
      if (id) await openConsent(id);
    } catch { error = copy.empty; }
  }
  async function applyReplacement(replace:boolean) {
    const pending = pendingReplacement;
    if (!pending || busy) return;
    if (replace && drafts.length) { await deleteDraft(drafts[0].id); await refresh(); }
    pendingReplacement = null;
    const id = await persist(pending.blocks,pending.wordCount,pending.title);
    if (id) await openConsent(id);
  }
  async function openConsent(draftId:string) {
    pendingConsentId = draftId;
    ageBand = 'unknown'; consentChecked = false; error = '';
    await tick();
    document.getElementById('consent-title')?.scrollIntoView({block:'start'});
  }
  async function sendForSimplification() {
    const id = pendingConsentId;
    if (!id || busy) return;
    if (ageBand !== '13plus' || !consentChecked) { error = copy.consentRequired; return; }
    busy = true; error = ''; status = copy.checkingService;
    try {
      const api = import.meta.env.VITE_LEARNFLOW_API_URL;
      if (typeof api !== 'string' || !api) throw new Error('not-configured');
      const url = new URL(api);
      if (url.protocol !== 'https:' || url.pathname !== '/') throw new Error('invalid-url');
      // Check WITHOUT sending source text. Fail closed if backend is not yet approved/enabled.
      const availability = await fetch(new URL('/capabilities',url), {
        method:'GET',credentials:'omit',cache:'no-store',redirect:'error'
      });
      if (!availability.ok || (await availability.json())?.simplify !== true) throw new Error('not-enabled');
      pendingConsentId = null;
      status = copy.simplifying;
      const response = await simplifyDraft(id,
        {canProcess:async () => consentChecked && ageBand === '13plus'}, createWorkerProcessor(api));
      const lesson = await saveVerifiedLesson(id,response);
      selectedLesson = lesson;
      status = copy.completed;
      await refresh();
      await tick();
      document.getElementById('lesson-title')?.scrollIntoView({block:'start'});
    } catch {
      error = copy.unavailable;
      status = '';
      await refresh();
    } finally { busy = false; }
  }
  async function editDraft(draft:SourceDraft) {
    const document = await getCurrentDocument(draft.id);
    text = draft.plainText; html = draft.html; origin = draft.origin ?? ''; resumeId = draft.id;
    selectedBlocks = document?.blocks ?? prepareSource({plainText:draft.plainText,html:draft.html}).blocks;
    selectedDraft = null; pendingConsentId = null; error = ''; status = copy.restored;
    await touchDraft(draft.id); await tick();
    sourceElement?.scrollIntoView({block:'start'}); sourceElement?.focus({preventScroll:true});
  }
  async function showOriginal(draft:SourceDraft) {
    selectedDraft = draft;
    selectedBlocks = (await getCurrentDocument(draft.id))?.blocks ??
      prepareSource({plainText:draft.plainText,html:draft.html}).blocks;
  }
  async function saveSelection() {
    if (!selectedDraft) return;
    try {
      const chosen = selectedBlocks.filter(x=>x.included);
      if (!chosen.length) throw new Error('empty');
      const count = chosen.reduce((n,x)=>n+(x.text.match(/[\p{L}\p{N}]+/gu)?.length??0),0);
      await updateSelection(selectedDraft.id,chosen.map(x=>x.id),count);
      selectedDraft = null; await refresh();
    } catch { error = copy.selectionEmpty; }
  }
  async function discard(id:string) {
    if (busy) return;
    await deleteDraft(id);
    if (selectedLesson?.draftId===id) selectedLesson = null;
    if (pendingConsentId===id) pendingConsentId = null;
    await refresh();
  }
</script>

<svelte:head><title>{copy.title}</title><meta name="description" content={copy.description}/></svelte:head>
<main>
  <header><h1>LearnFlow</h1><label for="lang">{copy.languageLabel}</label>
    <select id="lang" bind:value={language}><option value="nb">{copy.bokmal}</option><option value="nn">{copy.nynorsk}</option></select></header>

  <section aria-labelledby="paste-title">
    <h2 id="paste-title">{copy.action}</h2>
    <label for="source">{copy.prompt}</label>
    <textarea id="source" bind:value={text} bind:this={sourceElement} onpaste={pasted} rows="9"></textarea>
    <label for="origin">{copy.origin}</label><input id="origin" bind:value={origin} maxlength="120"/>
    <button onclick={prepareAndSave} disabled={busy}>{copy.start}</button>
    <p class="note">{copy.processingUnavailable}</p>
    {#if error}<p role="alert">{error}</p>{/if}
    {#if status}<p role="status">{status}</p>{/if}
  </section>

  {#if pendingReplacement}
    <section aria-labelledby="replace-title">
      <h2 id="replace-title">{copy.replaceTitle}</h2><p>{copy.replaceBody}</p>
      <button onclick={() => applyReplacement(true)}>{copy.replaceAction}</button>
      <button onclick={() => applyReplacement(false)}>{copy.newAction}</button>
      <button onclick={() => pendingReplacement=null}>{copy.cancel}</button>
    </section>
  {/if}

  {#if pendingConsentId}
    <section aria-labelledby="consent-title" class="step">
      <h2 id="consent-title">{copy.consentTitle}</h2>
      <p>{copy.privacyNotice}</p>
      <label for="age">{copy.ageLabel}</label>
      <select id="age" bind:value={ageBand}>
        <option value="unknown">{copy.ageChoose}</option>
        <option value="under13">{copy.under13}</option>
        <option value="13plus">{copy.age13plus}</option>
      </select>
      {#if ageBand === 'under13'}
        <p role="alert">{copy.guardianRequired}</p>
      {:else if ageBand === '13plus'}
        <label class="checkbox"><input type="checkbox" bind:checked={consentChecked}/> {copy.consentLabel}</label>
      {/if}
      <button onclick={sendForSimplification} disabled={busy || ageBand !== '13plus' || !consentChecked}>
        {busy ? copy.simplifying : copy.sendToAi}
      </button>
      <button class="secondary" onclick={() => pendingConsentId=null} disabled={busy}>{copy.cancel}</button>
    </section>
  {/if}

  {#if drafts.length}
    <section aria-labelledby="unfinished-title">
      <h2 id="unfinished-title">{copy.unfinished}</h2>
      <ul>{#each drafts as draft (draft.id)}
        <li>
          <strong>{draft.title}</strong> — {daysUntilExpiry(draft.lastActivityAt)} {copy.days}
          {#if shouldWarnExpiry(draft.lastActivityAt)} <span>{copy.deleteSoon}</span>{/if}
          <div class="actions">
            <button onclick={() => openConsent(draft.id)} disabled={busy}>{copy.simplify}</button>
            <button class="secondary" onclick={() => editDraft(draft)} disabled={busy}>{copy.edit}</button>
            <button class="secondary" onclick={() => showOriginal(draft)}>{copy.original}</button>
            <button class="secondary" onclick={() => discard(draft.id)} disabled={busy}>{copy.discard}</button>
          </div>
        </li>
      {/each}</ul>
    </section>
  {/if}

  {#if selectedDraft}
    <section aria-labelledby="original-title">
      <h2 id="original-title">{copy.originalTitle.replace('{title}',selectedDraft.title)}</h2>
      {#each selectedBlocks as block (block.id)}
        <label class="checkbox"><input type="checkbox" bind:checked={block.included}/>{block.text}</label>
      {/each}
      <button onclick={saveSelection}>{copy.saveSelection}</button>
      <button class="secondary" onclick={() => selectedDraft=null}>{copy.close}</button>
    </section>
  {/if}

  {#if lessons.length}
    <section aria-labelledby="lessons-title">
      <h2 id="lessons-title">{copy.myLessons}</h2>
      <ul>{#each lessons as lesson (lesson.id)}
        <li><strong>{lesson.title}</strong>
          <button class="secondary" onclick={() => selectedLesson=lesson}>{copy.showLesson}</button>
          <button class="secondary" onclick={() => discard(lesson.draftId)}>{copy.discard}</button>
        </li>
      {/each}</ul>
    </section>
  {/if}

  {#if selectedLesson}
    <article aria-labelledby="lesson-title" class="lesson">
      <h2 id="lesson-title">{selectedLesson.title}</h2>
      {#each selectedLesson.sentences as sentence, i (i)}
        {#if sentence.kind === 'heading'}<h3>{sentence.text}</h3>
        {:else if sentence.kind === 'task'}<p class="task">{sentence.text}</p>
        {:else if sentence.kind === 'quote'}<blockquote>{sentence.text}</blockquote>
        {:else}<p>{sentence.text}</p>{/if}
      {/each}
      <button class="secondary" onclick={() => selectedLesson=null}>{copy.close}</button>
    </article>
  {/if}
</main>

<style>
  main{max-width:44rem;margin:0 auto;padding:1.25rem;font:1.1rem/1.6 system-ui,sans-serif}
  header{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
  h1{margin-right:auto}
  section,article{margin-block:2rem}
  label{display:block;margin:.75rem 0 .25rem}
  textarea,input:not([type=checkbox]),select{box-sizing:border-box;width:100%;padding:.75rem;font:inherit}
  button{margin:.6rem .4rem .4rem 0;padding:.65rem 1.05rem;min-height:44px;font:inherit;cursor:pointer}
  button:disabled{opacity:.6;cursor:default}
  button.secondary{border:1px solid #666;border-radius:.35rem;background:transparent;color:inherit}
  .actions{display:flex;flex-wrap:wrap;gap:.2rem}
  .note{font-size:.9rem;color:inherit;opacity:.75}
  .step,.lesson{padding:1rem;border:1px solid #999;border-radius:.75rem}
  .checkbox{display:flex;align-items:start;gap:.6rem}
  .checkbox input{width:auto;margin-top:.45rem}
  ul{list-style:none;padding:0}
  li{margin-block:1rem;padding-bottom:.75rem;border-bottom:1px solid #aaa}
  .lesson p{margin:.6rem 0}
  .lesson h3{margin:1.4rem 0 .5rem}
  .task{border-left:3px solid #777;padding-left:.8rem}
  [role=alert]{color:#b91c1c}
  button:focus-visible,textarea:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #175cd3;outline-offset:2px}
</style>
