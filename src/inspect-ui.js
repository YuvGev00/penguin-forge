'use strict';

// The /_inspect page — Wire Inspector. Forge-console redesign (drop-in
// from the Claude Design bundle). Served as a string by the dispatcher
// (framework UI, not a route). All fetch paths / handlers preserved.
//
// NOTE: this file is a JS template literal. The HTML body uses single
// backslashes (\n, regex \s\d) — they are doubled on embed so the
// literal still emits single backslashes to the browser.

module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>fs-forge · wire inspector</title>
<!-- Fonts vendored locally (public/vendor/) — no CDN, works fully offline. -->
<link href="/vendor/fonts.css" rel="stylesheet">
<style>
  /* ============================================================
     FORGE CONSOLE — shared visual system
     ============================================================ */
  :root{
    color-scheme:dark;
    --bg:#060b15;
    --bg-2:#0d1524;
    --bg-3:#131c2e;
    --line:rgba(255,255,255,.07);
    --line-2:rgba(255,255,255,.14);
    --ink:#eef2fc;
    --ink-dim:#95a1c0;
    --ink-faint:#5d6885;
    --ink-ghost:#3a4360;

    --amber:#ffb84e;
    --amber-hot:#ff8a3d;
    --mint:#6bffb0;
    --coral:#ff6a8e;
    --violet:#9a6bff;
    --sky:#7cb8ff;

    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:"Manrope",system-ui,-apple-system,Segoe UI,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--bg);color:var(--ink)}
  ::selection{background:rgba(255,184,78,.3);color:var(--ink)}
  ::-moz-selection{background:rgba(255,184,78,.3);color:var(--ink)}
  :focus-visible{outline:2px solid var(--amber);outline-offset:2px;border-radius:4px}
  *::-webkit-scrollbar{width:9px;height:9px}
  *::-webkit-scrollbar-track{background:transparent}
  *::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:99px}
  *::-webkit-scrollbar-thumb:hover{background:rgba(255,184,78,.3)}
  body{
    font-family:var(--sans);min-height:100vh;
    -webkit-font-smoothing:antialiased;line-height:1.55;
    font-variant-numeric:tabular-nums;
    background:
      linear-gradient(180deg,var(--violet) 0 2px,transparent 2px 100%),
      repeating-linear-gradient(0deg,transparent 0 39px,rgba(255,255,255,.022) 39px 40px),
      radial-gradient(60% 50% at 50% -10%,rgba(154,107,255,.06),transparent 70%),
      var(--bg);
  }
  body::before{
    content:"";position:fixed;inset:-20%;z-index:0;pointer-events:none;
    background:
      radial-gradient(28% 28% at 14% 18%,rgba(154,107,255,.07),transparent 70%),
      radial-gradient(32% 32% at 86% 30%,rgba(124,184,255,.05),transparent 70%);
    filter:blur(40px);animation:ambient 30s ease-in-out infinite alternate;
  }
  @keyframes ambient{
    0%{transform:translate3d(0,0,0) scale(1)}
    100%{transform:translate3d(-2%,1.5%,0) scale(1.05)}
  }
  @media(prefers-reduced-motion:reduce){body::before{animation:none}}
  body > *{position:relative;z-index:1}
  a{color:inherit;text-decoration:none}
  code,kbd{font-family:var(--mono)}

  /* ---------- top nav ---------- */
  .topnav{
    position:sticky;top:0;z-index:50;
    backdrop-filter:blur(10px);
    background:rgba(6,11,21,.78);
    border-bottom:1px solid var(--line);
  }
  .topnav-inner{
    max-width:1320px;margin:0 auto;
    display:flex;align-items:center;gap:1.4rem;
    padding:.7rem 1.4rem;
    font-family:var(--mono);font-size:.78rem;
    letter-spacing:.14em;text-transform:uppercase;
  }
  .brand{display:flex;align-items:center;gap:.55rem;font-weight:700;color:var(--ink);white-space:nowrap;flex:0 0 auto}
  .brand .mark{
    width:14px;height:14px;
    background:linear-gradient(135deg,var(--amber),var(--amber-hot));
    transform:rotate(45deg);
    box-shadow:0 0 0 1px rgba(0,0,0,.4) inset,0 0 14px rgba(255,184,78,.5);
  }
  .brand .slash{color:var(--ink-faint);font-weight:400}
  .brand .product{color:var(--amber)}
  .nav-links{display:flex;align-items:center;gap:.15rem;margin-left:.6rem}
  .nav-links a{padding:.45rem .9rem;border-radius:6px;color:var(--ink-dim);font-weight:600;letter-spacing:.16em;transition:color .15s,background .15s}
  .nav-links a:hover{color:var(--ink);background:rgba(255,255,255,.04)}
  .nav-links a.active{color:var(--violet);background:rgba(154,107,255,.09);box-shadow:inset 0 0 0 1px rgba(154,107,255,.3)}
  .topnav .spacer{flex:1}
  .live-stamp{display:flex;align-items:center;gap:.5rem;color:var(--ink-faint);font-size:.72rem;white-space:nowrap;flex:0 0 auto}
  .live-stamp .pip{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 0 rgba(107,255,176,.55);animation:pulse 2.2s infinite}
  .live-stamp.bad .pip{background:var(--coral);animation:none}
  .live-stamp.wait .pip{background:var(--amber);animation:pulse 1.4s infinite}
  .live-stamp b{color:var(--mint);font-weight:700}
  .live-stamp.bad b{color:var(--coral)}
  .live-stamp.wait b{color:var(--amber)}
  @keyframes pulse{70%{box-shadow:0 0 0 8px rgba(107,255,176,0)}100%{box-shadow:0 0 0 0 rgba(107,255,176,0)}}

  /* ---------- frame ---------- */
  .frame{max-width:1320px;margin:0 auto;padding:2.2rem 1.4rem 4rem}

  /* ---------- shared card ---------- */
  .card{background:var(--bg-2);border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .card-head{
    display:flex;align-items:center;gap:.55rem;padding:.6rem 1rem;
    border-bottom:1px solid var(--line);font-family:var(--mono);font-size:.7rem;
    letter-spacing:.18em;text-transform:uppercase;color:var(--ink-faint);
    background:linear-gradient(180deg,rgba(255,255,255,.025),transparent);
  }
  .card-head .dot{width:7px;height:7px;border-radius:50%;background:var(--violet);box-shadow:0 0 0 2px rgba(154,107,255,.18)}
  .card-head .right{margin-left:auto;color:var(--ink-ghost)}

  /* =================================================================
     WIRE INSPECTOR
     ================================================================= */

  /* ---------- hero ---------- */
  .hero{
    display:grid;grid-template-columns:minmax(0,1fr) 360px;
    gap:2rem;align-items:end;
    padding:1.8rem 0 1.4rem;
    border-bottom:1px solid var(--line);
    margin-bottom:1.2rem;
  }
  @media(max-width:880px){.hero{grid-template-columns:1fr;gap:1.4rem}}
  .eyebrow{
    font-family:var(--mono);font-size:.72rem;letter-spacing:.22em;
    text-transform:uppercase;color:var(--violet);white-space:nowrap;
    display:inline-flex;align-items:center;gap:.55rem;margin-bottom:.85rem;
  }
  .eyebrow::before{content:"";display:inline-block;width:22px;height:1px;background:var(--violet)}
  h1.bigtitle{
    font-family:var(--sans);font-size:clamp(2.6rem,5.2vw,3.8rem);
    font-weight:800;letter-spacing:-.04em;line-height:.96;
    color:var(--ink);margin-bottom:.55rem;
  }
  h1.bigtitle .accent{color:var(--violet);font-style:italic}
  .lede{font-size:1.02rem;color:var(--ink-dim);line-height:1.55;max-width:60ch}
  .lede b{color:var(--ink);font-weight:700}
  .lede code{
    font-family:var(--mono);font-size:.86em;color:var(--violet);
    background:rgba(154,107,255,.08);padding:.05em .45em;border-radius:4px;
    border:1px solid rgba(154,107,255,.18);
  }

  /* ---------- hero ornament: animated byte tape + event ticker ----------
     The ornament shows what /_inspect does: bytes scrolling across a TCP
     socket, with direction-coded event rows underneath. Pure CSS — a
     horizontally scrolling hex string + 4 stacked mini-events, one of
     which pulses to suggest a "just arrived" event. */
  .ornament{
    background:#0a1120;
    border:1px solid var(--line);border-radius:10px;
    overflow:hidden;font-family:var(--mono);
    position:relative;
  }
  .ornament::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:2px;
    background:var(--violet);
  }
  .ornament-head{
    display:flex;align-items:center;gap:.5rem;
    padding:.5rem .85rem;
    border-bottom:1px solid var(--line);
    font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-faint);
    white-space:nowrap;
  }
  .ornament-head .pip{
    width:6px;height:6px;border-radius:50%;background:var(--mint);
    box-shadow:0 0 0 0 rgba(107,255,176,.55);animation:pulse 2.2s infinite;
    flex:0 0 auto;
  }
  .ornament-head .path{color:var(--violet);font-weight:700;letter-spacing:.12em;flex:0 0 auto}
  .ornament-head .right{margin-left:auto;color:var(--ink-ghost);font-weight:400;letter-spacing:.04em;text-transform:none;flex:0 0 auto}

  .tape{
    position:relative;
    padding:.45rem 0;
    border-bottom:1px solid var(--line);
    background:#06091a;
    overflow:hidden;
    mask:linear-gradient(90deg,transparent 0,#000 8%,#000 92%,transparent 100%);
    -webkit-mask:linear-gradient(90deg,transparent 0,#000 8%,#000 92%,transparent 100%);
  }
  .tape-track{
    display:inline-block;white-space:nowrap;
    font-family:var(--mono);font-size:.66rem;
    color:var(--ink-faint);letter-spacing:.18em;
    animation:tapeScroll 22s linear infinite;
    will-change:transform;
  }
  .tape-track .hi{color:var(--violet);animation:hiGet 8s linear infinite}
  .tape-track .hi.b{color:var(--mint);animation:hiOk 8s linear infinite}
  .tape-track .hi.c{color:var(--coral);animation:hiErr 8s linear infinite}
  .tape-track .hi.d{color:var(--violet);animation:hiDel 8s linear infinite}
  /* Each highlight burns bright + drop-shadow during its 2s phase,
     then dims back to its base color. Phases: GET 0–25%, OK 25–50%,
     DEL 50–75%, ERR 75–100% of the 8s loop. */
  @keyframes hiGet{
    0%,22%   {filter:brightness(1.7) drop-shadow(0 0 5px rgba(154,107,255,.7))}
    25%,100% {filter:none}
  }
  @keyframes hiOk{
    0%,25%   {filter:none}
    27%,47%  {filter:brightness(1.7) drop-shadow(0 0 5px rgba(107,255,176,.7))}
    50%,100% {filter:none}
  }
  @keyframes hiDel{
    0%,50%   {filter:none}
    52%,72%  {filter:brightness(1.7) drop-shadow(0 0 5px rgba(154,107,255,.7))}
    75%,100% {filter:none}
  }
  @keyframes hiErr{
    0%,75%   {filter:none}
    77%,97%  {filter:brightness(1.8) drop-shadow(0 0 5px rgba(255,106,142,.7))}
    100%     {filter:none}
  }
  @keyframes tapeScroll{
    0%{transform:translateX(0)}
    100%{transform:translateX(-50%)}
  }

  .ow-events{display:flex;flex-direction:column}
  .ow-ev{
    display:flex;align-items:center;gap:.55rem;
    padding:.4rem .85rem;
    border-bottom:1px solid var(--line);
    font-size:.74rem;
    position:relative;
  }
  .ow-ev:last-child{border-bottom:none}
  .ow-ev::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:2px;
  }
  .ow-ev.in::before{background:var(--violet)}
  .ow-ev.ok::before{background:var(--mint)}
  .ow-ev.err::before{background:var(--coral)}
  .ow-ev .arr{font-weight:800;font-size:.7rem;width:.85rem;text-align:center}
  .ow-ev.in .arr{color:var(--violet)}
  .ow-ev.ok .arr{color:var(--mint)}
  .ow-ev.err .arr{color:var(--coral)}
  .ow-ev .lbl{color:var(--ink);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ow-ev .ms{color:var(--ink-ghost);font-size:.6rem;letter-spacing:.08em}

  /* Sequence the "just arrived" highlight through the 4 events in
     order. Each event holds the spotlight for ~2s of the 8s loop,
     matching the byte-tape highlight above. */
  .ow-events > .ow-ev:nth-child(1){animation:owActGet 8s linear infinite}
  .ow-events > .ow-ev:nth-child(2){animation:owActOk  8s linear infinite}
  .ow-events > .ow-ev:nth-child(3){animation:owActDel 8s linear infinite}
  .ow-events > .ow-ev:nth-child(4){animation:owActErr 8s linear infinite}
  @keyframes owActGet{
    0%,22%   {background:rgba(154,107,255,.10);box-shadow:inset 2px 0 0 var(--violet),0 0 14px -6px rgba(154,107,255,.5)}
    25%,100% {background:transparent;box-shadow:none}
  }
  @keyframes owActOk{
    0%,25%   {background:transparent;box-shadow:none}
    27%,47%  {background:rgba(107,255,176,.10);box-shadow:inset 2px 0 0 var(--mint),0 0 14px -6px rgba(107,255,176,.5)}
    50%,100% {background:transparent;box-shadow:none}
  }
  @keyframes owActDel{
    0%,50%   {background:transparent;box-shadow:none}
    52%,72%  {background:rgba(154,107,255,.10);box-shadow:inset 2px 0 0 var(--violet),0 0 14px -6px rgba(154,107,255,.5)}
    75%,100% {background:transparent;box-shadow:none}
  }
  @keyframes owActErr{
    0%,75%   {background:transparent;box-shadow:none}
    77%,97%  {background:rgba(255,106,142,.10);box-shadow:inset 2px 0 0 var(--coral),0 0 14px -6px rgba(255,106,142,.5)}
    100%     {background:transparent;box-shadow:none}
  }
  /* Old single-event "fresh" kept as a no-op for backward compat
     should the live JS ever stamp a fresh class. */
  .ow-ev.fresh{}
  .ow-foot{
    display:flex;align-items:center;gap:.55rem;
    padding:.5rem .85rem;
    border-top:1px solid var(--line);
    font-size:.7rem;color:var(--ink-faint);
    background:rgba(255,255,255,.015);
    white-space:nowrap;
  }
  /* Phase-stacked metadata: every line occupies the same grid cell so
     the row never re-flows; opacity keyframes do the swap. */
  .ow-foot .stack{
    display:inline-grid;grid-template-areas:"a";flex:1;min-width:0;
  }
  .ow-foot .stack > span{
    grid-area:a;color:var(--ink-dim);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }
  .ow-foot .stack > span b{color:var(--ink);font-weight:700}
  .ow-foot .ph-get{animation:phGet 8s linear infinite}
  .ow-foot .ph-ok {animation:phOk  8s linear infinite}
  .ow-foot .ph-del{animation:phDel 8s linear infinite}
  .ow-foot .ph-err{animation:phErr 8s linear infinite}
  @keyframes phGet{0%,22%{opacity:1}25%,100%{opacity:0}}
  @keyframes phOk {0%,25%{opacity:0}27%,47%{opacity:1}50%,100%{opacity:0}}
  @keyframes phDel{0%,50%{opacity:0}52%,72%{opacity:1}75%,100%{opacity:0}}
  @keyframes phErr{0%,75%{opacity:0}77%,97%{opacity:1}100%{opacity:0}}
  .ow-foot .right{
    margin-left:0;color:var(--ink-ghost);
    font-size:.62rem;letter-spacing:.1em;flex:0 0 auto;
  }

  @media(prefers-reduced-motion:reduce){
    .tape-track,.tape-track .hi,
    .ow-events > .ow-ev,
    .ow-foot .ph-get,.ow-foot .ph-ok,.ow-foot .ph-del,.ow-foot .ph-err{
      animation:none;
    }
    .ow-events > .ow-ev:nth-child(1){background:rgba(154,107,255,.10);box-shadow:inset 2px 0 0 var(--violet)}
    .ow-foot .ph-get{opacity:1}
    .ow-foot .ph-ok,.ow-foot .ph-del,.ow-foot .ph-err{opacity:0}
  }

  /* ---------- control bar ---------- */
  .ctl{
    display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;
    padding:.7rem 1rem;
    border:1px solid var(--line);border-radius:9px;
    background:var(--bg-2);
    font-family:var(--mono);font-size:.8rem;color:var(--ink-dim);
    margin-bottom:.9rem;
  }
  .ctl label{display:flex;gap:.42rem;align-items:center;cursor:pointer;user-select:none;white-space:nowrap}
  .ctl input[type=checkbox]{
    width:14px;height:14px;
    accent-color:var(--violet);
    cursor:pointer;
  }
  .ctl-btn{
    font-family:var(--mono);font-size:.74rem;font-weight:700;letter-spacing:.08em;
    text-transform:uppercase;cursor:pointer;
    color:var(--ink);background:rgba(255,255,255,.04);
    border:1px solid var(--line);border-radius:6px;
    padding:.42rem .8rem;transition:color .15s,border-color .15s,background .15s;
    white-space:nowrap;
  }
  .ctl-btn:hover{color:var(--violet);border-color:rgba(154,107,255,.4)}
  .ctl-btn.amber{color:var(--amber);border-color:rgba(255,184,78,.3)}
  .ctl-btn.amber:hover{background:rgba(255,184,78,.07);border-color:var(--amber)}
  .ctl .spacer{flex:1}
  .ctl .back{
    color:var(--ink-faint);transition:color .15s;
    display:inline-flex;align-items:center;gap:.3rem;
    white-space:nowrap;font-size:.74rem;
  }
  .ctl .back:hover{color:var(--mint)}
  .ctl .count{
    color:var(--ink-faint);font-size:.74rem;letter-spacing:.1em;
    white-space:nowrap;
  }
  .ctl .count b{color:var(--violet)}

  /* ---------- protocol lab ---------- */
  .lab{
    margin-bottom:1rem;
    border:1px solid rgba(255,184,78,.35);border-radius:10px;
    background:linear-gradient(180deg,rgba(255,184,78,.04),rgba(255,255,255,.01));
    overflow:hidden;
  }
  .lab-head{
    display:flex;align-items:center;gap:.55rem;
    padding:.65rem 1rem;
    border-bottom:1px solid rgba(255,184,78,.18);
    font-family:var(--mono);font-size:.74rem;letter-spacing:.16em;
    text-transform:uppercase;color:var(--amber);font-weight:700;
  }
  .lab-head .right{margin-left:auto;color:var(--ink-ghost);font-weight:400;letter-spacing:.1em;text-transform:none;font-size:.7rem}
  .lab-body{padding:.9rem 1rem 1rem}
  .lab-presets{
    display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;
    font-family:var(--mono);font-size:.76rem;color:var(--ink-faint);
    margin-bottom:.7rem;
  }
  .lab-presets > span{color:var(--ink-ghost);letter-spacing:.12em;text-transform:uppercase;font-size:.66rem;margin-right:.2rem}
  .lab-presets button{
    font-family:var(--mono);font-size:.74rem;font-weight:600;cursor:pointer;
    color:var(--ink-dim);background:rgba(255,255,255,.03);
    border:1px solid var(--line);border-radius:6px;padding:.3rem .65rem;
    transition:color .15s,border-color .15s,background .15s;
  }
  .lab-presets button:hover{color:var(--amber);border-color:rgba(255,184,78,.4);background:rgba(255,184,78,.05)}
  #labBytes{
    width:100%;min-height:10rem;resize:vertical;
    font-family:var(--mono);font-size:.86rem;line-height:1.6;
    color:var(--ink);background:#06091a;
    border:1px solid var(--line);border-radius:8px;
    padding:.8rem .95rem;white-space:pre;overflow:auto;
  }
  #labBytes:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px rgba(255,184,78,.16)}
  .lab-foot{display:flex;align-items:center;gap:.85rem;margin-top:.7rem;flex-wrap:wrap}
  #labSend{
    font-family:var(--sans);font-weight:800;font-size:.84rem;
    color:#2a1500;border:none;border-radius:7px;padding:.5rem 1.2rem;
    cursor:pointer;letter-spacing:.02em;
    background:linear-gradient(135deg,var(--amber),var(--amber-hot));
    box-shadow:0 6px 16px -8px rgba(255,140,40,.7);
    transition:filter .15s,transform .15s;
  }
  #labSend:hover{filter:brightness(1.08);transform:translateY(-1px)}
  .lab-hint{font-size:.74rem;color:var(--ink-faint);font-family:var(--mono)}
  .lab-hint code{color:var(--amber);background:rgba(255,184,78,.08);padding:.05em .35em;border-radius:3px}

  /* ---------- event feed ---------- */
  .feed-col{display:flex;flex-direction:column;gap:.55rem}

  .empty{
    border:1px dashed var(--line-2);border-radius:12px;
    padding:2.6rem 1.5rem;text-align:center;
    color:var(--ink-faint);font-size:.95rem;line-height:1.6;
  }
  .empty a{color:var(--violet);font-weight:600}
  .empty a:hover{color:var(--amber)}
  .empty .glyph{
    font-family:var(--mono);font-size:1.4rem;color:var(--ink-ghost);
    letter-spacing:.4em;margin-bottom:.7rem;
  }

  .ev{
    border:1px solid var(--line);border-radius:9px;
    background:var(--bg-2);overflow:hidden;
    animation:rise .35s ease both;
    position:relative;
    transition:border-color .2s,box-shadow .25s;
  }
  .ev:hover{
    border-color:var(--line-2);
    box-shadow:0 14px 30px -22px rgba(0,0,0,.6);
  }
  .ev::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
  }
  .ev.in::before{background:var(--violet)}
  .ev.out::before{background:var(--sky)}
  .ev.out.ok::before{background:var(--mint)}
  .ev.out.err::before{background:var(--coral)}
  @keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .ev .h{
    display:flex;gap:.6rem;align-items:center;
    padding:.55rem 1rem .55rem 1.1rem;
    font-family:var(--mono);font-size:.78rem;letter-spacing:.04em;
    border-bottom:1px solid var(--line);
    background:linear-gradient(180deg,rgba(255,255,255,.02),transparent);
  }
  .ev .tag{font-weight:800;letter-spacing:.14em;font-size:.74rem}
  .ev.in .tag{color:var(--violet)}
  .ev.out .tag{color:var(--sky)}
  .ev.out.ok .tag{color:var(--mint)}
  .ev.out.err .tag{color:var(--coral)}
  .ev .code{
    font-family:var(--mono);font-weight:800;font-size:.72rem;
    padding:.1rem .45rem;border-radius:4px;letter-spacing:.04em;
  }
  .ev.out.ok .code{color:#072a18;background:var(--mint)}
  .ev.out.err .code{color:#2a0712;background:var(--coral)}
  .ev .meta{color:var(--ink-faint);margin-left:auto;font-size:.72rem}
  .ev .meta b{color:var(--ink-dim);font-weight:600}
  .ev .meta .scope-fw{color:var(--ink-ghost)}
  .replay{
    font-family:var(--mono);font-size:.7rem;font-weight:800;letter-spacing:.08em;
    color:var(--amber);border:1px solid currentColor;background:transparent;
    padding:.22rem .55rem;border-radius:5px;cursor:pointer;
    transition:background .15s;
  }
  .replay:hover{background:rgba(255,184,78,.1)}
  .replay:disabled{opacity:.45;cursor:default}
  .ev pre{
    font-family:var(--mono);padding:.85rem 1.1rem;font-size:.85rem;
    line-height:1.6;white-space:pre-wrap;word-break:break-all;
    color:var(--ink);max-height:340px;overflow:auto;
    background:#06091a;
  }
  .ev pre::-webkit-scrollbar{width:7px;height:7px}
  .ev pre::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:99px}

  /* ---------- entrance animation ---------- */
  [data-r]{opacity:0;transform:translateY(8px);animation:rise2 .65s cubic-bezier(.2,.7,.2,1) forwards}
  [data-r="1"]{animation-delay:.02s}[data-r="2"]{animation-delay:.12s}
  [data-r="3"]{animation-delay:.2s}
  @keyframes rise2{to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){[data-r]{animation:none;opacity:1;transform:none}}

    /* Top-nav activity ticker — 6 tiny bars that "dance" to suggest
       live traffic. Each bar pulses on its own offset; together they
       read as a constantly-shifting micro-graph. */
    .ticker{display:inline-flex;gap:2px;align-items:flex-end;height:10px;margin-right:.45rem}
    .ticker i{display:block;width:2px;background:currentColor;border-radius:1px;opacity:.7;animation:tick 1.2s ease-in-out infinite}
    .ticker i:nth-child(1){animation-delay:0s}
    .ticker i:nth-child(2){animation-delay:.15s}
    .ticker i:nth-child(3){animation-delay:.3s}
    .ticker i:nth-child(4){animation-delay:.45s}
    .ticker i:nth-child(5){animation-delay:.6s}
    .ticker i:nth-child(6){animation-delay:.75s}
    @keyframes tick{0%,100%{height:2px}50%{height:10px}}
    @media(prefers-reduced-motion:reduce){.ticker i{animation:none;height:6px}}
  </style>
</head>
<body>

  <nav class="topnav">
    <div class="topnav-inner">
      <a class="brand" href="/">
        <span class="mark"></span>
        <span>PENGUIN-FORGE</span>
        <span class="slash">/</span>
        <span class="product">FS-FORGE</span>
      </a>
      <div class="nav-links">
        <a href="/forge">Forge</a>
        <a href="/play">World</a>
        <a href="/_inspect" class="active">Wire</a>
        <a href="/_data">Data</a>
      </div>
      <div class="spacer"></div>
      <div id="conn" class="live-stamp wait">
        <span class="pip"></span>
        <span class="ticker" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span><b id="connlabel">connecting</b> · sse feed</span>
      </div>
    </div>
  </nav>

  <div class="frame">

    <!-- ---------- HERO ---------- -->
    <section class="hero" data-r="1">
      <div>
        <div class="eyebrow">framework UI · /_inspect</div>
        <h1 class="bigtitle">Wire <span class="accent">inspector.</span></h1>
        <p class="lede">
          Watch the raw bytes crossing the socket in real time — every
          <b>request line</b>, <b>header</b>, and <b>status line</b> that
          the from-scratch parser sees, as it sees them. Pair with
          <code>/forge</code> in another tab and send a request to fill
          this feed; or use the <b>Protocol Lab</b> below to fire
          deliberately malformed bytes and watch the parser react.
        </p>
      </div>
      <!-- Ambient byte stream + sequenced event spotlight. The tape's
           4 colored segments correspond to the 4 events below. Each 2s
           of the 8s loop, ONE row's spotlight + ONE tape segment glow
           together so the visual link "this row = these bytes" is
           plainly readable. -->
      <div class="ornament" aria-hidden="true">
        <div class="ornament-head">
          <span class="pip"></span>
          <span class="path">tcp socket</span>
          <span class="right">live · sse</span>
        </div>
        <div class="tape">
          <div class="tape-track">
            <span><span class="hi">47 45 54</span> 20 2F 61 70 69 0D 0A&nbsp;&nbsp;<span class="hi b">48 54 54 50</span> 2F 31 2E 31 20 32 30 30 0D 0A&nbsp;&nbsp;<span class="hi d">44 45 4C 45 54 45</span> 20 2F 61 70 69 0D 0A&nbsp;&nbsp;<span class="hi c">34 30 34</span> 20 4E 6F 74 0D 0A&nbsp;&nbsp;</span><span><span class="hi">47 45 54</span> 20 2F 61 70 69 0D 0A&nbsp;&nbsp;<span class="hi b">48 54 54 50</span> 2F 31 2E 31 20 32 30 30 0D 0A&nbsp;&nbsp;<span class="hi d">44 45 4C 45 54 45</span> 20 2F 61 70 69 0D 0A&nbsp;&nbsp;<span class="hi c">34 30 34</span> 20 4E 6F 74 0D 0A&nbsp;&nbsp;</span>
          </div>
        </div>
        <div class="ow-events">
          <div class="ow-ev in"><span class="arr">▼</span><span class="lbl">GET /api/penguins</span><span class="ms">23ms</span></div>
          <div class="ow-ev ok"><span class="arr">▲</span><span class="lbl">200 OK · 148 B</span><span class="ms">2.1s</span></div>
          <div class="ow-ev in"><span class="arr">▼</span><span class="lbl">DELETE /api/penguins/9</span><span class="ms">4.0s</span></div>
          <div class="ow-ev err"><span class="arr">▲</span><span class="lbl">404 Not Found</span><span class="ms">4.0s</span></div>
        </div>
        <div class="ow-foot">
          <!-- Phase-matched footer: shows the current event's conn+size
               instead of static aggregate counts — so the foot tracks
               the spotlight above in lockstep. -->
          <div class="stack">
            <span class="ph-get"><b>conn #7</b> · 62 B inbound</span>
            <span class="ph-ok"><b>conn #7</b> · 148 B sent · application/json</span>
            <span class="ph-del"><b>conn #8</b> · 55 B inbound</span>
            <span class="ph-err"><b>conn #8</b> · 46 B sent · unknown id</span>
          </div>
          <span class="right">parser: ok</span>
        </div>
      </div>
    </section>

    <!-- ---------- CONTROL BAR ---------- -->
    <div class="ctl" data-r="2">
      <label title="Show the framework's own page/asset/SSE traffic too">
        <input type="checkbox" id="showfw"> <span>show framework traffic</span>
      </label>
      <label>
        <input type="checkbox" id="hex"> <span>hex view</span>
      </label>
      <button id="pause" class="ctl-btn" title="Freeze the feed while you read; new events queue and apply when you unpause">⏸ pause</button>
      <button id="clear" class="ctl-btn">clear</button>
      <button id="labToggle" class="ctl-btn amber" title="Hand-craft raw HTTP bytes and fire them at the server">🧪 protocol lab</button>
      <div class="spacer"></div>
      <span class="count" id="evCount"></span>
      <a href="/forge" class="back">← back to console</a>
    </div>

    <!-- ---------- PROTOCOL LAB ---------- -->
    <section id="lab" class="lab" style="display:none">
      <div class="lab-head">
        <span>🧪 protocol lab</span>
        <span class="right">edit bytes → fire → watch the parser react below</span>
      </div>
      <div class="lab-body">
        <div class="lab-presets">
          <span>presets ▸</span>
          <button data-preset="ok">valid GET</button>
          <button data-preset="nohost">missing Host</button>
          <button data-preset="duphost">duplicate Host</button>
          <button data-preset="dupcl">conflicting Content-Length</button>
          <button data-preset="chunked">Transfer-Encoding: chunked</button>
          <button data-preset="badmethod">unknown method</button>
          <button data-preset="badver">bad HTTP version</button>
          <button data-preset="pipeline">pipelined (2 in 1)</button>
          <button data-preset="post">valid POST</button>
        </div>
        <textarea id="labBytes" spellcheck="false"></textarea>
        <div class="lab-foot">
          <button id="labSend">Send raw bytes ▸</button>
          <span class="lab-hint">Editor uses real newlines; the framework
            normalizes to <code>\\\\r\\\\n</code> on send — wire-correct.</span>
        </div>
      </div>
    </section>

    <!-- ---------- EVENT FEED ---------- -->
    <main id="log" class="feed-col" data-r="3">
      <div class="empty">
        <div class="glyph">· · ·</div>
        Awaiting traffic. Open the
        <a href="/forge">API console</a> in another tab and send a request —
        the bytes will appear here in real time.
      </div>
    </main>

  </div>

<script>
  /* ============================================================
     JS preserved from src/inspect-ui.js — same SSE endpoint, same
     snapshot fallback, same replay/lab paths. Only DOM structure
     and class names for the event cards changed.
     ============================================================ */
  const log=document.getElementById('log');
  const hex=document.getElementById('hex');
  const showfw=document.getElementById('showfw');
  const countEl=document.getElementById('evCount');
  const EMPTY='<div class="empty"><div class="glyph">· · ·</div>'+
    'Awaiting traffic. Open the <a href="/forge">API console</a> in another tab '+
    'and send a request — the bytes will appear here in real time.</div>';
  let events=[];
  const t=ts=>new Date(ts).toISOString().slice(11,23);

  function visible(e){ return showfw.checked || e.scope!=='framework'; }
  function isReplayable(e){
    return e.direction==='in' &&
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\\s+\\S+\\s+HTTP\\/1\\.[01]/.test(e.text);
  }
  function statusOf(e){
    if(e.direction!=='out') return null;
    const m=e.text.match(/^HTTP\\/1\\.[01]\\s+(\\d{3})/);
    return m?Number(m[1]):null;
  }

  function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  function node(e){
    const dir=e.direction==='in'?'in':'out';
    const arrow=dir==='in'?'▼ INBOUND':'▲ OUTBOUND';
    const code=statusOf(e);
    const tone=code===null?'':(code>=400?' err':' ok');
    const codeTag=code!==null
      ? ' <span class="code">'+code+'</span>' : '';
    const fw=e.scope==='framework'
      ? ' <span class="scope-fw">· framework</span>' : '';
    const replay=isReplayable(e)
      ? '<button class="replay" data-seq="'+e.seq+'" title="Re-fire these exact bytes via a fresh TCP connection back to the server">↻ REPLAY</button>'
      : '';
    const el=document.createElement('div');
    el.className='ev '+dir+tone;
    el.innerHTML='<div class="h"><span class="tag">'+arrow+'</span>'+codeTag+
      '<span class="meta"><b>conn #'+e.connId+'</b> · '+e.bytes+' B'+
      (e.truncated?' (trunc)':'')+fw+' · '+t(e.ts)+'</span>'+replay+
      '</div><pre></pre>';
    el.querySelector('pre').textContent=hex.checked?e.hex:e.text;
    const btn=el.querySelector('.replay');
    if(btn) btn.onclick=()=>replaySeq(btn);
    return el;
  }

  async function replaySeq(btn){
    btn.disabled=true;
    const seqN=Number(btn.dataset.seq);
    try{
      const r=await fetch('/_inspect/replay',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({seq:seqN}),
      });
      btn.textContent=r.ok?'↻ REPLAYED':'↻ FAILED';
    }catch{
      btn.textContent='↻ FAILED';
    }
    setTimeout(()=>{btn.textContent='↻ REPLAY';btn.disabled=false;},1400);
  }

  function nearBottom(){
    const doc=document.documentElement;
    return (doc.scrollHeight - window.scrollY - window.innerHeight) < 120;
  }

  function updateCount(){
    const shown=events.filter(visible);
    countEl.innerHTML = shown.length
      ? '<b>'+shown.length+'</b> event'+(shown.length===1?'':'s')+' captured'
      : '';
  }

  function render(){
    const wasFollowing=nearBottom();
    const shown=events.filter(visible);
    if(!shown.length){ log.innerHTML=EMPTY; updateCount(); return; }
    log.innerHTML='';
    shown.forEach(e=>log.appendChild(node(e)));
    updateCount();
    if(wasFollowing) window.scrollTo({top:document.documentElement.scrollHeight});
  }

  let paused=false;
  let queued=[];
  const pauseBtn=document.getElementById('pause');
  function setPaused(p){
    paused=p;
    pauseBtn.textContent=p?('▶ resume'+(queued.length?' ('+queued.length+')':'')):'⏸ pause';
    pauseBtn.style.color=p?'var(--amber)':'';
    pauseBtn.style.borderColor=p?'rgba(255,184,78,.4)':'';
    if(!p && queued.length){
      const drain=queued; queued=[];
      drain.forEach(addLive);
    }
  }
  pauseBtn.onclick=()=>setPaused(!paused);

  let lastSeq=0;
  function add(e){
    if(e.seq<=lastSeq) return;
    lastSeq=e.seq;
    if(paused){
      queued.push(e);
      pauseBtn.textContent='▶ resume ('+queued.length+')';
      if(queued.length>800) queued.shift();
      return;
    }
    return addLive(e);
  }
  function addLive(e){
    events.push(e);
    if(events.length>400) events.shift();
    if(!visible(e)){ updateCount(); return; }
    if(log.querySelector('.empty')) log.innerHTML='';
    const wasFollowing=nearBottom();
    const el=node(e);
    log.appendChild(el);
    updateCount();
    if(wasFollowing) el.scrollIntoView({block:'end',behavior:'smooth'});
  }

  showfw.onchange=render;
  hex.onchange=render;
  document.getElementById('clear').onclick=()=>{
    queued=[];
    if(paused) pauseBtn.textContent='▶ resume';
    events=[]; log.innerHTML='<div class="empty"><div class="glyph">· · ·</div>Cleared. Awaiting traffic…</div>';
    updateCount();
  };

  const connEl=document.getElementById('conn');
  const connLabel=document.getElementById('connlabel');
  function setConn(state, label){
    connEl.className='live-stamp '+state;
    connLabel.textContent=label;
  }

  let mode=null;
  let pollTimer=null;
  let pollSince=0;

  let previewLocked = false;

  function startPolling(reason){
    if(mode==='poll') return;
    if(previewLocked) return;
    mode='poll';
    setConn('wait','LIVE · polling ('+reason+')');
    async function tick(){
      if(previewLocked) return;
      try{
        const r=await fetch('/_inspect/snapshot?since='+pollSince);
        const { events:list }=await r.json();
        if(list && list.length){
          for(const e of list) add(e);
          pollSince=Math.max(pollSince, list[list.length-1].seq);
        }
        if(!previewLocked) setConn('wait','LIVE · polling');
      }catch{
        if(!previewLocked) setConn('bad','polling failed');
      }
    }
    tick();
    pollTimer=setInterval(tick, 2500);
  }

  const es=new EventSource('/_inspect/events');
  let sseTimer=setTimeout(()=>{ if(mode!=='sse'){ try{es.close();}catch{}; startPolling('SSE timeout'); } }, 5000);
  function promoteToSSE(){
    if(mode==='sse') return;
    mode='sse'; clearTimeout(sseTimer);
    if(pollTimer){ clearInterval(pollTimer); pollTimer=null; }
    setConn('','LIVE · sse');
  }
  es.onopen=promoteToSSE;
  es.addEventListener('hello', promoteToSSE);
  es.onerror=()=>{
    if(previewLocked) return;
    if(mode==='sse'){ setConn('bad','SSE dropped — falling back'); }
    try{es.close();}catch{}
    startPolling('SSE error');
  };
  es.onmessage=m=>{
    if(mode!=='sse'){ mode='sse'; clearTimeout(sseTimer); setConn('','LIVE · sse'); }
    try{ const e=JSON.parse(m.data); add(e); pollSince=Math.max(pollSince,e.seq); }catch{}
  };

  /* ---- Protocol Lab ---- */
  const lab=document.getElementById('lab');
  const labBytes=document.getElementById('labBytes');
  const PRESETS={
    ok:
      'GET /api/penguins HTTP/1.1\\n'+
      'Host: localhost:3000\\n\\n',
    nohost:
      'GET /api/penguins HTTP/1.1\\n\\n',
    duphost:
      'GET /api/penguins HTTP/1.1\\n'+
      'Host: a\\n'+
      'Host: b\\n\\n',
    dupcl:
      'POST /api/penguins HTTP/1.1\\n'+
      'Host: localhost:3000\\n'+
      'Content-Length: 3\\n'+
      'Content-Length: 5\\n\\n'+
      'hello',
    chunked:
      'POST /api/penguins HTTP/1.1\\n'+
      'Host: localhost:3000\\n'+
      'Transfer-Encoding: chunked\\n\\n'+
      '0\\n\\n',
    badmethod:
      'GOT /api/penguins HTTP/1.1\\n'+
      'Host: localhost:3000\\n\\n',
    badver:
      'GET /api/penguins HTTP/2.0\\n'+
      'Host: localhost:3000\\n\\n',
    pipeline:
      'GET /api/penguins/1 HTTP/1.1\\n'+
      'Host: localhost:3000\\n\\n'+
      'GET /api/penguins/2 HTTP/1.1\\n'+
      'Host: localhost:3000\\n'+
      'Connection: close\\n\\n',
    post:
      'POST /api/penguins?name=LabPingu HTTP/1.1\\n'+
      'Host: localhost:3000\\n\\n',
  };
  labBytes.value=PRESETS.ok;

  document.getElementById('labToggle').onclick=()=>{
    const show=lab.style.display==='none';
    lab.style.display=show?'block':'none';
    if(show) labBytes.focus();
  };
  document.querySelectorAll('.lab-presets button').forEach(b=>{
    b.onclick=()=>{ labBytes.value=PRESETS[b.dataset.preset]||''; labBytes.focus(); };
  });
  document.getElementById('labSend').onclick=async()=>{
    const raw=labBytes.value.replace(/\\r\\n/g,'\\n').replace(/\\n/g,'\\r\\n');
    try{
      const r=await fetch('/_inspect/send',{
        method:'POST',
        headers:{'Content-Type':'application/octet-stream'},
        body:raw,
      });
      setConn(r.ok?'':'bad', r.ok?'LIVE · sent '+raw.length+'B':'send failed');
    }catch{ setConn('bad','send failed'); }
  };

  /* ------- preview-only fallback ------- */
  // When opened standalone (no fs-forge server), neither SSE nor the
  // /_inspect/snapshot polling endpoint exists, so seed sample events
  // so the page isn't a blank shell. Active in any non-fs-forge context:
  // we look for /_inspect/snapshot specifically (the canonical fs-forge
  // endpoint) and seed if it 404s.
  async function seedIfNoServer(){
    try {
      const r = await fetch('/_inspect/snapshot?since=0', { method:'GET' });
      if (r.ok) return; // real server is here
    } catch {}
    previewLocked = true;
    try { es.close(); } catch {}
    clearTimeout(sseTimer);
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    mode = 'preview';
    setConn('wait','PREVIEW · sample events');
    // Seed a handful of sample events so the feed isn't empty.
    const now=Date.now();
    const samples=[
      { seq:1, connId:7, direction:'in',  scope:'app',       ts:now-2300, bytes:62,
        text:'GET /api/penguins HTTP/1.1\\r\\nHost: localhost:3000\\r\\nAccept: */*\\r\\n\\r\\n',
        hex:'47 45 54 20 2F 61 70 69 …' },
      { seq:2, connId:7, direction:'out', scope:'app',       ts:now-2270, bytes:148,
        text:'HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\nContent-Length: 78\\r\\n\\r\\n[{"id":1,"name":"Pingu","room":"plaza"},{"id":2,"name":"Skipper","room":"cafe"}]',
        hex:'48 54 54 50 2F 31 2E 31 …' },
      { seq:3, connId:8, direction:'in',  scope:'app',       ts:now-1100, bytes:55,
        text:'DELETE /api/penguins/9 HTTP/1.1\\r\\nHost: localhost:3000\\r\\n\\r\\n',
        hex:'44 45 4C 45 54 45 20 2F …' },
      { seq:4, connId:8, direction:'out', scope:'app',       ts:now-1070, bytes:46,
        text:'HTTP/1.1 404 Not Found\\r\\nContent-Length: 0\\r\\n\\r\\n',
        hex:'48 54 54 50 2F 31 2E 31 20 34 30 34 …' },
      { seq:5, connId:9, direction:'in',  scope:'framework', ts:now-300,  bytes:74,
        text:'GET /_routes HTTP/1.1\\r\\nHost: localhost:3000\\r\\nAccept: application/json\\r\\n\\r\\n',
        hex:'47 45 54 20 2F 5F 72 …' },
    ];
    samples.forEach(add);
  }
  seedIfNoServer();
</script>
</body>
</html>
`;
