<script lang="ts">
  import { onMount, tick } from 'svelte';
  import './learnflow.css';
  import { readClipboardEvent } from '../lib/import/clipboard';
  import { prepareSource } from '../lib/import/prepare';
  import { createDraft, deleteDraft, getCurrentDocument, saveDraftVersion, updateSelection, touchDraft } from '../lib/storage/drafts';
  import { purgeExpiredDrafts, daysUntilExpiry, shouldWarnExpiry } from '../lib/storage/expiry';
  import { db, type StoredLesson } from '../lib/storage/db';
  import { getCopy } from '../lib/i18n';
  import { simplifyDraft } from '../lib/lesson/handoff';
  import { createWorkerProcessor, WorkerProcessorError } from '../lib/lesson/worker-processor';
  import { saveVerifiedLesson } from '../lib/lesson/saved-lesson';
  import { narratedText, speakLesson } from '../lib/lesson/speak';
  import { getLessonAudio, storeLessonAudio } from '../lib/storage/audio';
  import type { SourceBlock, SourceDraft } from '../lib/import/types';

  let text = $state('');
  let html = $state<string | undefined>();
  let origin = $state('');
  let sourceElement: HTMLTextAreaElement;
  let error = $state('');
  let status = $state('');
  let busy = $state(false);
  // Where a simplification is: not started, request sent, received by the service, sentences arriving.
  let phase = $state<'idle'|'checking'|'sending'|'received'|'writing'|'saving'>('idle');
  let live = $state<{text:string;kind:string}[]>([]);
  const phaseStep = $derived({idle:0,checking:0,sending:1,received:2,writing:3,saving:4}[phase]);
  let liveElement = $state<HTMLElement | null>(null);
  let drafts = $state<SourceDraft[]>([]);
  let lessons = $state<StoredLesson[]>([]);
  let selectedLesson = $state<StoredLesson | null>(null);
  let selectedLessonSource = $state('');
  let audioUrl = $state<string | null>(null);
  let audioBusy = $state(false);
  let audioError = $state('');
  let audioStatus = $state('');
  let selectedDraft = $state<SourceDraft | null>(null);
  let selectedBlocks = $state<SourceBlock[]>([]);
  let resumeId = $state<string | null>(null);
  let pendingReplacement = $state<{blocks:SourceBlock[];wordCount:number;title:string}|null>(null);
  let language = $state<'nb'|'nn'>('nb');
  let theme = $state<'light'|'dark'>('light');
  const copy = $derived(getCopy(language));
  const inputWordCount = $derived((text.match(/[\p{L}\p{N}]+/gu) ?? []).length);
  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('learnflow-theme',theme); } catch { /* storage disabled */ }
  }

  $effect(() => { document.documentElement.lang = language; });
  onMount(() => {
    try { if (localStorage.getItem('learnflow-theme') === 'dark') theme = 'dark'; } catch { /* storage disabled */ }
    void (async () => { await purgeExpiredDrafts(); await refresh(); })();
    const timer = setInterval(async () => { await purgeExpiredDrafts(); await refresh(); }, 60_000);
    return () => { clearInterval(timer); if (audioUrl) URL.revokeObjectURL(audioUrl); };
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
      if (id) await runSimplification(id);
    } catch { error = copy.empty; }
  }
  async function applyReplacement(replace:boolean) {
    const pending = pendingReplacement;
    if (!pending || busy) return;
    if (replace && drafts.length) { await deleteDraft(drafts[0].id); await refresh(); }
    pendingReplacement = null;
    const id = await persist(pending.blocks,pending.wordCount,pending.title);
    if (id) await runSimplification(id);
  }
  /** Called only by an explicit Forenkle button click (or its save-and-send continuation).
   * The visible notice explains that this sends plain text to Gemini.
   * The Worker independently enforces the production release gate. */
  function readableSimplificationError(cause: unknown, checkingCapabilities: boolean): string {
    if (cause instanceof WorkerProcessorError) {
      if (cause.code === 'unavailable') return copy.workerConnectionError;
      if (cause.code === 'invalid-response') return copy.invalidAiResponse;
      switch (cause.backendCode) {
        case 'provider_credentials': return copy.geminiCredentialsError;
        case 'provider_model_not_found': return copy.geminiModelError;
        case 'provider_bad_request': return copy.geminiRequestError;
        case 'provider_quota': return copy.geminiQuotaError;
        case 'invalid-output': return copy.invalidAiResponse;
        case 'rate_limited': return copy.rateLimitedError;
        case 'rate_limit_unavailable': return copy.rateLimiterError;
        case 'invalid_request': return copy.invalidSourceError;
        case 'processing_not_enabled': return copy.workerNotReady;
        case 'unavailable': return copy.geminiUnavailableError;
      }
      if (cause.status === 429) return copy.rateLimitedError;
      return copy.geminiUnavailableError;
    }
    if (cause instanceof Error) {
      switch (cause.message) {
        case 'not-configured': case 'invalid-url': return copy.apiUrlError;
        case 'missing_api_key': return copy.apiKeyError;
        case 'missing_model': return copy.modelConfigError;
        case 'missing_rate_limiter': return copy.rateLimiterError;
        case 'not-enabled': return copy.workerNotReady;
      }
    }
    return checkingCapabilities ? copy.workerConnectionError : copy.unavailable;
  }

  async function runSimplification(id:string) {
    if (busy) return;
    busy = true; error = ''; status = copy.checkingService; phase = 'checking'; live = [];
    let checkingCapabilities = true;
    try {
      const api = import.meta.env.VITE_LEARNFLOW_API_URL;
      if (typeof api !== 'string' || !api) throw new Error('not-configured');
      const url = new URL(api);
      if (url.protocol !== 'https:' || url.pathname !== '/') throw new Error('invalid-url');
      // Check availability without sending source text.
      const availability = await fetch(new URL('/capabilities',url), {
        method:'GET',credentials:'omit',cache:'no-store',redirect:'error'
      });
      if (!availability.ok) throw new Error('capabilities-unreachable');
      const capabilities: {simplify?:boolean;reason?:string} = await availability.json();
      if (capabilities?.simplify !== true) throw new Error(capabilities?.reason ?? 'not-enabled');
      checkingCapabilities = false;
      status = copy.sending; phase = 'sending';
      const response = await simplifyDraft(id,
        {canProcess:async () => true}, createWorkerProcessor(api), {
          onAccepted: () => { phase = 'received'; status = copy.received; },
          onSentence: (sentence) => {
            live.push(sentence);
            if (phase !== 'writing') {
              phase = 'writing'; status = copy.writing;
              void tick().then(() => liveElement?.scrollIntoView({block:'nearest',behavior:'smooth'}));
            }
          },
          onReset: () => { live = []; phase = 'received'; status = copy.received; }
        });
      phase = 'saving';
      const lesson = await saveVerifiedLesson(id,response);
      // The streamed draft gives way to the checked lesson, rendered properly from the final result.
      live = [];
      await showLesson(lesson);
      status = copy.completed;
      await refresh();
      await tick();
      document.getElementById('lesson-title')?.scrollIntoView({block:'start'});
    } catch (cause) {
      // A malformed or unpersistable response must remain retryable, never a completed ghost lesson.
      const draft = await db.drafts.get(id);
      if (draft?.status === 'processed' && !(await db.lessons.get(draft.id+':'+draft.version))) {
        await touchDraft(id,'failed');
      }
      error = readableSimplificationError(cause, checkingCapabilities);
      status = '';
      live = [];
      await refresh();
    } finally { busy = false; phase = 'idle'; }
  }
  function clearAudioPlayer() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    audioError = '';
    audioStatus = '';
  }
  function closeLesson() {
    selectedLesson = null;
    selectedLessonSource = '';
    clearAudioPlayer();
  }
  async function showLesson(lesson:StoredLesson) {
    if (audioBusy) return;
    const source=await db.drafts.get(lesson.draftId);
    if (!source || source.version !== lesson.sourceVersion) { error=copy.unavailable; return; }
    clearAudioPlayer();
    selectedLessonSource=source.plainText;
    selectedLesson=lesson;
    const wav=await getLessonAudio(lesson.id);
    if (wav && selectedLesson?.id===lesson.id) audioUrl=URL.createObjectURL(wav);
  }
  async function makeAudio(lesson:StoredLesson) {
    if (audioBusy || audioUrl || selectedLesson?.id!==lesson.id) return;
    audioError='';
    const source=narratedText(lesson);
    if (source.length > 12_000) { audioError=copy.audioTooLong; return; }
    const api=import.meta.env.VITE_LEARNFLOW_API_URL;
    if (typeof api!=='string' || !api) { audioError=copy.apiUrlError; return; }
    audioBusy=true;
    audioStatus=copy.makingAudio;
    let storing=false;
    try {
      const wav=await speakLesson(lesson,api);
      storing=true;
      await storeLessonAudio(lesson,wav);
      if (selectedLesson?.id===lesson.id) {
        clearAudioPlayer();
        audioUrl=URL.createObjectURL(wav);
        audioStatus=copy.audioReady;
      }
    } catch (cause) {
      audioError=storing ? copy.audioStorageFailed : readableSimplificationError(cause,false);
      if (!(cause instanceof WorkerProcessorError) && !storing) audioError=copy.audioNotAvailable;
      if (cause instanceof WorkerProcessorError && cause.code==='invalid-response') audioError=copy.audioNotAvailable;
      audioStatus='';
    } finally { audioBusy=false; }
  }
  async function editDraft(draft:SourceDraft) {
    const document = await getCurrentDocument(draft.id);
    text = draft.plainText; html = draft.html; origin = draft.origin ?? ''; resumeId = draft.id;
    selectedBlocks = document?.blocks ?? prepareSource({plainText:draft.plainText,html:draft.html}).blocks;
    selectedDraft = null; error = ''; status = copy.restored;
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
    if (selectedLesson?.draftId===id) closeLesson();
    await refresh();
  }
