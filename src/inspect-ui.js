'use strict';

// The /_inspect page — a live view of the raw bytes crossing the socket,
// drawn in the same "Aurora" language as the landing page. Served as a
// string by the dispatcher (framework UI, not a route).
//
// NOTE: this file is a JS template literal, so it must contain NO ${...}.

module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>fs-forge · wire inspector</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{
    color-scheme:dark;
    --bg:#070a14; --ink:#eaf0ff; --ink-dim:#9aa6cc; --ink-faint:#6b769c;
    --line:rgba(255,255,255,.10); --line-soft:rgba(255,255,255,.06);
    --glass:rgba(255,255,255,.05);
    --violet:#a78bff; --teal:#5fe3c8; --pink:#ff6fae; --amber:#ffce73;
    --ok:#3ddc6e; /* success green — deliberately distinct from the cyan teal */
    --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
    --sans:"Manrope",system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--sans);color:var(--ink);background:var(--bg);
    min-height:100vh;-webkit-font-smoothing:antialiased;
    position:relative;overflow-x:hidden}
  body::before{content:"";position:fixed;inset:-30%;z-index:0;
    pointer-events:none;background:
      radial-gradient(38% 38% at 16% 14%, rgba(120,90,255,.30), transparent 70%),
      radial-gradient(34% 34% at 84% 22%, rgba(0,210,185,.20), transparent 70%),
      radial-gradient(44% 44% at 60% 96%, rgba(255,90,170,.16), transparent 70%);
    filter:blur(46px);animation:drift 26s ease-in-out infinite alternate}
  @keyframes drift{0%{transform:translate3d(0,0,0) scale(1)}
    100%{transform:translate3d(-2%,2%,0) scale(1.06)}}
  @media(prefers-reduced-motion:reduce){body::before{animation:none}}
  .frame{position:relative;z-index:1;max-width:1200px;margin:0 auto;
    padding:2rem 1.5rem 5rem}
  header{border:1px solid var(--line);border-radius:18px;padding:1.3rem 1.5rem;
    display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
    background:var(--glass);backdrop-filter:blur(14px)}
  .led{width:10px;height:10px;border-radius:50%;background:var(--teal);
    box-shadow:0 0 0 0 rgba(95,227,200,.55);animation:ping 2.2s infinite}
  @keyframes ping{70%{box-shadow:0 0 0 10px rgba(95,227,200,0)}100%{box-shadow:0 0 0 0 rgba(95,227,200,0)}}
  h1{font-size:1.7rem;font-weight:800;letter-spacing:-.02em;
    background:linear-gradient(118deg,#cbd6ff,#a78bff 50%,#5fe3c8);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .sub{font-size:1.05rem;color:var(--ink-dim);margin-top:.15rem}
  .conn{display:inline-flex;align-items:center;gap:.45rem;
    font-family:var(--mono);font-size:.8rem;letter-spacing:.12em;
    text-transform:uppercase;padding:.35rem .8rem;border-radius:999px;
    border:1px solid currentColor;color:var(--teal)}
  .conn.bad{color:var(--pink)} .conn.wait{color:var(--amber)}
  .conn .pip{width:7px;height:7px;border-radius:50%;background:currentColor}
  .stamp{font-family:var(--mono);font-size:.74rem;letter-spacing:.18em;
    text-transform:uppercase;color:var(--ink-faint);margin-left:auto;
    text-align:right;line-height:1.8}
  .ctl{display:flex;align-items:center;gap:1.1rem;margin-top:1rem;
    padding:.85rem 1.4rem;border:1px solid var(--line-soft);border-radius:14px;
    font-family:var(--mono);font-size:.88rem;color:var(--ink-faint);
    flex-wrap:wrap;background:rgba(255,255,255,.025)}
  .ctl label{display:flex;gap:.45rem;align-items:center;cursor:pointer}
  .ctl button{font-family:var(--mono);font-size:.82rem;letter-spacing:.1em;
    text-transform:uppercase;background:rgba(255,255,255,.05);color:var(--ink);
    border:1px solid var(--line);border-radius:8px;padding:.45rem 1rem;
    cursor:pointer}
  .ctl button:hover{border-color:var(--violet);color:var(--violet)}
  .ctl a{margin-left:auto;color:var(--teal);text-decoration:none}
  .ctl a:hover{color:var(--violet)}
  .legend{display:flex;gap:1.2rem;font-size:.82rem}
  .legend i{font-style:normal;color:var(--ink-faint)}
  .legend .in::before{content:"▼ ";color:var(--violet)}
  .legend .out::before{content:"▲ ";color:var(--teal)}
  main{margin-top:1.2rem;display:flex;flex-direction:column;gap:.8rem}
  .empty{border:1px dashed var(--line);border-radius:16px;padding:2.8rem;
    text-align:center;color:var(--ink-faint);font-size:1rem}
  .empty a{color:var(--teal)}
  .ev{border:1px solid var(--line);border-radius:14px;
    background:var(--glass);backdrop-filter:blur(10px);overflow:hidden;
    animation:rise .4s ease both}
  @keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  .ev .h{display:flex;gap:.8rem;align-items:center;padding:.6rem 1.1rem;
    font-family:var(--mono);font-size:.82rem;letter-spacing:.06em;
    border-bottom:1px solid var(--line-soft)}
  .ev.in{border-left:3px solid var(--violet)}
  .ev.out{border-left:3px solid var(--teal)}
  /* Colour outbound responses by status: green = 2xx/3xx, red = 4xx/5xx.
     Inbound stays violet; outbound body chunks with no status line keep
     the neutral teal. */
  .ev.out.ok{border-left-color:var(--ok,#54e0a8)}
  .ev.out.err{border-left-color:var(--pink)}
  .tag{font-weight:700;letter-spacing:.14em}
  .ev.in .tag{color:var(--violet)} .ev.out .tag{color:var(--teal)}
  .ev.out.ok .tag{color:var(--ok,#54e0a8)}
  .ev.out.err .tag{color:var(--pink)}
  .code{font-family:var(--mono);font-weight:700;font-size:.78rem;
    padding:.08rem .45rem;border-radius:5px;letter-spacing:.02em}
  .ev.out.ok .code{color:#0a1f16;background:var(--ok,#54e0a8)}
  .ev.out.err .code{color:#2a0a12;background:var(--pink)}
  .meta{color:var(--ink-faint);margin-left:auto}
  .replay{font-family:var(--mono);font-size:.78rem;font-weight:700;
    letter-spacing:.06em;color:var(--amber, #ffce73);
    border:1px solid currentColor;background:transparent;
    padding:.25rem .7rem;border-radius:6px;cursor:pointer;margin-left:.6rem}
  .replay:hover{background:rgba(255,206,115,.12)}
  .replay:disabled{opacity:.4;cursor:default}
  pre{font-family:var(--mono);padding:1rem 1.1rem;font-size:.92rem;
    line-height:1.6;white-space:pre-wrap;word-break:break-all;
    color:var(--ink);max-height:340px;overflow:auto;background:rgba(0,0,0,.3)}

  /* Protocol Lab */
  .lab{margin-top:1rem;border:1px solid rgba(255,206,115,.35);border-radius:14px;
    background:linear-gradient(180deg,rgba(255,206,115,.06),rgba(255,255,255,.02));
    padding:1rem 1.2rem}
  .lab-h{font-family:var(--mono);font-size:.82rem;color:var(--amber);
    letter-spacing:.04em;margin-bottom:.7rem}
  .lab-presets{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;
    font-family:var(--mono);font-size:.78rem;color:var(--ink-faint);
    margin-bottom:.7rem}
  .lab-presets button{font-family:var(--mono);font-size:.76rem;cursor:pointer;
    color:var(--ink);background:rgba(255,255,255,.05);
    border:1px solid var(--line);border-radius:7px;padding:.3rem .65rem}
  .lab-presets button:hover{border-color:var(--amber);color:var(--amber)}
  #labBytes{width:100%;min-height:9.5rem;resize:vertical;
    font-family:var(--mono);font-size:.86rem;line-height:1.55;
    color:var(--ink);background:rgba(0,0,0,.35);border:1px solid var(--line);
    border-radius:10px;padding:.8rem .95rem;white-space:pre;overflow:auto}
  #labBytes:focus{outline:none;border-color:var(--amber);
    box-shadow:0 0 0 3px rgba(255,206,115,.18)}
  .lab-foot{display:flex;align-items:center;gap:.9rem;margin-top:.7rem;
    flex-wrap:wrap}
  #labSend{font-family:var(--sans);font-weight:800;font-size:.86rem;
    color:#231400;border:none;border-radius:8px;padding:.5rem 1.2rem;
    cursor:pointer;background:linear-gradient(120deg,#ffce73,#ffb14e);
    box-shadow:0 8px 22px -10px rgba(255,177,78,.7)}
  #labSend:hover{filter:brightness(1.06)}
  .lab-hint{font-size:.74rem;color:var(--ink-faint)}
  .lab-hint code{font-family:var(--mono);color:var(--amber);
    background:rgba(255,206,115,.12);padding:.05rem .3rem;border-radius:3px}
</style>
</head>
<body>
<div class="frame">
  <header>
    <span class="led"></span>
    <div>
      <h1>Wire Inspector</h1>
      <div class="sub">raw bytes on the socket — live</div>
    </div>
    <span id="conn" class="conn wait" title="SSE stream status">
      <span class="pip"></span><span id="connlabel">connecting</span></span>
    <div class="stamp">fs-forge<br>substrate: node:net<br>SSE live feed</div>
  </header>
  <div class="ctl">
    <div class="legend"><i class="in">inbound (client → server)</i>
      <i class="out">outbound (server → client)</i></div>
    <label title="Show the framework's own page/asset/SSE traffic too">
      <input type="checkbox" id="showfw"> show framework traffic</label>
    <label><input type="checkbox" id="hex"> hex view</label>
    <button id="pause" title="Freeze the feed while you read; new events queue and apply when you unpause">⏸ pause</button>
    <button id="clear">clear</button>
    <button id="labToggle" title="Hand-craft raw HTTP bytes and fire them at the server">🧪 protocol lab</button>
    <a href="/forge">← back to console</a>
  </div>

  <!-- Protocol Lab: edit raw bytes and fire them through the real net
       server. Presets craft deliberately malformed requests so you can
       watch the from-scratch parser accept or reject them, live. -->
  <section id="lab" class="lab" style="display:none">
    <div class="lab-h">
      🧪 PROTOCOL LAB — edit the raw bytes, hit Send, watch the parser react below
    </div>
    <div class="lab-presets">
      <span>presets:</span>
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
      <span class="lab-hint">Use <code>\\r\\n</code> mentally — the textarea
      uses real newlines; the framework normalizes them to CRLF on send.</span>
    </div>
  </section>

  <main id="log">
    <div class="empty">Awaiting traffic… open the
      <a href="/forge">API console</a> in another tab and send a request —
      the bytes will appear here in real time.</div>
  </main>
</div>
<script>
  const log=document.getElementById('log');
  const hex=document.getElementById('hex');
  const showfw=document.getElementById('showfw');
  const EMPTY='<div class="empty">Awaiting traffic… open the '+
    '<a href="/forge">API console</a> in another tab and send a request — '+
    'the bytes will appear here in real time.</div>';
  let events=[];           // every event received, unfiltered
  const t=ts=>new Date(ts).toISOString().slice(11,23);

  function visible(e){ return showfw.checked || e.scope!=='framework'; }

  // An event is replayable only if it's an inbound HTTP request we
  // captured — replaying our own response bytes would be nonsense.
  function isReplayable(e){
    return e.direction==='in' &&
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\\s+\\S+\\s+HTTP\\/1\\.[01]/.test(e.text);
  }

  // For an outbound response, pull the status code out of the status line
  // ("HTTP/1.1 404 Not Found") so we can colour success vs error.
  function statusOf(e){
    if(e.direction!=='out') return null;
    const m=e.text.match(/^HTTP\\/1\\.[01]\\s+(\\d{3})/);
    return m?Number(m[1]):null;
  }

  function node(e){
    const dir=e.direction==='in'?'in':'out';
    const arrow=dir==='in'?'▼ INBOUND':'▲ OUTBOUND';
    const code=statusOf(e);
    // out responses: green for <400, red for >=400. Headerless body
    // chunks (no status line) inherit the neutral outbound colour.
    const tone=code===null?'':(code>=400?' err':' ok');
    const codeTag=code!==null
      ? ' <span class="code">'+code+'</span>' : '';
    const fw=e.scope==='framework'
      ? ' <span style="color:var(--ink-faint)">· framework</span>' : '';
    const replay=isReplayable(e)
      ? '<button class="replay" data-seq="'+e.seq+'" title="Re-fire these exact bytes via a fresh TCP connection back to the server">↻ REPLAY</button>'
      : '';
    const el=document.createElement('div');
    el.className='ev '+dir+tone;
    el.innerHTML='<div class="h"><span class="tag">'+arrow+'</span>'+codeTag+
      '<span class="meta">conn #'+e.connId+' · '+e.bytes+' B'+
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

  // "Follow tail" pattern: auto-scroll new events into view ONLY when the
  // user is already near the bottom. If they've scrolled up to read,
  // leave them be — otherwise the next event would yank them back down.
  function nearBottom(){
    const doc=document.documentElement;
    return (doc.scrollHeight - window.scrollY - window.innerHeight) < 120;
  }
  function scrollIfFollowing(){
    if(nearBottom()) window.scrollTo({top:document.documentElement.scrollHeight});
  }

  function render(){
    const wasFollowing=nearBottom();
    const shown=events.filter(visible);
    if(!shown.length){ log.innerHTML=EMPTY; return; }
    log.innerHTML='';
    shown.forEach(e=>log.appendChild(node(e)));
    if(wasFollowing) window.scrollTo({top:document.documentElement.scrollHeight});
  }

  let paused=false;
  let queued=[];
  const pauseBtn=document.getElementById('pause');
  function setPaused(p){
    paused=p;
    pauseBtn.textContent=p?('▶ resume'+(queued.length?' ('+queued.length+')':'')):'⏸ pause';
    pauseBtn.style.color=p?'var(--amber)':'';
    if(!p && queued.length){
      const drain=queued; queued=[];
      drain.forEach(addLive);
    }
  }
  pauseBtn.onclick=()=>setPaused(!paused);

  let lastSeq=0;
  function add(e){
    // Guard against any duplicate the server might re-send across a
    // reconnect — only ever append strictly newer events.
    if(e.seq<=lastSeq) return;
    lastSeq=e.seq;
    if(paused){
      queued.push(e);
      pauseBtn.textContent='▶ resume ('+queued.length+')';
      // Still keep duplicate-guard sane: don't store dups.
      if(queued.length>800) queued.shift();
      return;
    }
    return addLive(e);
  }
  function addLive(e){
    events.push(e);
    if(events.length>400) events.shift();
    if(!visible(e)) return;
    if(log.querySelector('.empty')) log.innerHTML='';
    const wasFollowing=nearBottom();
    const el=node(e);
    log.appendChild(el);
    if(wasFollowing) el.scrollIntoView({block:'end',behavior:'smooth'});
  }

  showfw.onchange=render;
  hex.onchange=render;
  document.getElementById('clear').onclick=()=>{
    queued=[];
    // Refresh the pause button label (drops the stale "(N)" counter).
    if(paused) pauseBtn.textContent='▶ resume';
    events=[]; log.innerHTML='<div class="empty">Cleared. Awaiting traffic…</div>';
  };
  const connEl=document.getElementById('conn');
  const connLabel=document.getElementById('connlabel');
  function setConn(state, label){
    connEl.className='conn '+state;
    connLabel.textContent=label;
  }
  // Primary: SSE. Fallback: poll /_inspect/snapshot every 1.2s. If SSE
  // doesn't establish within 3s (extension/proxy blocked it, etc.), we
  // tear it down and switch to polling so the page still works.
  let mode=null; // 'sse' | 'poll'
  let pollTimer=null;
  let pollSince=0;

  function startPolling(reason){
    if(mode==='poll') return;
    mode='poll';
    setConn('wait','LIVE (polling · '+reason+')');
    async function tick(){
      try{
        const r=await fetch('/_inspect/snapshot?since='+pollSince);
        const { events:list }=await r.json();
        if(list && list.length){
          for(const e of list) add(e);
          pollSince=Math.max(pollSince, list[list.length-1].seq);
        }
        setConn('wait','LIVE (polling)');
      }catch{
        setConn('bad','polling failed');
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
    setConn('','LIVE (SSE)');
  }
  es.onopen=promoteToSSE;
  // The server sends a "hello" event immediately as a connection probe;
  // it is our most reliable signal that SSE is actually working.
  es.addEventListener('hello', promoteToSSE);
  es.onerror=()=>{
    if(mode==='sse'){ setConn('bad','SSE dropped — falling back'); }
    try{es.close();}catch{}
    startPolling('SSE error');
  };
  es.onmessage=m=>{
    if(mode!=='sse'){ mode='sse'; clearTimeout(sseTimer); setConn('','LIVE (SSE)'); }
    try{ const e=JSON.parse(m.data); add(e); pollSince=Math.max(pollSince,e.seq); }catch{}
  };

  // ---- Protocol Lab ---------------------------------------------------
  // Edit raw HTTP bytes (or pick a preset) and fire them at the real
  // server. The textarea uses ordinary newlines for editability; we
  // normalize to CRLF before sending so it's wire-correct. The bytes go
  // as the body of POST /_inspect/send and are fired verbatim — malformed
  // input is the point, so the server does not validate them.
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
    // Normalize editor newlines to CRLF so what we send is wire-correct.
    const raw=labBytes.value.replace(/\\r\\n/g,'\\n').replace(/\\n/g,'\\r\\n');
    try{
      const r=await fetch('/_inspect/send',{
        method:'POST',
        headers:{'Content-Type':'application/octet-stream'},
        body:raw,
      });
      setConn(r.ok?'':'bad', r.ok?'LIVE (SSE) · sent '+raw.length+'B':'send failed');
      // The fired bytes hit /api/* paths (app scope), so they show in the
      // default view — no need to flip the "show framework" filter.
    }catch{ setConn('bad','send failed'); }
  };
</script>
</body>
</html>`;
