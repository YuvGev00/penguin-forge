'use strict';

// The /_data page — Data Explorer. Forge-console redesign (drop-in from
// the Claude Design bundle). Served as a string by the dispatcher
// (framework UI, not a route). It reads /_routes, groups collection
// routes by their list/item/update/remove hints, and renders an inline-
// editable table per collection over the /_data/events SSE stream.
// All fetch paths / handlers preserved; a self-disabling preview mock
// only fires when no live /_routes exists.
//
// NOTE: this file is a JS template literal — backslashes are doubled on
// embed so the literal emits single backslashes to the browser.

module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>fs-forge · data explorer</title>
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
      linear-gradient(180deg,var(--mint) 0 2px,transparent 2px 100%),
      repeating-linear-gradient(0deg,transparent 0 39px,rgba(255,255,255,.022) 39px 40px),
      radial-gradient(60% 50% at 50% -10%,rgba(107,255,176,.05),transparent 70%),
      var(--bg);
  }
  /* Ambient drifting glow — extremely subtle, makes the page feel alive
     without being noisy. Sits behind everything via z-index:0. */
  body::before{
    content:"";position:fixed;inset:-20%;z-index:0;pointer-events:none;
    background:
      radial-gradient(28% 28% at 12% 18%,rgba(107,255,176,.06),transparent 70%),
      radial-gradient(32% 32% at 88% 32%,rgba(255,184,78,.04),transparent 70%);
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
  .nav-links a.active{color:var(--mint);background:rgba(107,255,176,.08);box-shadow:inset 0 0 0 1px rgba(107,255,176,.3)}
  .topnav .spacer{flex:1}
  .live-stamp{display:flex;align-items:center;gap:.5rem;color:var(--ink-faint);font-size:.72rem;white-space:nowrap;flex:0 0 auto}
  .live-stamp .pip{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 0 rgba(107,255,176,.55);animation:pulse 2.2s infinite}
  .live-stamp b{color:var(--mint);font-weight:700}
  @keyframes pulse{70%{box-shadow:0 0 0 8px rgba(107,255,176,0)}100%{box-shadow:0 0 0 0 rgba(107,255,176,0)}}

  /* ---------- frame ---------- */
  .frame{max-width:1320px;margin:0 auto;padding:2.2rem 1.4rem 4rem}

  /* =================================================================
     DATA EXPLORER
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
    text-transform:uppercase;color:var(--mint);white-space:nowrap;
    display:inline-flex;align-items:center;gap:.55rem;margin-bottom:.85rem;
  }
  .eyebrow::before{content:"";display:inline-block;width:22px;height:1px;background:var(--mint)}
  h1.bigtitle{
    font-family:var(--sans);font-size:clamp(2.6rem,5.2vw,3.8rem);
    font-weight:800;letter-spacing:-.04em;line-height:.96;
    color:var(--ink);margin-bottom:.55rem;
  }
  h1.bigtitle .accent{color:var(--mint);font-style:italic}
  .lede{font-size:1.02rem;color:var(--ink-dim);line-height:1.55;max-width:60ch}
  .lede b{color:var(--ink);font-weight:700}
  .lede code{
    font-family:var(--mono);font-size:.86em;color:var(--mint);
    background:rgba(107,255,176,.08);padding:.05em .45em;border-radius:4px;
    border:1px solid rgba(107,255,176,.18);
  }

  /* ---------- hero ornament: animated mini-table ---------- */
  /* A coordinated 12s storyboard playing 3 real API actions in sequence,
     so a viewer can see what /_data actually does (not just glow):
       0   – 4s   PUT name on row 2 (Bob → Robert), mint flash, then revert
       4   – 8s   DELETE row 3 (Pingu) — slides off coral, then restores
       8   – 12s  POST a new row (Skipper → Iris in row 4), mint flash
     The footer badge / message / status track the SAME phase so the
     request and its effect always read together. */
  .ornament{
    background:#0a1120;
    border:1px solid var(--line);border-radius:10px;
    overflow:hidden;font-family:var(--mono);
    position:relative;
  }
  .ornament::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:2px;
    background:var(--mint);
  }
  .ornament-head{
    display:flex;align-items:center;gap:.5rem;
    padding:.5rem .85rem;
    border-bottom:1px solid var(--line);
    font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-faint);white-space:nowrap;
  }
  .ornament-head .pip{
    width:6px;height:6px;border-radius:50%;background:var(--mint);
    box-shadow:0 0 0 0 rgba(107,255,176,.55);animation:pulse 2.2s infinite;
    flex:0 0 auto;
  }
  .ornament-head .path{color:var(--mint);font-weight:700;letter-spacing:.12em;flex:0 0 auto}
  .ornament-head .right{margin-left:auto;color:var(--ink-ghost);font-weight:400;letter-spacing:.04em;text-transform:none;flex:0 0 auto}
  .ornament-table{width:100%;border-collapse:collapse;font-size:.78rem;table-layout:fixed}
  .ornament-table th{
    text-align:left;padding:.4rem .85rem .35rem;
    font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-ghost);font-weight:600;
    background:rgba(255,255,255,.012);
    border-bottom:1px solid var(--line);
  }
  .ornament-table td{
    padding:.42rem .85rem;border-bottom:1px solid var(--line);
    color:var(--ink);white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis;
    position:relative;
  }
  .ornament-table tr:last-child td{border-bottom:none}
  .ornament-table .id{color:var(--violet);font-weight:700;width:2.2rem}

  /* The 12s master timeline — every animated element runs on the same
     duration with its own keyframes, so phases stay in lockstep. */

  /* Row 2 (Bob): cursor + amber edit ring during 0–2.5s; row mint-
     flashes on PUT success around 2.5–3s; then quiets for the rest
     of the cycle. */
  .r-bob{animation:bobRow 12s linear infinite}
  @keyframes bobRow{
    0%   {background:transparent;box-shadow:none}
    1%,18%{background:rgba(255,184,78,.06);box-shadow:inset 0 0 0 1px rgba(255,184,78,.35)}
    21%,25%{background:rgba(107,255,176,.18);box-shadow:inset 0 0 0 1px rgba(107,255,176,.45)}
    30%  {background:transparent;box-shadow:none}
    100% {background:transparent;box-shadow:none}
  }
  /* Name text-swap in Bob's cell: "Bob" hides, "Robert" appears mid-edit,
     then everything reverts before the loop restarts so visually the
     table returns to its starting state (loop hides the revert). */
  .swap{display:inline-grid;grid-template-areas:"a"}
  .swap > span{grid-area:a}
  .r-bob .swap .orig{animation:bobOrig 12s linear infinite}
  .r-bob .swap .nu  {animation:bobNew  12s linear infinite;color:var(--amber)}
  @keyframes bobOrig{
    0%,12% {opacity:1}
    15%,28%{opacity:0}
    31%,100%{opacity:1}
  }
  @keyframes bobNew{
    0%,12% {opacity:0}
    15%,28%{opacity:1}
    31%,100%{opacity:0}
  }
  /* Cursor sits at the end of the name. It only blinks while the row
     is actively being edited (0–3s); after the PUT lands it fades. */
  .cursor{
    display:inline-block;width:1px;height:.85em;background:var(--amber);
    margin-left:1px;vertical-align:-.05em;
    animation:cursorPhase 12s linear infinite;
  }
  @keyframes cursorPhase{
    0%,2%  {opacity:1}
    2.5%,3%{opacity:0}
    3.5%,4%{opacity:1}
    4.5%,5%{opacity:0}
    5.5%,6%{opacity:1}
    6.5%,7%{opacity:0}
    7.5%,8%{opacity:1}
    8.5%,9%{opacity:0}
    9.5%,10%{opacity:1}
    10.5%,11%{opacity:0}
    11.5%,12%{opacity:1}
    14%,18% {opacity:1}
    20%,100%{opacity:0}
  }
  /* Cursor color flips mint at the moment the PUT succeeds, which sells
     the "edit committed" beat. */
  .r-bob.r-active .cursor{}

  /* Row 3 (Pingu) — DELETE phase 4–8s: coral tint, slide right, fade,
     then restore for the loop. */
  .r-pingu{animation:pinguRow 12s linear infinite}
  @keyframes pinguRow{
    0%,33.3%   {transform:translateX(0);opacity:1;background:transparent}
    36%        {transform:translateX(0);opacity:1;background:rgba(255,106,142,.18)}
    44%        {transform:translateX(18px);opacity:0;background:rgba(255,106,142,.10)}
    56%        {transform:translateX(18px);opacity:0;background:transparent}
    60%,66.7%  {transform:translateX(0);opacity:1;background:transparent}
    100%       {transform:translateX(0);opacity:1;background:transparent}
  }

  /* Row 4 (Skipper) — POST phase 8–12s: name swaps Skipper → Iris with
     a brief violet tint, then mint-flashes (201 Created). */
  .r-iris{animation:irisRow 12s linear infinite}
  @keyframes irisRow{
    0%,66.7%   {background:transparent;box-shadow:none}
    70%,80%    {background:rgba(154,107,255,.10);box-shadow:inset 0 0 0 1px rgba(154,107,255,.4)}
    82%,86%    {background:rgba(107,255,176,.18);box-shadow:inset 0 0 0 1px rgba(107,255,176,.45)}
    91%,100%   {background:transparent;box-shadow:none}
  }
  .r-iris .swap .orig{animation:irisOrig 12s linear infinite}
  .r-iris .swap .nu  {animation:irisNew  12s linear infinite;color:var(--violet)}
  @keyframes irisOrig{
    0%,72%   {opacity:1}
    76%,90%  {opacity:0}
    94%,100% {opacity:1}
  }
  @keyframes irisNew{
    0%,72%   {opacity:0}
    76%,90%  {opacity:1}
    94%,100% {opacity:0}
  }

  /* Footer: three stacked (badge, message, status-code) triplets — each
     one only visible during its own phase. Stacked via grid-area so the
     row height never jumps. */
  .ornament-foot{
    display:flex;align-items:center;gap:.5rem;
    padding:.55rem .85rem;
    border-top:1px solid var(--line);
    font-size:.7rem;color:var(--ink-faint);
    background:rgba(255,255,255,.015);
  }
  .of-badge{
    position:relative;display:inline-grid;grid-template-areas:"a";
    flex:0 0 auto;width:2.7rem;
  }
  .of-badge > span{
    grid-area:a;text-align:center;
    font-weight:800;font-size:.62rem;letter-spacing:.06em;
    padding:.12rem .4rem;border:1px solid currentColor;border-radius:3px;
  }
  .of-msg{
    position:relative;display:inline-grid;grid-template-areas:"a";flex:1;min-width:0;
  }
  .of-msg > span{grid-area:a;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .of-status{
    position:relative;display:inline-grid;grid-template-areas:"a";
    flex:0 0 auto;color:var(--ink-ghost);font-size:.62rem;letter-spacing:.1em;min-width:8rem;text-align:right;
  }
  .of-status > span{grid-area:a;text-align:right}

  /* Phase visibility — PUT (0–33.3%), DEL (33.3–66.7%), POST (66.7–100%).
     A tiny crossfade (~3% of cycle) keeps things from popping. */
  .ph-put  {color:var(--amber);  animation:phPut  12s linear infinite}
  .ph-del  {color:var(--coral);  animation:phDel  12s linear infinite}
  .ph-post {color:var(--violet); animation:phPost 12s linear infinite}
  @keyframes phPut {
    0%,30%   {opacity:1}
    33%,100% {opacity:0}
  }
  @keyframes phDel {
    0%,30%   {opacity:0}
    34%,63%  {opacity:1}
    67%,100% {opacity:0}
  }
  @keyframes phPost{
    0%,63%   {opacity:0}
    67%,100% {opacity:1}
  }
  /* Status text: empty during the request, fills in after success. The
     status-code phase fades in slightly LATER than the badge/message so
     it reads "request fires → response lands". */
  .st-put {color:var(--mint); animation:stPut  12s linear infinite}
  .st-del {color:var(--mint); animation:stDel  12s linear infinite}
  .st-post{color:var(--mint); animation:stPost 12s linear infinite}
  @keyframes stPut {
    0%,18%   {opacity:0}
    22%,30%  {opacity:1}
    33%,100% {opacity:0}
  }
  @keyframes stDel {
    0%,52%   {opacity:0}
    55%,63%  {opacity:1}
    67%,100% {opacity:0}
  }
  @keyframes stPost{
    0%,85%   {opacity:0}
    88%,98%  {opacity:1}
    100%     {opacity:0}
  }
  @media(prefers-reduced-motion:reduce){
    .r-bob,.r-pingu,.r-iris,.swap .orig,.swap .nu,.cursor,
    .ph-put,.ph-del,.ph-post,.st-put,.st-del,.st-post{animation:none}
    .r-bob{background:rgba(255,184,78,.06);box-shadow:inset 0 0 0 1px rgba(255,184,78,.35)}
    .r-bob .swap .nu,.r-iris .swap .nu{opacity:0}
    .cursor{opacity:1}
    .ph-put{opacity:1} .ph-del,.ph-post,.st-put,.st-del,.st-post{opacity:0}
  }

  /* ---------- howto strip (now below hero, thinner) ---------- */
  .howto{
    display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;
    padding:.65rem 1rem;margin-bottom:1.6rem;
    border:1px solid var(--line);border-radius:8px;
    background:rgba(255,255,255,.02);
    font-family:var(--mono);font-size:.78rem;
  }
  .howto > .k{
    color:var(--ink-faint);letter-spacing:.16em;text-transform:uppercase;
    font-size:.66rem;margin-right:.3rem;white-space:nowrap;flex:0 0 auto;
  }
  .howto > .tail{
    margin-left:auto;color:var(--ink-ghost);font-size:.66rem;
    letter-spacing:.14em;text-transform:uppercase;
    white-space:nowrap;flex:0 0 auto;
  }
  .howto .step{
    display:inline-flex;align-items:center;gap:.5rem;
    padding:.3rem .7rem;border-radius:5px;
    background:rgba(255,255,255,.025);border:1px solid var(--line);
    white-space:nowrap;
  }
  .howto .n{
    width:1.1rem;height:1.1rem;border-radius:50%;
    display:grid;place-items:center;font-weight:800;font-size:.62rem;
    color:#06091a;background:var(--ink-dim);
  }
  .howto .step.click .n{background:var(--amber);color:#2a1500}
  .howto .step.del   .n{background:var(--coral);color:#2a0712}
  .howto .step.post  .n{background:var(--violet);color:#160a2a}
  .howto .lbl{color:var(--ink-dim)}
  .howto .lbl b{color:var(--ink);font-weight:700}
  .howto .lbl .amber{color:var(--amber)}
  .howto .lbl .coral{color:var(--coral)}
  .howto .lbl .violet{color:var(--violet)}

  /* ---------- collection cards ---------- */
  .collection{
    margin-bottom:1.4rem;
    border:1px solid var(--line);border-radius:10px;
    background:var(--bg-2);overflow:hidden;
    position:relative;
    transition:border-color .2s,box-shadow .25s,transform .2s;
  }
  .collection:hover{
    border-color:rgba(107,255,176,.22);
    box-shadow:0 14px 40px -22px rgba(107,255,176,.35),0 0 0 1px rgba(107,255,176,.06) inset;
  }
  .collection::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
    background:var(--mint);
    box-shadow:0 0 18px rgba(107,255,176,.3);
  }
  .ch{
    display:flex;align-items:center;gap:.8rem;
    padding:.9rem 1.2rem;
    border-bottom:1px solid var(--line);
    background:linear-gradient(180deg,rgba(255,255,255,.02),transparent);
  }
  .ch .name{
    font-family:var(--sans);font-weight:800;font-size:1.15rem;
    letter-spacing:-.01em;color:var(--ink);
    text-transform:capitalize;
  }
  .ch .path{
    font-family:var(--mono);font-size:.78rem;color:var(--mint);
    padding:.18rem .55rem;border:1px solid rgba(107,255,176,.3);border-radius:5px;
    background:rgba(107,255,176,.05);
  }
  .ch .count{
    margin-left:auto;font-family:var(--mono);font-size:.74rem;
    color:var(--ink-faint);letter-spacing:.1em;text-transform:uppercase;
    white-space:nowrap;
  }
  .ch .count b{color:var(--ink);font-weight:700}
  .ch .actions{display:flex;gap:.45rem;flex:0 0 auto}

  /* ---------- table ---------- */
  table{width:100%;border-collapse:collapse;font-size:.95rem}
  th,td{
    padding:.7rem 1.2rem;text-align:left;
    border-bottom:1px solid var(--line);vertical-align:top;
  }
  tr:last-child td{border-bottom:none}
  th{
    font-family:var(--mono);font-size:.7rem;letter-spacing:.18em;
    text-transform:uppercase;color:var(--ink-faint);font-weight:700;
    background:rgba(255,255,255,.015);
  }
  td.cell{
    font-family:var(--mono);font-size:.92rem;color:var(--ink);
    max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }
  td.id{color:var(--violet);font-weight:700}
  td.edit{
    cursor:text;
    border-bottom:1px solid var(--line);
    box-shadow:inset 0 -1px 0 var(--line);
    transition:background .15s,box-shadow .15s;
  }
  td.edit:hover{
    background:rgba(255,184,78,.05);
    box-shadow:inset 0 -1px 0 rgba(255,184,78,.4);
  }
  td.editing{
    background:rgba(255,184,78,.08);outline:none;
    box-shadow:inset 0 0 0 1px rgba(255,184,78,.4);
    white-space:normal;overflow:visible;text-overflow:clip;max-width:none;
  }
  td.acts{text-align:right;white-space:nowrap}
  .empty-row td{
    color:var(--ink-faint);font-style:italic;text-align:center;
    padding:1.4rem;font-family:var(--sans);
  }
  tr.row-flash{animation:flash 1.2s ease-out}
  @keyframes flash{0%{background:rgba(107,255,176,.16)}100%{background:transparent}}
  tr.row-die{animation:die .55s ease-out forwards}
  @keyframes die{to{background:rgba(255,106,142,.14);opacity:0;transform:translateX(8px)}}

  /* ---------- buttons ---------- */
  .btn{
    font-family:var(--mono);font-size:.7rem;font-weight:800;
    letter-spacing:.08em;text-transform:uppercase;
    border:1px solid currentColor;background:transparent;
    padding:.36rem .7rem;border-radius:5px;cursor:pointer;margin-left:.3rem;
    transition:background .15s;white-space:nowrap;
  }
  .btn:hover{background:rgba(255,255,255,.06)}
  .btn.get{color:var(--mint)}
  .btn.put{color:var(--amber)}
  .btn.del{color:var(--coral)}
  .btn.add{color:var(--violet)}
  .btn.addf{color:var(--amber)}

  /* ---------- empty page state ---------- */
  .empty-page{
    padding:3rem;text-align:center;color:var(--ink-faint);
    border:1px dashed var(--line-2);border-radius:12px;margin-top:1.4rem;
    font-size:.98rem;line-height:1.7;
  }
  .empty-page code{
    font-family:var(--mono);color:var(--mint);
    background:rgba(107,255,176,.08);padding:.12rem .45rem;border-radius:4px;
    border:1px solid rgba(107,255,176,.18);
  }

  /* ---------- toast ---------- */
  .toast{
    position:fixed;left:50%;bottom:1.6rem;
    transform:translateX(-50%) translateY(8px);
    background:#0d1524;border:1px solid var(--line-2);
    border-radius:999px;padding:.7rem 1.3rem;
    font-family:var(--mono);font-size:.86rem;color:var(--ink);
    box-shadow:0 18px 40px -16px rgba(0,0,0,.7);
    opacity:0;transition:opacity .25s,transform .25s;
    pointer-events:none;z-index:99;max-width:90vw;
  }
  .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .toast.ok{border-color:rgba(107,255,176,.5);box-shadow:0 18px 40px -16px rgba(107,255,176,.25)}
  .toast.err{border-color:rgba(255,106,142,.6);box-shadow:0 18px 40px -16px rgba(255,106,142,.3)}

  /* ---------- footer ---------- */
  footer.foot{
    margin-top:2.4rem;padding-top:1rem;
    border-top:1px solid var(--line);
    display:flex;gap:.8rem;flex-wrap:wrap;align-items:center;
    color:var(--ink-faint);font-family:var(--mono);font-size:.82rem;
  }
  footer.foot a{
    padding:.3rem .7rem;border:1px solid var(--line);border-radius:5px;
    color:var(--ink-dim);transition:color .15s,border-color .15s,background .15s;
  }
  footer.foot a:hover{color:var(--mint);border-color:var(--line-2);background:rgba(107,255,176,.04)}

  /* ---------- entrance ---------- */
  [data-r]{opacity:0;transform:translateY(8px);animation:rise .65s cubic-bezier(.2,.7,.2,1) forwards}
  [data-r="1"]{animation-delay:.02s}[data-r="2"]{animation-delay:.12s}
  @keyframes rise{to{opacity:1;transform:none}}
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
        <a href="/_inspect">Wire</a>
        <a href="/_data" class="active">Data</a>
      </div>
      <div class="spacer"></div>
      <div class="live-stamp">
        <span class="pip"></span>
        <span class="ticker" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span><b>LIVE</b> · reactive · sse</span>
      </div>
    </div>
  </nav>

  <div class="frame">

    <!-- ---------- HERO ---------- -->
    <section class="hero" data-r="1">
      <div>
        <div class="eyebrow">framework UI · /_data</div>
        <h1 class="bigtitle">Data <span class="accent">explorer.</span></h1>
        <p class="lede">
          Resources auto-discovered from <code>routes/</code> · reactive
          across tabs · backed by JSON. There is no hardcoded knowledge of
          "users" here — drop a new route pair with the right
          <code>GET[list]</code> / <code>POST[create]</code> hints and the
          explorer picks it up on next refresh. Every action below flies
          past <b>/_inspect</b> as real HTTP.
        </p>
      </div>
      <!-- 12s storyboard: PUT Bob → DELETE Pingu → POST Iris. Every
           animated element is on the same 12s loop with phase-matched
           keyframes so the badge/message/status in the footer always
           describes what the highlighted row is doing. -->
      <div class="ornament" aria-hidden="true">
        <div class="ornament-head">
          <span class="pip"></span>
          <span class="path">/api/users</span>
          <span class="right">live</span>
        </div>
        <table class="ornament-table">
          <thead><tr><th>id</th><th>name</th><th>room</th></tr></thead>
          <tbody>
            <tr><td class="id">1</td><td>Alice</td><td>plaza</td></tr>
            <tr class="r-bob">
              <td class="id">2</td>
              <td><span class="swap"><span class="orig">Bob</span><span class="nu">Robert</span></span><span class="cursor"></span></td>
              <td>cafe</td>
            </tr>
            <tr class="r-pingu"><td class="id">3</td><td>Pingu</td><td>plaza</td></tr>
            <tr class="r-iris">
              <td class="id">4</td>
              <td><span class="swap"><span class="orig">Skipper</span><span class="nu">Iris</span></span></td>
              <td>igloo</td>
            </tr>
          </tbody>
        </table>
        <div class="ornament-foot">
          <div class="of-badge">
            <span class="ph-put">PUT</span>
            <span class="ph-del">DEL</span>
            <span class="ph-post">POST</span>
          </div>
          <div class="of-msg">
            <span class="ph-put">name → "Robert"</span>
            <span class="ph-del">/api/users/3</span>
            <span class="ph-post">{ name: "Iris" }</span>
          </div>
          <div class="of-status">
            <span class="st-put">200 OK · 3ms</span>
            <span class="st-del">204 No Content · 2ms</span>
            <span class="st-post">201 Created · 4ms</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ---------- HOWTO STRIP ---------- -->
    <div class="howto" data-r="2">
      <span class="k">how to use ▸</span>
      <span class="step click"><span class="n">1</span><span class="lbl">click any cell to <b class="amber">edit · PUT</b></span></span>
      <span class="step del"><span class="n">2</span><span class="lbl">click <b class="coral">DEL</b> to remove</span></span>
      <span class="step post"><span class="n">3</span><span class="lbl">click <b class="violet">+ POST</b> to create</span></span>
      <span class="tail">syncs across tabs · SSE</span>
    </div>

    <main id="root" data-r="2"></main>

    <footer class="foot">
      <a href="/forge">← framework</a>
      <a href="/_inspect">/_inspect</a>
      <a href="/_routes">/_routes</a>
      <span style="margin-left:auto;color:var(--ink-ghost);font-size:.74rem;letter-spacing:.1em;text-transform:uppercase">backed by data.json · generated from DSL hints</span>
    </footer>
  </div>
  <div id="toast" class="toast"></div>

<script>
  /* ============================================================
     JS preserved verbatim from src/data-ui.js — same /_routes
     discovery, same /_data/events SSE subscription, same
     inline edit / PUT / DELETE / POST paths.
     ============================================================ */
  const root=document.getElementById('root');
  const toastEl=document.getElementById('toast');
  let toastTimer;
  function toast(msg, kind){
    toastEl.textContent=msg;
    toastEl.className='toast show '+(kind||'');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toastEl.className='toast',2000);
  }

  async function discover(){
    const r=await fetch('/_routes');
    const { routes } = await r.json();
    const lists=routes.filter(rt=>rt.hints&&(rt.hints.GET==='list'||rt.hints.POST==='create'));
    return lists.map(list=>{
      const itemPath=list.path.replace(/\\/?$/,'')+'/:id';
      const item=routes.find(rt=>rt.path===itemPath)||null;
      return { list, item };
    });
  }

  async function render(){
    const cols=await discover();
    if(!cols.length){
      root.innerHTML='<div class="empty-page">No resources discovered yet. '+
        'Add hints like <code>GET[list]</code>, <code>POST[create]</code>, '+
        '<code>GET[item]</code>, <code>PUT[update]</code>, '+
        '<code>DELETE[remove]</code> to your route files — they will appear here.</div>';
      return;
    }
    root.innerHTML='';
    for(const c of cols) await renderCollection(c);
  }

  async function renderCollection({list,item}){
    const name=collectionName(list.path);
    const wrap=document.createElement('section');
    wrap.className='collection';
    wrap.innerHTML='<div class="ch">'+
      '<span class="name">'+escape(name)+'</span>'+
      '<span class="path">'+escape(list.path)+'</span>'+
      '<span class="count" id="count-'+name+'"></span>'+
      '<span class="actions" id="acts-'+name+'"></span>'+
      '</div>';

    if(list.hints.POST==='create'){
      const a=wrap.querySelector('#acts-'+name);
      const b=document.createElement('button');
      b.className='btn add'; b.textContent='+ POST';
      b.onclick=()=>promptCreate(list,name,wrap);
      a.appendChild(b);
    }

    root.appendChild(wrap);
    await refreshRows(list,item,wrap,name);
  }

  async function refreshRows(list,item,wrap,name){
    const res=await fetch(list.path);
    const data=await res.json();
    const rows=Array.isArray(data)?data:[];
    wrap.querySelector('#count-'+name).innerHTML='<b>'+rows.length+'</b> row'+(rows.length===1?'':'s');

    const cols=rows.length?Object.keys(rows[0]):['id','—'];
    const html=[
      '<table><thead><tr>',
      cols.map(c=>'<th>'+escape(c)+'</th>').join(''),
      '<th></th></tr></thead><tbody>',
      rows.length===0
        ? '<tr class="empty-row"><td colspan="'+(cols.length+1)+'">'+
          'empty collection — click <b>+ POST</b> to insert a row</td></tr>'
        : rows.map(r=>renderRow(r,cols,item)).join(''),
      '</tbody></table>'
    ].join('');

    const old=wrap.querySelector('table');
    if(old) old.remove();
    wrap.insertAdjacentHTML('beforeend',html);
    bindRow(list,item,wrap,name);
  }

  function renderRow(r,cols,item){
    const canEdit=item&&item.hints&&item.hints.PUT==='update';
    const cells=cols.map(c=>{
      const v=r[c];
      const isId=c==='id';
      const editable=canEdit&&!isId;
      const cls='cell'+(isId?' id':'')+(editable?' edit':'');
      const text=escape(v==null?'':String(v));
      return '<td class="'+cls+'"'+
        (editable?' data-field="'+escape(c)+'" tabindex="0" title="click to edit"':'')+
        '>'+text+'</td>';
    }).join('');
    const acts=[];
    if(item&&item.hints){
      if(item.hints.GET==='item')
        acts.push('<button class="btn get" data-act="get" data-id="'+r.id+'">GET</button>');
      if(item.hints.DELETE==='remove')
        acts.push('<button class="btn del" data-act="del" data-id="'+r.id+'">DEL</button>');
    }
    return '<tr data-id="'+r.id+'">'+cells+
      '<td class="acts">'+acts.join('')+'</td></tr>';
  }

  function bindRow(list,item,wrap,name){
    wrap.querySelectorAll('button[data-act]').forEach(b=>{
      b.onclick=()=>doAction(b.dataset.act,b.dataset.id,list,item,wrap,name);
    });
    wrap.querySelectorAll('td.edit').forEach(td=>{
      td.onclick=()=>beginEdit(td,list,item,wrap,name);
      td.onkeydown=(e)=>{if(e.key==='Enter'){e.preventDefault();beginEdit(td,list,item,wrap,name);}};
    });
  }

  function beginEdit(td,list,item,wrap,name){
    if(td.isContentEditable) return;
    const original=td.textContent;
    const field=td.dataset.field;
    const id=td.parentNode.dataset.id;
    td.contentEditable='true';
    td.classList.add('editing');
    td.focus();
    const sel=window.getSelection(),range=document.createRange();
    range.selectNodeContents(td); range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);

    let done=false;
    const cleanup=()=>{td.contentEditable='false';td.classList.remove('editing');};
    td.onkeydown=async(e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        const v=td.textContent.trim();
        cleanup(); done=true;
        if(v===original) return;
        const url=list.path.replace(/\\/?$/,'')+'/'+encodeURIComponent(id)+
          '?'+encodeURIComponent(field)+'='+encodeURIComponent(v);
        const r=await fetch(url,{method:'PUT'});
        toast('PUT '+field+' → '+r.status, r.ok?'ok':'err');
        refreshRows(list,item,wrap,name).then(()=>{
          const row=wrap.querySelector('tr[data-id="'+CSS.escape(id)+'"]');
          if(row) row.classList.add('row-flash');
        });
      } else if(e.key==='Escape'){
        e.preventDefault();
        td.textContent=original; cleanup(); done=true;
      }
    };
    td.onblur=()=>{ if(!done){ td.textContent=original; cleanup(); } };
  }

  async function doAction(act,id,list,item,wrap,name){
    const itemUrl=list.path.replace(/\\/?$/,'')+'/'+encodeURIComponent(id);
    if(act==='get'){
      const r=await fetch(itemUrl);
      const tx=await r.text();
      try{
        toast('GET → '+r.status+'  '+JSON.stringify(JSON.parse(tx)), 'ok');
      }catch{ toast('GET → '+r.status,'ok'); }
      return;
    }
    if(act==='del'){
      const row=wrap.querySelector('tr[data-id="'+CSS.escape(id)+'"]');
      if(row) row.classList.add('row-die');
      const r=await fetch(itemUrl,{method:'DELETE'});
      setTimeout(()=>refreshRows(list,item,wrap,name),450);
      toast('DELETE → '+r.status,r.ok?'ok':'err');
      return;
    }
  }

  async function pickCreateField(list){
    try{
      const data=await fetch(list.path).then(r=>r.json());
      if(Array.isArray(data)&&data[0]){
        const k=Object.keys(data[0]).find(x=>x!=='id');
        if(k) return k;
      }
    }catch{}
    return 'name';
  }

  async function promptCreate(list,name,wrap){
    let qs;
    if (name === 'posts') {
      const title = prompt('Post title?');
      if (title === null) return;
      const author = prompt(
        'Author? (must be an existing user — e.g. Alice)'
      );
      if (author === null) return;
      qs = '?title=' + encodeURIComponent(title) +
           '&author=' + encodeURIComponent(author);
    } else {
      const field = await pickCreateField(list);
      const v = prompt('New ' + name.replace(/s$/, '') + ' ' + field + '?');
      if (v === null) return;
      qs = '?' + encodeURIComponent(field) + '=' + encodeURIComponent(v);
    }
    const r = await fetch(list.path + qs, { method: 'POST' });
    if (!r.ok) {
      let body;
      try { body = await r.json(); } catch { body = null; }
      const msg = body && (body.hint || body.error)
        ? 'POST → ' + r.status + ' · ' + (body.hint || body.error)
        : 'POST → ' + r.status;
      toast(msg, 'err');
      return;
    }
    toast('POST → ' + r.status, 'ok');
    await refreshRows(list, findItem(list, name), wrap, name);
    flashLastRow(wrap);
  }
  function findItem(list,name){
    return window._cols && window._cols[name] && window._cols[name].item;
  }
  function flashLastRow(wrap){
    const rows=wrap.querySelectorAll('tbody tr');
    if(rows.length) rows[rows.length-1].classList.add('row-flash');
  }

  function collectionName(p){
    return p.split('/').filter(Boolean).pop()||'/';
  }
  function escape(s){
    return String(s).replace(/[&<>"']/g,
      c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  (async()=>{
    // ----- preview-only fallback for standalone viewing -----
    // If /_routes can't be reached (page loaded outside fs-forge), mock
    // the framework endpoints so the page demos cleanly.
    async function isStandalone(){
      if (!location.host || location.protocol === 'file:') return true;
      try {
        const r = await fetch('/_routes', { method:'GET' });
        if (!r.ok) return true;
        await r.json();
        return false;
      } catch { return true; }
    }
    if (await isStandalone()) {
      const mockRoutes = {
        routes: [
          { path:'/api/users',     methods:['GET','POST'],          hints:{ GET:'list', POST:'create' } },
          { path:'/api/users/:id', methods:['GET','PUT','DELETE'],  hints:{ GET:'item', PUT:'update', DELETE:'remove' } },
          { path:'/api/posts',     methods:['GET','POST'],          hints:{ GET:'list', POST:'create' } },
          { path:'/api/posts/:id', methods:['GET','PUT','DELETE'],  hints:{ GET:'item', PUT:'update', DELETE:'remove' } },
        ],
      };
      const mockData = {
        '/api/users': [
          { id:1, name:'Alice',  room:'plaza' },
          { id:2, name:'Bob',    room:'cafe'  },
          { id:3, name:'Pingu',  room:'plaza' },
          { id:4, name:'Skipper',room:'igloo' },
        ],
        '/api/posts': [
          { id:1, title:'snowstorm warning',  author:'Alice' },
          { id:2, title:'best fish in town',  author:'Bob'   },
        ],
      };
      const origFetch = window.fetch;
      window.fetch = (url, opts) => {
        if (url === '/_routes') return Promise.resolve(new Response(JSON.stringify(mockRoutes), { status:200, headers:{'content-type':'application/json'} }));
        const base = url.split('?')[0].replace(/\\/\\d+$/,'');
        if (mockData[base]) {
          const m = (opts && opts.method) || 'GET';
          return Promise.resolve(new Response(JSON.stringify(m==='GET'?mockData[base]:{ok:true}), { status:200, headers:{'content-type':'application/json'} }));
        }
        return origFetch(url, opts);
      };
    }

    const cols=await discover();
    window._cols={};
    cols.forEach(c=>window._cols[collectionName(c.list.path)]=c);
    await render();
    subscribeToChanges();
  })();

  function subscribeToChanges(){
    if(!window.EventSource) return;
    // Skip SSE in preview mode where /_data/events doesn't exist.
    if (!location.host || location.protocol === 'file:') return;
    let es;
    try { es=new EventSource('/_data/events'); } catch { return; }
    es.onerror=()=>{ try{ es.close(); }catch{} };
    es.addEventListener('hello', ()=>{});
    es.onmessage=async(m)=>{
      let evt; try{ evt=JSON.parse(m.data); }catch{ return; }
      if(!evt || !evt.collection) return;
      const c=window._cols[evt.collection];
      if(!c) return;
      const wrap=document.querySelector('section.collection [id="count-'+evt.collection+'"]')
        && document.querySelector('section.collection [id="count-'+evt.collection+'"]').closest('section.collection');
      if(!wrap) return;
      await refreshRows(c.list, c.item, wrap, evt.collection);
      if(evt.kind!=='remove' && evt.row){
        const row=wrap.querySelector('tr[data-id="'+CSS.escape(String(evt.row.id))+'"]');
        if(row) row.classList.add('row-flash');
      } else {
        wrap.querySelector('table')?.classList.add('row-flash');
        setTimeout(()=>wrap.querySelector('table')?.classList.remove('row-flash'),1100);
      }
    };
  }
</script>
</body>
</html>
`;
