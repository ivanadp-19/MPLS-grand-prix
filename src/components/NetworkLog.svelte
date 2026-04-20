<script>
  import { game } from '../lib/stores.js';
  import { tick } from 'svelte';

  let logEl;

  $effect(() => {
    $game.networkLog;
    tick().then(() => {
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    });
  });
</script>

<div class="network-log" bind:this={logEl}>
  {#each $game.networkLog as entry}
    <div class="log-entry {entry.severity}">
      <span class="ts">[{entry.ts}]</span>{entry.line}
    </div>
  {/each}
  {#if $game.networkLog.length === 0}
    <div class="log-entry info muted">// idle :: no packets traversing…</div>
  {/if}
</div>
