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
  - **Lab** — step onto the **💻 Code Lab** console to solve small coding
    puzzles; the room shows who's cracked the current one. Pick your language
    with the picker: **JavaScript** runs instantly in your browser (no download,
    fully offline), or **Python** runs as real CPython via Pyodide (WebAssembly,
    loaded from a CDN on first use). Either way the **server never runs the
    code** — it's graded in your browser, so the server stays zero-dependency.
    The Python track is the one feature that needs a connection on first load;
    JavaScript and the rest of the game are fully offline.
  - **Library** — has a **📖 Bookshelf** you can read and leave margin notes in,
    including two full programming books — *A Byte of Python* and *Eloquent
    JavaScript* — that pair with the Code Lab's two language tracks.
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

## Under the hood — built from scratch on `net`

Everything below the framework's friendly surface is hand-written on Node's raw
`net` (TCP) module. No `http`, no `http2`, no Express, no `ws` — the only
built-ins used are `net`, `fs`, `path`, `crypto` (for the WebSocket handshake
SHA-1) and `events`.

- **Manual HTTP/1.1 parsing** (`src/http-parser.js`). TCP delivers bytes in
  arbitrary chunks, so the parser reassembles a request across `data` events,
  finds the `\r\n\r\n` header terminator, splits the **request line** (method /
  target / version), the **headers**, and the **body**, and decodes the path +
  query string by hand. It also hardens the wire: rejects conflicting/duplicate
  `Content-Length`, `Transfer-Encoding: chunked`, and a missing/duplicate `Host`
  (request-smuggling guards), and caps body size.
- **Hand-built HTTP/1.1 responses** (`src/response.js`). The status line,
  headers, and body are assembled and written to the socket directly — with a
  full status-code table, HEAD/204/304 body suppression, keep-alive framing, and
  CRLF-injection guards on every header.
- **A hand-built routing engine** (`src/fs-router.js`) that matches paths and
  HTTP methods. `fileToPattern()` compiles each path into a **regex** with
  `:param` → `([^/]+)` capture groups (and `[...rest]` catch-alls); `match()`
  runs those regexes against each request path, extracts and URL-decodes the
  params, orders routes by specificity (literal segments beat params), and
  dispatches by method (emitting `405 + Allow` when the path exists but the verb
  doesn't).

  **The filesystem and `app.get()` are just two ways to *register* routes into
  that one hand-built matcher — neither replaces it.** A `routes/` file's
  location supplies the path; an `app.get(path, …)` call supplies it imperatively.
  Both compile to the same regex table and run through the same `match()`.
- **From-scratch WebSockets** (`src/websocket.js`) — RFC 6455 handshake, frame
  decode/encode, ping/pong — on the same raw socket after a `101` upgrade.

## How it's built

**Routing is the filesystem.** A file under `routes/` *is* an endpoint (it
registers into the matcher above — there's no `app.get()` boilerplate to write).
`routes/index.js` → `/`, `routes/play.js` → `/play`,
`routes/api/penguins/[id].js` → `/api/penguins/:id`. Each file reads like the
HTTP it serves, via a tiny tagged-template DSL:

```js
// routes/api/penguins/[id].js
module.exports = http`
  PUT    ${({ params }) => json(rename(params.id))}
  DELETE ${() => noContent()}
`;
```

**Or the familiar way, if you prefer.** The filesystem + DSL is the primary
mechanism, but the framework *also* exposes a classic Express-style imperative
API — `app.get()` / `app.post()` / `app.put()` / `app.delete()` / `app.patch()`
— as a thin facade over the **same** router. Two front doors, one engine:

```js
const forge = require('./src');
const { json } = forge;

forge({ staticDir: 'public' })
  .get('/api/ping', () => json({ pong: true }))
  .post('/api/echo', ({ body }) => json(body))
  .listen(4300);
```

Handlers take the same single `ctx` and return the same `json()/send()/status()`
descriptors as DSL handlers, so there is nothing new to learn. Routes registered
this way show up in `/_routes` and the `/forge` route table tagged `code` (vs
`file` for routes declared by a `routes/` file) — `server.js` registers
`GET /api/ping` this way as a live demo. `curl localhost:4300/api/ping` →
`{"pong":true}`.

### The two required features, demonstrated

**1. Static file serving** (like `express.static()`). Pass `staticDir` and any
path with no matching route is served from that folder, with the correct MIME
type and directory-traversal protection (a `../` escape returns 404/403):

```js
forge({ staticDir: 'public' }).listen(4300);
//  GET /app.js        → public/app.js        (application/javascript)
//  GET /bg/plaza.png  → public/bg/plaza.png  (image/png)
//  GET /../etc/passwd → 404  (traversal blocked)
```

This is exactly how penguin-forge serves its own browser client — every page,
script, font, and PNG under `public/` is delivered by this static handler.

**2. Route handlers** (like `app.get()` / `app.post()`). Either declare them as
`routes/` files (the DSL, shown above) or imperatively:

```js
forge({ staticDir: 'public' })
  .get('/api/users/:id', ({ params }) => json({ id: params.id }))   // :params
  .post('/api/users', ({ body }) => created(body))                  // parsed body
  .listen(4300);
//  GET  /api/users/42   → {"id":"42"}
//  POST /api/users      → 201 + the JSON body echoed back
```

`req`-style data is on the handler `ctx`: `method`, `path`, `query`, `params`,
`headers`, and a lazily-parsed `body` (JSON / urlencoded auto-detected).

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
    arcade.js            the cabinet games (draw, duel, bookshelf, code lab)
    hub.js               lets the REST API act on the live world
  routes/
    index.js             /        the home page
    play.js              /play    the game
    forge.js             /forge   the framework console + live chat
    world.js             /world   the WebSocket + game loop
    api/penguins/        the roster + spawn/rename/kick REST API
  public/                the browser client (pages, game renderer, art)
  test/
    framework.test.js    framework-capability suite (HTTP parse, routing,
                         static, smuggling, keep-alive, HEAD, WS, dual-API…)
                         run against isolated fixtures under test/fixtures/
    smoke.js             end-to-end game tests over real sockets
```

---

## Tests

```bash
npm test              # runs BOTH suites below (≈129 assertions)
npm run test:framework  # framework only
npm run test:game       # game E2E only
```

Two suites, both driving the server over raw `net` sockets (no test framework,
no HTTP client — same spirit as the project):

- **`test/framework.test.js`** (~113 assertions) exercises the framework itself
  against isolated fixtures: manual HTTP parsing (incl. split-TCP requests and
  smuggling rejections), routing + `:params` + `405`, static serving +
  directory-traversal/symlink blocking, keep-alive, pipelining, HEAD, the
  Data Explorer / Wire Inspector / route builder, the from-scratch WebSocket
  handshake + echo, and the imperative `app.get()/app.post()` API.
- **`test/smoke.js`** (16 assertions) is the end-to-end game path: the WebSocket
  handshake, a penguin joining and landing in the roster, chat broadcasting
  between two clients, disconnect cleanup, and the full REST cycle — spawn,
  rename, and kick a connected player (down to the "kicked" message arriving on
  their socket).

Both use a dedicated isolated DB (`FS_FORGE_DB`) so they never touch the demo
`data.json`.
