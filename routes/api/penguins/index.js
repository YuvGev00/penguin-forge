'use strict';

const { http, json, created, status } = require('../../../src');
const { collection } = require('../../../src/store');
const hub = require('../../../game/hub');

const penguins = collection('penguins');

// The live roster + REST control. The [list]/[create] hints let the Data
// Explorer (/_data) discover this as a collection. These verbs drive the LIVE
// game via the hub the world route (routes/world.js) registers:
//   GET    → the roster
//   POST   → spawn a real (socket-less) penguin into the running world
// (rename / kick live in [id].js)
module.exports = http`
  GET[list]    ${() => json(penguins.all())}
  POST[create] ${({ body, query }) => {
    const b = (body && typeof body === 'object') ? body : {};
    const name = String(b.name || query.name || '').trim();
    if (!name) {
      return status(400, json({
        error: 'name required',
        hint: 'pass ?name=<name> or a JSON body { "name": "..." }',
      }));
    }
    const api = hub.getApi();
    if (!api) return status(503, json({ error: 'world not ready' }));
    const row = api.spawn(name);
    if (row && row.error === 'name-taken') {
      return status(409, json({ error: 'name already in use', name }));
    }
    if (!row) return status(400, json({ error: 'could not spawn penguin' }));
    return created(row);
  }}
`;
