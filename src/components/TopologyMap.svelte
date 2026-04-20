<script>
  let { topo, highlightNode = null, activeEdges = [], edgeLabels = {} } = $props();

  function edgeIsActive(e) {
    return activeEdges.some(
      (ae) => (ae[0] === e[0] && ae[1] === e[1]) || (ae[0] === e[1] && ae[1] === e[0])
    );
  }

  function labelForEdge(e) {
    return edgeLabels[e[0] + '-' + e[1]] || edgeLabels[e[1] + '-' + e[0]] || null;
  }

  function nodeClass(n) {
    if (highlightNode === n.id) return 'node highlight';
    if (n.type === 'edge' && n.id === 'PE1') return 'node ingress';
    if (n.type === 'edge' && n.id === 'PE2') return 'node egress';
    return 'node lsr';
  }

  function nodeById(id) {
    return topo.nodes.find((n) => n.id === id);
  }
</script>

<svg class="topology-svg" viewBox="0 0 600 320">
  {#each topo.edges as e}
    {@const n1 = nodeById(e[0])}
    {@const n2 = nodeById(e[1])}
    {@const active = edgeIsActive(e)}
    {@const label = labelForEdge(e)}
    <line
      x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
      class="link {active ? 'active' : ''}"
    />
    {#if label}
      {@const midX = (n1.x + n2.x) / 2}
      {@const midY = (n1.y + n2.y) / 2 - 4}
      <rect x={midX - 22} y={midY - 11} width="44" height="16" rx="4" class="link-label-bg" />
      <text x={midX} y={midY + 2} class="link-label">{label}</text>
    {/if}
  {/each}

  {#each topo.nodes as n}
    <g class={nodeClass(n)}>
      <circle cx={n.x} cy={n.y} r="26" class="node-circle" stroke-width="3" />
      <text x={n.x} y={n.y + 4} class="node-label">{n.id}</text>
      <text x={n.x} y={n.y + 44} class="node-role">{n.role}</text>
    </g>
  {/each}
</svg>
