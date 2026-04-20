# MPLS Grand Prix

Juego multijugador online todos-contra-todos para aprender enrutamiento MPLS (Multiprotocol Label Switching).

**Jugar:** https://TU-USUARIO.github.io/mpls-grand-prix/

## Cómo jugar

1. Un jugador (host) abre la URL y pulsa **Crear Sala**.
2. Comparte el código generado (`mpls-XXXXXX`) con los demás jugadores.
3. Los demás entran a la misma URL y pulsan **Unirse**, pegan el código.
4. El host configura rondas y tiempo, y pulsa **Iniciar partida**.
5. En cada ronda todos responden el mismo reto MPLS en paralelo. Gana quien tenga más puntos.

## Tecnología

- HTML/CSS/JavaScript puro (un solo archivo)
- PeerJS + WebRTC para multijugador P2P
- Sin backend propio; señalización pública gratuita

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
