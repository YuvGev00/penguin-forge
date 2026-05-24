'use strict';

const fs = require('fs');
const path = require('path');

// Returns middleware that serves files from `rootDir`. `mountPath` is an
// optional virtual prefix (e.g. '/static'). Directory-traversal attempts are
// rejected with 403 before any filesystem access.
function serveStatic(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  // Canonical (symlinks resolved) root. The string-prefix check below stops
  // `../` traversal in the URL, but it can't see a symlink *inside* the
  // directory that points outside it — fs.stat follows links. Comparing
  // realpaths before serving closes that hole.
  let realRoot = root;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    /* directory may not exist yet; fall back to resolved path */
  }
  const mount = (options.mountPath || '/').replace(/\/$/, '') || '';
  const indexFile = options.index || 'index.html';
  // Cache-Control max-age (seconds) for served assets — matches the
  // response shape taught in the course. Set options.maxAge = 0 to omit.
  const maxAge = options.maxAge === undefined ? 3600 : options.maxAge;

  // Serve `file` only if its real path is contained in realRoot.
  function serveIfContained(file, res, next) {
    fs.realpath(file, (err, real) => {
      if (err) return next();
      const rel = path.relative(realRoot, real);
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        if (maxAge > 0) res.set('Cache-Control', `max-age=${maxAge}`);
        return res.sendFile(real, () => next());
      }
      return res
        .status(403)
        .json({ error: 'Forbidden', reason: 'symlink escapes static root' });
    });
  }

  return function staticMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    if (mount && !(req.path === mount || req.path.startsWith(mount + '/'))) {
      return next();
    }

    let relative = mount ? req.path.slice(mount.length) : req.path;
    if (relative === '' || relative === '/') relative = '/' + indexFile;

    // Decode, then resolve against root and verify containment.
    let decoded;
    try {
      decoded = decodeURIComponent(relative);
    } catch {
      return res.status(400).send('Bad Request');
    }

    // A NUL byte truncates paths at the syscall level on some platforms and
    // makes fs.stat throw — reject it as a bad request rather than 500.
    if (decoded.includes('\0')) {
      return res.status(400).json({ error: 'Bad Request', reason: 'null byte in path' });
    }

    const target = path.resolve(root, '.' + path.posix.normalize(decoded));
    if (target !== root && !target.startsWith(root + path.sep)) {
      return res.status(403).json({ error: 'Forbidden', reason: 'path traversal blocked' });
    }

    fs.stat(target, (err, stats) => {
      if (err) return next(); // not found here -> let router 404
      if (stats.isDirectory()) {
        const indexPath = path.join(target, indexFile);
        return fs.stat(indexPath, (e2, s2) => {
          if (e2 || !s2.isFile()) return next();
          serveIfContained(indexPath, res, next);
        });
      }
      if (!stats.isFile()) return next();
      serveIfContained(target, res, next);
    });
  };
}

module.exports = serveStatic;
