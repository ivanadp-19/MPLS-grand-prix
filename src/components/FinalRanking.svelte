<script>
  import { game, me, nodeLabels } from '../lib/stores.js';

  let winnerPlayer = $derived($game.winnerId ? $game.players[$game.winnerId] : null);
  let winnerLabel = $derived($game.winnerId ? ($nodeLabels[$game.winnerId] ?? '—') : '—');

  let ranked = $derived(
    $game.turnOrder.map((pid) => {
      const s = $game.scores[pid] || { packetsRouted: 0, intercepts: 0, bufferOverflows: 0 };
      return { pid, nodeId: $nodeLabels[pid] ?? '?', player: $game.players[pid], s };
    }).sort((a, b) =>
      (b.s.packetsRouted - a.s.packetsRouted) ||
      (b.s.intercepts - a.s.intercepts) ||
      (a.s.bufferOverflows - b.s.bufferOverflows)
    )
  );

  function newGame() { location.reload(); }
</script>

<div>
  <h1>:: TRANSMISSION COMPLETE ::</h1>

  <div class="winner-banner">
    <div class="w-label">// LAST NODE ONLINE</div>
    <div class="w-node">{winnerLabel}</div>
    <div class="w-nick">{winnerPlayer?.nickname ?? '—'}</div>
  </div>

  <div class="card">
    <h3>Final Telemetry</h3>
    <div class="scoreboard">
      {#each ranked as r, i}
        <div class="score-row" class:me={r.pid === $me.id}>
          <span class="sb-node">#{i + 1} :: {r.nodeId}</span>
          <span class="sb-nick">{r.player?.nickname ?? '?'}</span>
          <span class="sb-metric pkt">PKT:{r.s.packetsRouted}</span>
          <span class="sb-metric int">INT:{r.s.intercepts}</span>
          <span class="sb-metric ovr">OVR:{r.s.bufferOverflows}</span>
        </div>
      {/each}
    </div>

    <div class="center mt-3">
      <button onclick={newGame}>⟦ NEW TRANSMISSION ⟧</button>
    </div>
  </div>
</div>
