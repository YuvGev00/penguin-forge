'use strict';

// Penguin World client. Server is authoritative at 20Hz; we render at
// 60fps and interpolate penguins between the two latest snapshots.
// Visual direction (3-way design synthesis): "storybook winter resort" —
// crisp shapes, room-specific colour scripts, cheap fake shadows, sparing
// glow accents, lots of small juice.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const $ = (i) => document.getElementById(i);
const W = canvas.width, H = canvas.height;

let ws, myId = null, myName = 'penguin';
let prev = null, cur = null, prevAt = 0, curAt = 0;
const anim = new Map(); // id -> { phase, squash, lastX, lastY }

// ---------- room background images ----------
// Each room is a painted scene in public/bg/<room>.png, drawn to fill the
// 1200x720 canvas. Preloaded once; until an image is ready (or if it fails),
// we fall back to the room's flat bg colour from the snapshot.
const ROOM_BG = {};
['plaza', 'cafe', 'university', 'lab', 'library', 'arcade'].forEach((room) => {
  const img = new Image();
  img.src = '/bg/' + room + '.png';
  ROOM_BG[room] = img;
});
function paintRoomBg(room) {
  const img = ROOM_BG[room];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    ctx.fillStyle = (cur && cur.bg) || '#10203a';
    ctx.fillRect(0, 0, W, H);
  }
}
let ripples = [];       // click destination puffs
let footprints = [];    // fading prints behind walking penguins
const snow = Array.from({ length: 34 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  r: Math.random() * 2 + 1, sp: Math.random() * 18 + 10,
  drift: Math.random() * 14 - 7,
}));

// ---- change 5: intro name validation + preview ----
(function setupIntro() {
  const introCanvas = $('introPreview');
  const ictx = introCanvas.getContext('2d');
  const IW = introCanvas.width, IH = introCanvas.height;
  let bobPhase = 0;
  let introRafActive = true;
  let introTimer = null;

  function drawIntroPreview() {
    if (!introRafActive) return;
    ictx.clearRect(0, 0, IW, IH);
    bobPhase = (bobPhase + 0.012) % 1;
    // Draw penguin centered at (48, 62) in the 96x96 canvas
    drawPenguin(ictx, 48, 62, '#3b82f6', 1, true, bobPhase, 0);
    introTimer = setTimeout(
      () => requestAnimationFrame(drawIntroPreview), 33); // ~30fps
  }
  function stopIntroPreview() {
    introRafActive = false;
    clearTimeout(introTimer);
  }
  requestAnimationFrame(drawIntroPreview);

  function validateName() {
    const v = $('name').value.trim();
    if (v.length >= 2) { $('nameErr').textContent = ''; return true; }
    $('nameErr').textContent = 'Pick a name (2–14 letters)';
    const inp = $('name');
    inp.classList.remove('shake');
    // force reflow so the animation re-triggers
    void inp.offsetWidth;
    inp.classList.add('shake');
    inp.addEventListener('animationend', () => inp.classList.remove('shake'), { once: true });
    return false;
  }

  $('go').onclick = () => { if (validateName()) { stopIntroPreview(); start(); } };
  $('name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { if (validateName()) { stopIntroPreview(); start(); } }
  });
})();

function start() {
  myName = $('name').value.trim();

  const wipe = $('cloudWipe');
  if (!wipe) {
    // Fallback: no transition element — behave as before.
    $('intro').style.display = 'none';
    connect();
    return;
  }

  // Cloud curtain: the login screen is covered by closed clouds. On login we
  // connect to the game (it renders at the base layer, hidden behind the
  // clouds), then PART the clouds left/right like curtains and fade the intro
  // out — revealing the live world between them. After the part, the intro +
  // cloud overlay are removed entirely.
  //
  // prefers-reduced-motion shortens the .bank transition to .5s (see the CSS),
  // so match the teardown delay to whichever the user gets — otherwise the
  // curtain sits fully-open-but-still-present for ~1.1s for those users.
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PART_MS = reduce ? 500 : 1600; // matches the .bank transition duration
  connect();                       // game starts rendering behind the clouds
  $('intro').classList.add('opening'); // fade the form/plaza out
  wipe.classList.add('part');      // slide the two banks apart

  curtainTimer = setTimeout(() => {
    $('intro').style.display = 'none';
    wipe.classList.add('gone');
    wipe.classList.remove('play'); // animation no longer needed once hidden
  }, PART_MS);
}

// Handle for the start() teardown timer, so a name rejection arriving mid-part
// can cancel it before it hides the intro we're sending the user back to.
let curtainTimer = null;

// Put the cloud curtain back to its CLOSED login state — clouds covering and
// billowing, the form visible. Reverses everything start() did so returning to
// the intro (e.g. after a rejected name) never leaves a blank/half-open screen.
function resetCurtain() {
  clearTimeout(curtainTimer);
  const intro = $('intro');
  const wipe = $('cloudWipe');
  if (intro) intro.classList.remove('opening'); // un-fade the form
  if (wipe) {
    wipe.classList.remove('part', 'gone'); // close the curtain again
    wipe.classList.add('play');            // resume the gentle billow
  }
  if (intro) intro.style.display = 'flex';
}

function connect() {
  nameRejected = false; // a fresh connection attempt is always intentional
  ws = new WebSocket(`ws://${location.host}/world`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: 'join', name: myName }));
    Game.wireSend((o) => ws.send(JSON.stringify(o)));
    // "Leave game" → server snaps us to OUR CURRENT room's spawn (always
    // clear of that room's cabinet zones — fixes leaving the lab/library
    // re-entering the PC/shelf because the old hardcoded arcade coord sat
    // inside those zones).
    Game.wireLeave(() => ws.send(JSON.stringify({ t: 'leave' })));
  };
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; } // ignore a malformed frame
    if (m.t === 'hello') myId = m.id;
    else if (m.t === 'snap') { prev = cur; prevAt = curAt; cur = m; curAt = performance.now(); }
    else if (m.t === 'cab') Game.handle(m.cab, m.ev);
    else if (m.t === 'kicked') showKicked(m.reason);
    else if (m.t === 'nameTaken') showNameTaken(m.name);
    else if (m.t === 'chatlog') addChatLine(m.name, m.text, m.room === 'broadcast');
    else if (m.t === 'announce') { showAnnounce(m.text); addChatLine('admin', m.text, true); }
    else if (m.t === 'idlewarn') showIdleWarn(m.seconds || 60);
  };
  // Auto-reconnect on a dropped socket — UNLESS we were kicked or our name
  // was rejected (both are intentional; reconnecting would loop).
  ws.onclose = () => { if (!kicked && !nameRejected) setTimeout(connect, 1000); };
}

