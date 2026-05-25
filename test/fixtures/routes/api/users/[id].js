'use strict';

const { http, json, noContent, notFound, coerce } = require('../../../../../src');
const { collection } = require('../../../../../src/store');

const users = collection('users');

// Shared by PUT and PATCH (merge-update). Query values are coerced so
// ?age=32 stores 32 (number), ?active=true stores true (boolean), and a
// non-round-tripping value like "Smoked007" stays a string.
function update({ params, body, query }) {
  const fromBody = body && typeof body === 'object' ? body : {};
  const patch = { ...fromBody, ...coerce(query) };
  delete patch.id;
  const u = users.update(params.id, patch);
  return u ? json(u) : notFound({ error: 'user not found', id: params.id });
}

module.exports = http`
  GET[item]      ${({ params }) => {
    const u = users.get(params.id);
    return u ? json(u) : notFound({ error: 'user not found', id: params.id });
  }}
  PUT[update]    ${update}
  PATCH          ${update}
  DELETE[remove] ${({ params }) =>
    users.remove(params.id)
      ? noContent()
      : notFound({ error: 'user not found', id: params.id })}
`;
