'use strict';

// Test fixture: a minimal landing route so GET / resolves during the
// framework suite. Mirrors fs-forge's routes/index.js shape.
const { http, html } = require('../../../src');

module.exports = http`
  GET ${() => html('<!DOCTYPE html><title>fixture</title><h1>fixture root</h1>')}
`;