// The chosen name is already in use by another live penguin. Don't reconnect;
// send the user back to the intro to pick a different name.
let nameRejected = false;
function showNameTaken(name) {
  nameRejected = true;
  try { if (ws) ws.close(); } catch (e) {}
  // Re-close the cloud curtain + un-fade the form (start() had begun opening
  // it), and cancel its pending teardown timer — otherwise the user is sent
  // back to a blank, invisible intro.
  resetCurtain();
  const err = $('nameErr');
  if (err) err.textContent = '"' + (name || myName) + '" is already in the world — pick another.';
  const inp = $('name');
  if (inp) { inp.focus(); inp.select(); }
  // nameRejected is reset inside connect() on the next submit.
}

// A penguin was removed by an admin (DELETE /api/penguins/:id). Show a
// full-screen notice and stop reconnecting.
let kicked = false;
function showKicked(reason) {
  kicked = true;
  try { if (ws) ws.close(); } catch (e) {}
  let el = document.getElementById('kickedOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kickedOverlay';
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:1rem;text-align:center;' +
      'background:rgba(7,10,20,.92);backdrop-filter:blur(8px);' +
      "font-family:'Manrope',system-ui,sans-serif;color:#eaf0ff;padding:2rem";
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div style="font-size:3.5rem">🚫</div>' +
    '<div style="font-size:1.6rem;font-weight:800">You were kicked</div>' +
    '<div style="color:#9aa6cc;max-width:30rem;line-height:1.5">' +
    String(reason || 'An admin removed you from the world.')
      .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) +
    '</div>' +
    '<a href="/play" style="margin-top:.5rem;font-family:ui-monospace,monospace;' +
    'color:#5fe3c8;text-decoration:none;border:1px solid rgba(255,255,255,.18);' +
    'border-radius:10px;padding:.55rem 1.1rem">Rejoin ▸</a>';
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

const _esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ----- live chat stream (item: in-world chat) -----
// Lines appear, linger a few seconds, then fade out and remove themselves —
// so the stream doesn't sit permanently on screen. Admin lines linger longer.
function addChatLine(name, text, isAdmin) {
  const box = document.getElementById('chatStream');
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'line' + (isAdmin ? ' admin' : '');
  line.innerHTML = '<b>' + _esc(isAdmin ? '📢 admin' : name) + ':</b> ' + _esc(text);
  box.appendChild(line);
  while (box.children.length > 8) box.removeChild(box.firstChild);
  // Schedule fade-out: keep visible for a few seconds, then fade and remove.
  const linger = isAdmin ? 9000 : 6000;
  setTimeout(() => {
    line.classList.add('fade');
    setTimeout(() => { if (line.parentNode) line.parentNode.removeChild(line); }, 700);
  }, linger);
}

// ----- admin broadcast banner (item: admin announce) -----
let _announceTimer = null;
function showAnnounce(text) {
  const el = document.getElementById('announceBanner');
  if (!el) return;
  el.textContent = '📢 ' + text;
  el.classList.add('show');
  clearTimeout(_announceTimer);
  _announceTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

// ----- idle warning + activity heartbeat (item: idle timeout) -----
let _idleCountdown = null;
function showIdleWarn(seconds) {
  const el = document.getElementById('idleWarn');
  if (!el) return;
  let left = seconds;
  const render = () => {
    el.innerHTML =
      '<div class="box"><h3>⏰ Still there?</h3>' +
      '<p>You’ve been idle. You’ll be kicked in <span class="cd">' + left +
      '</span>s.<br>Move or click to stay.</p>' +
      '<button id="stayBtn">I’m still here</button></div>';
    const b = document.getElementById('stayBtn');
    if (b) b.onclick = () => { markActive(); hideIdleWarn(); };
  };
  render();
  el.classList.add('show');
  clearInterval(_idleCountdown);
  _idleCountdown = setInterval(() => {
    left -= 1;
    if (left <= 0) { clearInterval(_idleCountdown); return; }
    const cd = el.querySelector('.cd');
    if (cd) cd.textContent = left;
  }, 1000);
}
function hideIdleWarn() {
  const el = document.getElementById('idleWarn');
  if (el) el.classList.remove('show');
  clearInterval(_idleCountdown);
}

// Tell the server we're active (resets the idle timer) and clear any warning.
// Throttled so we don't flood the socket on every mousemove.
let _lastActiveSent = 0;
function markActive() {
  const now = Date.now();
  if (now - _lastActiveSent > 5000) { _lastActiveSent = now; send({ t: 'active' }); }
  hideIdleWarn();
}
['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach((ev) =>
  window.addEventListener(ev, markActive, { passive: true }));

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  send({ t: 'move', x, y });
  ripples.push({ x, y, life: 1 });
  // fire first-spawn hint on first click
  hintTrigger('click');
});

const chatBox = $('chat');
chatBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatBox.value.trim()) {
    send({ t: 'chat', text: chatBox.value.trim() });
    chatBox.value = ''; chatBox.blur();
  }
});

// ---- change 2: contextual hint system ----
const ctxHint = $('ctxHint');
const hintState = {
  click:   { fired: false, cooldownUntil: 0 },
  door:    { fired: false, cooldownUntil: 0 },
  cabinet: { fired: false, cooldownUntil: 0 },
};
const HINT_TTL = 4000;
const HINT_COOLDOWN = 12000;
let hintTimeout = null;
let hintVisible = false;

function hintBlocked() {
  if (chatBox === document.activeElement) return true;
  if (!cur) return false;
  const me = (cur.players || []).find((p) => p.id === myId);
  return !!(me && me.m); // chat bubble over local penguin
}

// Returns true only if the hint was actually displayed (not blocked).
function showHint(text) {
  if (hintVisible || hintBlocked()) return false;
  ctxHint.textContent = text;
  ctxHint.classList.add('show');
  hintVisible = true;
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => {
    ctxHint.classList.remove('show');
    hintVisible = false;
  }, HINT_TTL);
  return true;
}

