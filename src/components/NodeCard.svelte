<script>
  import { game, me, nodeLabels } from '../lib/stores.js';

  let { playerId, clickable = false, onclick = null } = $props();

  let player = $derived($game.players[playerId]);
  let nodeId = $derived($nodeLabels[playerId] ?? 'NODE-??');
  let isMe = $derived(playerId === $me.id);
  let isCurrent = $derived(playerId === $game.currentPlayerId);
  let isTarget = $derived(playerId === $game.routingTarget);
  let isEliminated = $derived(($game.eliminated ?? []).includes(playerId));

  let resolutionClass = $derived.by(() => {
    const r = $game.lastResolution;
    if (!r) return '';
    if (r.targetId === playerId && r.correct) return 'correct';
    if (r.targetId === playerId && !r.correct) return 'wrong';
    return '';
  });
</script>

{#snippet inner()}
  <div class="node-id">
    <span class="node-swatch" style="background: {player?.color ?? '#00ff41'};"></span>
    {nodeId}
  </div>
  <div class="node-nick">{player?.nickname ?? '—'}</div>
  {#if isEliminated}
    <div class="alert-text mt-1" style="font-size:0.75rem; letter-spacing:0.1em;">// OFFLINE</div>
  {:else if isCurrent}
    <div class="warn-text mt-1" style="font-size:0.75rem; letter-spacing:0.1em;">// ROUTING</div>
  {:else if isMe}
    <div class="muted mt-1" style="font-size:0.75rem; letter-spacing:0.1em;">// you</div>
  {/if}
{/snippet}

{#if clickable}
  <button
    type="button"
    class="node-card"
    class:me={isMe}
    class:current={isCurrent}
    class:target={isTarget}
    class:eliminated={isEliminated}
    class:correct={resolutionClass === 'correct'}
    class:wrong={resolutionClass === 'wrong'}
    onclick={() => onclick?.(playerId)}
    style="font-family:var(--mono-body); text-transform:none; letter-spacing:0;"
  >
    {@render inner()}
  </button>
{:else}
  <div
    class="node-card disabled"
    class:me={isMe}
    class:current={isCurrent}
    class:target={isTarget}
    class:eliminated={isEliminated}
    class:correct={resolutionClass === 'correct'}
    class:wrong={resolutionClass === 'wrong'}
  >
    {@render inner()}
  </div>
{/if}
