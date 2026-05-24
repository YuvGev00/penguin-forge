'use strict';

// A tiny in-process bridge between the live game (routes/world.js, which owns
// the World + the connected clients) and the REST routes (routes/api/penguins,
// which can't otherwise reach that private state). routes/world.js registers a
// narrow control API here once its singletons exist; the REST routes call it.
//
// Same pattern as src/runtime.js (which exposes the inspector). Keeping the
// world the sole owner — REST only gets verbs, never the raw Map.
//
// API shape registered by routes/world.js:
//   spawn(name)          -> { id, pid, name, room } | null   (a live, conn-less penguin)
//   rename(storeId,name) -> row | null
//   kick(storeId,reason) -> bool   (removes from world + pushes {t:'kicked'} + closes)
//   list()               -> array  (the roster)

let api = null;

module.exports = {
  setApi(a) {
    api = a;
  },
  getApi() {
    return api;
  },
};
