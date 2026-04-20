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
    const nick = ($me.nickname || '').trim();
    if (!nick) { alert('OPERATOR ID REQUIRED'); return false; }
    me.update((m) => ({ ...m, nickname: nick }));
    return true;
  }
  function pickColor(c) { me.update((m) => ({ ...m, color: c })); }
  function onCreate() { if (validateNickname()) createRoom(); }
  function onJoin() { if (validateNickname()) joinRoom(joinCode); }
</script>

<div id="lobby">
  <h1>LABEL SWAP</h1>
  <p class="subtitle">:: MPLS MEMORY TERMINAL :: BATTLE ROYALE ::</p>

  <div class="card">
    <label for="nickname">OPERATOR ID</label>
    <input
      id="nickname"
      class="prompt"
      type="text"
      placeholder="netadmin_99"
      maxlength="16"
      bind:value={$me.nickname}
    />

    <div style="display:block; margin-top:12px; color:var(--fg-dim); font-family:var(--mono-ui); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.08em;">NODE COLOR</div>
    <div class="flex mt-1">
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
        <span class="icon">⟦HOST⟧</span>
        <span>INITIALIZE ROOM</span>
        <small>// boot a new session</small>
      </button>
      <button class="mode-btn ghost" onclick={openJoin}>
        <span class="icon">⟦LINK⟧</span>
        <span>JOIN SESSION</span>
        <small>// enter a room code</small>
      </button>
    </div>
  </div>

  {#if showCreatePanel}
    <div class="card warn">
      <h2>Initialize Session</h2>
      <p class="muted" style="margin-bottom:12px;">
        You become the host node. Share the generated code with up to 4 others.
      </p>
      <div class="flex">
        <button class="warn" onclick={onCreate}>Boot Room</button>
        <button class="ghost" onclick={() => (showCreatePanel = false)}>Abort</button>
      </div>
    </div>
  {/if}

  {#if showJoinPanel}
    <div class="card warn">
      <h2>Join Session</h2>
      <label for="join-code">Room Code</label>
      <input
        id="join-code"
        class="prompt"
        type="text"
        placeholder="mpls-XXXXXX"
        autocapitalize="off"
        autocorrect="off"
        autocomplete="off"
        spellcheck="false"
        bind:value={joinCode}
      />
      <div class="flex mt-2">
        <button class="warn" onclick={onJoin}>Link Up</button>
        <button class="ghost" onclick={() => (showJoinPanel = false)}>Abort</button>
      </div>
    </div>
  {/if}

  <div class="card">
    <h3>Protocol Brief</h3>
    <p class="muted" style="line-height:1.7;">
      Each node is assigned <code>2</code> secret animal labels. All labels are revealed for <code>10s</code>,
      then hidden — everything after is memory. On your turn, a Package arrives tagged with one animal. Route it to
      the node you believe holds that label. Correct routes trigger a silent partial swap: the packaged animal moves
      to you, and the receiver steals one of your other labels back.
    </p>
    <p class="muted" style="margin-top:10px; line-height:1.7;">
      Other nodes can <code>INTERCEPT</code> within <code>5s</code> to flag your route as wrong. Correct intercept =
      challenger +1. False intercept = challenger <span class="alert-text">+1 OVERFLOW</span>.
      Hit the overflow threshold (default <code>3</code>) and you go <span class="alert-text">OFFLINE</span>.
      Last node standing wins the link.
    </p>
  </div>
</div>
