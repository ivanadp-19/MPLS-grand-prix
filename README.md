# MPLS Grand Prix

Juego multijugador online todos-contra-todos para aprender enrutamiento MPLS
(Multiprotocol Label Switching).

## Stack

- **Frontend:** Svelte 5 (con runes) + Vite, desplegado en Cloudflare Pages.
- **Backend multijugador:** PartyKit (WebSocket sobre Cloudflare Durable Objects).
- Sin base de datos; el estado de cada sala vive en el Durable Object mientras
  dura la partida y se descarta al cerrarse.

## Cómo jugar

1. Un jugador abre la URL y pulsa **Crear Sala**.
2. Comparte el código generado (`mpls-XXXXXX`) con los demás jugadores.
3. Los demás abren la misma URL, pegan el código y pulsan **Unirse**.
4. El host configura rondas y tiempo, y pulsa **Iniciar partida**.
5. Cada ronda todos responden el mismo reto MPLS en paralelo. Gana quien tenga
   más puntos tras N rondas.

## Estructura del repo

```
.
├── src/                    # Código Svelte (frontend)
│   ├── App.svelte
│   ├── main.js
│   ├── app.css
│   ├── components/         # Lobby, WaitingRoom, GameView, TopologyMap, …
│   └── lib/                # engine, transport, stores, challenges, topology
├── party/
│   └── server.js           # Servidor PartyKit (relay de mensajes por sala)
├── index.html              # Plantilla Vite
├── vite.config.js
├── svelte.config.js
├── partykit.json
└── package.json
```

## Desarrollo local

Necesitas Node 18+.

```bash
npm install

# Terminal 1: servidor PartyKit en 127.0.0.1:1999
npm run party:dev

# Terminal 2: Vite dev server en 127.0.0.1:5173 (auto-detecta localhost y apunta al party dev)
npm run dev
```

Abre <http://127.0.0.1:5173> en dos pestañas para simular dos jugadores.

## Deploy

### Backend (PartyKit)

```bash
npm run party:deploy
```

Deja la URL tipo `mpls-grand-prix.<usuario>.partykit.dev` como `PARTYKIT_HOST`
en `src/lib/transport.js` (o defínelo con la variable de entorno
`VITE_PARTYKIT_HOST` al buildear).

### Frontend (Cloudflare Pages)

Primera vez:

```bash
npx wrangler login        # autoriza Cloudflare (browser OAuth)
```

Luego en cada deploy:

```bash
npm run build
npm run pages:deploy
```

Esto publica el contenido de `dist/` al proyecto `mpls-grand-prix` en
Cloudflare Pages. La URL de producción será `mpls-grand-prix.pages.dev`
(o tu dominio custom).

## Tipos de retos

- Siguiente salto en el LSP
- Operación MPLS (PUSH / SWAP / POP)
- Rol del router (LER vs LSR)
- Etiqueta de salida según LDP
- Consulta de LFIB

## Puntuación

- Respuesta correcta: +100
- Bonus velocidad (< 8s / 16s / 24s): +50 / +25 / +10
- Primer acierto de la ronda: +25 extra
