'use strict';

const { http, json, created, status } = require('../../../../../src');
const { collection } = require('../../../../../src/store');

const users = collection('users');

// Collection route with [list]/[create] hints — exercises routing, the DSL
// hint protocol (/_routes + Data Explorer discovery), body/query parsing,
// and the real JSON store. Mirrors fs-forge's routes/api/users/index.js.
module.exports = http`
  GET[list]    ${() => json(users.all())}
  POST[create] ${({ body, query }) => {
    const b = (body && typeof body === 'object') ? body : {};
    const name = String(b.name || query.name || '').trim();
    if (!name) {
      return status(400, json({
        error: 'name required',
        hint: 'pass ?name=<your name> or a JSON body { "name": "..." }',
      }));
    }
    return created(users.insert({ name, role: b.role || 'member' }));
  }}
`;
