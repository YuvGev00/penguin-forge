# Design notes — penguin-forge

Why penguin-forge is shaped the way it is. The project merges a from-scratch
HTTP/WebSocket framework (**fs-forge**) with a multiplayer game
(**penguin-world**) so the framework's own dashboards become the game's live
control room. These are the decisions behind that and the trade-offs each one
carries.

## 1. Why vendor fs-forge instead of sharing or rewriting

**Decision:** copy fs-forge's `src/` into this project verbatim (with two tiny,
documented additions) rather than symlinking it or depending on it.

**Why:** the two original projects (`fs-forge`, `penguin-world`) stay untouched
and independently submittable. A symlink would couple them (editing one breaks
the other) and is fragile to clone/submit. Vendoring keeps penguin-forge a
single self-contained tree with zero dependencies — exactly the property the
assignment rewards.

**Trade-off:** the framework code is duplicated on disk. Accepted: it's a
showcase project, and the duplication is explicit and inert.

## 2. Why the game runs as a route, not its own server

**Decision:** the penguin game lives in `routes/world.js` (a `` ws`` `` route at
`/world`) instead of penguin-world's standalone `server.js`.

**Why:** that single move is the whole thesis. Once the game is *inside* the
framework, every game event naturally flows through the framework's existing
surfaces — the store (`/_data`), the wire inspector (`/_inspect`), the REST API
— with almost no glue. The framework becomes the game's admin/ops view for free.

**Trade-off:** the 20 Hz authoritative loop now lives at module scope in a route
file. fs.watch hot-reload could double-start it, so it's guarded with a
`globalThis.__pfWorldLoop` handle that clears any prior interval.

## 3. The store-write boundary: identity durable, motion ephemeral

**Decision:** penguin **identity** (name, room, join time) is written to the
JSON store; **position** (x/y, 20 Hz) never is.

**Why:** the store powers the reactive `/_data` roster, so identity belongs
there — and a penguin joining/leaving/changing rooms is exactly what an admin
wants to see. But writing 20 Hz positions would hammer `data.json` and add
nothing (positions are transient). So: `insert` on join, `update` **only when
the room actually changes** (diffed against a cached `lastRoom`, never per
tick), `remove` on disconnect/kick. Live positions stay in `world.players`
memory and ship only via the snapshot fan-out.

**Trade-off:** the roster shows *which room*, not live coordinates. That's the
right altitude for an admin view, not a limitation.

## 4. Why a hub module (`game/hub.js`) bridges REST and the live game

**Decision:** `routes/world.js` owns `world` + `clients` privately and registers
a narrow control API (`spawn`/`rename`/`kick`/`list`) on `game/hub.js`; the REST
routes (`routes/api/penguins/*`) call that API.

**Why:** REST routes and the WebSocket route are separate files and can't see
each other's module state. Three options existed: (a) a shared hub holder, (b)
the store `changes` event bus, (c) exporting `world`/`clients`. The store bus is
one-way and can't *invoke* world mutations or reach a specific socket (so it
can't spawn or kick). Exporting the mutable maps leaks transport state across
files and breaks the "world.js is the sole owner" invariant (and the hot-reload
guard). The hub is the minimal seam — it mirrors the `src/runtime.js` pattern
already used to expose the inspector, keeps `world.js` authoritative, and
survives hot reload (re-require just re-registers the API).

**Trade-off:** one more tiny module. Worth it for a clean, testable verb
interface instead of leaked globals.

## 5. Why a REST-spawned penguin has no socket

**Decision:** `POST /api/penguins` creates a real penguin in the world with
`conn: null`.

**Why:** snapshots are built from `world.players`, so a penguin needs no socket
to *exist*, walk, or be seen by others. A connection-less penguin appears in the
roster and on everyone's screen immediately; the fan-out just guards `c.conn &&`
before delivering. This is more honest than a "pre-register a name" half-measure
— the admin genuinely added a participant to the world.

**Trade-off:** a conn-less penguin can't receive input, so it idles at spawn.
Fine for an admin/demo action; documented.

## 6. Why DELETE pushes a "kicked" message and suppresses reconnect

**Decision:** `DELETE /api/penguins/:id` sends `{t:'kicked',reason}` to the
target's socket, closes it, and removes the world player + roster row. The
client shows a full-screen overlay and a `kicked` flag stops the auto-reconnect.

**Why:** a kick that only closed the socket would be invisible (and the client's
`onclose` auto-reconnect would instantly rejoin). Surfacing it on the victim's
screen makes the admin action real and visible — the point of the feature.

**Trade-off:** `:id` is the **store row id** (what `/_data` and the REST API
expose), not the internal game pid; the hub maps between them, returning 404
when no live penguin matches.

## 7. Why the /forge chat panel is a "watcher", not a player

**Decision:** the live chat on the framework showcase opens its own `/world`
socket but sends `{t:'watch'}` (not `{t:'join'}`), so it sees/sends chat without
spawning a penguin.

**Why:** the framework page isn't the game — a phantom penguin appearing in
`/play` whenever someone opens `/forge` would be confusing. A watcher gets the
live chat feed (`{t:'chatlog'}`) and can post (`{t:'say'}`) without an avatar.
It reuses the exact same hand-written WebSocket the game does.

**Trade-off:** watcher chat shows in the chat feed but not as a speech bubble in
the world (no avatar to attach it to). Intended.

## 8. Why drop the Python classroom game

**Decision:** the classroom mini-game (which spawned `python3` to grade code)
and `judge.js` are not ported.

**Why:** penguin-forge's pitch is "pure Node, zero external dependencies." A
`python3` requirement on the grader's machine would undercut that. The Lab room
stays as an explorable space; Draw & Guess, Reaction Duel, and the Bookshelf are
kept intact.

## 9. The two (and only two) edits to vendored fs-forge

To keep the vendored framework honest, the only changes from upstream fs-forge
are:
1. **`src/runtime.js`** (new) + one line in `src/index.js` — exposes the wire
   inspector to route handlers so game events can be surfaced on `/_inspect`.
2. **`src/ws-ui.js` removed** + its `/_ws` route/links — the generic echo
   playground pointed at a `/ws/echo` route that doesn't exist here and was made
   redundant by the live game + the `/forge` chat. (The `/world` WebSocket is the
   real, working socket.)

Everything else under `src/` is byte-for-byte fs-forge, and its 99-assertion
smoke suite still passes against it.

## What was deliberately left out

- **Live position in the roster** — see §3; out of altitude for an admin view.
- **The Python classroom game** — see §8; dependency cost.
- **The /_ws echo playground** — see §9; broken + redundant here.
- **WebSocket message fragmentation / permessage-deflate** — inherited fs-forge
  boundaries; snapshots are small single frames, so unaffected.
