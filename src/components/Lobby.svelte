<script>
  import { me, COLORS } from '../lib/stores.js';
  import { createRoom, joinRoom } from '../lib/engine.js';

  let showCreatePanel = $state(false);
  let showJoinPanel = $state(false);
  let joinCode = $state('');

  function openCreate() {
    if (!validateNickname()) return;
    showCreatePanel = true;
    showJoinPanel = false;
  }
  function openJoin() {
    if (!validateNickname()) return;
    showJoinPanel = true;
    showCreatePanel = false;
  }
  function validateNickname() {
    const nick = $me.nickname.trim();
    if (!nick) { alert('Escribe un apodo primero'); return false; }
    me.update((m) => ({ ...m, nickname: nick }));
    return true;
  }
  function pickColor(c) {
    me.update((m) => ({ ...m, color: c }));
  }
  function onCreate() {
    if (!validateNickname()) return;
    createRoom();
  }
  function onJoin() {
    if (!validateNickname()) return;
    joinRoom(joinCode);
  }
</script>

<div id="lobby">
  <h1>MPLS Grand Prix</h1>
  <p class="subtitle">Compite todos-contra-todos dominando el enrutamiento MPLS</p>

  <div class="card">
    <label for="nickname">Tu apodo</label>
    <input
      id="nickname"
      type="text"
      placeholder="Ej: NetAdmin99"
      maxlength="16"
      bind:value={$me.nickname}
    />

    <div style="display:block; margin-top:10px; color:#cbd5e1; font-size:0.9rem;">Color de jugador</div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
      {#each COLORS as c}
        <div
          class="color-swatch"
          class:active={$me.color === c}
          style="background: {c};"
          onclick={() => pickColor(c)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && pickColor(c)}
        ></div>
      {/each}
    </div>

    <div class="lobby-buttons">
      <button class="mode-btn" onclick={openCreate}>
        <span class="icon">🎮</span>
        <span>Crear Sala</span>
        <small style="opacity:0.8">Sé el anfitrión</small>
      </button>
      <button class="mode-btn secondary" onclick={openJoin}>
        <span class="icon">🔗</span>
        <span>Unirse</span>
        <small style="opacity:0.8">Con código de sala</small>
      </button>
    </div>
  </div>

  {#if showCreatePanel}
    <div class="card">
      <h2>Crear nueva sala</h2>
      <p style="color:#94a3b8; margin-bottom:15px;">Serás el host. Comparte el código con los demás jugadores (hasta 5).</p>
      <button class="success" onclick={onCreate}>Crear sala</button>
      <button class="secondary" onclick={() => (showCreatePanel = false)}>Cancelar</button>
    </div>
  {/if}

  {#if showJoinPanel}
    <div class="card">
      <h2>Unirse a una sala</h2>
      <label for="join-code">Código de sala (ID del host)</label>
      <input
        id="join-code"
        type="text"
        placeholder="mpls-XXXXXX"
        autocapitalize="off"
        autocorrect="off"
        autocomplete="off"
        spellcheck="false"
        bind:value={joinCode}
      />
      <button class="success" onclick={onJoin}>Unirse</button>
      <button class="secondary" onclick={() => (showJoinPanel = false)}>Cancelar</button>
    </div>
  {/if}

  <div class="card">
    <h3>¿Cómo se juega?</h3>
    <p style="line-height:1.6; color:#cbd5e1;">
      En cada ronda todos los jugadores responden el mismo reto MPLS simultáneamente: identificar
      operaciones (<code>PUSH</code>, <code>SWAP</code>, <code>POP</code>), siguientes saltos en un LSP,
      labels asignados por LDP, roles de router (<code>LER/PE</code> vs <code>LSR/P</code>), y más.
      Ganas puntos por respuestas correctas y por velocidad. Al final de 10 rondas gana quien tenga
      más puntos en el ranking.
    </p>
  </div>
</div>
