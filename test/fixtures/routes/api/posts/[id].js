'use strict';

const { http, json, noContent, notFound, status, coerce } = require('../../../../../src');
const { collection } = require('../../../../../src/store');

const posts = collection('posts');
const users = collection('users');

// Re-runs the author gate on update so a post can't be reassigned to a
// user that doesn't exist.
function update({ params, body, query }) {
  const fromBody = body && typeof body === 'object' ? body : {};
  const patch = { ...fromBody, ...coerce(query) };
  delete patch.id;
  if (patch.author !== undefined) {
    const newAuthor = String(patch.author).trim();
    if (!newAuthor) return status(400, json({ error: 'author cannot be empty' }));
    const known = users.all().some(
      (u) => String(u.name).toLowerCase() === newAuthor.toLowerCase()
    );
    if (!known) return status(403, json({ error: 'unknown author', author: newAuthor }));
    patch.author = newAuthor;
  }
  const p = posts.update(params.id, patch);
  return p ? json(p) : notFound({ error: 'post not found', id: params.id });
}

module.exports = http`
  GET[item]      ${({ params }) => {
    const p = posts.get(params.id);
    return p ? json(p) : notFound({ error: 'post not found', id: params.id });
  }}
  PUT[update]    ${update}
  PATCH          ${update}
  DELETE[remove] ${({ params }) =>
    posts.remove(params.id)
      ? noContent()
      : notFound({ error: 'post not found', id: params.id })}
`;
