'use strict';

const { http, json, status, noContent } = require('../../../src');
const hub = require('../../../game/hub');

// REST control over a single LIVE penguin, keyed by its store row id (the id
// shown in /_data and returned by GET /api/penguins). The hub (registered by
// routes/world.js) maps that store id to the in-game penguin and acts on the
// running world:
//   PUT    → rename the penguin (name changes in the world + the roster)
//   DELETE → KICK the penguin (removed from the world; if it's a connected
//            player, a {t:'kicked'} message pops up on its screen and its
//            socket is closed)
// A 404 is returned when no LIVE penguin matches that id.
module.exports = http`
  PUT[update]    ${({ params, body, query }) => {
    const api = hub.getApi();
    if (!api) return status(503, json({ error: 'world not ready' }));
    const b = (body && typeof body === 'object') ? body : {};
    const name = String(b.name || query.name || '').trim();
    if (!name) return status(400, json({ error: 'name required' }));
    const row = api.rename(params.id, name);
    if (row && row.error === 'name-taken') {
      return status(409, json({ error: 'name already in use', name }));
    }
    if (!row) return status(404, json({ error: 'no live penguin with that id' }));
    return json(row);
  }}
  DELETE[remove] ${({ params, query }) => {
    const api = hub.getApi();
    if (!api) return status(503, json({ error: 'world not ready' }));
    const reason = query.reason
      ? String(query.reason).slice(0, 120)
      : 'You were kicked from the world by an admin.';
    const ok = api.kick(params.id, reason);
    if (!ok) return status(404, json({ error: 'no live penguin with that id' }));
    return noContent();
  }}
`;
