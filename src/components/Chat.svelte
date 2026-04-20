<script>
  import { game, me } from '../lib/stores.js';
  import { submitChat } from '../lib/engine.js';
  import { tick } from 'svelte';

  let draft = $state('');
  let listEl;

  $effect(() => {
    $game.chatMessages;
    tick().then(() => {
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    });
  });

  function onSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    submitChat(text);
    draft = '';
  }

  function fmt(ts) {
    try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false }); }
    catch { return ''; }
  }

  let connected = $derived(!!$game.roomId);
</script>

<div class="chat">
  <div class="chat-list" bind:this={listEl}>
    {#each $game.chatMessages as msg (msg.id)}
      <div class="chat-msg" class:me={msg.fromId === $me.id}>
        <span class="chat-ts">[{fmt(msg.ts)}]</span>
        <span class="chat-nick" style="color: {msg.color};">{msg.nickname}</span>
        <span class="chat-sep">::</span>
        <span class="chat-text">{msg.text}</span>
      </div>
    {/each}
    {#if $game.chatMessages.length === 0}
      <div class="chat-empty muted">// channel silent</div>
    {/if}
  </div>

  <form class="chat-input-row" onsubmit={onSubmit}>
    <input
      type="text"
      placeholder={connected ? 'type and press enter' : 'offline'}
      maxlength="240"
      bind:value={draft}
      disabled={!connected}
      autocomplete="off"
    />
    <button type="submit" class="ghost" disabled={!connected || !draft.trim()}>SEND</button>
  </form>
</div>