function hintTrigger(key) {
  const now = performance.now();
  const s = hintState[key];
  if (!s || (s.fired && now < s.cooldownUntil)) return;
  const texts = {
    click:   'Click the snow to waddle around',
    door:    'Waddle through the door to explore',
    cabinet: 'Step into the glowing floor to play',
  };
  // Only consume the trigger + start the cooldown if the hint was really
  // shown. If it was blocked (chat focused / another hint up), leave the
  // trigger armed so the player still sees it the next time around.
  if (showHint(texts[key])) {
    s.fired = true;
    s.cooldownUntil = now + HINT_COOLDOWN;
  }
}

// ---- change 3: solo notice ----
const soloNotice = $('soloNotice');
const copyBtn = $('copyInvite');
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(location.href).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy invite link'; }, 2000);
  }).catch(() => {});
});

const lerp = (a, b, t) => a + (b - a) * t;
let lastT = performance.now();

// ---------- room environments ----------
// ---- shared prop helpers ----
function pineTree(x, baseY, s) {
  ctx.fillStyle = '#3f6b4a';
  for (let k = 0; k < 3; k++) {
    const ty = baseY - k * 26 * s, w = (44 - k * 11) * s;
    ctx.beginPath();
    ctx.moveTo(x, ty - 40 * s);
    ctx.lineTo(x - w, ty);
    ctx.lineTo(x + w, ty);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#5a3b22';
  ctx.fillRect(x - 5 * s, baseY, 10 * s, 16 * s);
  // snow caps
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.moveTo(x, baseY - 118 * s);
  ctx.lineTo(x - 9 * s, baseY - 96 * s);
  ctx.lineTo(x + 9 * s, baseY - 96 * s); ctx.closePath(); ctx.fill();
}
function snowman(x, y) {
  ctx.fillStyle = '#f4f9ff';
  [[20, 0], [15, -30], [11, -54]].forEach(([r, dy]) => {
    ctx.beginPath(); ctx.arc(x, y + dy, r, 0, 7); ctx.fill();
  });
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(x - 4, y - 56, 1.6, 0, 7);
  ctx.arc(x + 4, y - 56, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff8a1e';
  ctx.beginPath(); ctx.moveTo(x, y - 52);
  ctx.lineTo(x + 12, y - 50); ctx.lineTo(x, y - 49);
  ctx.closePath(); ctx.fill();
}
function igloo(x, y) {
  ctx.fillStyle = '#dfe9f5';
  ctx.beginPath(); ctx.arc(x, y, 60, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#c4d4e6';
  ctx.beginPath(); ctx.arc(x + 38, y, 22, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#11202f';
  ctx.beginPath(); ctx.arc(x + 38, y, 18, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(150,170,195,0.6)'; ctx.lineWidth = 1.5;
  for (let a = 0.3; a < Math.PI; a += 0.5) {
    ctx.beginPath();
    ctx.arc(x, y, 60, Math.PI + a, Math.PI + a + 0.001); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, 40, Math.PI, 0); ctx.stroke();
}

function paintPlaza(t) {
  // layered icy sky → distant mountains → snow ground (depth)
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9fcdf2');
  sky.addColorStop(0.4, '#c4e2fb');
  sky.addColorStop(0.7, '#e6f3ff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // soft sun glow
  glow(W - 230, 110, 200, 'rgba(255,250,225,0.5)');
  // far mountain range
  ctx.fillStyle = '#a9c4dd';
  ctx.beginPath(); ctx.moveTo(0, 360);
  ctx.lineTo(170, 200); ctx.lineTo(330, 330); ctx.lineTo(520, 170);
  ctx.lineTo(720, 320); ctx.lineTo(940, 210); ctx.lineTo(1150, 340);
  ctx.lineTo(W, 250); ctx.lineTo(W, 420); ctx.lineTo(0, 420);
  ctx.closePath(); ctx.fill();
  // snow caps on peaks
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.moveTo(520, 170); ctx.lineTo(490, 215);
  ctx.lineTo(552, 215); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(940, 210); ctx.lineTo(912, 250);
  ctx.lineTo(968, 250); ctx.closePath(); ctx.fill();
  // rolling snow drifts (ground)
  drift('#eaf4ff', 1, 380, 70);
  drift('#ffffff', 1, 470, 90);
  // pine trees along the back
  pineTree(90, 460, 1); pineTree(150, 470, 0.75);
  pineTree(W - 90, 460, 1); pineTree(W - 150, 470, 0.75);
  pineTree(360, 455, 0.85);
  // igloo (left) + snowman (right)
  igloo(220, 470);
  snowman(W - 260, 500);
  // ---- The Gothic University is the Plaza's central landmark (it
  // replaced the old clock tower). Its archway is the door at
  // x:528,y:70,w:144,h:96 → room 'university'. Drawn large & prominent. ----
  gothicFacade(600, 56, 460, 470);
  // lampposts with warm halo
  lamppost(150, 470, t); lamppost(W - 150, 470, t);
  ambientSnow();
}

// A gothic stone facade centred on cx, top at topY, given width/height.
// Two spired towers, a big pointed entrance arch, and a rose window.
function gothicFacade(cx, topY, fw, fh) {
  const stone = ctx.createLinearGradient(0, topY, 0, topY + fh);
  stone.addColorStop(0, '#6d6982');
  stone.addColorStop(1, '#4a4760');
  const L = cx - fw / 2, Rt = cx + fw / 2, B = topY + fh;
  // main block
  ctx.fillStyle = stone;
  ctx.fillRect(L, topY + 30, fw, fh - 30);
  // crenellated roofline
  ctx.fillStyle = '#3f3c54';
  for (let x = L; x < Rt; x += 26) ctx.fillRect(x, topY + 18, 16, 16);
  // side towers
  [L - 30, Rt - 14].forEach((tx) => {
    ctx.fillStyle = stone;
    ctx.fillRect(tx, topY - 20, 44, fh + 20);
    ctx.fillStyle = '#3a3550';
    ctx.beginPath();
    ctx.moveTo(tx - 6, topY - 20);
    ctx.lineTo(tx + 22, topY - 64);
    ctx.lineTo(tx + 50, topY - 20);
    ctx.closePath(); ctx.fill();
    // lancet windows
    ctx.fillStyle = '#26314a';
    for (let wy = topY + 30; wy < B - 40; wy += 54)
      lancet(tx + 22, wy, 11, 34);
  });
  // rose window
  ctx.fillStyle = '#2a3350';
  ctx.beginPath(); ctx.arc(cx, topY + 78, 30, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8d88a6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, topY + 78, 30, 0, 7); ctx.stroke();
  for (let a = 0; a < 6; a++) {
    ctx.beginPath(); ctx.moveTo(cx, topY + 78);
    ctx.lineTo(cx + 30 * Math.cos(a * 1.047),
      topY + 78 + 30 * Math.sin(a * 1.047));
    ctx.stroke();
  }
  // Grand pointed entrance arch at the BASE of the building — drawn to
  // fill the real door trigger zone (plaza door: x 552..648, y 392..542)
  // so the opening you see is exactly where you walk in. A wider stone
  // surround frames the walkable opening.
  const dL = cx - 48, dR = cx + 48, dTop = 392, dBot = 542;
  // stone surround so the building doesn't look like it has a thin slot
  ctx.fillStyle = '#3a3550';
  ctx.beginPath();
  ctx.moveTo(cx - 96, dBot);
  ctx.lineTo(cx - 96, dTop - 6);
  ctx.quadraticCurveTo(cx, dTop - 96, cx + 96, dTop - 6);
  ctx.lineTo(cx + 96, dBot);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c1528';
  ctx.beginPath();
  ctx.moveTo(dL, dBot);
  ctx.lineTo(dL, dTop + 34);
  ctx.quadraticCurveTo(cx, dTop - 30, dR, dTop + 34);
  ctx.lineTo(dR, dBot);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9a93b4'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(dL, dBot);
  ctx.lineTo(dL, dTop + 34);
  ctx.quadraticCurveTo(cx, dTop - 30, dR, dTop + 34);
  ctx.lineTo(dR, dBot);
  ctx.stroke();
  // glowing doorway + welcoming "ENTER" so it reads as the way in
  glow(cx, dBot - 24, 110, 'rgba(255,210,130,0.32)');
  ctx.fillStyle = 'rgba(255,228,175,0.9)';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('▲ ENTER', cx, dBot - 14);
  // stone steps fanning onto the snow
  ctx.fillStyle = '#6a6480';
  ctx.fillRect(cx - 116, dBot, 232, 12);
  ctx.fillStyle = '#7b7592';
  ctx.fillRect(dL - 32, dBot + 12, 244, 12);
}
function lancet(x, y, rw, rh) {
  ctx.beginPath();
  ctx.moveTo(x - rw, y + rh);
  ctx.lineTo(x - rw, y + rh * 0.4);
  ctx.quadraticCurveTo(x, y - rh * 0.3, x + rw, y + rh * 0.4);
  ctx.lineTo(x + rw, y + rh);
  ctx.closePath(); ctx.fill();
}
function paintCafe() {
  // dim warm room with a back wall + window onto a snowy night
  const wall = ctx.createLinearGradient(0, 0, 0, 380);
  wall.addColorStop(0, '#52392c'); wall.addColorStop(1, '#3a281f');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, 380);
  // window with night view
  const winX = 120, winY = 70, winW = 240, winH = 200;
  const night = ctx.createLinearGradient(0, winY, 0, winY + winH);
  night.addColorStop(0, '#16243f'); night.addColorStop(1, '#2c3e5e');
  ctx.fillStyle = night;
  ctx.fillRect(winX, winY, winW, winH);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.fillRect(winX + Math.random() * winW, winY + Math.random() * winH * 0.7, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#dfe9f5';
  ctx.beginPath(); ctx.arc(winX + winW - 50, winY + 48, 20, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 8;
  ctx.strokeRect(winX, winY, winW, winH);
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(winX + winW / 2, winY);
  ctx.lineTo(winX + winW / 2, winY + winH);
  ctx.moveTo(winX, winY + winH / 2);
  ctx.lineTo(winX + winW, winY + winH / 2); ctx.stroke();
  // hanging pendant lamps
  [W * 0.62, W * 0.82].forEach((lx) => {
    ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 70); ctx.stroke();
    ctx.fillStyle = '#caa15a';
    ctx.beginPath(); ctx.moveTo(lx - 26, 100);
    ctx.lineTo(lx + 26, 100); ctx.lineTo(lx + 16, 70);
    ctx.lineTo(lx - 16, 70); ctx.closePath(); ctx.fill();
    glow(lx, 110, 120, 'rgba(255,200,110,0.22)');
  });
  // shelf with mugs/jars
  ctx.fillStyle = '#3a281c';
  ctx.fillRect(W - 320, 150, 250, 12);
  const jars = ['#c0894e', '#8fae6b', '#b9676a', '#6f93b0'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = jars[i % jars.length];
    roundRect(W - 305 + i * 40, 122, 24, 28, 4); ctx.fill();
  }
  // oak plank floor (perspective shading)
  for (let y = 380; y < H; y += 32) {
    const k = (y - 380) / (H - 380);
    ctx.fillStyle = ((y / 32) | 0) % 2
      ? `rgb(${107 - k * 20},${74 - k * 14},${50 - k * 10})`
      : `rgb(${94 - k * 18},${63 - k * 12},${42 - k * 8})`;
    ctx.fillRect(0, y, W, 32);
    ctx.strokeStyle = 'rgba(30,18,10,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // round rug
  ctx.fillStyle = 'rgba(150,70,55,0.35)';
  ctx.beginPath(); ctx.ellipse(W / 2, 560, 230, 70, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(200,150,90,0.4)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(W / 2, 560, 200, 58, 0, 0, 7); ctx.stroke();
  // potted plant (left)
  ctx.fillStyle = '#7a4a28';
  ctx.beginPath(); ctx.moveTo(70, 540); ctx.lineTo(110, 540);
  ctx.lineTo(104, 590); ctx.lineTo(76, 590); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3f7a45';
  for (let a = -1; a <= 1; a++) {
    ctx.beginPath(); ctx.ellipse(90 + a * 16, 510, 10, 34, a * 0.4, 0, 7);
    ctx.fill();
  }
  // landmark: fireplace with jittering flames
  const fx = W / 2;
  ctx.fillStyle = '#2a1a12';
  roundRect(fx - 95, 180, 190, 200, 10); ctx.fill();
  ctx.fillStyle = '#0e0907';
  roundRect(fx - 64, 232, 128, 148, 8); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const h = 64 + Math.random() * 40;
    ctx.fillStyle = i % 2 ? '#ff8a1e' : '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(fx - 45 + i * 16, 376);
    ctx.quadraticCurveTo(fx - 37 + i * 16, 376 - h, fx - 29 + i * 16, 376);
    ctx.fill();
  }
  ctx.fillStyle = '#3a281c';
  ctx.fillRect(fx - 105, 372, 210, 14); // mantel
  glow(fx, 350, 240, 'rgba(255,150,40,0.26)');
  // counter
  ctx.fillStyle = '#7a5436';
  roundRect(70, 470, 280, 70, 8); ctx.fill();
  ctx.fillStyle = '#5e3f2a'; ctx.fillRect(70, 530, 280, 16);
}
function paintArcade(t) {
  // deep night-club gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#16062e'); bg.addColorStop(0.5, '#0d0420');
  bg.addColorStop(1, '#070213');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // back wall neon signage
  ctx.font = '900 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const blink = 0.55 + 0.45 * Math.sin(t / 280);
  ctx.fillStyle = `rgba(255,93,176,${blink})`;
  ctx.fillText('★ ARCADE ★', W / 2, 90);
  glow(W / 2, 78, 220, `rgba(255,93,176,${0.14 * blink})`);
  // neon side bars
  ctx.fillStyle = `rgba(34,211,238,${0.5 + 0.3 * Math.sin(t / 200)})`;
  ctx.fillRect(40, 130, 6, 180);
  ctx.fillRect(W - 46, 130, 6, 180);
  // ceiling spotlights
  [W * 0.3, W * 0.5, W * 0.7].forEach((sx, i) => {
    glow(sx, 120, 130, i === 1
      ? 'rgba(123,92,255,0.16)' : 'rgba(34,211,238,0.13)');
  });
  // neon perspective grid floor (deeper)
  ctx.strokeStyle = 'rgba(0,215,255,0.32)'; ctx.lineWidth = 1;
  const vy = 250;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 64, H);
    ctx.lineTo(W / 2 + i * 7, vy);
    ctx.stroke();
  }
  for (let gy = vy; gy < H; gy += (gy - vy) * 0.16 + 12) {
    ctx.strokeStyle = `rgba(255,93,176,${0.12 + (gy / H) * 0.18})`;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }
  // floor speakers (corners)
  [[70, H - 110], [W - 70, H - 110]].forEach(([sx, sy]) => {
    ctx.fillStyle = '#15101f';
    roundRect(sx - 28, sy - 60, 56, 120, 6); ctx.fill();
    ctx.fillStyle = '#241834';
    ctx.beginPath(); ctx.arc(sx, sy - 24, 16, 0, 7);
    ctx.arc(sx, sy + 26, 22, 0, 7); ctx.fill();
  });
  // playable cabinets — drawn AT their zone so visuals match the playfield
  for (const cab of (cur && cur.cabinets) || []) {
    const z = cab.zone;
    const cxp = z.x + z.w / 2;
    const neon = cab.id === 'draw' ? '#22d3ee' : '#ff5db0';
    const neon2 = cab.id === 'draw' ? '#3b82f6' : '#ffb02e';
    // glowing standing zone on the floor (where to walk)
    const pulse = 0.5 + 0.5 * Math.sin(t / 350);
    ctx.fillStyle = `rgba(${cab.id === 'draw' ? '34,211,238' : '255,93,176'},${0.07 + pulse * 0.07})`;
    roundRect(z.x, z.y, z.w, z.h, 16); ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + pulse * 0.2})`;
    ctx.lineWidth = 2; roundRect(z.x, z.y, z.w, z.h, 16); ctx.stroke();
    ctx.setLineDash([]);
    // cabinet body above the zone
    ctx.fillStyle = '#1b1030';
    roundRect(cxp - 60, z.y - 165, 120, 165, 12); ctx.fill();
    const scr = ctx.createLinearGradient(cxp, z.y - 150, cxp, z.y - 60);
    scr.addColorStop(0, neon); scr.addColorStop(1, neon2);
    ctx.fillStyle = scr;
    roundRect(cxp - 42, z.y - 148, 84, 92, 6); ctx.fill();
    glow(cxp, z.y - 100, 95, cab.id === 'draw'
      ? 'rgba(34,211,238,0.22)' : 'rgba(255,93,176,0.22)');
    // marquee label + live player count
    const n = (cur.players || []).filter((p) => p.cab === cab.id).length;
    ctx.fillStyle = '#fff';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cab.label, cxp, z.y - 30);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#aab8d4';
    ctx.fillText(n ? `${n} playing` : 'walk in to play', cxp, z.y - 12);
  }
}

// ---- Gothic University rooms (props/activities come later) ----
function stoneHall(tint) {
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, tint[0]); wall.addColorStop(1, tint[1]);
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  // stone-block seams
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  for (let y = 60; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let y = 60; y < H; y += 60) {
    const off = ((y / 60) | 0) % 2 ? 60 : 0;
    for (let x = off; x < W; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke();
    }
  }
  // floor band
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, H - 120, W, 120);
}
function gothicWindow(x, y, w, h, glassTop, glassBot) {
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  const gl = ctx.createLinearGradient(0, y, 0, y + h);
  gl.addColorStop(0, glassTop); gl.addColorStop(1, glassBot);
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.35);
  ctx.quadraticCurveTo(x + w / 2, y - h * 0.18, x + w, y + h * 0.35);
  ctx.lineTo(x + w, y + h);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a1626'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x + w, y + h * 0.6); ctx.stroke();
}
// Stone-tiled floor for the interior rooms (drawn over the lower band).
function stoneFloor(floorY, base) {
  ctx.fillStyle = base;
  ctx.fillRect(0, floorY, W, H - floorY);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i++) { // perspective seams
    ctx.beginPath(); ctx.moveTo(W / 2 + i * 70, floorY);
    ctx.lineTo(W / 2 + i * 220, H); ctx.stroke();
  }
  for (let y = floorY + 36; y < H; y += 46) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}
function gothicPillar(x, topY, botY) {
  ctx.fillStyle = '#4a4760';
  ctx.fillRect(x - 18, topY, 36, botY - topY);
  ctx.fillStyle = '#5b5774';
  ctx.fillRect(x - 24, topY, 48, 16);
  ctx.fillRect(x - 24, botY - 14, 48, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x - 14, topY + 16, 6, botY - topY - 30);
}

function paintUniversity() {
  stoneHall(['#322a4c', '#1b1730']);
  const cx = W / 2;
  // rose window high on the back wall
  ctx.fillStyle = '#2a335a';
  ctx.beginPath(); ctx.arc(cx, 96, 56, 0, 7); ctx.fill();
  ctx.strokeStyle = '#9a93b4'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, 96, 56, 0, 7); ctx.stroke();
  for (let a = 0; a < 8; a++) {
    ctx.beginPath(); ctx.moveTo(cx, 96);
    ctx.lineTo(cx + 56 * Math.cos(a * 0.785), 96 + 56 * Math.sin(a * 0.785));
    ctx.stroke();
  }
  glow(cx, 96, 120, 'rgba(120,140,220,0.18)');
  // tall arched windows along the back
  for (let i = 0; i < 6; i++)
    gothicWindow(60 + i * 200, 150, 110, 200, '#3a4e7a', '#1d2440');
  // colonnade — gothic pillars framing the hall
  [180, 420, W - 420, W - 180].forEach((px) => gothicPillar(px, 70, 470));
  // floor + grand red carpet from the entrance up to the spawn
  stoneFloor(470, '#241f38');
  ctx.fillStyle = 'rgba(150,42,48,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx - 70, H); ctx.lineTo(cx - 34, 470);
  ctx.lineTo(cx + 34, 470); ctx.lineTo(cx + 70, H);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(210,170,90,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 52, H); ctx.lineTo(cx - 30, 470);
  ctx.moveTo(cx + 52, H); ctx.lineTo(cx + 30, 470); ctx.stroke();
  // chandelier
  ctx.strokeStyle = '#5a4a2e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 60); ctx.stroke();
  ctx.fillStyle = '#caa14e';
  ctx.beginPath(); ctx.ellipse(cx, 78, 80, 16, 0, 0, 7); ctx.fill();
  for (let a = -3; a <= 3; a++) {
    glow(cx + a * 26, 78, 24, 'rgba(255,210,120,0.45)');
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(cx + a * 26, 78, 4.5, 0, 7); ctx.fill();
  }
  // banner
  ctx.fillStyle = '#efe8ff'; ctx.font = '800 24px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOTHIC UNIVERSITY · GREAT HALL', cx, 430);
}
function paintLab(t) {
  stoneHall(['#21302c', '#13201c']);
  const cx = W / 2;
  // green chalkboard, framed
  ctx.fillStyle = '#173028';
  roundRect(cx - 280, 70, 560, 210, 6); ctx.fill();
  ctx.strokeStyle = '#6a5230'; ctx.lineWidth = 10;
  ctx.strokeRect(cx - 280, 70, 560, 210);
  ctx.strokeStyle = 'rgba(220,235,215,0.6)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 230, 120); ctx.lineTo(cx - 60, 120);
  ctx.moveTo(cx - 230, 165); ctx.lineTo(cx + 70, 165);
  ctx.moveTo(cx - 230, 210); ctx.lineTo(cx - 100, 210);
  ctx.stroke();
  // a little chalk "E = mc²"
  ctx.fillStyle = 'rgba(230,240,225,0.6)';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('E = mc²', cx + 150, 175);
  // floor
  stoneFloor(440, '#182824');
  // rows of student desks
  for (let r = 0; r < 2; r++) {
    for (let c2 = 0; c2 < 4; c2++) {
      const dx = 230 + c2 * 200, dy = 480 + r * 90;
      ctx.fillStyle = '#6a4a2c';
      roundRect(dx - 55, dy, 110, 30, 4); ctx.fill();
      ctx.fillStyle = '#4a3420';
      ctx.fillRect(dx - 48, dy + 30, 8, 22);
      ctx.fillRect(dx + 40, dy + 30, 8, 22);
    }
  }
  // teacher's lab bench with apparatus, front-left
  ctx.fillStyle = '#3a4a44';
  roundRect(120, 360, 200, 80, 6); ctx.fill();
  ctx.fillStyle = 'rgba(120,220,170,0.75)';
  ctx.beginPath(); ctx.moveTo(175, 360); ctx.lineTo(185, 320);
  ctx.lineTo(165, 320); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(150,190,255,0.75)';
  ctx.beginPath(); ctx.arc(255, 345, 16, 0, 7); ctx.fill();
  glow(220, 360, 90, 'rgba(120,220,170,0.14)');
  ctx.fillStyle = '#cfe6dd'; ctx.font = '700 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Lab & Classroom', cx, 330);
  // PC cabinet zone
  for (const cab of (cur && cur.cabinets) || []) {
    if (cab.id !== 'pc') continue;
    const z = cab.zone;
    const cxp = z.x + z.w / 2;
    const pulse = 0.5 + 0.5 * Math.sin((t || 0) / 350);
    // glowing floor zone
    ctx.fillStyle = `rgba(107,255,176,${0.07 + pulse * 0.07})`;
    roundRect(z.x, z.y, z.w, z.h, 14); ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = `rgba(107,255,176,${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 2; roundRect(z.x, z.y, z.w, z.h, 14); ctx.stroke();
    ctx.setLineDash([]);
    // little PC/monitor shape above the zone
    const mx = cxp, my = z.y - 60;
    ctx.fillStyle = '#1a2e28';
    roundRect(mx - 38, my - 28, 76, 52, 6); ctx.fill();
    ctx.fillStyle = '#0d4a30';
    roundRect(mx - 30, my - 22, 60, 38, 4); ctx.fill();
    // screen glow — green terminal style
    ctx.fillStyle = `rgba(107,255,176,${0.3 + pulse * 0.2})`;
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('> _', mx, my - 4);
    // stand + base
    ctx.fillStyle = '#1a2e28';
    ctx.fillRect(mx - 4, my + 24, 8, 14);
    ctx.fillRect(mx - 18, my + 38, 36, 6);
    glow(mx, my, 55, 'rgba(107,255,176,0.14)');
    // label + count
    const n = (cur.players || []).filter((p) => p.cab === cab.id).length;
    ctx.fillStyle = '#6bffb0';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cab.label, cxp, z.y - 14);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#8abeaa';
    ctx.fillText(n ? `${n} coding` : 'walk in to code', cxp, z.y + 14);
  }
}
function paintLibrary(t) {
  stoneHall(['#2e2618', '#1a1410']);
  const cx = W / 2;
  // tall bookshelves lining the back wall
  const spineCols = ['#7a3b3b', '#3b5a7a', '#6a5a2e', '#3b6a4a', '#6a3b6a', '#5a4a7a'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const sy = 60 + shelf * 96;
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(70, sy, W - 140, 84);
    ctx.fillStyle = '#241a10'; ctx.fillRect(70, sy + 78, W - 140, 8);
    for (let bx = 84; bx < W - 84; bx += 15) {
      ctx.fillStyle = spineCols[(bx + shelf * 3) % spineCols.length];
      const bh = 58 + ((bx * 7) % 18);
      ctx.fillRect(bx, sy + 76 - bh, 11, bh);
    }
  }
  // floor
  stoneFloor(456, '#221a10');
  // reading tables with green banker's lamps
  for (const tx of [cx - 230, cx + 230]) {
    ctx.fillStyle = '#5e3f2a';
    roundRect(tx - 95, 510, 190, 56, 6); ctx.fill();
    ctx.fillStyle = '#3f2a18';
    ctx.fillRect(tx - 80, 566, 10, 34);
    ctx.fillRect(tx + 70, 566, 10, 34);
    // lamp
    ctx.fillStyle = '#1f5a3a';
    ctx.beginPath(); ctx.ellipse(tx, 500, 26, 12, 0, 0, 7); ctx.fill();
    glow(tx, 512, 90, 'rgba(255,210,120,0.22)');
    // open book
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.moveTo(tx - 26, 512); ctx.lineTo(tx, 506);
    ctx.lineTo(tx + 26, 512); ctx.lineTo(tx, 518);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#efe2c6'; ctx.font = '700 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('The Library — quiet, please', cx, 436);
  // Bookshelf cabinet zone
  for (const cab of (cur && cur.cabinets) || []) {
    if (cab.id !== 'shelf') continue;
    const z = cab.zone;
    const cxp = z.x + z.w / 2;
    const pulse = 0.5 + 0.5 * Math.sin((t || 0) / 400);
    // glowing floor zone
    ctx.fillStyle = `rgba(255,212,59,${0.07 + pulse * 0.07})`;
    roundRect(z.x, z.y, z.w, z.h, 14); ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = `rgba(255,212,59,${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 2; roundRect(z.x, z.y, z.w, z.h, 14); ctx.stroke();
    ctx.setLineDash([]);
    glow(cxp, z.y + z.h / 2, 70, 'rgba(255,212,59,0.1)');
    // label + count
    const n = (cur.players || []).filter((p) => p.cab === cab.id).length;
    ctx.fillStyle = '#ffd43b';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cab.label, cxp, z.y - 8);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#c8a860';
    ctx.fillText(n ? `${n} reading` : 'walk in to read', cxp, z.y + z.h + 14);
  }
}
function drift(c, a, top, amp) {
  ctx.fillStyle = c; ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40)
    ctx.lineTo(x, top + Math.sin(x / 180) * amp * 0.3);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}
function lamppost(x, groundY, t) {
  ctx.fillStyle = '#4a4a55';
  ctx.fillRect(x - 4, groundY - 150, 8, 150);
  ctx.fillStyle = '#ffd93d';
  ctx.beginPath(); ctx.arc(x, groundY - 156, 10, 0, 7); ctx.fill();
  glow(x, groundY - 156, 90, 'rgba(255,217,61,0.20)');
}
function glow(x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function ambientSnow() {
  const dt = 1 / 60;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const f of snow) {
    f.y += f.sp * dt; f.x += f.drift * dt;
    if (f.y > H) { f.y = -4; f.x = Math.random() * W; }
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
  }
}

// A step-on portal / cabinet marker on the painted background: a yellowish
// shimmer beam rising from a glowing floor pool. Pulses gently; brightens when
// a penguin is near.
function drawPortalGlow(cx, cy, rx, ry, pulse, near) {
  const beamA = near ? 0.85 + 0.15 * pulse : 0.55 + 0.18 * pulse;
  const beamH = (near ? 150 : 125) + 16 * pulse; // beam height (px upward)
  const halfW = rx * 0.55; // beam half-width at the base
  ctx.save();
  // Additive blending so the yellow glows brightly over dark/busy art.
  ctx.globalCompositeOperation = 'lighter';
  // upward shimmer beam — bright at the floor, fading to nothing at the top
  const beam = ctx.createLinearGradient(cx, cy, cx, cy - beamH);
  beam.addColorStop(0, `rgba(255,216,70,${beamA})`);
  beam.addColorStop(0.5, `rgba(255,200,50,${beamA * 0.45})`);
  beam.addColorStop(1, 'rgba(255,200,50,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx + halfW * 0.4, cy - beamH);
  ctx.lineTo(cx - halfW * 0.4, cy - beamH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawPortalLabel(cx, topY, label) {
  ctx.save();
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  // pill background for legibility over busy art
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  roundRect(cx - tw / 2 - 8, topY - 20, tw + 16, 20, 10); ctx.fill();
  ctx.fillStyle = '#ffe7a8';
  ctx.fillText(label, cx, topY - 6);
  ctx.restore();
}

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  if (!cur) return;

  // Painted background image per room (doors, cabinets, penguins and chat
  // bubbles are drawn on top of this, below).
  paintRoomBg(cur.room);

  // ---- portal markers ----
  // Rooms are travelled by stepping ONTO the painted feature (a doorway, the
  // red carpet, a staircase). We don't draw a door body over the art anymore —
  // just a subtle glowing hotspot on the spot, which pulses and brightens +
  // shows its label when a penguin is near.
  const me = (cur.players || []).find((p) => p.id === myId);
  const pulse = 0.5 + 0.5 * Math.sin(now / 500); // 0..1 slow pulse
  for (const d of cur.doors || []) {
    const dcx = d.x + d.w / 2;
    const dcy = d.y + d.h / 2;
    const rx = d.w * 0.45, ry = d.h * 0.42;
    const near = me && Math.hypot(me.x - dcx, me.y - dcy) < 110;
    drawPortalGlow(dcx, dcy, rx, ry, pulse, near);
    if (near) drawPortalLabel(dcx, d.y - 6, d.label);
  }
  // Cabinet zones get the same hotspot treatment (they're "step here" spots too).
  for (const cab of cur.cabinets || []) {
    const z = cab.zone;
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    const near = me && Math.hypot(me.x - cx, me.y - cy) < 110;
    drawPortalGlow(cx, cy, z.w * 0.45, z.h * 0.42, pulse, near);
    if (near) drawPortalLabel(cx, z.y - 6, cab.label);
  }

  // footprints (drawn under penguins)
  footprints = footprints.filter((p) => (p.life -= 0.012) > 0);
  for (const p of footprints) {
    ctx.fillStyle = `rgba(120,140,170,${p.life * 0.4})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 3, 2, 0, 0, 7); ctx.fill();
  }

  // click ripples
  ripples = ripples.filter((r) => (r.life -= 0.04) > 0);
  for (const r of ripples) {
    ctx.strokeStyle = `rgba(255,255,255,${r.life})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, (1 - r.life) * 26, (1 - r.life) * 12, 0, 0, 7);
    ctx.stroke();
  }

  // interpolate + draw penguins (depth-sorted)
  let t = 1;
  if (prev && cur) {
    const span = curAt - prevAt;
    t = span > 0 ? Math.min(1, (now - curAt) / span) : 1;
  }
  const pmap = new Map();
  if (prev && prev.room === cur.room) for (const pp of prev.players) pmap.set(pp.id, pp);

  for (const pl of (cur.players || []).slice().sort((a, b) => a.y - b.y)) {
    const o = pmap.get(pl.id);
    const x = o ? lerp(o.x, pl.x, t) : pl.x;
    const y = o ? lerp(o.y, pl.y, t) : pl.y;
    const moving = o ? Math.hypot(pl.x - o.x, pl.y - o.y) > 0.4 : false;

    let a = anim.get(pl.id);
    if (!a) { a = { phase: 0, squash: 0, wasMoving: false }; anim.set(pl.id, a); }
    if (moving) {
      a.phase = (a.phase + 0.07) % 1;
      if (Math.random() < 0.15)
        footprints.push({ x: x + (Math.random() * 8 - 4), y: y + 24, life: 1 });
    } else {
      // arrival pop the frame it stops
      if (a.wasMoving) a.squash = 1;
      a.phase = 0;
    }
    a.wasMoving = moving;
    a.squash *= 0.86;

    drawPenguin(ctx, x, y, '#' + toHex(pl.c), pl.f || 1, moving, a.phase, a.squash);

    // name tag — rounded pill, high contrast
    ctx.font = '700 12.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const isMe = pl.id === myId;
    const label = pl.n + (isMe ? ' (you)' : '');
    const lw = ctx.measureText(label).width + 16;
    ctx.fillStyle = isMe ? 'rgba(255,209,102,0.95)' : 'rgba(20,28,46,0.78)';
    roundRect(x - lw / 2, y + 34, lw, 19, 9); ctx.fill();
    ctx.fillStyle = isMe ? '#3a2a00' : '#fff';
    ctx.fillText(label, x, y + 47);

    if (pl.m) bubble(x, y - 50, pl.m, now);
  }

  // Evict per-penguin animation state for anyone no longer in this room's
  // snapshot — otherwise `anim` grows by one entry per penguin ever seen.
  if (cur.players) {
    const liveIds = new Set(cur.players.map((p) => p.id));
    for (const id of anim.keys()) if (!liveIds.has(id)) anim.delete(id);
  }
  // Drop stale speech-bubble pop-in timers by age every frame (the key embeds
  // the float x position, so a moving/departed penguin's keys would otherwise
  // never be revisited and never cleaned up).
  for (const [k, born] of bubbleBorn) if (now - born > 8000) bubbleBorn.delete(k);

  $('roomName').textContent = cur.roomName || '';

  // ---- change 6: HUD population hierarchy ----
  updatePop(cur.population || {}, cur.room);

  // show/hide the cabinet game overlay based on MY penguin's cabinet
  const myPlayer = (cur.players || []).find((p) => p.id === myId);
  Game.setActiveCabinet(myPlayer ? myPlayer.cab || null : null);

  // ---- change 2: contextual hint triggers ----
  updateHints(myPlayer);

  // ---- change 3: solo notice ----
  updateSoloNotice(cur.population || {});

  lastT = now;
}

function updatePop(pop, currentRoom) {
  const entries = Object.entries(pop);
  // Current room first, then others
  entries.sort(([a], [b]) => {
    if (a === currentRoom) return -1;
    if (b === currentRoom) return 1;
    return 0;
  });
  $('pop').innerHTML = entries.map(([r, n]) => {
    const emoji = roomEmoji(r);
    if (r === currentRoom) {
      return `<span class="pop-cur">${emoji} ${r} · ${n}</span>`;
    }
    return `${emoji} ${r} · ${n}`;
  }).join('&nbsp;&nbsp;');
}

function updateHints(myPlayer) {
  if (!myPlayer) return;
  // door proximity
  for (const d of cur.doors || []) {
    const dcx = d.x + d.w / 2;
    const dcy = d.y + d.h / 2;
    if (Math.hypot(myPlayer.x - dcx, myPlayer.y - dcy) < 110) {
      hintTrigger('door');
      break;
    }
  }
  // cabinet zone proximity (rooms with cabinets)
  for (const cab of cur.cabinets || []) {
    const z = cab.zone;
    const zcx = z.x + z.w / 2;
    const zcy = z.y + z.h / 2;
    if (Math.hypot(myPlayer.x - zcx, myPlayer.y - zcy) < 130) {
      hintTrigger('cabinet');
      break;
    }
  }
}

function updateSoloNotice(pop) {
  const total = Object.values(pop).reduce((s, v) => s + v, 0);
  if (total <= 1) {
    soloNotice.classList.add('show');
  } else {
    soloNotice.classList.remove('show');
  }
}

function roomEmoji(r) {
  return ({ plaza: '⛄', cafe: '☕', arcade: '🕹',
    university: '🎓', lab: '🔬', library: '📚' })[r] || '•';
}

const bubbleBorn = new Map();
function bubble(x, y, text, now) {
  // pop-in scale the first ~180ms a message appears
  const key = x + '|' + text;
  if (!bubbleBorn.has(key)) bubbleBorn.set(key, now);
  const age = now - bubbleBorn.get(key);
  const s = Math.min(1, age / 180);
  const sc = 0.6 + 0.4 * easeOut(s);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.font = '600 14px system-ui, sans-serif';
  const w = Math.min(280, ctx.measureText(text).width + 26);
  const h = 32;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.strokeStyle = 'rgba(30,40,66,0.18)';
  ctx.lineWidth = 1.5;
  roundRect(-w / 2, -h, w, h, 13); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill();
  ctx.fillStyle = '#15203a';
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, -h / 2 + 5);
  ctx.restore();
  if (age > 8000) bubbleBorn.delete(key);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function toHex(c) {
  // server sends "#rrggbb"; strip leading # if present
  return String(c).replace(/^#/, '');
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

requestAnimationFrame(render);
