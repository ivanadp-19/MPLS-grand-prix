<script>
  import { game, me, nodeLabels } from '../lib/stores.js';
  import { submitRoute, submitIntercept } from '../lib/engine.js';
  import NodeCard from './NodeCard.svelte';

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

  let isMyTurn = $derived($game.currentPlayerId === $me.id);
  let amEliminated = $derived(($game.eliminated ?? []).includes($me.id));
  let phase = $derived($game.phase);

  let canRoute = $derived(phase === 'routing' && isMyTurn && !amEliminated);
  let canIntercept = $derived(
    phase === 'challenging' && !isMyTurn && !amEliminated && !$game.challenger
  );
  let totalSec = $derived(
    phase === 'routing' ? $game.config.routeTimeMs / 1000 :
    phase === 'challenging' ? $game.config.challengeTimeMs / 1000 :
    phase === 'swap-choice' ? $game.config.swapChoiceTimeMs / 1000 :
    1
  );

  let currentNodeLabel = $derived($nodeLabels[$game.currentPlayerId] ?? '—');

  function onRoute(targetId) {
    if (!canRoute) return;
    submitRoute(targetId);
  }

  function onIntercept() {
    if (!canIntercept) return;
    submitIntercept();
  }
</script>

<div>
  <div class="phase-header">
    {#if phase === 'routing'}
      <div class="phase-badge">⟦ ROUTING :: {currentNodeLabel} ⟧</div>
    {:else if phase === 'challenging'}
      <div class="phase-badge warn">⟦ INTERCEPT WINDOW ⟧</div>
    {:else if phase === 'swap-choice'}
      <div class="phase-badge warn">⟦ SWAP PENDING ⟧</div>
    {:else if phase === 'resolving'}
      <div class="phase-badge {$game.lastResolution?.correct ? '' : 'alert'}">⟦ RESOLVED ⟧</div>
    {/if}
    <div class="deadline-clock" class:critical={remaining < 3}>{remaining.toFixed(1)}s</div>
  </div>
  <div class="timer-bar">
    <div class="timer-fill" style="width: {Math.min(100, (remaining / totalSec) * 100)}%;"></div>
  </div>

  <div class="package">
    <div class="package-label">// PAYLOAD</div>
    <div class="package-animal">[ {$game.packageAnimal ?? '—'} ]</div>
    <div class="package-label mt-1">
      {#if phase === 'routing' && isMyTurn}
        SELECT THE NODE THAT CURRENTLY HOLDS THIS LABEL
      {:else if phase === 'routing'}
        {currentNodeLabel} IS ROUTING…
      {:else if phase === 'challenging'}
        {currentNodeLabel} ROUTED → {$nodeLabels[$game.routingTarget] ?? '?'} :: VERIFY OR INTERCEPT
      {:else if phase === 'swap-choice'}
        {$nodeLabels[$game.swapChoiceFor] ?? '?'} IS PULLING A LABEL…
      {:else if phase === 'resolving'}
        PACKET PROCESSED
      {/if}
    </div>
  </div>

  <div class="node-grid">
    {#each $game.turnOrder as pid}
      <NodeCard
        playerId={pid}
        clickable={canRoute && pid !== $game.currentPlayerId && !($game.eliminated ?? []).includes(pid)}
        onclick={onRoute}
      />
    {/each}
  </div>

  {#if phase === 'challenging' && canIntercept}
    <div class="center mt-3">
      <button class="danger" onclick={onIntercept}>⟦ INTERCEPT ⟧</button>
      <div class="muted mt-1" style="font-size:0.8rem;">Flag the route as incorrect. False intercept = +1 overflow.</div>
    </div>
  {:else if phase === 'challenging' && !canIntercept && isMyTurn}
    <div class="center mt-3 muted">// awaiting verification…</div>
  {:else if phase === 'challenging' && amEliminated}
    <div class="center mt-3 muted">// you are OFFLINE — cannot intercept</div>
  {/if}
</div>
