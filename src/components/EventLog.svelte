<script>
  import { eventLog } from '../lib/stores.js';
  import { tick } from 'svelte';

  let logEl;

  $effect(() => {
    $eventLog; // re-run when log updates
    tick().then(() => {
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    });
  });
</script>

<div class="chat-log" bind:this={logEl}>
  {#each $eventLog as entry}
    <div class="log-entry {entry.type}">[{entry.ts}] {entry.msg}</div>
  {/each}
</div>
