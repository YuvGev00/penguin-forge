// Two scroll-driven landing variations that combine B (full diorama hero)
// with A's console block (terminal + routes/ tree). The artboards are 900px
// tall but scroll internally to ~2400px so you can see the transition.
//
// Both pages share the same content: a diorama hero up top, a console block
// down below. They differ in HOW the transition reads:
//
//   C · Atmospheric Fade  — diorama scrolls naturally, but as you scroll it
//                           desaturates and dims into deep navy. Console
//                           rises with a soft aurora glow tying it to the
//                           sky above. Feels like "leaving the surface,
//                           descending into the server."
//   D · Sticky Crossfade  — diorama is pinned at the top via position:sticky.
//                           Console glass-card scrolls UP OVER it. The
//                           diorama dims/blurs behind the glass as the
//                           console takes the foreground.
//
// Both react to scroll via a tiny ref+listener inside their own container so
// they work even when the design-canvas viewport is panned/zoomed.

// ───────── shared subviews ─────────

// Slow, cinematic smooth-scroll. The browser's native `behavior: 'smooth'`
// is too fast for the world↔console transition; this animates scrollTop
// over `duration` ms with an ease-in-out cubic curve so the descent feels
// like a deliberate dive rather than a snap.
function slowScrollTo(el, target, duration = 1800) {
  if (!el) return;
  const start = el.scrollTop;
  const change = target - start;
  if (Math.abs(change) < 1) return;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    // ease-in-out cubic
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    el.scrollTop = start + change * e;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// The big snowy diorama (1440×900) — borrowed from Landing B but with no
// glass card on top, so it can act as a full hero.
// Memoized so the parent can mutate filter/opacity via refs without
// triggering a re-render of all the SVG particles every frame.
// Hero diorama — uses the user's hand-drawn plaza illustration as a
// full-bleed background, with original penguin sprites standing on the
// surrounding snow.
const DioramaHero = React.memo(function DioramaHero({ palette: p }) {
  return (
    <svg viewBox="0 0 1440 900" width="1440" height="900"
      style={{ display: 'block', background: '#a4d4ee' }}>
      <defs>
        {/* soft bottom vignette so the bottom edge dissolves into the page */}
        <linearGradient id="lsf-floor-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(7,13,24,0)" />
          <stop offset="1" stopColor="rgba(7,13,24,0.18)" />
        </linearGradient>
      </defs>

      {/* hand-drawn plaza illustration, full-bleed */}
      <image href="assets/plaza-hero.png" x="0" y="0" width="1440" height="900"
        preserveAspectRatio="xMidYMid slice" />

      {/* penguins standing on the snow around the plaza */}
      {/* far-left snow drift */}
      <g transform="translate(120 620)">
        <Penguin size={1.4} color="#3b82f6" facing={1} />
      </g>
      {/* in front of café (warm orange) */}
      <g transform="translate(340 630)">
        <Penguin size={1.5} color="#e23636" facing={-1} />
      </g>
      {/* on the front step (yellow) */}
      <g transform="translate(680 610)">
        <Penguin size={1.55} color="#ffd24a" facing={1} />
      </g>
      {/* between university & plaza (violet) */}
      <g transform="translate(940 630)">
        <Penguin size={1.5} color="#9a6bff" facing={-1} />
      </g>
      {/* far-right snow drift */}
      <g transform="translate(1280 620)">
        <Penguin size={1.4} color="#33aa8a" facing={-1} />
      </g>

      {/* a couple of small chat bubbles to sell the live world */}
      <g transform="translate(700 554)">
        <rect x="-46" y="-22" width="92" height="20" rx="10" fill="#fff" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
        <path d="M -4 0 L 0 8 L 6 0 Z" fill="#fff" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
        <text x="0" y="-7" textAnchor="middle" fontFamily="system-ui, sans-serif"
          fontWeight="700" fontSize="11" fill="#1a2740">hi 👋</text>
      </g>
      <g transform="translate(140 564)">
        <rect x="-46" y="-22" width="92" height="20" rx="10" fill="#fff" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
        <path d="M 0 0 L -4 8 L 6 0 Z" fill="#fff" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
        <text x="0" y="-7" textAnchor="middle" fontFamily="system-ui, sans-serif"
          fontWeight="700" fontSize="11" fill="#1a2740">brrr ❄️</text>
      </g>

      {/* light drifting snow */}
      <SnowField count={50} w={1440} h={900} seed={5} />
    </svg>
  );
});

// The hero text overlay — anchored UPPER-LEFT inside a translucent glass
// card so the type stays readable against the diorama (the centered layout
// was clashing with the moon + university silhouette).
const HeroText = React.forwardRef(function HeroText({ onScrollToForge }, ref) {
  return (
    <div ref={ref} className="pf" style={{
      position: 'absolute', left: 48, top: 96,
      width: 560, padding: '34px 38px 32px',
      borderRadius: 22,
      background: 'linear-gradient(180deg, rgba(7,13,24,0.62), rgba(7,13,24,0.48))',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
      opacity: 1, transition: 'opacity .15s linear',
      zIndex: 4, overflow: 'hidden',
    }}>
      {/* drifting micro snow inside the card — ties it to the diorama */}
      <div className="pf-snow-layer" />
      {/* top edge highlight */}
      <div style={{
        position: 'absolute', top: 0, left: 24, right: 24, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,184,78,0.6), transparent)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace', fontSize: 11,
        color: '#a7c6f0', letterSpacing: '0.22em', textTransform: 'uppercase',
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span className="pf-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#6bffb0' }} />
        <span>live</span>
        <span style={{ color: 'rgba(167,198,240,0.4)' }}>·</span>
        <span><b style={{ color: '#fff', fontWeight: 700 }}>4</b> penguins in plaza</span>
        <span style={{ color: 'rgba(167,198,240,0.4)' }}>·</span>
        <span style={{ color: '#ffb84e' }}>20Hz</span>
      </div>
      <h1 style={{
        position: 'relative', zIndex: 1,
        fontSize: 54, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.028em',
        color: '#fff', margin: 0,
      }}>
        A multiplayer world<br />
        on <span style={{ color: '#ffb84e', fontStyle: 'italic', fontWeight: 800 }}>raw sockets.</span>
      </h1>
      <p style={{
        position: 'relative', zIndex: 1,
        fontSize: 15.5, lineHeight: 1.55, color: '#cfd6e8', margin: '18px 0 0',
        textWrap: 'pretty',
      }}>
        A shared penguin world and the from-scratch HTTP/WebSocket framework
        that runs it. Both built on Node's <code style={{
          fontFamily: 'ui-monospace, monospace', color: '#ffb84e',
          background: 'rgba(255,184,78,0.10)', padding: '1px 7px', borderRadius: 4,
          fontSize: '0.9em', border: '1px solid rgba(255,184,78,0.2)',
        }}>net</code> module. <b style={{ color: '#fff' }}>Zero dependencies.</b>
      </p>

      {/* CTAs */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', gap: 10, marginTop: 24,
      }}>
        <a href="/play" target="_blank" rel="noopener" className="pf-cta-primary" style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
          padding: '14px 18px', borderRadius: 12, textDecoration: 'none',
          color: '#3a2000', background: 'linear-gradient(135deg, #ffb84e, #ff8a3d)',
          boxShadow: '0 10px 26px rgba(255,140,40,0.45)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 18 }}>🎮</span>
            <span style={{ fontWeight: 800, fontSize: 15.5 }}>Play the world</span>
            <span style={{ marginLeft: 'auto', fontSize: 14 }}>▸</span>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.75, position: 'relative', zIndex: 1 }}>
            /play · waddle in
          </div>
        </a>
        <a href="#forge" className="pf-cta-secondary" onClick={(e) => { e.preventDefault(); onScrollToForge?.(); }} style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
          padding: '14px 18px', borderRadius: 12, textDecoration: 'none',
          color: '#eaf0ff', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span style={{ fontWeight: 800, fontSize: 15.5 }}>The framework</span>
            <span style={{ marginLeft: 'auto', fontSize: 14, color: '#6bffb0' }}>↓</span>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#6bffb0', opacity: 0.85 }}>
            /forge · peek under the hood
          </div>
        </a>
      </div>

      {/* scroll cue — sits outside the card */}
      <div style={{
        position: 'absolute', left: 36, bottom: -52,
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
        color: 'rgba(255,255,255,0.65)', letterSpacing: '0.18em',
      }}>
        <svg width="14" height="22" viewBox="0 0 14 22">
          <rect x="1" y="1" width="12" height="20" rx="6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="1.6" fill="rgba(255,255,255,0.9)">
            <animate attributeName="cy" values="6;14;6" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </svg>
        <span>SCROLL TO PEEK UNDER THE HOOD</span>
      </div>
    </div>
  );
});
// Floating nav strip — just the logo, no route chips (they sit in the hero CTAs)
function NavStrip() {
  return (
    <div className="pf" style={{
      position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 48px',
      display: 'flex', alignItems: 'center', gap: 18, zIndex: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 15,
        padding: '8px 14px', borderRadius: 10, color: '#fff',
        background: 'rgba(7,13,24,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20"><Penguin x={10} y={14} size={0.4} color="#3b82f6" /></svg>
        <span>penguin<span style={{ color: '#ffb84e' }}>-</span>forge</span>
      </div>
    </div>
  );
}

// Console panel block — terminal + routes/ tree (copied from Landing A).
// `onBackToWorld` (optional) scrolls the outer container back to the top
// so the "↑ back to the world" button feels live.
function ConsoleBlock({ onBackToWorld }) {
  const termStyle = {
    background: 'rgba(7,16,28,0.85)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    minHeight: 0,
  };
  const termHeader = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)',
  };
  const dot = { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' };
  const mono = (color) => ({
    fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
    fontSize: 12.5, color: color || '#e8f1ff', lineHeight: 1.55,
  });
  return (
    <div id="forge" style={{ padding: '0 80px 40px', color: '#eaf0ff' }}>
      {/* section title */}
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#7fa3d6',
        letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        <span style={{ color: '#ffb84e' }}>{'>'}</span>&nbsp; under the hood · /forge
      </div>
      <h2 style={{
        fontSize: 56, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.025em',
        margin: 0, color: '#fff', maxWidth: 800,
      }}>
        The framework <span style={{ color: '#ffb84e', fontStyle: 'italic' }}>is</span> the dashboard.
      </h2>
      <p style={{
        fontSize: 15, lineHeight: 1.5, color: '#a7b8d4',
        marginTop: 12, maxWidth: 680,
      }}>
        fs-forge serves the game and watches it. The same dashboards that ship
        with the framework become a live admin console for the running world
        — a data table of every penguin, the wire bytes scrolling past, and a
        REST API that drives the world in real time.
      </p>

      {/* terminal + tree split */}
      <div style={{
        marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
      }}>
        <div style={termStyle}>
          <div style={termHeader}>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <span style={{ ...dot, background: '#ff6b6b' }} />
              <span style={{ ...dot, background: '#ffd24a' }} />
              <span style={{ ...dot, background: '#6bffb0' }} />
            </span>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#7fa3d6',
              fontFamily: 'ui-monospace, monospace' }}>
              pingu@plaza ~/penguin-forge
            </span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={mono()}><span style={{ color: '#6bffb0' }}>$</span> node server.js</div>
            <div style={mono('rgba(255,255,255,0.5)')}>fs-forge listening on http://localhost:4300</div>
            <div style={mono('rgba(255,255,255,0.5)')}>watching routes/  · 0 deps loaded</div>
            <div style={{ height: 5 }} />
            <div style={mono()}><span style={{ color: '#ffb84e' }}>WS</span> /world  handshake ok  <span style={{ color: '#7fa3d6' }}>{'<-'}</span> Pingu</div>
            <div style={mono('rgba(255,255,255,0.5)')}>&nbsp;&nbsp;snapshot[plaza] · 3 penguins · 20Hz</div>
            <div style={mono()}><span style={{ color: '#ff5db0' }}>POST</span> /api/penguins?name=Skipper <span style={{ color: '#6bffb0' }}>201</span></div>
            <div style={mono('rgba(255,255,255,0.5)')}>&nbsp;&nbsp;world.add → plaza · #4</div>
            <div style={mono()}><span style={{ color: '#a78bff' }}>chat</span> Pingu: "found a snowman!"</div>
            <div style={mono()}>
              <span style={{ color: '#6bffb0' }}>$</span> _<span style={{
                display: 'inline-block', width: 7, height: 14,
                background: '#6bffb0', marginLeft: 2, verticalAlign: -2,
              }} />
            </div>
          </div>
        </div>

        <div style={termStyle}>
          <div style={termHeader}>
            <span style={{ fontSize: 11, color: '#7fa3d6',
              fontFamily: 'ui-monospace, monospace' }}>
              routes/ ── filesystem is the API
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: 'rgba(255,184,78,0.15)', color: '#ffb84e',
              fontFamily: 'ui-monospace, monospace' }}>HOT</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
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
                display: 'flex', gap: 10, padding: '2px 0',
                fontFamily: 'ui-monospace, monospace', fontSize: 12,
                color: r[0].endsWith('/') ? '#7fa3d6' : '#eaf0ff',
              }}>
                <span style={{ width: 130, color: r[0].startsWith(' ') ? '#a7b8d4' : 'inherit' }}>{r[0]}</span>
                <span style={{ flex: 1, color: r[1] ? '#ffb84e' : 'transparent' }}>{r[1] || '·'}</span>
                <span style={{ color: '#6bffb0', opacity: 0.8 }}>{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTAs — own the framework + return to world */}
      <div style={{
        marginTop: 18, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12,
      }}>
        <a href="https://github.com/YuvGev00/penguin-forge" target="_blank" rel="noreferrer" className="pf-cta-primary" style={{
          display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 16px',
          borderRadius: 12, textDecoration: 'none', color: '#3a2000',
          background: 'linear-gradient(135deg, #ffb84e, #ff8a3d)',
          boxShadow: '0 8px 22px rgba(255,140,40,0.32)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Read the source</span>
            <span style={{ marginLeft: 'auto' }}>▸</span>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.8, position: 'relative', zIndex: 1 }}>
            $ git clone penguin-forge
          </div>
        </a>
        <a href="/forge" target="_blank" rel="noopener" className="pf-cta-secondary" style={{
          display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 16px',
          borderRadius: 12, textDecoration: 'none', color: '#eaf0ff',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Open dashboards</span>
            <span style={{ marginLeft: 'auto', color: '#6bffb0' }}>▸</span>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#6bffb0', opacity: 0.85 }}>
            /forge · live admin
          </div>
        </a>
        <button onClick={onBackToWorld} className="pf-cta-ghost" style={{
          display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 16px',
          borderRadius: 12, color: '#cfd6e8', cursor: 'pointer', textAlign: 'left',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.12)',
          fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🐧</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Back to the world</span>
            <span style={{ marginLeft: 'auto' }}>↑</span>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#a7b8d4' }}>
            /play
          </div>
        </button>
      </div>

      {/* bottom stats strip */}
      <div style={{
        marginTop: 18, padding: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: 22, fontFamily: 'ui-monospace, monospace',
        fontSize: 10.5, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em',
      }}>
        <span>0 DEPENDENCIES</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span>RFC-6455 WEBSOCKETS</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span>20Hz GAME LOOP</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span>RAW node:net</span>
        <span style={{ flex: 1 }} />
        <span>penguin-forge · v0.1.0 · 2026</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// C — Atmospheric Fade. Diorama scrolls naturally with content;
// as it leaves the viewport it desaturates + dims into deep navy;
// console rises with an aurora horizon-line bridging the two halves.
// ═════════════════════════════════════════════════════════════════
function LandingScrollFade({ palette }) {
  const ref = React.useRef(null);
  const heroTextRef = React.useRef(null);
  const pillRef = React.useRef(null);

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      const y = el.scrollTop;
      const t = Math.min(1, Math.max(0, (y - 150) / 600));
      // World stays vibrant on scroll — only the hero copy gets out of the
      // way and the corner pill flips its active segment.
      if (heroTextRef.current) heroTextRef.current.style.opacity = String(Math.max(0, 1 - t * 1.2));
      if (pillRef.current) pillRef.current.dataset.active = t < 0.5 ? 'world' : 'console';
    };
    const sched = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(apply); } };
    el.addEventListener('scroll', sched, { passive: true });
    // also poll on a coarse interval as a safety net (design-canvas may swallow scroll events)
    const id = setInterval(apply, 100);
    apply();
    return () => { el.removeEventListener('scroll', sched); clearInterval(id); };
  }, []);

  const scrollTo = (top) => slowScrollTo(ref.current, top, 1800);

  return (
    <div ref={ref} className="pf" style={{
      width: 1440, height: 900, overflowY: 'auto', overflowX: 'hidden',
      position: 'relative', background: '#070d18', color: '#eaf0ff',
      fontFamily: '"Manrope", system-ui, sans-serif',
      scrollbarWidth: 'none',
    }}>
      <style>{`@keyframes sd { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>

      {/* progress pill — pinned upper-right, click to jump */}
      <div style={{ position: 'sticky', top: 0, zIndex: 6, height: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 60, right: 48, pointerEvents: 'auto' }}>
          <div ref={pillRef} className="pf-pill" data-active="world">
            <div className="pf-pill-thumb" />
            <button className="pf-pill-seg" onClick={() => scrollTo(0)}>WORLD</button>
            <button className="pf-pill-seg" onClick={() => {
              const el = ref.current;
              if (el) slowScrollTo(el, el.scrollHeight - el.clientHeight, 1800);
            }}>CONSOLE</button>
          </div>
        </div>
      </div>

      {/* hero — diorama 900px tall, stays bright on scroll */}
      <div style={{ position: 'relative', width: 1440, height: 900 }}>
        <NavStrip />
        <DioramaHero palette={palette} />
        <HeroText ref={heroTextRef} onScrollToForge={() => {
          const el = ref.current;
          if (!el) return;
          // scroll to the MAX scrollTop, not scrollHeight — otherwise the
          // ease curve aims past the clamp and the motion appears to
          // "speed up + slam" at the end instead of decelerating smoothly.
          slowScrollTo(el, el.scrollHeight - el.clientHeight, 1800);
        }} />
      </div>

      {/* TRANSITION BAND — snowy surface → deep cold water → console.
          The surface line breaks into floating ice chunks; light filters
          down through clear icy water that progressively darkens; god-rays
          and suspended particles sell the depth; the very bottom is the
          console's exact background color so the two seam invisibly. */}
      <div style={{ position: 'relative', height: 420, overflow: 'hidden' }}>
        {/* base gradient — snow → vivid icy water → deep cobalt → console.
            Bottom third now reaches console black earlier so the divider seams
            invisibly into the dev console below. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg,
            rgba(7,13,24,0.5) 0%,
            #ecf3fb 3%,
            #d4e6f5 7%,
            #93c4e6 12%,
            #4a9bcc 22%,
            #2576a8 32%,
            #155080 42%,
            #0c355a 52%,
            #0a1f3a 62%,
            #08152a 70%,
            #070f1d 78%,
            #070d18 85%,
            #070d18 100%)`,
        }} />

        {/* atmospheric haze at the very top — light snowy gradient that
            matches the plaza's snow tones so the join is gradual instead
            of a hard step. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 220,
          background: 'linear-gradient(180deg, rgba(208,205,216,1) 0%, rgba(208,205,216,0.88) 30%, rgba(208,205,216,0.5) 60%, rgba(208,205,216,0.18) 82%, transparent 100%)',
          pointerEvents: 'none', zIndex: 2,
        }} />

        <svg viewBox="0 0 1440 420" width="1440" height="420"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, display: 'block' }}>
          <defs>
            {/* snow drift highlight */}
            <linearGradient id="pf-snowline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d0cdd8" stopOpacity="0" />
              <stop offset="0.45" stopColor="#d0cdd8" stopOpacity="0.95" />
              <stop offset="1" stopColor="#b6b2c2" stopOpacity="0.96" />
            </linearGradient>
            {/* god-ray cone — bright at top, fades */}
            <linearGradient id="pf-godray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(220,235,250,0.30)" />
              <stop offset="0.5" stopColor="rgba(180,210,235,0.12)" />
              <stop offset="1" stopColor="rgba(120,160,200,0)" />
            </linearGradient>
            {/* caustic ripple — thin horizontal stroke of light */}
            <linearGradient id="pf-caustic" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0)" />
              <stop offset="0.5" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <linearGradient id="pf-caustic-dim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(200,225,245,0)" />
              <stop offset="0.5" stopColor="rgba(200,225,245,0.3)" />
              <stop offset="1" stopColor="rgba(200,225,245,0)" />
            </linearGradient>
            {/* floating ice fragment fill — same as snow */}
            <linearGradient id="pf-ice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6fafe" />
              <stop offset="1" stopColor="#aac3e0" />
            </linearGradient>
          </defs>

          {/* ── SNOW SURFACE (top) ─────────────────────────────── */}
          {/* main snow drift — gently undulating, with a bumpy bottom edge
              where it meets the water */}
          <path d="M 0 0 L 1440 0 L 1440 22
                   C 1340 30, 1280 22, 1220 26
                   C 1160 30, 1100 18, 1050 22
                   C 1000 26, 940 30, 880 24
                   C 820 18, 760 28, 700 24
                   C 640 20, 580 30, 520 26
                   C 460 22, 400 30, 340 26
                   C 280 22, 220 28, 160 24
                   C 100 20, 50 28, 0 30 Z"
            fill="url(#pf-snowline)" />
          {/* second drift behind for parallax */}
          <path d="M 0 12 C 220 22, 420 16, 640 24
                   C 860 32, 1080 20, 1300 28 L 1440 24 L 1440 38 L 0 38 Z"
            fill="#bdbac8" opacity="0.5" />

          {/* ── WATER SURFACE LINE ─────────────────────────────── */}
          {/* a soft horizontal reflection just under the snow's bumpy edge */}
          <path d="M 0 32 Q 360 36 720 33 T 1440 34"
            stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" fill="none" />
          <path d="M 0 35 Q 360 38 720 36 T 1440 36"
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" fill="none" />

          {/* ── FLOATING ICE CHUNKS just under the snow ────────── */}
          {[
            { x: 90,   y: 30, w: 36, h: 8 },
            { x: 260,  y: 34, w: 26, h: 7 },
            { x: 460,  y: 31, w: 44, h: 9 },
            { x: 720,  y: 35, w: 22, h: 6 },
            { x: 880,  y: 31, w: 38, h: 8 },
            { x: 1080, y: 34, w: 30, h: 7 },
            { x: 1280, y: 32, w: 40, h: 9 },
          ].map((c, i) => (
            <g key={i}>
              {/* iceberg above water */}
              <path d={`M ${c.x} ${c.y}
                       L ${c.x + c.w * 0.15} ${c.y - c.h * 0.7}
                       L ${c.x + c.w * 0.5} ${c.y - c.h}
                       L ${c.x + c.w * 0.85} ${c.y - c.h * 0.6}
                       L ${c.x + c.w} ${c.y} Z`}
                fill="url(#pf-ice)" />
              {/* shadow below */}
              <ellipse cx={c.x + c.w / 2} cy={c.y + 1}
                rx={c.w / 2} ry="1.2" fill="rgba(0,0,0,0.25)" />
              {/* faint underwater silhouette */}
              <path d={`M ${c.x + c.w * 0.18} ${c.y}
                       L ${c.x + c.w * 0.5} ${c.y + c.h * 1.6}
                       L ${c.x + c.w * 0.82} ${c.y}`}
                fill="rgba(190,215,235,0.18)" />
            </g>
          ))}

          {/* ── (god rays removed per user request) ───────────── */}

          {/* ── SEA CREATURES — naturalistic + pixel-art residents ── */}
          {/* swimming penguin (naturalistic) — body of water near top */}
          <g transform="translate(360 138) rotate(8)">
            <Penguin x={0} y={0} size={0.95} color="#1a2848" facing={1} />
          </g>
          {/* second swimming penguin, smaller, mid-water, facing left */}
          <g transform="translate(1080 200) rotate(-12)">
            <Penguin x={0} y={0} size={0.75} color="#0e1a35" facing={-1} />
          </g>
          {/* bubble trail behind the swimming penguins */}
          <g fill="rgba(220,235,250,0.6)">
            <circle cx="318" cy="135" r="2" />
            <circle cx="298" cy="130" r="1.3" />
            <circle cx="284" cy="122" r="1" opacity="0.55" />
            <circle cx="276" cy="115" r="0.7" opacity="0.4" />
          </g>
          <g fill="rgba(220,235,250,0.45)">
            <circle cx="1110" cy="205" r="1.6" />
            <circle cx="1124" cy="214" r="1.1" />
            <circle cx="1136" cy="222" r="0.7" />
          </g>

          {/* small sleek fish silhouettes — naturalistic, sprinkled mid-depth */}
          {[
            { x: 180, y: 100, s: 1.0, dir: 1,  tint: 'rgba(20,38,68,0.55)' },
            { x: 880, y: 116, s: 0.8, dir: -1, tint: 'rgba(18,34,60,0.5)' },
            { x: 540, y: 168, s: 1.1, dir: 1,  tint: 'rgba(16,28,52,0.55)' },
            { x: 920, y: 178, s: 0.9, dir: -1, tint: 'rgba(16,28,52,0.5)' },
            { x: 260, y: 226, s: 1.3, dir: 1,  tint: 'rgba(14,24,44,0.55)' },
            { x: 760, y: 240, s: 1.0, dir: -1, tint: 'rgba(12,22,40,0.55)' },
            { x: 1200, y: 248, s: 0.85, dir: 1, tint: 'rgba(12,22,40,0.5)' },
          ].map((f, i) => (
            <g key={i} transform={`translate(${f.x} ${f.y}) scale(${f.dir * f.s} ${f.s})`}>
              <path d="M 0 0 Q 14 -5 26 0 Q 14 5 0 0 Z" fill={f.tint} />
              <path d="M 0 0 L -8 -5 L -8 5 Z" fill={f.tint} />
              <path d="M 12 -3 L 16 -7 L 18 -3 Z" fill={f.tint} />
              <circle cx="20" cy="-1.5" r="0.7" fill="rgba(220,235,250,0.6)" />
            </g>
          ))}

          {/* jellyfish — translucent bell with curling tentacles, mid-water */}
          <g transform="translate(700 200)">
            <ellipse cx="0" cy="0" rx="32" ry="10" fill="rgba(180,210,235,0.06)" />
            <path d="M -22 0 Q -22 -22 0 -22 Q 22 -22 22 0 Q 22 4 18 5 Q 0 9 -18 5 Q -22 4 -22 0 Z"
              fill="rgba(190,220,240,0.25)" stroke="rgba(220,235,250,0.4)" strokeWidth="0.8" />
            <path d="M -16 -8 Q -10 -18 0 -18 Q 10 -18 16 -8"
              stroke="rgba(255,255,255,0.45)" strokeWidth="1" fill="none" />
            <path d="M -10 -2 Q 0 -8 10 -2"
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" fill="none" />
            <g stroke="rgba(220,235,250,0.45)" strokeWidth="0.9" fill="none" strokeLinecap="round">
              <path d="M -16 6 q -2 8 2 14 q 4 6 -2 12 q -4 6 0 10" />
              <path d="M -8 8 q 0 8 -4 16 q -3 6 1 12" />
              <path d="M 0 9 q 1 10 -2 18 q -2 6 1 12" />
              <path d="M 8 8 q 2 10 -2 18 q -3 6 0 10" />
              <path d="M 16 6 q 2 8 -2 14 q -2 6 2 10 q 2 4 0 8" />
            </g>
          </g>

          {/* smaller jellyfish farther down */}
          <g transform="translate(220 290)">
            <path d="M -14 0 Q -14 -14 0 -14 Q 14 -14 14 0 Q 14 3 11 4 Q 0 7 -11 4 Q -14 3 -14 0 Z"
              fill="rgba(180,210,235,0.18)" stroke="rgba(220,235,250,0.3)" strokeWidth="0.6" />
            <path d="M -10 -4 Q -5 -12 0 -12 Q 5 -12 10 -4"
              stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" fill="none" />
            <g stroke="rgba(220,235,250,0.32)" strokeWidth="0.7" fill="none" strokeLinecap="round">
              <path d="M -10 5 q -2 6 1 12 q 2 4 -1 8" />
              <path d="M -3 6 q 1 7 -1 13" />
              <path d="M 3 6 q -1 7 1 13" />
              <path d="M 10 5 q 2 6 -1 12 q -2 4 1 8" />
            </g>
          </g>

          {/* great whale silhouette — very faint in the deep */}
          <g transform="translate(560 320)" opacity="0.55">
            <path d="M -160 0
                     C -140 -22, -80 -28, 0 -22
                     C 80 -16, 130 -4, 150 4
                     L 162 -2 L 175 -8 L 175 6 L 165 12
                     C 130 18, 60 22, -20 18
                     C -110 12, -160 6, -180 2 Z"
              fill="rgba(8,16,30,0.85)" />
            <circle cx="-130" cy="-8" r="1.4" fill="rgba(180,210,235,0.4)" />
            <path d="M 155 -4 L 175 -8 L 175 6 L 158 4"
              fill="rgba(5,10,20,0.95)" />
          </g>

          {/* ── PIXEL-ART CREATURES ───────────────────────────────
              8-bit residents of the abyss. Each pixel is a 3×3 rect. */}
          {(() => {
            const PX = 3;
            const penguinPx = [
              '..XX..',
              '.XBBX.',
              '.XBBX.',
              '.XWWX.',
              'XBWWBX',
              'XBBBBX',
              '.XOOX.',
              '..OO..',
            ];
            const penguinPal = { X: '#0a1424', B: '#3b82f6', W: '#ecf3fb', O: '#ffb84e' };
            const fishPx = [
              '...XXX...',
              '..XBBBX..',
              '.XBWBBBX.',
              'XBBBBBBBX',
              'XBLBBBBBX',
              'XBBBBBBBX',
              '.XBBBBX..',
              '..XXXX...',
            ];
            const fishPal = { X: '#040814', B: '#1e3458', W: '#dfeaf7', L: '#0b1a30' };
            const squidPx = [
              '..XXX..',
              '.XPPPX.',
              'XPPPPPX',
              'XPWWPPX',
              'XPPPPPX',
              '.X.X.X.',
              'X.X.X.X',
              'X...X.X',
            ];
            const squidPal = { X: '#0a0e18', P: '#2a3a60', W: '#aac3e0' };

            const renderPx = (grid, pal, ox, oy) =>
              grid.flatMap((row, ry) =>
                row.split('').map((ch, rx) => {
                  if (ch === '.' || !pal[ch]) return null;
                  return (
                    <rect key={`${ox}-${oy}-${ry}-${rx}`}
                      x={ox + rx * PX}
                      y={oy + ry * PX}
                      width={PX} height={PX}
                      fill={pal[ch]} shapeRendering="crispEdges" />
                  );
                })
              );

            return (
              <g>
                <g transform="rotate(-6 1200 246)">
                  {renderPx(penguinPx, penguinPal, 1186, 230)}
                </g>
                {renderPx(fishPx, fishPal, 420, 296)}
                <circle cx="439" cy="305" r="3.5" fill="#ffe5a3" opacity="0.6" />
                <circle cx="439" cy="305" r="1.6" fill="#fff5d6" />
                <g transform="rotate(8 960 350)">
                  {renderPx(squidPx, squidPal, 950, 336)}
                </g>
              </g>
            );
          })()}

          {/* tiny silhouettes of fish schooling deep below */}
          {Array.from({ length: 6 }, (_, i) => {
            const x = 200 + i * 180 + (i % 2) * 40;
            const y = 360 + (i % 3) * 8;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(0.45)`} opacity="0.4">
                <path d="M 0 0 Q 14 -5 26 0 Q 14 5 0 0 Z" fill="#070d18" />
                <path d="M 0 0 L -8 -5 L -8 5 Z" fill="#070d18" />
              </g>
            );
          })}

          {/* ── CAUSTICS — shimmering ripples just below surface ─ */}
          {[
            { y: 46, x: 80,   len: 220, opacity: 0.9 },
            { y: 52, x: 360,  len: 260, opacity: 0.8 },
            { y: 58, x: 720,  len: 200, opacity: 0.7 },
            { y: 50, x: 1020, len: 240, opacity: 0.85 },
            { y: 60, x: 1240, len: 180, opacity: 0.7 },
            { y: 72, x: 180,  len: 280, opacity: 0.5 },
            { y: 78, x: 580,  len: 220, opacity: 0.45 },
            { y: 84, x: 920,  len: 260, opacity: 0.5 },
            { y: 92, x: 240,  len: 200, opacity: 0.32 },
            { y: 100, x: 700, len: 240, opacity: 0.28 },
            { y: 108, x: 1060, len: 200, opacity: 0.28 },
            { y: 122, x: 120,  len: 280, opacity: 0.22 },
            { y: 132, x: 800,  len: 260, opacity: 0.22 },
            { y: 152, x: 340,  len: 260, opacity: 0.18 },
            { y: 168, x: 760,  len: 280, opacity: 0.18 },
            { y: 180, x: 1080, len: 240, opacity: 0.18 },
            { y: 202, x: 200,  len: 260, opacity: 0.14 },
            { y: 218, x: 620,  len: 280, opacity: 0.13 },
            { y: 236, x: 960,  len: 260, opacity: 0.12 },
            { y: 262, x: 280,  len: 280, opacity: 0.09 },
            { y: 278, x: 780,  len: 240, opacity: 0.09 },
            { y: 302, x: 140,  len: 240, opacity: 0.06 },
            { y: 322, x: 700,  len: 280, opacity: 0.06 },
          ].map((c, i) => (
            <path key={i}
              d={`M ${c.x} ${c.y} q ${c.len / 4} -2 ${c.len / 2} 0 t ${c.len / 2} 0`}
              stroke={c.y < 90 ? 'url(#pf-caustic)' : 'url(#pf-caustic-dim)'}
              strokeWidth={c.y < 60 ? 1 : 0.7}
              fill="none"
              opacity={c.opacity} />
          ))}

          {/* ── SUSPENDED PARTICLES / BUBBLES ─────────────────── */}
          {Array.from({ length: 90 }, (_, i) => {
            // deterministic-pseudo
            const hash = (n) => {
              const v = Math.sin(n * 12.9898 + i * 78.233) * 43758.5453;
              return v - Math.floor(v);
            };
            const x = hash(1) * 1440;
            const y = 50 + hash(2) * 350;
            const r = 0.5 + hash(3) * 1.3;
            // particles thin out with depth
            const op = Math.max(0.03, (0.55 - (y - 50) / 400) * (0.5 + hash(4) * 0.5));
            return <circle key={i} cx={x} cy={y} r={r}
              fill="#dfeaf7" opacity={op} />;
          })}

          {/* ── DEEP-DEPTH GRADIENT TINT to push the bottom even darker ─ */}
        </svg>

        {/* one more vignette so the bottom edge is truly seamless with #070d18 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 160,
          background: 'linear-gradient(180deg, rgba(7,13,24,0) 0%, rgba(7,13,24,0.6) 35%, rgba(7,13,24,0.95) 70%, #070d18 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* console block */}
      <div style={{
        position: 'relative',
        background: '#070d18',
        paddingTop: 40,
      }}>
        <ConsoleBlock onBackToWorld={() => {
          const el = ref.current;
          if (el) slowScrollTo(el, 0, 1800);
        }} />
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════
// D — Sticky Crossfade. Diorama is pinned via position:sticky; the
// console glass-card slides UP over it. The diorama dims behind the
// glass via a translucent backdrop so both layers stay visible.
// ═════════════════════════════════════════════════════════════════
function LandingScrollSticky({ palette }) {
  const ref = React.useRef(null);
  const dioramaRef = React.useRef(null);
  const heroTextRef = React.useRef(null);
  const pillRef = React.useRef(null);

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      const y = el.scrollTop;
      const t = Math.min(1, Math.max(0, (y - 100) / 700));
      if (dioramaRef.current) {
        dioramaRef.current.style.filter =
          `saturate(${1 - t * 0.27}) brightness(${1 - t * 0.225})`;
      }
      if (heroTextRef.current) heroTextRef.current.style.opacity = String(Math.max(0, 1 - t * 0.7));
      if (pillRef.current) pillRef.current.dataset.active = t < 0.5 ? 'world' : 'console';
    };
    const sched = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(apply); } };
    el.addEventListener('scroll', sched, { passive: true });
    const id = setInterval(apply, 100);
    apply();
    return () => { el.removeEventListener('scroll', sched); clearInterval(id); };
  }, []);

  const scrollTo = (top) => slowScrollTo(ref.current, top, 1800);

  return (
    <div ref={ref} className="pf" style={{
      width: 1440, height: 900, overflowY: 'auto', overflowX: 'hidden',
      position: 'relative', background: '#070d18', color: '#eaf0ff',
      fontFamily: '"Manrope", system-ui, sans-serif',
      scrollbarWidth: 'none',
    }}>
      <style>{`@keyframes sd { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>

      {/* sticky diorama */}
      <div style={{ position: 'sticky', top: 0, height: 900, width: 1440, zIndex: 1 }}>
        <NavStrip />
        <div ref={dioramaRef} style={{ position: 'absolute', inset: 0, willChange: 'filter' }}>
          <DioramaHero palette={palette} />
        </div>
        <HeroText ref={heroTextRef} onScrollToForge={() => scrollTo(800)} />
        <div style={{ position: 'absolute', top: 60, right: 48, zIndex: 5 }}>
          <div ref={pillRef} className="pf-pill" data-active="world">
            <div className="pf-pill-thumb" />
            <button className="pf-pill-seg" onClick={() => scrollTo(0)}>WORLD</button>
            <button className="pf-pill-seg" onClick={() => scrollTo(800)}>CONSOLE</button>
          </div>
        </div>
      </div>

      {/* spacer — holds enough scroll for the sticky reveal but no more */}
      <div style={{ height: 320, position: 'relative', zIndex: 0 }} />

      {/* console drawer */}
      <div style={{
        position: 'relative', zIndex: 3, marginTop: -160,
        padding: '0 48px 0',
      }}>
        <div style={{
          height: 6, width: 60, borderRadius: 3, margin: '0 auto 28px',
          background: 'rgba(255,255,255,0.3)',
        }} />
        <div style={{
          background: 'rgba(7,13,24,0.78)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 28, padding: '56px 48px 0',
          boxShadow: '0 -10px 50px rgba(0,0,0,0.4)',
        }}>
          <ConsoleBlock onBackToWorld={() => scrollTo(0)} />
        </div>
      </div>
    </div>
  );
}

// ───── Procedural deep-water transition band ─────
// (Stone generator removed — divider now renders snowy surface → icy water
// → console abyss. See the SVG block inside LandingScrollFade.)

Object.assign(window, {
  LandingScrollFade, LandingScrollSticky,
  DioramaHero, HeroText, NavStrip, ConsoleBlock,
});
