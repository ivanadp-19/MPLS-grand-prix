<script>
  import { game, me, nodeLabels } from '../lib/stores.js';
  import { submitSwapPick } from '../lib/engine.js';

  let remaining = $state(0);
  let handle = null;

  $effect(() => {
    const endsAt = $game.deadlineMs;
    clearInterval(handle);
    if (!endsAt) return;
    const tick = () => { remaining = Math.max(0, (endsAt - Date.now()) / 1000); };
    tick();
    handle = setInterval(tick, 100);
    return () => clearInterval(handle);
  });

  let isReceiver = $derived(
    $game.phase === 'swap-choice' &&
    $game.swapChoiceFor === $me.id &&
    Array.isArray($game.swapChoiceOptions)
  );

  let senderLabel = $derived($nodeLabels[$game.lastResolution?.routerId] ?? $nodeLabels[$game.currentPlayerId] ?? '—');

  function pick(label) {
    submitSwapPick(label);
  }
</script>

{#if isReceiver}
  <div class="modal-backdrop">
    <div class="swap-modal">
      <h2>PULL A LABEL</h2>
      <p class="muted">
        {senderLabel} routed correctly. You must claim <strong class="warn-text">ONE</strong> of their labels.
        Timeout → random.
      </p>
      <div class="deadline-clock mt-2" class:critical={remaining < 2}>
        {remaining.toFixed(1)}s
      </div>
      <div class="options">
        {#each $game.swapChoiceOptions as opt}
          <button class="warn" onclick={() => pick(opt)}>{opt}</button>
        {/each}
      </div>
    </div>
  </div>
{/if}
