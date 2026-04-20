<script>
  import { game, me } from '../lib/stores.js';

  let sorted = $derived(
    Object.entries($game.players).sort(([, a], [, b]) => b.score - a.score)
  );
  let podium = $derived(sorted.slice(0, 3));

  const medals = ['🥇', '🥈', '🥉'];
  const slots = ['gold', 'silver', 'bronze'];

  function newGame() {
    location.reload();
  }
</script>

<div>
  <h1>🏁 ¡Fin de la partida!</h1>
  <div class="card">
    <div class="final-podium">
      {#each podium as [, p], i}
        <div class="podium-slot {slots[i]}">
          <div class="podium-medal">{medals[i]}</div>
          <div class="podium-name">{p.nickname}</div>
          <div class="podium-score">{p.score} pts</div>
        </div>
      {/each}
    </div>

    <h3 style="margin-top:25px;">Clasificación completa</h3>
    <div class="leaderboard">
      {#each sorted as [pid, p], i}
        <div class="lb-row" class:me={pid === $me.id}>
          <div class="lb-rank">#{i + 1}</div>
          <div class="lb-name">
            <span class="player-dot" style="background: {p.color};"></span>
            {p.nickname}
          </div>
          <div class="lb-score">{p.score}</div>
        </div>
      {/each}
    </div>

    <div style="text-align:center; margin-top:25px;">
      <button onclick={newGame}>Nueva partida</button>
    </div>
  </div>
</div>
