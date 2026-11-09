<script lang="ts" generics="T extends string">
  /** A small two-or-three-way choice shown as a radio group (used for the interface and output language). */
  let { value = $bindable(), label, options, onchange }: {
    value: T;
    label: string;
    options: { value: T; text: string; lang?: string }[];
    onchange?: () => void;
  } = $props();

  function choose(next: T) {
    if (next === value) return;
    value = next;
    onchange?.();
  }
  /** Arrow keys move the choice, as in any radio group. */
  function key(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex(o => o.value === value);
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    choose(options[(index + step + options.length) % options.length].value);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="segmented" role="radiogroup" aria-label={label} onkeydown={key}>
  {#each options as option (option.value)}
    <button type="button" role="radio" class="segment" aria-checked={value === option.value}
      tabindex={value === option.value ? 0 : -1} lang={option.lang}
      onclick={() => choose(option.value)}>{option.text}</button>
  {/each}
</div>
