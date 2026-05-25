'use strict';

const { http, json } = require('../../../../src');

module.exports = http`
  GET ${({ query }) => json({ message: 'Hello, World!', you: query.name || 'stranger' })}
`;
