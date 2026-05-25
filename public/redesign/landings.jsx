// Two landing-page variations: each blends the dark dev-console aesthetic
// with the Club Penguin storybook game. 1440×900 artboards.

// ───────── shared bits ─────────
function MonoLine({ children, dim, accent }) {
  return (
    <div style={{
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
      fontSize: 13, color: dim ? 'rgba(255,255,255,0.45)' : '#e8f1ff',
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// LANDING v1 — "Console + Diorama"
// Left ⅔ = dark dev-console with terminal + routes/ tree.
// Right ⅓ = a glowing snow diorama (the game peeking through).
// ═════════════════════════════════════════════════════════════════
function LandingConsoleDiorama({ palette: p }) {
  return (
    <div style={{
      width: 1440, height: 900, position: 'relative', overflow: 'hidden',
      background: '#070d18', color: '#eaf0ff',
      fontFamily: '"Manrope", system-ui, sans-serif',
      display: 'grid', gridTemplateColumns: '1fr 480px',
    }}>
      {/* ambient grain + soft glows */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(40% 50% at 18% 22%, rgba(120,180,255,0.10), transparent 70%),
                     radial-gradient(36% 44% at 92% 88%, rgba(255,180,120,0.10), transparent 70%)`,
      }} />

      {/* === LEFT — console === */}
      <div style={{ position: 'relative', padding: '40px 56px 0 56px', display: 'flex', flexDirection: 'column' }}>
        {/* top nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 64 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 15,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <Penguin x={11} y={15} size={0.45} color="#3b82f6" />
            </svg>
            <span>penguin<span style={{ color: '#ffb84e' }}>-</span>forge</span>
          </div>
          <div style={{ flex: 1 }} />
          <a style={navLink}>/play</a>
          <a style={navLink}>/forge</a>
          <a style={navLink}>/_data</a>
          <a style={navLink}>/_inspect</a>
          <div style={{
            padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em',
            background: 'rgba(107,255,176,0.12)', color: '#6bffb0',
            border: '1px solid rgba(107,255,176,0.3)',
          }}>● LIVE · 4 ONLINE</div>
        </div>

        {/* hero */}
        <div style={{ maxWidth: 720 }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#7fa3d6',
            letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 18,
          }}>
            <span style={{ color: '#ffb84e' }}>{'>'}</span>&nbsp; a multiplayer world running on a from-scratch framework
          </div>
          <h1 style={{
            fontSize: 72, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.03em',
            margin: 0,
          }}>
            Waddle into a world built<br />
            on <span style={{ color: '#ffb84e', fontStyle: 'italic', fontWeight: 800 }}>net</span>
            <span style={{ color: '#7fa3d6', fontWeight: 500 }}>(),</span> not a framework.
          </h1>
          <p style={{
            fontSize: 19, lineHeight: 1.55, color: '#a7b8d4',
            marginTop: 24, maxWidth: 600,
          }}>
            <b style={{ color: '#fff' }}>penguin-forge</b> is a real-time multiplayer penguin world
            and the HTTP/WebSocket framework that runs it — both hand-written on
            Node's raw <code style={mono}>net</code> module. Zero dependencies.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
            <a style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 26px', borderRadius: 12,
              background: 'linear-gradient(135deg, #ffb84e, #ff8a3d)',
              color: '#3a2000', fontWeight: 800, fontSize: 16,
              boxShadow: '0 10px 30px rgba(255,140,40,0.4)',
              textDecoration: 'none',
            }}>
              <span>🎮</span> Enter the world &nbsp;<span style={{ opacity: 0.6 }}>▸</span>
            </a>
            <a style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 26px', borderRadius: 12,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: '#eaf0ff', fontWeight: 700, fontSize: 16,
              fontFamily: 'ui-monospace, monospace',
              textDecoration: 'none',
            }}>
              <span style={{ color: '#6bffb0' }}>$</span> read the source
            </a>
          </div>
        </div>

        {/* terminal + tree split */}
        <div style={{
          marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
          flex: 1, minHeight: 0,
        }}>
          {/* terminal */}
          <div style={termStyle}>
            <div style={termHeader}>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <span style={{ ...dot, background: '#ff6b6b' }} />
                <span style={{ ...dot, background: '#ffd24a' }} />
                <span style={{ ...dot, background: '#6bffb0' }} />
              </span>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#7fa3d6' }}>
                pingu@plaza ~/penguin-forge
              </span>
            </div>
            <div style={{ padding: '16px 18px', fontSize: 13.5 }}>
              <MonoLine><span style={{ color: '#6bffb0' }}>$</span> node server.js</MonoLine>
              <MonoLine dim>fs-forge listening on http://localhost:4300</MonoLine>
              <MonoLine dim>watching routes/  · 0 deps loaded</MonoLine>
              <div style={{ height: 8 }} />
              <MonoLine><span style={{ color: '#ffb84e' }}>WS</span> /world &nbsp; handshake ok &nbsp;<span style={{ color: '#7fa3d6' }}>{'<-'}</span> Pingu</MonoLine>
              <MonoLine dim>&nbsp;&nbsp;snapshot[plaza] · 3 penguins · 20Hz</MonoLine>
              <MonoLine><span style={{ color: '#ff5db0' }}>POST</span> /api/penguins?name=Skipper <span style={{ color: '#6bffb0' }}>201</span></MonoLine>
              <MonoLine dim>&nbsp;&nbsp;world.add → plaza · #4</MonoLine>
              <MonoLine><span style={{ color: '#a78bff' }}>chat</span> Pingu: "found a snowman!"</MonoLine>
              <div style={{ height: 6 }} />
              <MonoLine>
                <span style={{ color: '#6bffb0' }}>$</span> _<span style={{
                  display: 'inline-block', width: 8, height: 16,
                  background: '#6bffb0', marginLeft: 2, verticalAlign: -3,
                }} />
              </MonoLine>
            </div>
          </div>

          {/* routes tree */}
          <div style={termStyle}>
            <div style={termHeader}>
              <span style={{ fontSize: 11, color: '#7fa3d6', fontFamily: 'ui-monospace, monospace' }}>routes/ ── filesystem is the API</span>
              <div style={{ flex: 1 }} />
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(255,184,78,0.15)', color: '#ffb84e',
                fontFamily: 'ui-monospace, monospace',
              }}>HOT</span>
            </div>
            <div style={{ padding: '16px 18px', fontSize: 13 }}>
              {[
                ['index.js', '/', ''],
                ['play.js', '/play', '🎮'],
                ['forge.js', '/forge', '⚙️'],
                ['world.js', '/world', 'ws'],
                ['api/penguins/', '', ''],
                ['  index.js', '/api/penguins', 'GET·POST'],
                ['  [id].js', '/api/penguins/:id', 'PUT·DEL'],
              ].map((r, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '3px 0',
                  fontFamily: 'ui-monospace, monospace', fontSize: 12.5,
                  color: r[0].endsWith('/') ? '#7fa3d6' : '#eaf0ff',
                }}>
                  <span style={{ width: 140, color: r[0].startsWith(' ') ? '#a7b8d4' : 'inherit' }}>{r[0]}</span>
                  <span style={{ flex: 1, color: r[1] ? '#ffb84e' : 'transparent' }}>{r[1] || '·'}</span>
                  <span style={{ color: '#6bffb0', opacity: 0.8 }}>{r[2]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* bottom strip */}
        <div style={{
          display: 'flex', gap: 28, padding: '24px 0', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em',
        }}>
          <span>0 DEPENDENCIES</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span>RFC-6455 WEBSOCKETS</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span>20Hz GAME LOOP</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span>RAW node:net</span>
          <span style={{ flex: 1 }} />
          <span>v0.1.0 · 2026</span>
        </div>
      </div>

      {/* === RIGHT — diorama === */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: `linear-gradient(180deg, ${p.skyTop} 0%, ${p.skyMid} 50%, ${p.snowDeep} 100%)`,
      }}>
        {/* mini diorama: pretend live game */}
        <svg viewBox="0 0 480 900" width="480" height="900" style={{ display: 'block' }}>
          <defs>
            <radialGradient id="ld-sun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff5d6" stopOpacity="0.7" />
              <stop offset="1" stopColor="#fff5d6" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ld-amber" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffb84e" stopOpacity="0.7" />
              <stop offset="1" stopColor="#ffb84e" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* sun */}
          <circle cx="380" cy="160" r="180" fill="url(#ld-sun)" />
          <circle cx="380" cy="160" r="36" fill="#fff5d6" opacity="0.7" />
          {/* mountains */}
          <path d="M 0 460 L 70 320 L 160 420 L 240 300 L 340 410 L 440 320 L 480 380 L 480 520 L 0 520 Z"
            fill="#7a98c0" opacity="0.85" />
          <path d="M 240 300 L 218 350 L 262 350 Z" fill="#fff" opacity="0.85" />
          {/* trees */}
          <PineTree x={60} y={520} s={0.85} palette={p} />
          <PineTree x={420} y={520} s={0.95} palette={p} />
          <PineTree x={120} y={540} s={0.55} palette={p} />
          {/* ground */}
          <path d="M 0 900 L 0 520 Q 240 490 480 520 L 480 900 Z" fill="#e6effa" />
          <path d="M 0 900 L 0 660 Q 240 630 480 660 L 480 900 Z" fill="#fff" opacity="0.85" />
          {/* mini gothic facade */}
          <g transform="translate(240 350)">
            <rect x="-90" y="20" width="180" height="200" fill="#5a546e" />
            <rect x="-90" y="20" width="180" height="200" fill="url(#stone-shade)" />
            {[-110, 90].map((tx, i) => (
              <g key={i}>
                <rect x={tx} y="0" width="22" height="220" fill="#5a546e" />
                <path d={`M ${tx - 4} 0 L ${tx + 11} -30 L ${tx + 26} 0 Z`} fill="#3f3c54" />
              </g>
            ))}
            <circle cx="0" cy="80" r="22" fill="#3a4470" stroke="#9a93b4" strokeWidth="2" />
            <circle cx="0" cy="80" r="6" fill="#ffb84e" opacity="0.85" />
            {/* archway */}
            <path d="M -32 220 L -32 150 Q 0 110 32 150 L 32 220 Z" fill="#1c1528" />
            <circle cx="0" cy="200" r="36" fill="url(#ld-amber)" />
          </g>
          {/* lampposts */}
          <Lamppost x={140} y={680} palette={p} />
          <Lamppost x={340} y={680} palette={p} />
          {/* penguins */}
          <g transform="translate(160 780)"><Penguin size={1.4} color="#3b82f6" facing={1} /></g>
          <g transform="translate(280 800)"><Penguin size={1.3} color="#e23636" facing={-1} /></g>
          <g transform="translate(370 760)"><Penguin size={1.15} color="#ffd24a" facing={-1} /></g>
          {/* snow */}
          <SnowField count={50} w={480} h={900} seed={11} />
          {/* chat bubble */}
          <g transform="translate(160 720)">
            <rect x="-50" y="-22" width="116" height="22" rx="11" fill="#fff" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
            <path d="M -4 0 L 0 8 L 6 0 Z" fill="#fff" />
            <text x="8" y="-7" fontFamily="system-ui" fontWeight="700" fontSize="11" fill="#1a2740" textAnchor="middle">
              brrr ❄️ hi!
            </text>
          </g>
        </svg>

        {/* corner watermark */}
        <div style={{
          position: 'absolute', top: 18, right: 18, padding: '6px 12px',
          borderRadius: 999, background: 'rgba(7,13,24,0.55)', backdropFilter: 'blur(6px)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.14em',
          color: '#a7b8d4', border: '1px solid rgba(255,255,255,0.1)',
        }}>
          ● /play · LIVE PREVIEW
        </div>
        {/* bottom info card */}
        <div style={{
          position: 'absolute', left: 24, right: 24, bottom: 24,
          padding: '14px 18px', borderRadius: 14,
          background: 'rgba(7,13,24,0.7)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 22 }}>🐧</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>Town Plaza</div>
            <div style={{ fontSize: 12, color: '#a7b8d4', fontFamily: 'ui-monospace, monospace' }}>
              4 penguins · click to waddle
            </div>
          </div>
          <div style={{
            padding: '8px 14px', borderRadius: 10,
            background: 'linear-gradient(135deg, #ffb84e, #ff8a3d)', color: '#3a2000',
            fontWeight: 800, fontSize: 13,
          }}>Join ▸</div>
        </div>
      </div>
    </div>
  );
}

const navLink = {
  fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#a7b8d4',
  textDecoration: 'none', padding: '6px 10px', borderRadius: 6,
  transition: 'color .12s',
};
const mono = {
  fontFamily: 'ui-monospace, monospace', fontSize: '0.92em',
  color: '#ffb84e', background: 'rgba(255,184,78,0.08)',
  padding: '1px 6px', borderRadius: 4,
};
const termStyle = {
  background: 'rgba(7,16,28,0.75)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  minHeight: 0,
};
const termHeader = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
  background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)',
};
const dot = { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' };


// ═════════════════════════════════════════════════════════════════
// LANDING v2 — "Snowfield Console"
// A single immersive view: a wide game diorama IS the background,
// with a translucent dev console floating in the middle of it.
// ═════════════════════════════════════════════════════════════════
function LandingSnowfieldConsole({ palette: p }) {
  return (
    <div style={{
      width: 1440, height: 900, position: 'relative', overflow: 'hidden',
      background: '#070d18', color: '#eaf0ff',
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      {/* full-bleed diorama */}
      <svg viewBox="0 0 1440 900" width="1440" height="900" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="lsc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1830" />
            <stop offset="0.5" stopColor="#1c3658" />
            <stop offset="1" stopColor="#3a6a98" />
          </linearGradient>
          <radialGradient id="lsc-moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff5d6" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff5d6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lsc-arch" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffb84e" stopOpacity="0.6" />
            <stop offset="1" stopColor="#ffb84e" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* twilight sky */}
        <rect width="1440" height="900" fill="url(#lsc-sky)" />
        {/* stars */}
        {Array.from({ length: 60 }, (_, i) => {
          const sx = (i * 137) % 1440;
          const sy = (i * 71) % 360;
          const r = (i % 5 === 0) ? 1.6 : 1;
          return <circle key={i} cx={sx} cy={sy} r={r} fill="#fff" opacity={0.4 + (i % 3) * 0.2} />;
        })}
        {/* moon */}
        <circle cx="1180" cy="160" r="220" fill="url(#lsc-moon)" />
        <circle cx="1180" cy="160" r="48" fill="#fef4d4" />
        <circle cx="1166" cy="148" r="38" fill="rgba(30,40,80,0.25)" />
        {/* aurora ribbons */}
        <path d="M 0 320 Q 360 280 720 320 Q 1080 360 1440 300 L 1440 360 Q 1080 420 720 380 Q 360 340 0 380 Z"
          fill="#6ee0b8" opacity="0.16" />
        <path d="M 0 380 Q 360 340 720 380 Q 1080 420 1440 360 L 1440 420 Q 1080 480 720 440 Q 360 400 0 440 Z"
          fill="#a78bff" opacity="0.13" />

        {/* mountains */}
        <path d="M 0 540 L 200 320 L 380 480 L 580 280 L 800 460 L 1080 320 L 1320 460 L 1440 380 L 1440 600 L 0 600 Z"
          fill="#3a4e7a" />
        <path d="M 580 280 L 540 350 L 622 350 Z" fill="#fff" opacity="0.85" />
        <path d="M 1080 320 L 1042 380 L 1118 380 Z" fill="#fff" opacity="0.85" />

        {/* snow ground */}
        <path d="M 0 900 L 0 580 Q 360 540 720 570 Q 1080 600 1440 555 L 1440 900 Z" fill="#dfe9f5" />
        <path d="M 0 900 L 0 720 Q 360 690 720 710 Q 1080 730 1440 700 L 1440 900 Z" fill="#fff" opacity="0.85" />

        {/* faraway gothic university silhouette */}
        <g transform="translate(720 360)">
          <rect x="-160" y="50" width="320" height="260" fill="#3a3550" />
          {[-180, 160].map((tx, i) => (
            <g key={i}>
              <rect x={tx} y="0" width="30" height="310" fill="#3a3550" />
              <path d={`M ${tx - 6} 0 L ${tx + 15} -40 L ${tx + 36} 0 Z`} fill="#2a2440" />
              <path d={`M ${tx + 15} -48 L ${tx + 11} -56 L ${tx + 19} -56 Z`} fill="#ffb84e" />
            </g>
          ))}
          <circle cx="0" cy="120" r="34" fill="#3a4e7a" stroke="#9a93b4" strokeWidth="2.5" />
          <circle cx="0" cy="120" r="10" fill="#ffb84e" opacity="0.9" />
          {/* archway */}
          <path d="M -46 310 L -46 220 Q 0 170 46 220 L 46 310 Z" fill="#1c1528" />
          <circle cx="0" cy="290" r="56" fill="url(#lsc-arch)" />
          {/* lit windows */}
          {[0, 1, 2].map(i => {
            const wx = -110 + i * 110;
            return <rect key={i} x={wx - 12} y="160" width="24" height="50" rx="4" fill="#ffb84e" opacity="0.7" />;
          })}
        </g>

        {/* nearer scenery */}
        <PineTree x={120} y={680} s={1.35} palette={p} />
        <PineTree x={220} y={700} s={0.9} palette={p} />
        <PineTree x={1280} y={680} s={1.35} palette={p} />
        <PineTree x={1180} y={700} s={0.9} palette={p} />
        <Igloo x={300} y={780} />
        <Snowman x={1100} y={810} />
        <Lamppost x={200} y={780} palette={p} />
        <Lamppost x={1240} y={780} palette={p} />

        {/* near penguins */}
        <g transform="translate(420 830)"><Penguin size={1.6} color="#3b82f6" facing={1} /></g>
        <g transform="translate(540 850)"><Penguin size={1.4} color="#e23636" facing={-1} /></g>
        <g transform="translate(940 830)"><Penguin size={1.5} color="#ffd24a" facing={-1} /></g>
        <g transform="translate(1020 850)"><Penguin size={1.3} color="#9a6bff" facing={1} /></g>

        {/* snow flakes layered */}
        <SnowField count={70} w={1440} h={900} seed={3} />
      </svg>

      {/* top nav strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 48px',
        display: 'flex', alignItems: 'center', gap: 18, zIndex: 3,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 15,
          padding: '8px 14px', borderRadius: 10,
          background: 'rgba(7,13,24,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20"><Penguin x={10} y={14} size={0.4} color="#3b82f6" /></svg>
          <span>penguin<span style={{ color: '#ffb84e' }}>-</span>forge</span>
        </div>
        <div style={{ flex: 1 }} />
        {['/play', '/forge', '/_data', '/_inspect'].map(l => (
          <a key={l} style={{
            ...navLink, padding: '8px 14px', borderRadius: 10,
            background: 'rgba(7,13,24,0.4)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>{l}</a>
        ))}
      </div>

      {/* centered glass card */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 2,
        width: 720, padding: '40px 44px',
        borderRadius: 24, background: 'rgba(7,13,24,0.72)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#7fa3d6',
          letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6bffb0', boxShadow: '0 0 8px #6bffb0' }} />
          live · 4 penguins in plaza
        </div>
        <h1 style={{
          fontSize: 56, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.025em',
          margin: 0,
        }}>
          A multiplayer world<br />
          on <span style={{ color: '#ffb84e', fontStyle: 'italic' }}>raw sockets.</span>
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: '#cfd6e8', margin: '18px 0 0' }}>
          A shared penguin world and the from-scratch HTTP/WebSocket framework
          that runs it. Both built on Node's <code style={mono}>net</code> module.
          <b style={{ color: '#fff' }}> Zero dependencies.</b>
        </p>

        {/* dual entry */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 28 }}>
          <a style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '18px 20px',
            borderRadius: 14, textDecoration: 'none', color: '#3a2000',
            background: 'linear-gradient(135deg, #ffb84e, #ff8a3d)',
            boxShadow: '0 10px 30px rgba(255,140,40,0.4)',
          }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>🎮</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Play the world</div>
            <div style={{ fontSize: 12.5, opacity: 0.85, fontFamily: 'ui-monospace, monospace' }}>
              /play &nbsp;▸
            </div>
          </a>
          <a style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '18px 20px',
            borderRadius: 14, textDecoration: 'none', color: '#eaf0ff',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>⚙️</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>The framework</div>
            <div style={{ fontSize: 12.5, opacity: 0.7, fontFamily: 'ui-monospace, monospace', color: '#6bffb0' }}>
              /forge &nbsp;▸
            </div>
          </a>
        </div>

        {/* mini route preview */}
        <div style={{
          marginTop: 22, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)',
          fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#a7b8d4',
        }}>
          <div style={{ color: '#7fa3d6', marginBottom: 4, fontSize: 10.5, letterSpacing: '0.14em' }}>ROUTES/</div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <span><span style={{ color: '#ffb84e' }}>/play</span> game</span>
            <span><span style={{ color: '#ffb84e' }}>/forge</span> console</span>
            <span><span style={{ color: '#a78bff' }}>/world</span> ws · 20Hz</span>
            <span><span style={{ color: '#6bffb0' }}>/api/penguins</span> REST</span>
            <span><span style={{ color: '#ff5db0' }}>/_inspect</span> wire</span>
          </div>
        </div>
      </div>

      {/* corner stats */}
      <div style={{
        position: 'absolute', bottom: 28, left: 48, zIndex: 3,
        display: 'flex', gap: 22, fontFamily: 'ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)',
      }}>
        <span>0 DEPENDENCIES</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>NODE ≥16</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>RFC-6455</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>20Hz LOOP</span>
      </div>
      <div style={{
        position: 'absolute', bottom: 28, right: 48, zIndex: 3,
        fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)',
      }}>
        penguin-forge · v0.1.0 · 2026
      </div>
    </div>
  );
}

Object.assign(window, { LandingConsoleDiorama, LandingSnowfieldConsole });
