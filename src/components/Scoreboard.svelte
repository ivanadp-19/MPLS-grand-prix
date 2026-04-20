<script>
  import { game, me, nodeLabels } from '../lib/stores.js';

  let rows = $derived(
    $game.turnOrder.map((pid) => {
      const player = $game.players[pid];
      const scores = $game.scores[pid] || { packetsRouted: 0, intercepts: 0, bufferOverflows: 0 };
      const eliminated = ($game.eliminated ?? []).includes(pid);
      return {
        pid,
        nodeId: $nodeLabels[pid] ?? '—',
        nickname: player?.nickname ?? '?',
        color: player?.color ?? '#00ff41',
        scores,
        eliminated,
      };
    })
  );
</script>

<div class="scoreboard">
  {#each rows as r}
    <div class="score-row" class:me={r.pid === $me.id} class:eliminated={r.eliminated}>
      <span class="sb-node">
        <span class="node-swatch" style="background: {r.color};"></span>
        {r.nodeId}
      </span>
      <span class="sb-nick">{r.nickname}</span>
      <span class="sb-metric pkt" title="Packets routed">PKT:{r.scores.packetsRouted}</span>
      <span class="sb-metric int" title="Intercepts">INT:{r.scores.intercepts}</span>
      <span class="sb-metric ovr" title="Buffer overflows">OVR:{r.scores.bufferOverflows}/{$game.config.overflowThreshold}</span>
    </div>
  {/each}
</div>
