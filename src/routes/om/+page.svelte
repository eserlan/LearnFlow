<script lang="ts">
  import { onMount } from 'svelte';
  import '../learnflow.css';
  import { getCopy } from '../../lib/i18n';

  let language = $state<'nb' | 'nn'>('nb');
  let theme = $state<'light' | 'dark'>('light');
  const copy = $derived(getCopy(language));
  onMount(() => {
    try {
      const lang = localStorage.getItem('learnflow-lang');
      if (lang === 'nn' || lang === 'nb') language = lang;
      const stored = localStorage.getItem('learnflow-theme');
      if (stored) theme = stored === 'dark' ? 'dark' : 'light';
      else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) theme = 'dark';
    } catch { /* storage disabled */ }
  });
  $effect(() => { document.documentElement.lang = language; });
</script>

<svelte:head><title>{copy.aboutTitle} – LearnFlow</title></svelte:head>
<main class="learnflow-shell" data-theme={theme}>
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true">L</span><h1>LearnFlow</h1></div>
  </header>
  <div class="content about">
    <p><a href="/">{copy.aboutBack}</a></p>
    <div class="hero"><h2>{copy.aboutTitle}</h2><p>{copy.aboutIntro}</p></div>
    <section><h2>{copy.aboutDoesTitle}</h2><p>{copy.aboutDoes}</p></section>
    <section><h2>{copy.aboutLeavesOutTitle}</h2><p>{copy.aboutLeavesOut}</p></section>
    <section><h2>{copy.aboutMistakesTitle}</h2><p>{copy.aboutMistakes}</p></section>
    <section><h2>{copy.aboutPrivacyTitle}</h2>
      <p>{copy.aboutPrivacy1}</p><p>{copy.aboutPrivacy2}</p><p>{copy.aboutPrivacy3}</p></section>
    <section><h2>{copy.aboutDeleteTitle}</h2><p>{copy.aboutDelete}</p></section>
  </div>
</main>