</script>

<svelte:head><title>{copy.title}</title><meta name="description" content={copy.description}/></svelte:head>
<main class="learnflow-shell" data-theme={theme}>
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true">L</span><h1>LearnFlow</h1></div>
    <div class="language-control"><label for="lang">{copy.languageLabel}</label>
      <select id="lang" bind:value={language}><option value="nb">{copy.bokmal}</option><option value="nn">{copy.nynorsk}</option></select></div>
    <button type="button" class="theme-toggle" onclick={toggleTheme} aria-label={theme === 'light' ? copy.darkMode : copy.lightMode} title={theme === 'light' ? copy.darkMode : copy.lightMode}>{theme === 'light' ? '☾' : '☀'}</button>
  </header>

  <div class="content">
  <div class="hero"><h2 id="paste-title">{copy.action}</h2><p>{copy.tagline}</p></div>
  <section class="composer" aria-labelledby="paste-title">
    <label for="source">{copy.prompt}</label>
    <textarea id="source" bind:value={text} bind:this={sourceElement} onpaste={pasted} rows="9" placeholder={copy.placeholder}></textarea>
    <label for="origin">{copy.origin}</label><input id="origin" bind:value={origin} maxlength="120"/>
    <p class="note">{copy.processingNotice}</p>
    <div class="composer-footer">
      <span class="word-count">{inputWordCount} {copy.count}</span>
      <button onclick={prepareAndSave} disabled={busy} aria-busy={busy}>
        {#if busy}<span class="spinner" aria-hidden="true"></span>{copy.working}{:else}{copy.start}{/if}
      </button>
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
    {#if busy && phase !== 'idle'}
      <div class="progress" aria-hidden="true">
        <ol class="steps">
          <li class:done={phaseStep > 1} class:current={phaseStep === 1}>{copy.stepSending}</li>
          <li class:done={phaseStep > 2} class:current={phaseStep === 2}>{copy.stepReceived}</li>
          <li class:done={phaseStep > 3} class:current={phaseStep === 3}>{copy.stepWriting}</li>
          <li class:done={phaseStep > 4} class:current={phaseStep === 4}>{copy.stepDone}</li>
        </ol>
        <div class="bar"><span></span></div>
      </div>
    {/if}
    {#if status}<p role="status">{status}</p>{/if}
  </section>

  {#if live.length}
    <article class="lesson live" bind:this={liveElement} aria-label={copy.draftLabel}>
      <p class="note">{copy.draftLabel}</p>
      {#each live as sentence, i (i)}
        {#if sentence.kind === 'heading'}<h3>{sentence.text}</h3>
        {:else if sentence.kind === 'task'}<p class="task">{sentence.text}</p>
        {:else if sentence.kind === 'quote'}<blockquote>{sentence.text}</blockquote>
        {:else}<p>{sentence.text}</p>{/if}
      {/each}
      <span class="caret" aria-hidden="true"></span>
    </article>
  {/if}

  {#if pendingReplacement}
    <section aria-labelledby="replace-title">
      <h2 id="replace-title">{copy.replaceTitle}</h2><p>{copy.replaceBody}</p>
      <button onclick={() => applyReplacement(true)}>{copy.replaceAction}</button>
      <button onclick={() => applyReplacement(false)}>{copy.newAction}</button>
      <button onclick={() => pendingReplacement=null}>{copy.cancel}</button>
    </section>
  {/if}

  {#if drafts.length}
    <section aria-labelledby="unfinished-title">
      <h2 id="unfinished-title">{copy.unfinished}</h2>
      <p class="note">{copy.processingNotice}</p>
      <ul>{#each drafts as draft (draft.id)}
        <li>
          <strong>{draft.title}</strong> — {daysUntilExpiry(draft.lastActivityAt)} {copy.days}
          {#if shouldWarnExpiry(draft.lastActivityAt)} <span>{copy.deleteSoon}</span>{/if}
          <div class="actions">
            <button onclick={() => runSimplification(draft.id)} disabled={busy}>{copy.simplify}</button>
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
          <button class="secondary" onclick={() => void showLesson(lesson)}>{copy.showLesson}</button>
          <button class="secondary" onclick={() => discard(lesson.draftId)}>{copy.discard}</button>
        </li>
      {/each}</ul>
    </section>
  {/if}

  {#if selectedLesson}
    <article aria-labelledby="lesson-title" class="lesson">
      <h2 id="lesson-title">{selectedLesson.title}</h2>
      <p class="note" role="note">{copy.aiCaution}</p>
      <div class="audio-panel">
        {#if audioUrl}
          <audio controls preload="metadata" src={audioUrl} aria-label={copy.playAudio}></audio>
          <a href={audioUrl} download="LearnFlow-leksjon.wav">{copy.downloadAudio}</a>
        {:else}
          <p class="note">{copy.audioNotice}</p>
          <button type="button" onclick={() => makeAudio(selectedLesson!)} disabled={audioBusy}>
            {audioBusy ? copy.makingAudio : copy.makeAudio}
          </button>
        {/if}
        {#if audioStatus}<p role="status">{audioStatus}</p>{/if}
        {#if audioError}<p role="alert">{audioError}</p>{/if}
      </div>
      {#each selectedLesson.sentences as sentence, i (i)}
        {#if sentence.kind === 'heading'}<h3>{sentence.text}</h3>
        {:else if sentence.kind === 'task'}<p class="task">{sentence.text}</p>
        {:else if sentence.kind === 'quote'}<blockquote>{sentence.text}</blockquote>
        {:else}<p>{sentence.text}</p>{/if}
      {/each}
      <details><summary>{copy.showSource}</summary><p class="source-text">{selectedLessonSource}</p></details>
      <button class="secondary" onclick={closeLesson} disabled={audioBusy}>{copy.close}</button>
    </article>
  {/if}
</div>
</main>
