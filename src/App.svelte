<script>
  import { view, log } from './lib/stores.js';
  import Lobby from './components/Lobby.svelte';
  import WaitingRoom from './components/WaitingRoom.svelte';
  import GameView from './components/GameView.svelte';
  import FinalRanking from './components/FinalRanking.svelte';

  log('Bienvenido a MPLS Grand Prix');
</script>

<div class="container">
  {#if $view === 'lobby'}
    <Lobby />
  {:else if $view === 'waiting'}
    <WaitingRoom />
  {:else if $view === 'game'}
    <GameView />
  {:else if $view === 'final'}
    <FinalRanking />
  {/if}
</div>
