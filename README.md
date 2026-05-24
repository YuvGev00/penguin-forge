# 🐧 penguin-forge

A shared, explorable **multiplayer penguin world** running entirely on a
from-scratch HTTP/WebSocket framework — and wired so the framework's own
dashboards become a **live control room** for the running game.

> Built only on Node's `net` module. **Zero dependencies** — no `express`,
> `ws`, `socket.io`, or game engine. The HTTP server, the WebSocket transport,
> the authoritative game loop, and the penguin artwork are all hand-written.

## The idea

This project merges two from-scratch projects:

- **fs-forge** — a creative HTTP/1.1 + WebSocket framework (filesystem routing,
  a `` ws`` `` route tag, a tagged-template `` http`` `` DSL, a reactive JSON
  store with a Data Explorer at `/_data`, a Wire Inspector at `/_inspect`). It
  is **vendored** here under `src/`.
- **penguin-world** — a real-time multiplayer game (authoritative 20 Hz world
  loop, multi-room, chat, arcade mini-games). Its pure game logic lives in
  `game/`.

The twist: instead of the game owning its own server, it runs **as a route
inside fs-forge**, so the framework sits behind the scenes and observes — and
controls — everything:

| Game event | Surfaces in… |
|---|---|
| A penguin joins (name + room) | the **store** → a live row in **`/_data`** |
| Walking between rooms | the row's `room` updates live in **`/_data`** |
| Join / chat / room change / leave | readable `GAME …` lines in the **Wire Inspector** (`/_inspect`) |
| All movement + chat transport | the from-scratch **WebSocket** at `/world` |
| Admin spawn / rename / **kick** | the REST API **`/api/penguins`** drives the live world |

So fs-forge becomes the *admin / ops view* of a living multiplayer world.

## Run it

```bash
node server.js          # → http://localhost:4300
npm test                # end-to-end smoke (14 assertions)
PORT=8080 node server.js
```

Open `http://localhost:4300/` in **several tabs**, give each a name, and walk
around together in real time.

## The pages

- **`/`** — the hub: links to the game and the framework showcase.
- **`/play`** — the penguin game (waddle, chat, explore rooms, arcade games),
  live for everyone over the `/world` WebSocket.
- **`/forge`** — fs-forge's framework showcase: the live route table + API
  console, the filesystem-routing diagram, the DSL sample, and a **live chat**
  panel that rides the same `/world` socket (a chat-only "watcher", no avatar).
- **`/_data`** — the live penguin roster (a row appears on join, its `room`
  updates as the penguin walks, it vanishes on disconnect).
- **`/_inspect`** — the wire: the `/world` `101` handshake plus `GAME …` event
  lines as they happen (live 20 Hz movement is intentionally muted so the feed
  stays legible).

## The REST API drives the live game (`/api/penguins`)

The framework's store + REST verbs are wired to the *running* world via a small
in-process bridge (`game/hub.js`):

| Verb | Effect |
|---|---|
| `GET /api/penguins` | the live roster (also rendered by `/_data`) |
| `POST /api/penguins` `{name}` | **spawns** a real (socket-less) penguin into the world |
| `PUT /api/penguins/:id` `{name}` | **renames** a live penguin (`:id` = store row id) |
| `DELETE /api/penguins/:id` | **kicks** the penguin — removed from the world; if it's a connected player, a "you were kicked" overlay pops up on its screen and its socket closes |

Try it from the `/forge` console, or:

```bash
curl -X POST 'http://localhost:4300/api/penguins?name=Pingu'
curl -X PUT  'http://localhost:4300/api/penguins/1?name=Skipper'
curl -X DELETE 'http://localhost:4300/api/penguins/1'
```

## How the integration works

- **`routes/world.js`** is the only transport-coupled file (it replaces
  penguin-world's standalone `server.js`). At module scope it runs the
  authoritative 20 Hz loop, keeps the client map + a `watchers` set (chat-only
  clients), fans out per-room snapshots over fs-forge WebSocket connections, and
  routes inbound `{t:'join'|'move'|'chat'|'leave'|'cab'|'watch'|'say'}` messages
  into the pure game logic. It registers a control API on `game/hub.js`
  (`spawn`/`rename`/`kick`) so the REST routes can reach the live world.
- **Store-write boundary:** identity is durable, motion is ephemeral. A penguin
  row is written on **join** (`insert`), updated **only when its room changes**
  (`update`, diffed against the last room — never per tick), and removed on
  **disconnect / kick** (`remove`). The 20 Hz x/y stream never touches disk.
- **Wire hook:** `routes/world.js` reaches the inspector via `src/runtime.js`
  (one of two small additions to the vendored framework) and feeds it a readable
  line per meaningful event (join / chat / room change / leave / spawn / kick).
- **Conn-less penguins:** a `POST`-spawned penguin has no socket. It lives in
  `world.players` (so it walks and appears in everyone's snapshots) and in the
  roster; the fan-out simply skips delivering to a `null` connection.

## What was dropped vs. penguin-world

The classroom mini-game graded Python via a `python3` subprocess. It was
removed here to keep penguin-forge **pure-Node with zero external
dependencies** — so `judge.js` is gone, the `class` cabinet is removed from the
Lab (which remains an explorable room), and `ClassRoom` is dropped from the
arcade. The Draw & Guess, Reaction Duel, and Bookshelf games are untouched.

## Layout

```
penguin-forge/
  server.js              forge({routesDir,staticDir}).listen
  src/                   vendored fs-forge framework (+ runtime.js — see above)
  game/
    world.js  arcade.js  pure, transport-agnostic game logic
    hub.js               the REST↔live-game bridge (spawn/rename/kick)
  routes/
    index.js             the hub page (/)
    play.js              the game page (/play)
    forge.js             the framework showcase + live chat (/forge)
    world.js             the /world WebSocket route (the adapter + 20 Hz loop)
    api/penguins/
      index.js           GET[list] roster + POST[create] (spawn)
      [id].js            PUT[update] (rename) + DELETE[remove] (kick)
  public/                the browser client (index.html hub, game.html, forge.html, app.js, …)
  test/  smoke.js        14 end-to-end assertions
```

## Tests

`npm test` runs 14 assertions over raw `net` sockets: the `/world` handshake,
join → store row, chat broadcast, disconnect cleanup, and the full REST cycle
(POST spawn → snapshot, PUT rename, DELETE kick → `{t:'kicked'}` frame + row
removed, watcher `chatlog` / `say`). The vendored fs-forge framework keeps its
own 99-assertion suite passing unchanged.
