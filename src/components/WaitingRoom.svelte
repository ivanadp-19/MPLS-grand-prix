<script>
  import { game, me, nodeLabels } from '../lib/stores.js';
  import { DEFAULT_CONFIG } from '../lib/labelswap.js';
  import { startGame, regenerateRoom, leaveRoom } from '../lib/engine.js';

  let overflowThreshold = $state(DEFAULT_CONFIG.overflowThreshold);
  let routeTimeMs = $state(DEFAULT_CONFIG.routeTimeMs);

  let playerList = $derived(Object.entries($game.players));
  let playerCount = $derived(playerList.length);

  function copyRoomCode() {
    if (!$game.roomId) return;
    navigator.clipboard.writeText($game.roomId).then(() => {
      alert('COPIED :: ' + $game.roomId);
    });
  }

  function onStart() {
    startGame({
      ...DEFAULT_CONFIG,
      overflowThreshold: Number(overflowThreshold),
      routeTimeMs: Number(routeTimeMs),
    });
  }
</script>

<div>
  <h1>:: ROOM :: {$game.roomId ?? 'STANDBY'}</h1>

  <div class="card">
    {#if $me.isHost && $game.roomId}
      <div class="room-code">
        <div class="room-code-label">Share this link-code with all operators</div>
        <div class="room-code-value">{$game.roomId}</div>
        <div class="host-status-line" class:online={$game.hostOnline} class:offline={!$game.hostOnline}>
          {$game.hostOnline ? '◉ LINK STABLE' : '⚠ LINK UNSTABLE'}
        </div>
        <div class="flex mt-2" style="justify-content:center;">
          <button onclick={copyRoomCode}>Copy Code</button>
          <button class="ghost" onclick={regenerateRoom}>Regenerate</button>
        </div>
      </div>
    {/if}

    <h3>Connected Operators ({playerCount}/5)</h3>
    <div class="node-list">
      {#each playerList as [pid, p], i}
        <div class="node-chip" class:host={p.isHost}>
          <span class="dot" style="background: {p.color};"></span>
          <span>NODE-{String(i + 1).padStart(2, '0')}</span>
          <span class="muted">::</span>
          <span>{p.nickname}</span>
          {#if p.isHost}<span class="warn-text">HOST</span>{/if}
        </div>
      {/each}
    </div>

    {#if $me.isHost}
      <div class="mt-3">
        <label for="overflow-th">Overflow Threshold (elimination)</label>
        <select id="overflow-th" bind:value={overflowThreshold}>
          <option value={2}>2 :: Glass jaw</option>
          <option value={3}>3 :: Standard</option>
          <option value={5}>5 :: Endurance</option>
        </select>
        <label for="route-time">Route TTL</label>
        <select id="route-time" bind:value={routeTimeMs}>
          <option value={15000}>15 s :: quick</option>
          <option value={20000}>20 s :: standard</option>
          <option value={30000}>30 s :: relaxed</option>
        </select>
        <div class="flex mt-2">
          <button onclick={onStart}>⟦ BOOT TRANSMISSION ⟧</button>
          <button class="ghost" onclick={leaveRoom}>Abort</button>
        </div>
      </div>
    {:else}
      <div class="mt-3 muted center">// Awaiting host :: transmission pending…</div>
      <div class="flex mt-2" style="justify-content:center;">
        <button class="ghost" onclick={leaveRoom}>Disconnect</button>
      </div>
    {/if}
  </div>

  <div class="card">
    <h3>MPLS Data-Plane Primer</h3>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; font-size:0.85rem; line-height:1.55; color:var(--fg-dim);">
      <div><strong class="warn-text">PACKAGE</strong> :: a single animal label in transit. One per turn.</div>
      <div><strong class="warn-text">ROUTE</strong> :: you pick which node currently holds that label.</div>
      <div><strong class="warn-text">SWAP</strong> :: correct route → packaged animal flips to you, receiver grabs one of your labels.</div>
      <div><strong class="warn-text">INTERCEPT</strong> :: flag a route as wrong. Correct flag = +1. False flag = buffer overflow.</div>
      <div><strong class="warn-text">OVERFLOW</strong> :: threshold reached → node goes OFFLINE for the remainder.</div>
      <div><strong class="warn-text">WINNER</strong> :: last node online.</div>
    </div>
  </div>
</div>
