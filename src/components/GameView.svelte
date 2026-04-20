<script>
  import { game } from '../lib/stores.js';
  import RevealPhase from './RevealPhase.svelte';
  import RoutingPhase from './RoutingPhase.svelte';
  import SwapChoiceModal from './SwapChoiceModal.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import NetworkLog from './NetworkLog.svelte';
</script>

<div class="game-view">
  <div>
    <div class="card">
      {#if $game.phase === 'reveal'}
        <RevealPhase />
      {:else}
        <RoutingPhase />
      {/if}
    </div>
  </div>

  <div>
    <div class="card">
      <h3>:: Scoreboard</h3>
      <Scoreboard />
    </div>
    <div class="card">
      <h3>:: Network Log</h3>
      <NetworkLog />
    </div>
  </div>
</div>

<SwapChoiceModal />
