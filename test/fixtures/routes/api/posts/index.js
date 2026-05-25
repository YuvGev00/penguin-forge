'use strict';

const { http, json, created, status } = require('../../../../../src');
const { collection } = require('../../../../../src/store');

const posts = collection('posts');
const users = collection('users');

// Second resource with an authorship gate: an author must already exist as
// a users row (case-insensitive). Exercises cross-collection logic, 400 on
// missing field, and 403 on an unknown author.
module.exports = http`
  GET[list]    ${() => json(posts.all())}
  POST[create] ${({ query, body }) => {
    const b = (body && typeof body === 'object') ? body : {};
    const title = (query.title || b.title || '').trim();
    const author = (query.author || b.author || '').trim();
    if (!author) {
      return status(400, json({ error: 'author required', hint: 'pass ?author=<your name>' }));
    }
    const known = users.all().some(
      (u) => String(u.name).toLowerCase() === author.toLowerCase()
    );
    if (!known) {
      return status(403, json({ error: 'unknown author', author }));
    }
    return created(posts.insert({ title: title || 'untitled', author }));
  }}
`;
