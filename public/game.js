'use strict';

// Cabinet games client. app.js calls:
//   Game.setActiveCabinet(cabId|null)  — based on whether YOUR penguin is
//                                        standing in a cabinet zone
//   Game.handle(cabId, ev)             — a server game event for that cabinet
// and uses Game.send(...) to relay input back through the world socket.

const Game = (() => {
  const $ = (i) => document.getElementById(i);
  let active = null;        // current cabinet id, or null
  let sendFn = null;        // wired by app.js: (obj) => ws.send
  let drawColor = '#111';

  // Server game events can arrive BEFORE the world snapshot flips `active`
  // (join fires immediately on the socket). So we cache the latest state
  // per cabinet and replay it the moment the overlay opens — otherwise the
  // player list / word would be silently dropped.
  const cache = {}; // cabId -> { state, ops:[] }

  // ---- change 4: lobby state tracking ----
  // lobbyShown tracks whether we are currently showing the lobby card
  // for the active cabinet. Once the user dismisses it (or game goes active),
  // we hide it.
  let lobbyShown = false;

  const RULES = {
    draw: 'One penguin draws a secret word, everyone else races to guess it in chat. Correct guesses score points.',
    duel: 'Wait for GO, then be the fastest to tap. First to 3 wins. Jumping early loses the round.',
    shelf: 'Browse the library. Open a book, turn pages, and leave margin notes for other scholars.',
    pc: 'Solve coding puzzles. Write your solution and submit — everyone sees who cracks it first.',
  };

  // ---- Book Room state ----
  let bookOpenId = null;    // currently open book id
  let bookPage = 0;         // current page index
  const bookNotesCache = {}; // key -> [{name,text}]

  // ---- Lab state ----
  let labPuzzle = null; // {title,prompt,signature}

  function isGameIdle(cabId) {
    if (cabId === 'shelf' || cabId === 'pc') return false; // never show lobby
    const c = cache[cabId];
    if (!c || !c.state) return true; // no state yet — treat as idle
    const ev = c.state;
    if (cabId === 'draw') return ev.active === false;
    if (cabId === 'duel') return ev.phase === 'idle';
    return true;
  }

  function updateLobbyCount(cabId) {
    const c = cache[cabId];
    const players = (c && c.state && c.state.players) || [];
    $('lobbyCount').textContent = `Players: ${players.length}`;
  }

  function showLobby(cabId) {
    const isDraw = cabId === 'draw';
    $('lobbyTitle').textContent = isDraw ? '🎨 Draw & Guess' : '⚡ Reaction Duel';
    $('lobbyRules').textContent = RULES[cabId] || '';
    updateLobbyCount(cabId);
    const btn = $('cabLobbyBtn');
    btn.textContent = '▶ Ready';
    btn.classList.remove('waiting');
    $('cabLobby').hidden = false;
    $('drawUI').hidden = true;
    $('duelUI').hidden = true;
    $('bookUI').hidden = true;
    $('labUI').hidden = true;
    lobbyShown = true;
  }

  function hideLobby(cabId) {
    $('cabLobby').hidden = true;
    $('drawUI').hidden = cabId !== 'draw';
    $('duelUI').hidden = cabId !== 'duel';
    $('bookUI').hidden = cabId !== 'shelf';
    $('labUI').hidden = cabId !== 'pc';
    lobbyShown = false;
  }

  $('cabLobbyBtn').onclick = () => {
    if (active) hideLobby(active);
  };

  // ---- overlay show/hide driven by penguin position ----
  function setActiveCabinet(cabId) {
    if (cabId === active) return;
    active = cabId;
    const ov = $('cabOverlay');
    if (!cabId) {
      ov.classList.remove('on');
      lobbyShown = false;
      $('cabLobby').hidden = true;
      return;
    }
    ov.classList.add('on');
    const isDraw = cabId === 'draw';
    const isShelf = cabId === 'shelf';
    const isPc = cabId === 'pc';
    if (isDraw) {
      $('cabTitle').textContent = '🎨 Draw & Guess';
      clearDraw();
    } else if (cabId === 'duel') {
      $('cabTitle').textContent = '⚡ Reaction Duel';
    } else if (isShelf) {
      $('cabTitle').textContent = '📖 Library';
      initBookUI();
    } else if (isPc) {
      $('cabTitle').textContent = '💻 Class Console';
    }
    $('drawLog').innerHTML = '';

    // Show lobby card if game is idle / not yet active
    if (isGameIdle(cabId)) {
      showLobby(cabId);
    } else {
      $('cabLobby').hidden = true;
      $('drawUI').hidden = !isDraw;
      $('duelUI').hidden = cabId !== 'duel';
      $('bookUI').hidden = !isShelf;
      $('labUI').hidden = !isPc;
      lobbyShown = false;
    }

    // Replay whatever we already know about this cabinet's game.
    const c = cache[cabId];
    if (c && c.state) render(cabId, c.state);
    if (c && c.ops && isDraw) c.ops.forEach(applyOp);
  }

  function send(o) { if (sendFn) sendFn({ t: 'cab', ...o }); }

  // ---- Book Room helpers ----
  function initBookUI() {
    bookOpenId = null;
    bookPage = 0;
    const shelf = $('bookShelf');
    shelf.innerHTML = '';
    const books = (typeof window !== 'undefined' && window.BOOKS) || [];
    books.forEach((b) => {
      const el = document.createElement('div');
      el.className = 'book-spine';
      el.textContent = b.title;
      el.style.background = b.color || '#3a2a18';
      el.dataset.bookId = b.id;
      el.onclick = () => openBook(b.id);
      shelf.appendChild(el);
    });
    renderBookPage();
  }

  function openBook(bookId) {
    const books = (typeof window !== 'undefined' && window.BOOKS) || [];
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    bookOpenId = bookId;
    bookPage = 0;
    document.querySelectorAll('.book-spine').forEach((el) => {
      el.classList.toggle('active', el.dataset.bookId === bookId);
    });
    renderBookPage();
    if (active === 'shelf') send({ kind: 'peek', book: bookOpenId, page: bookPage });
  }

  function renderBookPage() {
    const books = (typeof window !== 'undefined' && window.BOOKS) || [];
    const book = books.find((b) => b.id === bookOpenId);
    if (!book) {
      $('bookHeader').textContent = 'Select a book…';
      $('bookAuthor').textContent = '';
      $('bookPageText').textContent = '';
      $('bookPageNum').textContent = '';
      $('bookPrev').disabled = true;
      $('bookNext').disabled = true;
      renderBookNotes(null, 0);
      return;
    }
    $('bookHeader').textContent = book.title;
    $('bookAuthor').textContent = book.author;
    $('bookPageText').textContent = book.pages[bookPage] || '';
    $('bookPageNum').textContent = `Page ${bookPage + 1} / ${book.pages.length}`;
    $('bookPrev').disabled = bookPage <= 0;
    $('bookNext').disabled = bookPage >= book.pages.length - 1;
    renderBookNotes(bookOpenId, bookPage);
  }

  function renderBookNotes(bookId, page) {
    const key = bookId ? `${bookId}#${page}` : null;
    const notes = (key && bookNotesCache[key]) || [];
    const el = $('bookNotes');
    if (!notes.length) {
      el.innerHTML = '<span style="color:#4a5a78;font-size:.78rem">No notes yet on this page.</span>';
      return;
    }
    el.innerHTML = notes.map((n) =>
      `<div class="note-row"><span class="note-who">${esc(n.name)}:</span>${esc(n.text)}</div>`
    ).join('');
    el.scrollTop = el.scrollHeight;
  }

  // Book nav and note wiring
  $('bookPrev').onclick = () => {
    if (active !== 'shelf' || bookPage <= 0) return;
    bookPage--;
    renderBookPage();
    send({ kind: 'peek', book: bookOpenId, page: bookPage });
  };
  $('bookNext').onclick = () => {
    const books = (typeof window !== 'undefined' && window.BOOKS) || [];
    const book = books.find((b) => b.id === bookOpenId);
    if (active !== 'shelf' || !book || bookPage >= book.pages.length - 1) return;
    bookPage++;
    renderBookPage();
    send({ kind: 'peek', book: bookOpenId, page: bookPage });
  };
  $('bookNoteInput').addEventListener('keydown', (e) => {
    if (active !== 'shelf') return;
    if (e.key === 'Enter' && e.target.value.trim() && bookOpenId !== null) {
      send({ kind: 'note', book: bookOpenId, page: bookPage, text: e.target.value.trim() });
      e.target.value = '';
    }
  });

  // ---- Lab helpers ----
  function renderLabState(s) {
    if (!s) return;
    const prevSig = labPuzzle ? labPuzzle.signature : null;
    const prevTitle = labPuzzle ? labPuzzle.title : null;
    labPuzzle = s.puzzle;
    if (s.puzzle) {
      $('labPuzzleTitle').textContent = s.puzzle.title || '—';
      $('labPuzzlePrompt').textContent = s.puzzle.prompt || '';
      $('labPuzzleSig').textContent = s.puzzle.signature || '';
      // The class advanced to a DIFFERENT puzzle: the old solution is
      // meaningless now, so always reset the editor to the new skeleton.
      // Within the SAME puzzle (e.g. a scoreboard update re-renders state),
      // preserve whatever the user has typed unless it's still the
      // untouched skeleton.
      const code = $('labCode').value;
      const puzzleChanged = prevTitle !== null && prevTitle !== s.puzzle.title;
      if (puzzleChanged || code === '' || code === prevSig
          || code === s.puzzle.signature) {
        $('labCode').value = s.puzzle.signature || '';
      }
      // Hint stays hidden until "Show hint". Re-hide it on a puzzle change
      // (its text is now stale); leave it alone on same-puzzle re-renders
      // so a scoreboard update doesn't snap a revealed hint shut.
      const hint = s.puzzle.hint || '';
      const firstRender = prevTitle === null;
      if (puzzleChanged || firstRender) {
        $('labHint').hidden = true;
        $('labHint').textContent = hint;
        $('labHintBtn').textContent = '💡 Show hint';
        $('labHintBtn').hidden = !hint;
      } else {
        $('labHint').textContent = hint;
      }
    }
    if (s.players) renderLabScores(s.players);
  }

  function renderLabScores(players) {
    $('labScores').innerHTML = '<b style="color:#6bffb0;display:block;margin-bottom:.3rem">Scoreboard</b>' +
      (players || []).map((p) =>
        `<div class="row"><span>${esc(p.name)}</span><span>${p.solved ? '✓' : '—'}</span></div>`
      ).join('');
  }

  // Tab inside the code box indents (4 spaces — Python convention, matches
  // the autofilled signature so users don't hit IndentationError) instead
  // of leaving the field; Shift+Tab outdents the current/selected lines.
  $('labCode').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.target;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    if (s === en && !e.shiftKey) {
      // simple caret: insert 4 spaces
      ta.value = val.slice(0, s) + '    ' + val.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 4;
    } else {
      // (multi-)line indent / outdent
      const block = val.slice(lineStart, en);
      let changed;
      if (e.shiftKey) {
        changed = block.replace(/^ {1,4}/gm, '');
      } else {
        changed = block.replace(/^/gm, '    ');
      }
      ta.value = val.slice(0, lineStart) + changed + val.slice(en);
      ta.selectionStart = lineStart;
      ta.selectionEnd = lineStart + changed.length;
    }
  });

  $('labRunBtn').onclick = () => {
    if (active !== 'pc') return;
    const code = $('labCode').value;
    send({ kind: 'submit', code });
  };
  $('labNextBtn').onclick = () => {
    if (active !== 'pc') return;
    send({ kind: 'next' });
  };
  // Reveal-on-click hint (client-only; the text already arrived in state).
  $('labHintBtn').onclick = () => {
    const box = $('labHint');
    box.hidden = !box.hidden;
    $('labHintBtn').textContent = box.hidden ? '💡 Show hint' : '💡 Hide hint';
  };

  // ---- Draw & Guess ----
  const dC = $('drawC'), dctx = dC.getContext('2d');
  let drawing = false, last = null, iAmDrawer = false, endsAt = 0;
  let brush = 4, erasing = false;

  function clearDraw() { dctx.clearRect(0, 0, dC.width, dC.height); }

  // Render one server op (stroke / fill / clear). Mirrors the standalone
  // game: eraser = destination-out, fill = whole-canvas paint.
  function applyOp(op) {
    if (!op) return;
    if (op.t === 'clear' || op.clear) { clearDraw(); return; }
    if (op.t === 'fill') {
      dctx.fillStyle = op.c || '#111';
      dctx.fillRect(0, 0, dC.width, dC.height);
      return;
    }
    // default: a stroke
    dctx.globalCompositeOperation = op.erase ? 'destination-out' : 'source-over';
    dctx.strokeStyle = op.c || '#111';
    dctx.lineWidth = op.w || 4;
    dctx.lineCap = 'round';
    dctx.lineJoin = 'round';
    dctx.beginPath();
    dctx.moveTo(op.x0, op.y0); dctx.lineTo(op.x1, op.y1); dctx.stroke();
    dctx.globalCompositeOperation = 'source-over';
  }
  function replayOps(ops) { clearDraw(); (ops || []).forEach(applyOp); }

  function dpos(e) {
    const r = dC.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: (t.clientX - r.left) * (dC.width / r.width),
      y: (t.clientY - r.top) * (dC.height / r.height),
    };
  }
  function startDraw(e) { if (!iAmDrawer) return; drawing = true; last = dpos(e); e.preventDefault(); }
  function moveDraw(e) {
    if (!drawing || !iAmDrawer) return;
    const p = dpos(e);
    const s = { x0: last.x, y0: last.y, x1: p.x, y1: p.y,
      c: drawColor, w: brush, erase: erasing };
    applyOp({ t: 'stroke', ...s });
    send({ kind: 'op', op: { t: 'stroke', s } });
    last = p; e.preventDefault();
  }
  const endDraw = () => (drawing = false);
  dC.addEventListener('mousedown', startDraw);
  dC.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  dC.addEventListener('touchstart', startDraw, { passive: false });
  dC.addEventListener('touchmove', moveDraw, { passive: false });
  dC.addEventListener('touchend', endDraw);

  // colour swatches
  document.querySelectorAll('.dc').forEach((s) =>
    s.addEventListener('click', () => {
      drawColor = s.dataset.c; erasing = false;
      $('drawErase').classList.remove('on');
      document.querySelectorAll('.dc').forEach((x) =>
        x.classList.toggle('on', x === s));
    }));
  // brush sizes
  document.querySelectorAll('.ds').forEach((s) =>
    s.addEventListener('click', () => {
      brush = +s.dataset.w;
      document.querySelectorAll('.ds').forEach((x) =>
        x.classList.toggle('on', x === s));
    }));
  $('drawErase').onclick = () => {
    if (!iAmDrawer) return;
    erasing = !erasing;
    $('drawErase').classList.toggle('on', erasing);
  };
  $('drawFill').onclick = () => {
    if (iAmDrawer) send({ kind: 'op', op: { t: 'fill', c: drawColor } });
  };
  $('drawUndo').onclick = () => {
    if (iAmDrawer) send({ kind: 'op', op: { t: 'undo' } });
  };
  $('drawClear').onclick = () => {
    if (iAmDrawer) send({ kind: 'op', op: { t: 'clear' } });
  };
  $('drawGuess').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      send({ kind: 'guess', text: e.target.value.trim() });
      e.target.value = '';
    }
  });

  function drawScores(list) {
    $('drawScores').innerHTML = list
      .slice().sort((a, b) => b.score - a.score)
      .map((p) => `<div class="row ${p.drawing ? 'dr' : ''}">
        <span>${p.drawing ? '✏️ ' : ''}${esc(p.name)}</span>
        <b>${p.score}</b></div>`).join('');
  }
  function glog(text, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    $('drawLog').appendChild(d);
    $('drawLog').scrollTop = $('drawLog').scrollHeight;
  }

  // ---- Reaction Duel ----
  let duelGoAt = 0, duelTick = null;
  function stopDuelTick() { clearInterval(duelTick); duelTick = null; }

  function renderDuel(s) {
    const stage = $('duelStage'), btn = $('duelBtn'),
      msg = $('duelMsg'), tmr = $('duelTimer');
    stage.classList.remove('go', 'bad', 'arming');

    if (s.phase === 'idle') {
      stopDuelTick();
      msg.textContent = 'Waiting for 2+ players';
      btn.textContent = 'WAIT'; tmr.textContent = '';
    } else if (s.phase === 'arming') {
      stopDuelTick();
      stage.classList.add('arming');
      msg.textContent = "Hold… don't tap early";
      btn.textContent = '●'; tmr.textContent = '';
    } else if (s.phase === 'go') {
      stage.classList.add('go');
      msg.textContent = 'TAP NOW!';
      btn.textContent = 'TAP!';
      // live reaction timer counting up from the GO moment
      duelGoAt = performance.now();
      stopDuelTick();
      duelTick = setInterval(() => {
        tmr.textContent = Math.round(performance.now() - duelGoAt) + ' ms';
      }, 16);
    } else if (s.phase === 'done') {
      stopDuelTick();
      const w = s.winner;
      if (w && w.false) {
        stage.classList.add('bad');
        msg.textContent = `${w.name} jumped early!`;
        tmr.textContent = '🙈';
      } else if (w) {
        msg.textContent = `${w.name} wins the round`;
        tmr.textContent = `${w.ms} ms`;
      } else {
        msg.textContent = 'Round over';
      }
      btn.textContent = '…';
    }

    $('duelScores').innerHTML = (s.players || [])
      .slice().sort((a, b) => b.wins - a.wins)
      .map((p) => `<div class="row"><span>${esc(p.name)}</span>
        <b>${'🏆'.repeat(p.wins) || '—'}</b></div>`).join('');
  }
  $('duelBtn').onclick = () => send({ kind: 'press' });

  function esc(s) {
    return String(s).replace(/[&<>]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  // Render one event into the overlay (only meaningful when that cabinet
  // is the active one).
  function render(cabId, ev) {
    if (cabId === 'draw') {
      if (ev.t === 'state') {
        // If game just became active, dismiss lobby
        if (lobbyShown && ev.active !== false) hideLobby(cabId);
        // Update lobby player count if still showing
        if (lobbyShown) updateLobbyCount(cabId);
        iAmDrawer = ev.youDraw;
        endsAt = ev.endsAt || 0;
        $('drawRole').textContent = ev.active === false
          ? 'Waiting for another penguin…'
          : (ev.youDraw ? '✏️ Your turn — draw:' :
             `🎨 ${ev.drawerName || '?'} is drawing`);
        $('drawWord').textContent = ev.youDraw
          ? (ev.word || '') : (ev.wordLen ? '_ '.repeat(ev.wordLen).trim() : '');
        $('drawTools').hidden = !ev.youDraw;
        $('drawGuess').disabled = !!ev.youDraw;
        $('drawGuess').placeholder = ev.youDraw
          ? "you're drawing — others guess" : 'type your guess…';
        if (ev.players) drawScores(ev.players);
        if (ev.replay) replayOps(ev.replay);
      } else if (ev.t === 'players') {
        if (lobbyShown) updateLobbyCount(cabId);
        drawScores(ev.players);
      } else if (ev.t === 'op') applyOp(ev.op);
      else if (ev.t === 'replace') replayOps(ev.ops); // undo rebuild
      else if (ev.t === 'clear') clearDraw();
      else if (ev.t === 'sys') glog(ev.text, 'sys');
      else if (ev.t === 'chat') glog(`${ev.name}: ${ev.text}`);
    } else if (cabId === 'duel') {
      if (ev.t === 'duel') {
        // If game becomes active (not idle), dismiss lobby
        if (lobbyShown && ev.phase !== 'idle') hideLobby(cabId);
        if (lobbyShown) updateLobbyCount(cabId);
        renderDuel(ev);
      }
    } else if (cabId === 'shelf') {
      if (ev.t === 'notes') {
        bookNotesCache[ev.key] = ev.notes;
        // Render if this matches the currently open page
        if (bookOpenId && ev.key === `${bookOpenId}#${bookPage}`) {
          renderBookNotes(bookOpenId, bookPage);
        }
      } else if (ev.t === 'bookstate') {
        // members updated — nothing to render for now
      }
    } else if (cabId === 'pc') {
      if (ev.t === 'classstate') {
        renderLabState(ev);
      } else if (ev.t === 'scores') {
        renderLabScores(ev.players);
      } else if (ev.t === 'classmsg') {
        const log = $('labLog');
        const d = document.createElement('div');
        d.textContent = ev.text;
        log.appendChild(d);
        log.scrollTop = log.scrollHeight;
      } else if (ev.t === 'result') {
        const res = $('labResults');
        const lines = (ev.detail || []).map((d) => {
          if (d.ok) return `<div class="pass">✓ ${esc(d.call)}</div>`;
          const why = d.err ? esc(d.err) : `got ${esc(JSON.stringify(d.got))}, want ${esc(JSON.stringify(d.expect))}`;
          return `<div class="fail">✗ ${esc(d.call)} — ${why}</div>`;
        });
        res.innerHTML = `<b style="color:${ev.ok ? '#6bff9e' : '#ff6b6b'}">${ev.ok ? 'All tests passed!' : `${ev.passed}/${ev.total} passed`}</b>` + lines.join('');
      }
    }
  }

  // ---- inbound server events: cache always, render when active ----
  function handle(cabId, ev) {
    const c = cache[cabId] || (cache[cabId] = { state: null, ops: [] });
    if (ev.t === 'state' || ev.t === 'duel' || ev.t === 'bookstate' || ev.t === 'classstate') {
      c.state = ev;
    } else if (ev.t === 'players' && c.state) {
      c.state.players = ev.players;
    } else if (ev.t === 'scores' && c.state) {
      c.state.players = ev.players;
    } else if (ev.t === 'notes') {
      bookNotesCache[ev.key] = ev.notes;
    } else if (ev.t === 'op') {
      c.ops.push(ev.op); if (c.ops.length > 4000) c.ops.shift();
    } else if (ev.t === 'replace') {
      c.ops = ev.ops.slice();
    } else if (ev.t === 'clear') {
      c.ops = [];
    }
    if (cabId === active) render(cabId, ev);
  }

  // draw timer tick
  setInterval(() => {
    if (active === 'draw' && endsAt) {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      $('drawTimer').textContent = endsAt ? `⏱ ${s}s` : '';
    }
  }, 250);

  // Leave button: walk the penguin out of the cabinet zone. The server's
  // onCabinet logic then cleanly removes us from the game; the overlay
  // closes automatically once the snapshot shows cab=null.
  let leaveFn = null;
  $('cabLeave').onclick = () => { if (leaveFn) leaveFn(); };

  return {
    setActiveCabinet,
    handle,
    wireSend(fn) { sendFn = fn; },
    wireLeave(fn) { leaveFn = fn; },
  };
})();

window.Game = Game;
