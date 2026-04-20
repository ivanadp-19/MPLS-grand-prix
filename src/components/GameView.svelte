<script>
  import { game, me } from '../lib/stores.js';
  import { submitAnswer } from '../lib/engine.js';
  import TopologyMap from './TopologyMap.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import EventLog from './EventLog.svelte';

  let remainingSeconds = $state($game.roundTime);
  let timerHandle = null;

  // Start/stop a visual countdown each time a new challenge arrives.
  $effect(() => {
    const ch = $game.currentChallenge;
    if (ch) {
      clearInterval(timerHandle);
      const startTs = $game.roundStartTime || Date.now();
      const total = $game.roundTime;
      remainingSeconds = total;
      timerHandle = setInterval(() => {
        const elapsed = (Date.now() - startTs) / 1000;
        remainingSeconds = Math.max(0, total - elapsed);
        if (remainingSeconds <= 0) clearInterval(timerHandle);
      }, 100);
    } else {
      clearInterval(timerHandle);
    }
    return () => clearInterval(timerHandle);
  });

  // Stop the timer the moment a round result is published.
  $effect(() => {
    if ($game.roundResult) clearInterval(timerHandle);
  });

  let fillPct = $derived(($game.roundTime > 0 ? (remainingSeconds / $game.roundTime) * 100 : 0));

  function optionClass(i) {
    const g = $game;
    if (g.roundResult) {
      if (i === g.roundResult.correctIndex) return 'option-btn correct';
      if (i === g.myAnswerIndex) return 'option-btn wrong';
      return 'option-btn';
    }
    if (g.answeredThisRound && i === g.myAnswerIndex) return 'option-btn selected';
    return 'option-btn';
  }

  let lsrHop = $derived.by(() => {
    const ch = $game.currentChallenge;
    if (!ch || !ch.showLFIB || !ch.lsp) return null;
    return ch.lsp.find((h) => h.node === ch.showLFIB) || null;
  });

  let myScoreLine = $derived.by(() => {
    const r = $game.roundResult;
    if (!r || !$me.id) return null;
    return r.scoreDetails[$me.id] || null;
  });
</script>

<div class="game-view">
  <div>
    <div class="card">
      <div class="round-header">
        <div>
          <span class="round-badge">Ronda {$game.currentRound}/{$game.totalRounds}</span>
          <span style="color:#a78bfa; margin-left:10px; font-weight:600;">
            {$game.currentChallenge?.label ?? ''}
          </span>
        </div>
        <div style="color:#fbbf24; font-weight:700;">{remainingSeconds.toFixed(1)}s</div>
      </div>
      <div class="timer-bar"><div class="timer-fill" style="width: {fillPct}%;"></div></div>

      {#if $game.currentChallenge}
        <TopologyMap
          topo={$game.currentChallenge.topo}
          highlightNode={$game.currentChallenge.highlightNode}
          activeEdges={$game.currentChallenge.activeEdges}
          edgeLabels={$game.currentChallenge.edgeLabels}
        />

        <div class="challenge-area">
          <div class="challenge-question">
            {@html $game.currentChallenge.question}
          </div>

          {#if lsrHop}
            <div>
              <h4 style="color:#60a5fa; margin-bottom:8px;">LFIB de {lsrHop.node}</h4>
              <table>
                <thead>
                  <tr><th>Label IN</th><th>Operación</th><th>Label OUT</th><th>Next Hop</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{lsrHop.inLabel}</td>
                    <td>{lsrHop.op}</td>
                    <td>{lsrHop.outLabel}</td>
                    <td>{lsrHop.nextHop}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          {/if}

          <div class="options-grid">
            {#each $game.currentChallenge.options as opt, i}
              <button
                class={optionClass(i)}
                disabled={$game.answeredThisRound || !!$game.roundResult}
                onclick={() => submitAnswer(i)}
              >
                {opt}
              </button>
            {/each}
          </div>
        </div>

        {#if $game.roundResult}
          <div class="info-panel">
            {@html $game.roundResult.explanation}
            {#if myScoreLine}
              <p style="margin-top:10px;">
                <b>Tu resultado:</b>
                {myScoreLine.correct ? '✅ Correcto' : '❌ Incorrecto'} ·
                <b>+{myScoreLine.earned} pts</b>
                {#if myScoreLine.firstBonus} 🥇 (primer acierto){/if}
              </p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <div>
    <div class="card">
      <h3>🏆 Ranking</h3>
      <Leaderboard />
    </div>
    <div class="card">
      <h3>📡 Eventos</h3>
      <EventLog />
    </div>
  </div>
</div>
