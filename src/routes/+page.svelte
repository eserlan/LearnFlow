<script lang="ts">
  import { onMount, tick } from 'svelte';
  import './learnflow.css';
  import { readClipboardEvent } from '../lib/import/clipboard';
  import { prepareSource } from '../lib/import/prepare';
  import { createDraft, deleteDraft, getCurrentDocument, saveDraftVersion, updateSelection, touchDraft } from '../lib/storage/drafts';
  import { purgeExpiredDrafts, daysUntilExpiry, shouldWarnExpiry } from '../lib/storage/expiry';
  import { purgeExpiredLessons, touchLesson, setLessonPinned } from '../lib/storage/lessons';
  import { db, type StoredLesson } from '../lib/storage/db';
  import { getCopy } from '../lib/i18n';
  import { simplifyDraft } from '../lib/lesson/handoff';
  import { createWorkerProcessor, WorkerProcessorError } from '../lib/lesson/worker-processor';
  import { saveVerifiedLesson } from '../lib/lesson/saved-lesson';
  import { renderInline, renderMarkdown, plainTitle } from '../lib/markdown';
  import { groupSentences, wordCount, type LessonSentence } from '../lib/lesson/layout';
  import { narratedText, speakLesson } from '../lib/lesson/speak';
  import { getLessonAudio, storeLessonAudio, listLessonIdsWithAudio } from '../lib/storage/audio';
  import type { SourceBlock, SourceDraft } from '../lib/import/types';

  let text = $state('');
  let html = $state<string | undefined>();
  let origin = $state('');
  let sourceElement = $state<HTMLTextAreaElement | null>(null);
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
  // Playing a saved lesson straight from the list, without opening it.
  let audioIds = $state<Set<string>>(new Set());
  let listPlaying = $state<{id:string;title:string;url:string}|null>(null);
  let listPaused = $state(false);
  let listAudio = $state<HTMLAudioElement | null>(null);
  let audioBusy = $state(false);
  let audioError = $state('');
  let audioStatus = $state('');
  let selectedDraft = $state<SourceDraft | null>(null);
  let selectedBlocks = $state<SourceBlock[]>([]);
  let resumeId = $state<string | null>(null);
  let pendingReplacement = $state<{blocks:SourceBlock[];wordCount:number;title:string}|null>(null);
  let retryId = $state<string|null>(null);
  let errorDetail = $state('');
  // Soft delete: the item disappears at once and is only really deleted after the undo window.
  let undo = $state<{id:string;title:string}|null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let textSize = $state(1);      // 0..3
  let clearFont = $state(false);
  let spacious = $state(false);
  let lessonTitleElement = $state<HTMLElement | null>(null);
  const MAX_WORDS = 2000;
  const title = (value:string) => plainTitle(value) || value;
  let language = $state<'nb'|'nn'>('nb');
  let hintSeen = $state(true);   // set from storage on mount, so it never flashes for returning users
  let sourceOpen = $state(false);
  let theme = $state<'light'|'dark'>('light');
  const copy = $derived(getCopy(language));
  const inputWordCount = $derived((text.match(/[\p{L}\p{N}]+/gu) ?? []).length);
  const visibleDrafts = $derived(drafts.filter(d => d.id !== undo?.id));
  const visibleLessons = $derived(lessons.filter(l => l.draftId !== undo?.id));
  const lessonBlocks = $derived(selectedLesson ? groupSentences(selectedLesson.sentences) : []);
  const liveBlocks = $derived(groupSentences(live));
  const SIZES = ['1rem','1.125rem','1.3rem','1.5rem'];
  function savePrefs() {
    try { localStorage.setItem('learnflow-reading',JSON.stringify({textSize,clearFont,spacious})); } catch { /* storage disabled */ }
  }
  function changeSize(step:number) { textSize = Math.min(3,Math.max(0,textSize+step)); savePrefs(); }
  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('learnflow-theme',theme); } catch { /* storage disabled */ }
  }

  $effect(() => { document.documentElement.lang = language; });
  // Saved on change only: an effect would overwrite the stored choice with the default before it is read.
  function saveLanguage() {
    try { localStorage.setItem('learnflow-lang',language); } catch { /* storage disabled */ }
  }
  function dismissHint() {
    hintSeen = true;
    try { localStorage.setItem('learnflow-hint-seen','1'); } catch { /* storage disabled */ }
  }
  onMount(() => {
    try {
      const lang = localStorage.getItem('learnflow-lang');
      if (lang === 'nn' || lang === 'nb') language = lang;
      hintSeen = localStorage.getItem('learnflow-hint-seen') === '1';
      const stored = localStorage.getItem('learnflow-theme');
      if (stored) theme = stored === 'dark' ? 'dark' : 'light';
      else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) theme = 'dark';
      const prefs = JSON.parse(localStorage.getItem('learnflow-reading') ?? 'null');
      if (prefs && typeof prefs === 'object') {
        if (Number.isInteger(prefs.textSize) && prefs.textSize >= 0 && prefs.textSize <= 3) textSize = prefs.textSize;
        clearFont = prefs.clearFont === true; spacious = prefs.spacious === true;
      }
    } catch { /* storage disabled or unreadable */ }
    void cleanupAndRefresh();
    const timer = setInterval(() => void cleanupAndRefresh(), 60_000);
    return () => { clearInterval(timer); void commitUndo(); stopListPlayback(); if (audioUrl) URL.revokeObjectURL(audioUrl); };
  });
  async function cleanupAndRefresh() {
    await purgeExpiredDrafts();
    const active = [
      ...(selectedLesson ? [selectedLesson.id] : []),
      ...(listPlaying ? [listPlaying.id] : []),
      ...lessons.filter((lesson) => lesson.draftId === undo?.id).map((lesson) => lesson.id)
    ];
    await purgeExpiredLessons(Date.now(), active);
    await refresh();
  }
  async function refresh() {
    drafts = (await db.drafts.where('status').anyOf('pending','failed','processing').toArray())
      .sort((a,b) => b.lastActivityAt - a.lastActivityAt);
    lessons = await db.lessons.orderBy('createdAt').reverse().toArray();
    audioIds = new Set(await listLessonIdsWithAudio());
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
      await saveAndRun(prepared.blocks,prepared.wordCount,prepared.title);
    } catch { error = copy.empty; }
  }
  /** Saves the draft, then simplifies it. The pasted text stays in the box until the lesson is saved,
   * so a failed request can be retried (or the text edited) without pasting again. */
  async function saveAndRun(blocks:SourceBlock[], words:number, draftTitle:string) {
    const id = await persist(blocks,words,draftTitle);
    if (!id) return;
    resumeId = id;
    await runSimplification(id);
  }
  async function applyReplacement(replace:boolean) {
    const pending = pendingReplacement;
    if (!pending || busy) return;
    if (replace && drafts.length) { await deleteDraft(drafts[0].id); await refresh(); }
    pendingReplacement = null;
    await saveAndRun(pending.blocks,pending.wordCount,pending.title);
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

  const TECHNICAL = ['apiUrlError','apiKeyError','modelConfigError','rateLimiterError','workerNotReady',
    'workerConnectionError','geminiCredentialsError','geminiModelError','geminiRequestError','geminiQuotaError','invalidSourceError'] as const;
  /** Pupils get one calm message; setup details for a teacher or developer sit in a fold. */
  function showError(cause: unknown, checkingCapabilities: boolean) {
    const message = readableSimplificationError(cause, checkingCapabilities);
    const technical = TECHNICAL.some(key => copy[key] === message);
    error = technical ? copy.serviceProblem : message;
    errorDetail = technical ? message : '';
  }

  async function runSimplification(id:string) {
    if (busy) return;
    busy = true; error = ''; errorDetail = ''; retryId = null; status = copy.checkingService; phase = 'checking'; live = [];
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
      text = ''; html = undefined; origin = ''; resumeId = null;
      // The streamed draft gives way to the checked lesson, rendered properly from the final result.
      live = [];
      await showLesson(lesson);
      status = copy.completed;
      await refresh();
      await tick();
      focusLesson();
    } catch (cause) {
      // A malformed or unpersistable response must remain retryable, never a completed ghost lesson.
      const draft = await db.drafts.get(id);
      if (draft?.status === 'processed' && !(await db.lessons.get(draft.id+':'+draft.version))) {
        await touchDraft(id,'failed');
      }
      showError(cause, checkingCapabilities);
      retryId = id;
      status = '';
      live = [];
      await refresh();
    } finally { busy = false; phase = 'idle'; }
  }
  function stopListPlayback() {
    listAudio?.pause();
    if (listPlaying) URL.revokeObjectURL(listPlaying.url);
    listPlaying = null; listPaused = false;
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }
  /** One tap on the list: play that lesson's saved audio. Starting another lesson stops the first. */
  async function playFromList(lesson:StoredLesson) {
    if (listPlaying?.id === lesson.id) {
      if (listAudio?.paused) {
        await touchLesson(lesson.id);
        void listAudio.play().catch(() => {});
      } else listAudio?.pause();
      return;
    }
    stopListPlayback();
    const wav = await getLessonAudio(lesson.id);
    if (!wav) { error = copy.audioUnavailable; await refresh(); return; }
    const accessed = await touchLesson(lesson.id);
    if (!accessed) { error = copy.unavailable; await refresh(); return; }
    listPlaying = {id:accessed.id,title:title(accessed.title),url:URL.createObjectURL(wav)};
    await tick();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({title:listPlaying.title,artist:'LearnFlow'});
      navigator.mediaSession.setActionHandler('play',() => void listAudio?.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause',() => listAudio?.pause());
      navigator.mediaSession.setActionHandler('stop',stopListPlayback);
    }
    void listAudio?.play().catch(() => { listPaused = true; });
  }
  async function focusLesson() {
    await tick();
    lessonTitleElement?.scrollIntoView({block:'start'});
    lessonTitleElement?.focus({preventScroll:true});
  }
  async function openLesson(lesson:StoredLesson) { await showLesson(lesson); await focusLesson(); }
  function clearAudioPlayer() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    audioError = '';
    audioStatus = '';
  }
  function closeLesson() {
    selectedLesson = null;
    sourceOpen = false;
    selectedLessonSource = '';
    clearAudioPlayer();
    window.scrollTo({top:0});
  }
  async function showLesson(lesson:StoredLesson) {
    if (audioBusy) return;
    stopListPlayback();
    const source=await db.drafts.get(lesson.draftId);
    if (!source || source.version !== lesson.sourceVersion) { error=copy.unavailable; return; }
    const accessed = await touchLesson(lesson.id);
    if (!accessed) { error = copy.unavailable; return; }
    clearAudioPlayer();
    selectedLessonSource=source.plainText;
    selectedLesson=accessed;
    lessons = lessons.map((item) => item.id === accessed.id ? accessed : item);
    const wav=await getLessonAudio(accessed.id);
    if (wav && selectedLesson?.id===accessed.id) audioUrl=URL.createObjectURL(wav);
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
      audioIds = new Set([...audioIds, lesson.id]);
    } catch (cause) {
      audioError=storing ? copy.audioStorageFailed : readableSimplificationError(cause,false);
      if (!(cause instanceof WorkerProcessorError) && !storing) audioError=copy.audioNotAvailable;
      if (cause instanceof WorkerProcessorError && cause.code==='invalid-response') audioError=copy.audioNotAvailable;
      audioStatus='';
    } finally { audioBusy=false; }
  }
  async function togglePin(lesson: StoredLesson) {
    const updated = await setLessonPinned(lesson.id, lesson.pinned !== true);
    if (!updated) { await refresh(); return; }
    lessons = lessons.map((item) => item.id === updated.id ? updated : item);
    if (selectedLesson?.id === updated.id) selectedLesson = updated;
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
  async function commitUndo() {
    clearTimeout(undoTimer);
    const pending = undo;
    undo = null;
    if (!pending) return;
    await deleteDraft(pending.id);
    if (selectedLesson?.draftId===pending.id) closeLesson();
    await refresh();
  }
  /** Removes the item from view and deletes it for real after a few seconds, unless the pupil taps Angre. */
  async function discard(id:string, label:string) {
    if (busy) return;
    await commitUndo();
    if (selectedLesson?.draftId===id) closeLesson();
    if (listPlaying && lessons.some(l => l.draftId===id && l.id===listPlaying!.id)) stopListPlayback();
    undo = {id,title:label};
    undoTimer = setTimeout(() => void commitUndo(), 7000);
  }
  function undoDiscard() { clearTimeout(undoTimer); undo = null; }
</script>

<svelte:head><title>{copy.title}</title><meta name="description" content={copy.description}/></svelte:head>
{#snippet blocksView(blocks: ReturnType<typeof groupSentences>)}
  {#each blocks as block, i (i)}
    {#if block.type === 'heading'}<h3>{@html renderInline(block.text)}</h3>
    {:else if block.type === 'quote'}<blockquote>{@html renderInline(block.text)}</blockquote>
    {:else if block.type === 'list'}<ul class="items">{#each block.items as item, j (j)}<li>{@html renderInline(item)}</li>{/each}</ul>
    {:else if block.type === 'tasks'}<ol class="tasks">{#each block.items as item, j (j)}<li>{@html renderInline(item)}</li>{/each}</ol>
    {:else if block.type === 'paragraph'}<p>{@html renderInline(block.text)}</p>{/if}
  {/each}
{/snippet}

<main class="learnflow-shell" data-theme={theme}>
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true">L</span><h1>LearnFlow</h1></div>
    <div class="language-control"><label for="lang">{copy.languageLabel}</label>
      <select id="lang" bind:value={language} onchange={saveLanguage}><option value="nb">{copy.bokmal}</option><option value="nn">{copy.nynorsk}</option></select></div>
    <button type="button" class="theme-toggle" onclick={toggleTheme} aria-label={theme === 'light' ? copy.darkMode : copy.lightMode} title={theme === 'light' ? copy.darkMode : copy.lightMode}>{theme === 'light' ? '☾' : '☀'}</button>
  </header>

  <div class="content">
  {#if undo}
    <div class="toast" role="status">
      <span>{copy.deleted}: {title(undo.title)}</span>
      <button type="button" class="secondary" onclick={undoDiscard}>{copy.undo}</button>
    </div>
  {/if}

  {#if !selectedLesson}
  <div class="hero"><h2 id="paste-title">{copy.action}</h2><p>{copy.tagline}</p></div>
  {#if !lessons.length && !drafts.length && !busy}
    <ol class="how" aria-label={copy.howTitle}>
      <li><span class="num" aria-hidden="true">1</span>{copy.howStep1}</li>
      <li><span class="num" aria-hidden="true">2</span>{copy.howStep2}</li>
      <li><span class="num" aria-hidden="true">3</span>{copy.howStep3}</li>
    </ol>
  {/if}
  <section class="composer" aria-labelledby="paste-title">
    <label for="source">{copy.prompt}</label>
    <textarea id="source" bind:value={text} bind:this={sourceElement} onpaste={pasted} rows="9" placeholder={copy.placeholder}></textarea>
    <details class="origin-field" open={!!origin}>
      <summary>{copy.originOptional}</summary>
      <label for="origin" class="visually-hidden">{copy.origin}</label>
      <input id="origin" bind:value={origin} maxlength="120" placeholder={copy.origin}/>
    </details>
    <p class="note">{copy.privacyShort}</p>
    <details class="more"><summary>{copy.privacyMore}</summary><p class="note">{copy.processingNotice}</p></details>
    <div class="composer-footer">
      <span class="word-count" class:near={inputWordCount > MAX_WORDS * 0.9 && inputWordCount <= MAX_WORDS} class:over={inputWordCount > MAX_WORDS}>
        {inputWordCount.toLocaleString('nb-NO')} {copy.wordLimit}
      </span>
      <button onclick={prepareAndSave} disabled={busy} aria-busy={busy}>
        {#if busy}<span class="spinner" aria-hidden="true"></span>{copy.working}{:else}{copy.start}{/if}
      </button>
    </div>
    {#if error}
      <div class="problem">
        <p role="alert">{error}</p>
        {#if retryId && !busy}<button type="button" onclick={() => runSimplification(retryId!)}>{copy.retry}</button>{/if}
        {#if errorDetail}<details><summary>{copy.details}</summary><p class="note">{errorDetail}</p></details>{/if}
      </div>
    {/if}
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
    <article class="lesson live" bind:this={liveElement} aria-label={copy.draftLabel} style:--lesson-size={SIZES[textSize]}>
      <p class="note">{copy.draftLabel}</p>
      {@render blocksView(liveBlocks)}
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

  {#if visibleLessons.length}
    <section aria-labelledby="lessons-title">
      <h2 id="lessons-title">{copy.myLessons}</h2>
      <p class="note expiry">{copy.lessonExpiryNote}</p>
      <ul class="lesson-list">{#each visibleLessons as lesson (lesson.id)}
        <li>
          <button class="row" onclick={() => void openLesson(lesson)} aria-label={`${copy.showLesson}: ${title(lesson.title)}`}>
            <span class="row-title">{title(lesson.title)}</span>
            <span class="row-meta">{new Date(lesson.createdAt).toLocaleDateString(language === 'nn' ? 'nn-NO' : 'nb-NO',{day:'numeric',month:'short'})} · {wordCount(lesson.sentences)} {copy.wordsShort}</span>
          </button>
          {#if audioIds.has(lesson.id)}
            {@const active = listPlaying?.id === lesson.id && !listPaused}
            <button class="play" type="button" aria-pressed={active}
              aria-label={`${active ? copy.pauseLesson : copy.playLesson}: ${title(lesson.title)}`}
              onclick={() => void playFromList(lesson)}><span aria-hidden="true">{active ? '⏸' : '▶'}</span></button>
          {/if}
          <button class="pin secondary" type="button" aria-pressed={lesson.pinned === true}
            aria-label={`${lesson.pinned ? copy.unpinLesson : copy.pinLesson}: ${title(lesson.title)}`}
            title={lesson.pinned ? copy.unpinLesson : copy.pinLesson}
            onclick={() => void togglePin(lesson)}><span aria-hidden="true">📌</span></button>
          <button class="danger" onclick={() => discard(lesson.draftId,lesson.title)}>{copy.discard}</button>
        </li>
      {/each}</ul>
    </section>
  {/if}

  {#if visibleDrafts.length}
    <section aria-labelledby="unfinished-title">
      <h2 id="unfinished-title">{copy.unfinished}</h2>
      <p class="note expiry">{copy.expiryNote}</p>
      <ul>{#each visibleDrafts as draft (draft.id)}
        <li>
          <strong>{title(draft.title)}</strong> — {daysUntilExpiry(draft.lastActivityAt)} {copy.days}
          {#if shouldWarnExpiry(draft.lastActivityAt)} <span>{copy.deleteSoon}</span>{/if}
          <div class="actions">
            <button onclick={() => runSimplification(draft.id)} disabled={busy}>{copy.simplify}</button>
            <button class="secondary" onclick={() => editDraft(draft)} disabled={busy}>{copy.edit}</button>
            <button class="secondary" onclick={() => showOriginal(draft)}>{copy.original}</button>
            <button class="danger" onclick={() => discard(draft.id,draft.title)} disabled={busy}>{copy.discard}</button>
          </div>
        </li>
      {/each}</ul>
    </section>
  {/if}

  {#if selectedDraft}
    <section aria-labelledby="original-title">
      <h2 id="original-title">{copy.originalTitle.replace('{title}',title(selectedDraft.title))}</h2>
      {#each selectedBlocks as block (block.id)}
        <label class="checkbox"><input type="checkbox" bind:checked={block.included}/><span class="md">{@html renderMarkdown(block.text)}</span></label>
      {/each}
      <button onclick={saveSelection}>{copy.saveSelection}</button>
      <button class="secondary" onclick={() => selectedDraft=null}>{copy.close}</button>
    </section>
  {/if}
  {:else}
    <article aria-labelledby="lesson-title" class="lesson reading" class:clear-font={clearFont} class:spacious
      style:--lesson-size={SIZES[textSize]}>
      <div class="reading-bar">
        <button class="secondary back" onclick={closeLesson} disabled={audioBusy}>{copy.back}</button>
        <details class="reading-fold"><summary>{copy.readingOptions}</summary>
        <div class="reading-options" role="group" aria-label={copy.readingOptions}>
          <button type="button" class="secondary" onclick={() => changeSize(-1)} disabled={textSize===0} aria-label={copy.smaller}>A−</button>
          <button type="button" class="secondary" onclick={() => changeSize(1)} disabled={textSize===3} aria-label={copy.larger}>A+</button>
          <button type="button" class="secondary" aria-pressed={clearFont} onclick={() => { clearFont=!clearFont; savePrefs(); }}>{copy.clearFont}</button>
          <button type="button" class="secondary" aria-pressed={spacious} onclick={() => { spacious=!spacious; savePrefs(); }}>{copy.spacious}</button>
        </div>
        </details>
      </div>
      <h2 id="lesson-title" tabindex="-1" bind:this={lessonTitleElement}>{title(selectedLesson.title)}</h2>
      {#if !hintSeen}
        <div class="hint" role="note"><strong>{copy.hintTitle}:</strong> {copy.hintBody}
          <button type="button" class="secondary" onclick={dismissHint}>{copy.hintDismiss}</button></div>
      {/if}
      <div class="audio-panel">
        {#if audioUrl}
          <audio controls preload="metadata" src={audioUrl} aria-label={copy.playAudio}></audio>
          <a href={audioUrl} download="LearnFlow-leksjon.wav">{copy.downloadAudio}</a>
        {:else}
          <button type="button" onclick={() => makeAudio(selectedLesson!)} disabled={audioBusy}>
            <span aria-hidden="true">🔊</span> {audioBusy ? copy.makingAudio : copy.makeAudio}
          </button>
          <p class="note">{copy.audioNotice}</p>
        {/if}
        {#if audioStatus}<p role="status">{audioStatus}</p>{/if}
        {#if audioError}<p role="alert">{audioError}</p>{/if}
      </div>
      {@render blocksView(lessonBlocks)}
      <p class="note caution" role="note">{copy.cautionLead}
        <button type="button" class="linklike" onclick={() => { sourceOpen = true; }}>{copy.cautionLink}</button>.</p>
      <details bind:open={sourceOpen}><summary>{copy.showSource}</summary><div class="source-text md">{@html renderMarkdown(selectedLessonSource)}</div></details>
      <button class="secondary" onclick={closeLesson} disabled={audioBusy}>{copy.close}</button>
    </article>
  {/if}
  <footer class="site-footer"><a href="/om">{copy.aboutLink}</a></footer>
</div>
{#if listPlaying}
  <div class="mini-player" role="region" aria-label={copy.nowPlaying}>
    <span class="mp-title"><span class="mp-label">{copy.nowPlaying}</span> {listPlaying.title}</span>
    <audio bind:this={listAudio} src={listPlaying.url} controls
      onplay={() => listPaused = false} onpause={() => listPaused = true} onended={stopListPlayback}></audio>
    <button type="button" class="secondary" onclick={stopListPlayback}>{copy.stopPlayback}</button>
  </div>
{/if}
</main>
