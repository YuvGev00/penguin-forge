# Design notes — penguin-forge

Why penguin-forge is shaped the way it is. It is a multiplayer penguin game
that runs *inside* its own from-scratch HTTP/WebSocket framework, so the
framework's own dashboards double as the game's live control room. These are
the decisions behind that and the trade-offs each one carries.

## 1. The game is a route, not its own server

**Decision:** the penguin game lives in `routes/world.js` — a `` ws`` `` route
at `/world` — rather than a standalone game server.

**Why:** that single choice is the whole thesis. Because the game runs as a
route, every game event flows through the framework's existing surfaces — the
store (`/_data`), the wire inspector (`/_inspect`), the REST API — with almost
no glue. The framework becomes the game's admin/ops view for free.

**Trade-off:** the 20 Hz authoritative loop lives at module scope in a route
file. Hot-reload (`fs.watch`) could double-start it, so it is guarded with a
`globalThis.__pfWorldLoop` handle that clears any existing interval.

## 2. The store-write boundary: identity durable, motion ephemeral

**Decision:** penguin **identity** (name, room, join time) is written to the
JSON store; **position** (x/y, 20 Hz) never is.

**Why:** the store powers the reactive `/_data` roster, so identity belongs
there — a penguin joining, leaving, or changing rooms is exactly what an admin
wants to see. Writing 20 Hz positions would hammer `data.json` and add nothing
(positions are transient). So: `insert` on join, `update` **only when the room
actually changes** (diffed against a cached `lastRoom`, never per tick),
`remove` on disconnect/kick. Live positions stay in `world.players` memory and
ship only via the snapshot fan-out.

**Trade-off:** the roster shows *which room*, not live coordinates — the right
altitude for an admin view, not a limitation.

## 3. A hub module (`game/hub.js`) bridges REST and the live game

**Decision:** `routes/world.js` owns `world` + `clients` privately and registers
a narrow control API (`spawn`/`rename`/`kick`/`list`) on `game/hub.js`; the REST
routes (`routes/api/penguins/*`) call that API.

**Why:** the REST routes and the WebSocket route are separate files and can't
see each other's module state. Three options existed: (a) a shared hub holder,
(b) the store `changes` event bus, (c) exporting `world`/`clients`. The store
bus is one-way and can't *invoke* world mutations or reach a specific socket
(so it can't spawn or kick). Exporting the mutable maps leaks transport state
across files and breaks the "`world.js` is the sole owner" invariant (and the
hot-reload guard). The hub is the minimal seam — a small holder that exposes a
clean verb API, keeps `world.js` authoritative, and survives hot reload
(re-requiring just re-registers the API).

**Trade-off:** one more tiny module. Worth it for a clean, testable verb
interface instead of leaked globals.

## 4. A REST-spawned penguin has no socket

**Decision:** `POST /api/penguins` creates a real penguin in the world with
`conn: null`.

**Why:** snapshots are built from `world.players`, so a penguin needs no socket
to *exist*, walk, or be seen by others. A connection-less penguin appears in the
roster and on everyone's screen immediately; the fan-out just guards `c.conn &&`
before delivering. This is more honest than a "pre-register a name" half-measure
— the admin genuinely added a participant to the world.

**Trade-off:** a conn-less penguin can't receive input, so it idles at spawn.
Fine for an admin/demo action.

## 5. DELETE pushes a "kicked" message and suppresses reconnect

**Decision:** `DELETE /api/penguins/:id` sends `{t:'kicked',reason}` to the
target's socket, closes it, and removes the world player + roster row. The
client shows a full-screen overlay and a `kicked` flag stops the auto-reconnect.

**Why:** a kick that only closed the socket would be invisible — and the
client's `onclose` auto-reconnect would instantly rejoin. Surfacing it on the
victim's screen makes the admin action real and visible, which is the point of
the feature.

**Trade-off:** `:id` is the **store row id** (what `/_data` and the REST API
expose), not the internal game pid; the hub maps between them, returning 404
when no live penguin matches.

## 6. The /forge chat panel is a "watcher", not a player

**Decision:** the live chat on the framework console opens its own `/world`
socket but sends `{t:'watch'}` (not `{t:'join'}`), so it sees and sends chat
without spawning a penguin.

**Why:** the framework page isn't the game — a phantom penguin appearing in
`/play` whenever someone opens `/forge` would be confusing. A watcher receives
the live chat feed (`{t:'chatlog'}`) and can broadcast an announcement to
everyone (`{t:'announce'}`) without an avatar, over the exact same hand-written
WebSocket the game uses.

**Trade-off:** watcher chat shows in the chat feed but not as a speech bubble in
the world (there's no avatar to attach it to). Intended.

## 7. Routing: the filesystem and `app.get()` feed one hand-built matcher

**Decision:** routes can be declared two ways — as files under `routes/` (the
tagged-template DSL) or imperatively via `app.get()/app.post()/…` — and both
register into the same hand-written regex matcher.

**Why:** the matcher (`src/fs-router.js`) is the actual routing engine:
`fileToPattern()` compiles each path into a regex with `:param` capture groups,
and `match()` runs those regexes per request, extracts params, orders by
specificity, and dispatches by method. The filesystem layer makes the route
table self-evident (a file's location *is* its path, with hot reload and live
introspection at `/_routes`); the imperative API offers the familiar
Express-style surface. Neither replaces the matcher — they are two front doors
to one engine.

**Trade-off:** a path can be declared by both a file and a code route. They
compose (the union of their verbs is reachable); on a same-verb collision the
hand-written file wins, so a file route is never silently overridden.

## 8. The Code Lab grades Python in the browser, not on the server

**Decision:** the Lab's Python puzzles are graded **client-side** — the
browser runs the player's code with CPython-compiled-to-WebAssembly (Pyodide),
checks it against the puzzle's test cases, and reports `{kind:'solved', puzzleId}`
to the server. The server (`ClassRoom` in `game/arcade.js`) only holds the
puzzle metadata and broadcasts the scoreboard; it never executes Python.

**Why:** running Python on the server would mean shelling out to a `python3`
binary (a host dependency that breaks on any machine without Python) or
embedding an interpreter (a heavy dependency). Both violate the project's
pure-Node, zero-dependency premise. Pyodide keeps the server clean: Python
lives entirely in the player's own browser tab, sandboxed by the browser, and
loaded on demand from a CDN only when someone opens the Lab. Everything else in
the game runs offline; this one feature is the sole exception, and it fails
gracefully (a "needs a connection" notice) rather than breaking the room.

**Trade-offs:** (1) Grading is trusted — a player could lie about solving, since
the result comes from their browser. Acceptable: this is a friendly co-op
classroom, not a proctored exam, and a false "solved" only ticks a scoreboard.
(2) Pyodide runs on the main thread and can't be force-killed mid-execution, so
an unbounded loop would freeze that one tab; obvious infinite loops
(`while True`) are rejected up front, and the limitation is documented.

## What is deliberately out of scope

- **Live position in the roster** — see §2; the wrong altitude for an admin
  view, and a 20 Hz write stream the store shouldn't carry.
- **WebSocket message fragmentation / permessage-deflate** — the protocol
  handles single-frame text/binary messages; game snapshots are small single
  frames, so fragmentation and compression aren't needed.
- **Middleware pipeline (`app.use`)** — body parsing is automatic (JSON /
  urlencoded auto-detected on the request) and static serving is configured via
  `forge({ staticDir })`, so a general middleware chain isn't required for the
  features here.
