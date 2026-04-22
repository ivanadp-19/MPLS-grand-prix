<script>
  import { game, me } from '../lib/stores.js';
  import { startGame, regenerateRoom } from '../lib/engine.js';

  let numRounds = $state(10);
  let roundTime = $state(30);

  let players = $derived(Object.values($game.players));
  let playerCount = $derived(players.length);

  function copyRoomCode() {
    if (!$game.roomId) return;
    navigator.clipboard.writeText($game.roomId).then(() => alert('Copiado: ' + $game.roomId));
  }

  function onStart() {
    startGame({ numRounds: Number(numRounds), roundTime: Number(roundTime) });
  }
</script>

<div>
  <h1>Sala de espera</h1>

  <div class="card">
    {#if $me.isHost && $game.roomId}
      <div class="room-code">
        <div style="color:#cbd5e1; font-size:0.9rem; margin-bottom:8px;">
          Código de sala (compártelo con los jugadores):
        </div>
        <div class="room-code-value">{$game.roomId}</div>
        <div
          style="margin-top:8px; font-size:0.9rem; font-weight:600; color:{$game.hostOnline ? '#10b981' : '#ef4444'};"
        >
          {$game.hostOnline ? '🟢 En línea' : '🔴 Desconectado'}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          <button onclick={copyRoomCode}>Copiar código</button>
          <button
            class="secondary"
            onclick={regenerateRoom}
            title="Si un jugador no puede entrar, genera un código nuevo"
          >
            Regenerar código
          </button>
        </div>
      </div>
    {/if}

    <h3>Jugadores conectados ({playerCount}/5)</h3>
    <div class="player-list">
      {#each players as p}
        <div class="player-chip">
          <span class="player-dot" style="background: {p.color};"></span>
          {p.nickname}
          {#if p.isHost}<span class="status-badge status-host">HOST</span>{/if}
        </div>
      {/each}
    </div>

    {#if $me.isHost}
      <div style="margin-top:20px;">
        <label for="num-rounds">Número de rondas</label>
        <select id="num-rounds" bind:value={numRounds}>
          <option value={5}>5 rondas (corto)</option>
          <option value={10}>10 rondas (estándar)</option>
          <option value={15}>15 rondas (largo)</option>
        </select>
        <label for="round-time">Tiempo por ronda</label>
        <select id="round-time" bind:value={roundTime}>
          <option value={20}>20 segundos</option>
          <option value={30}>30 segundos</option>
          <option value={45}>45 segundos</option>
        </select>
        <button class="success" onclick={onStart} style="margin-top:15px;">
          Iniciar partida
        </button>
      </div>
    {:else}
      <div style="margin-top:20px; color:#94a3b8; text-align:center;">
        Esperando que el host inicie la partida...
      </div>
    {/if}
  </div>

  <div class="card">
    <h3>Conceptos clave de MPLS</h3>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; font-size:0.9rem;">
      <div><strong style="color:#60a5fa;">LER / PE</strong> (Label Edge Router / Provider Edge): Router en el borde de la red MPLS. Hace <code>PUSH</code> (ingreso) o <code>POP</code> (egreso).</div>
      <div><strong style="color:#60a5fa;">LSR / P</strong> (Label Switch Router / Provider): Router interno. Solo hace <code>SWAP</code> de etiquetas.</div>
      <div><strong style="color:#60a5fa;">LSP</strong> (Label Switched Path): Ruta unidireccional pre-establecida de ingress LER a egress LER.</div>
      <div><strong style="color:#60a5fa;">LDP</strong> (Label Distribution Protocol): Los routers anuncian qué etiqueta esperan recibir para cada FEC, en dirección downstream → upstream.</div>
      <div><strong style="color:#60a5fa;">FEC</strong> (Forwarding Equivalence Class): Grupo de paquetes que se enrutan igual (ej. mismo destino).</div>
      <div><strong style="color:#60a5fa;">LFIB</strong>: Tabla de switcheo MPLS. Relaciona label entrante → operación y label saliente.</div>
    </div>
  </div>
</div>
