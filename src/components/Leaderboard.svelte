<script>
  import { game, me } from '../lib/stores.js';

  let sorted = $derived(
    Object.entries($game.players)
      .sort(([, a], [, b]) => b.score - a.score)
  );
</script>

<div class="leaderboard">
  {#each sorted as [pid, p], i}
    <div class="lb-row" class:me={pid === $me.id}>
      <div class="lb-rank">#{i + 1}</div>
      <div class="lb-name">
        <span class="player-dot" style="background: {p.color};"></span>
        {p.nickname}
        {#if p.answered}<span class="status-badge status-answered">✓</span>{/if}
      </div>
      <div class="lb-score">{p.score}</div>
    </div>
  {/each}
</div>
