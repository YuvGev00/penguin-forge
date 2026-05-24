# 🐧 penguin-forge

A shared, real-time **multiplayer penguin world** — and the from-scratch web
framework that runs it. Pick a name, waddle around as a hand-drawn penguin, bump
into other people, hop between rooms, chat in speech bubbles, and play arcade
mini-games. Everyone sees everyone, live.

Underneath, the whole thing — the HTTP server, the WebSocket transport, the
authoritative game loop, the routing, the JSON store, the penguin artwork — is
**hand-written on Node's raw `net` module**. No `express`, no `ws`, no
`socket.io`, no game engine, no sprites. **Zero dependencies.**

The twist that makes it interesting: the framework doesn't just *serve* the
game, it **watches and controls** it. The same dashboards that ship with the
framework become a live admin console for the running world — see every penguin
in a data table, watch game events stream across the wire, and spawn / rename /
kick players over a plain REST API.

---

## Quick start

Requires **Node ≥ 16**. There is nothing to install.

```bash
node server.js          # → http://localhost:4300
npm test                # run the test suite
PORT=8080 node server.js
```

Open **http://localhost:4300/** in a couple of tabs, give each penguin a
different name, and watch them move around together in real time. (Share it on
your LAN and friends can join too.)

---

## What you can open

| URL | What it is |
|---|---|
| **`/`** | Home — jump to the game or the framework console. |
| **`/play`** | **The game.** Click to walk, type to chat, step onto a glowing portal (a doorway, the arcade carpet, a staircase) to travel between rooms, or onto an arcade cabinet to play. |
| **`/forge`** | **The framework console** — a live route table + request runner, plus a live chat that mirrors the game's chat. |
| **`/_data`** | **Data Explorer** — a live table of every penguin currently in the world (name + room). Rows appear when someone joins, update as they walk between rooms, and disappear when they leave. |
| **`/_inspect`** | **Wire Inspector** — watch the actual bytes and game events cross the socket in real time (joins, chats, room changes, kicks). |

---

## The world

Six connected rooms, each a hand-painted scene. Travel by stepping onto the
glowing portal marking a doorway or feature in each room:

- **Town Plaza** — the spawn point and hub.
- **Cozy Café** — a quiet hangout.
- **Gothic University** — a great hall branching into two study rooms:
  - **Lab** — an explorable room.
  - **Library** — has a **📖 Bookshelf** you can read and leave margin notes in.
- **Arcade** — two cabinets to play:
  - **🎨 Draw & Guess** — one penguin draws, the others guess.
  - **⚡ Reaction Duel** — fastest reflex wins, best of three.

Movement is **server-authoritative**: you don't move yourself, you tell the
server where you want to go, and it walks every penguin at a fixed speed each
tick and broadcasts the result. The browser smoothly interpolates between
updates, so motion looks fluid even though the truth updates 20 times a second.
A laggy or malicious client can't teleport or cheat its position.

---

## Control the world over HTTP

The game's roster isn't just for show — the REST API actually drives the **live**
world. Anything you do here happens in every player's browser instantly.

```bash
# List everyone currently in the world
curl http://localhost:4300/api/penguins

# Spawn a new penguin into the world
curl -X POST 'http://localhost:4300/api/penguins?name=Pingu'

# Rename a penguin (id is the one shown in the roster / Data Explorer)
curl -X PUT 'http://localhost:4300/api/penguins/1?name=Skipper'

# Kick a penguin — if it's a live player, a "you were kicked"
# notice pops up full-screen on their game and disconnects them
curl -X DELETE 'http://localhost:4300/api/penguins/1'
```

You can do the same thing from the request runner on **`/forge`** without
touching the terminal.

| Method | Path | Effect |
|---|---|---|
| `GET` | `/api/penguins` | the live roster |
| `POST` | `/api/penguins` | spawn a penguin |
| `PUT` | `/api/penguins/:id` | rename a penguin |
| `DELETE` | `/api/penguins/:id` | kick a penguin |

---

## How it's built

**Routing is the filesystem.** There is no route registration — a file under
`routes/` *is* an endpoint. `routes/index.js` → `/`, `routes/play.js` → `/play`,
`routes/api/penguins/[id].js` → `/api/penguins/:id`. Each file reads like the
HTTP it serves, via a tiny tagged-template DSL:

```js
// routes/api/penguins/[id].js
module.exports = http`
  PUT    ${({ params }) => json(rename(params.id))}
  DELETE ${() => noContent()}
`;
```

**Real WebSockets, from scratch.** `routes/world.js` is a `` ws`` `` route at
`/world`. It performs the RFC 6455 handshake, decodes/encodes frames, and runs
the authoritative 20 Hz game loop, broadcasting each room's state to the players
in it. The game client and the `/forge` chat both speak to this one hand-written
socket.

**The framework watches the game.** Two design choices make the dashboards a
true control room:

- **Identity is persisted, motion is not.** When a penguin joins, a row is
  written to the JSON store (so it shows up in the Data Explorer); its room is
  updated only when it actually changes rooms. The 20 Hz position stream stays
  in memory and never touches disk — the roster shows *who* and *where*, not a
  flood of coordinates.
- **Meaningful events surface on the wire.** Joins, chats, room changes, spawns,
  and kicks are written into the Wire Inspector's feed as readable lines, while
  the high-frequency movement frames are kept out so the feed stays legible.

---

## Layout

```
penguin-forge/
  server.js              start the server
  src/                   the framework: net server, HTTP parser, router, DSL,
                         WebSocket, JSON store, Data Explorer, Wire Inspector
  game/
    world.js             the world: rooms, players, the 20 Hz simulation
    arcade.js            the arcade mini-games (draw, duel, bookshelf)
    hub.js               lets the REST API act on the live world
  routes/
    index.js             /        the home page
    play.js              /play    the game
    forge.js             /forge   the framework console + live chat
    world.js             /world   the WebSocket + game loop
    api/penguins/        the roster + spawn/rename/kick REST API
  public/                the browser client (pages, game renderer, art)
  test/  smoke.js        end-to-end tests over real sockets
```

---

## Tests

```bash
npm test
```

The suite drives the server over raw sockets and checks the full path end to
end: the WebSocket handshake, a penguin joining and landing in the roster, chat
broadcasting between two clients, disconnect cleanup, and the complete REST
cycle — spawning a penguin, renaming it, and kicking a connected player (right
down to the "kicked" message arriving on their socket).
