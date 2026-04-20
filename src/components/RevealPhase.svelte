<script>
  import { game, nodeLabels } from '../lib/stores.js';

  let remaining = $state(0);
  let handle = null;

  $effect(() => {
    const endsAt = $game.deadlineMs;
    clearInterval(handle);
    if (!endsAt) return;
    const tick = () => {
      remaining = Math.max(0, (endsAt - Date.now()) / 1000);
    };
    tick();
    handle = setInterval(tick, 100);
    return () => clearInterval(handle);
  });

  let rows = $derived(
    $game.turnOrder.map((pid) => ({
      pid,
      nodeId: $nodeLabels[pid] ?? '—',
      nickname: $game.players[pid]?.nickname ?? '?',
      color: $game.players[pid]?.color ?? '#00ff41',
      labels: ($game.publicLabels && $game.publicLabels[pid]) || ['?', '?'],
    }))
  );
</script>

<div>
  <div class="phase-header">
    <div class="phase-badge">⟦ LABEL REVEAL ⟧</div>
    <div class="deadline-clock" class:critical={remaining < 3}>{remaining.toFixed(1)}s</div>
  </div>
  <div class="timer-bar">
    <div class="timer-fill" style="width: {Math.min(100, (remaining / 10) * 100)}%;"></div>
  </div>

  <div class="card warn">
    <h2>:: MEMORIZE THE MAPPING ::</h2>
    <p class="muted" style="margin-bottom:12px;">
      Every operator node and its two animal labels. Once this window closes, labels are hidden for good.
      Your memory is the only routing table you have.
    </p>

    <table class="reveal-table">
      <thead>
        <tr>
          <th>NODE</th>
          <th>OPERATOR</th>
          <th>LABEL 1</th>
          <th>LABEL 2</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r}
          <tr>
            <td>
              <span class="node-swatch" style="background: {r.color};"></span>
              {r.nodeId}
            </td>
            <td>{r.nickname}</td>
            <td class="animal">{r.labels[0]}</td>
            <td class="animal">{r.labels[1]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
