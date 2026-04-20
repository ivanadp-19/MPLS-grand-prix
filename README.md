# MPLS Grand Prix

Juego multijugador online todos-contra-todos para aprender enrutamiento MPLS (Multiprotocol Label Switching).

**Jugar:** https://ivanadp-19.github.io/MPLS-grand-prix/

## Cómo jugar

1. Un jugador (host) abre la URL y pulsa **Crear Sala**.
2. Comparte el código generado (`mpls-XXXXXX`) con los demás jugadores.
3. Los demás entran a la misma URL y pulsan **Unirse**, pegan el código.
4. El host configura rondas y tiempo, y pulsa **Iniciar partida**.
5. En cada ronda todos responden el mismo reto MPLS en paralelo. Gana quien tenga más puntos.

## Tecnología

- HTML/CSS/JavaScript puro en el cliente (un solo archivo: `index.html`)
- **PartyKit** (WebSocket en Cloudflare) como backend de mensajería multijugador
- Servidor en `party/server.js` — el host de la partida vive en el browser, el servidor solo retransmite mensajes

## Deploy

Se hace una sola vez; después el juego funciona de forma estable.

```bash
# 1. Instalar dependencias (necesitas Node 18+)
npm install

# 2. Desarrollo local (servidor en http://127.0.0.1:1999)
npm run dev
# Abre index.html con un servidor estático, p.ej.:
#   python3 -m http.server 8000
# El cliente detecta automáticamente localhost y usa ws://127.0.0.1:1999

# 3. Deploy a Cloudflare (primera vez pide login)
npm run deploy
# El CLI imprime una URL tipo: https://mpls-grand-prix.TU-USUARIO.partykit.dev
```

Después del primer deploy, abre `index.html` y reemplaza `REEMPLAZAR-USUARIO`
en la constante `PARTYKIT_HOST` por el subdominio que te dio el CLI. Commit
y push — GitHub Pages servirá el HTML apuntando al backend de PartyKit.

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
