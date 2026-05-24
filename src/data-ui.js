'use strict';

// The /_data page — a framework-GENERATED data explorer.
//
// It reads /_routes (the live introspection endpoint), groups routes that
// have a `list` hint together with the sibling route that has `item` /
// `update` / `remove` hints on its :id path, and renders a table per
// collection with inline action buttons whose set is derived from the
// available hints. There is no hardcoded knowledge of "users" or any other
// resource — drop a new pair of routes with the right hints and the
// explorer picks them up on the next refresh.
//
// Pair this view with /_inspect: every action you take here flies past
// the Wire Inspector as real HTTP bytes.
//
// NOTE: this file is a JS template literal so it must contain NO ${...}.

module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>fs-forge · data explorer</title>
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
    --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
    --sans:"Manrope",system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--sans);color:var(--ink);background:var(--bg);
    min-height:100vh;-webkit-font-smoothing:antialiased;
    position:relative;overflow-x:hidden}
  body::before{content:"";position:fixed;inset:-30%;z-index:0;
    pointer-events:none;background:
      radial-gradient(38% 38% at 16% 14%, rgba(120,90,255,.28), transparent 70%),
      radial-gradient(34% 34% at 84% 22%, rgba(0,210,185,.20), transparent 70%),
      radial-gradient(44% 44% at 60% 96%, rgba(255,90,170,.14), transparent 70%);
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
  .stamp{font-family:var(--mono);font-size:.74rem;letter-spacing:.18em;
    text-transform:uppercase;color:var(--ink-faint);margin-left:auto;
    text-align:right;line-height:1.8}

  .tip{margin-top:1rem;color:var(--ink-faint);font-size:.95rem;line-height:1.6}
  .tip a{color:var(--teal);text-decoration:none}
  .tip a:hover{color:var(--violet)}

  .collection{margin-top:1.4rem;border:1px solid var(--line);border-radius:18px;
    background:var(--glass);backdrop-filter:blur(14px);overflow:hidden}
  .ch{display:flex;align-items:center;gap:.8rem;padding:1rem 1.3rem;
    border-bottom:1px solid var(--line-soft)}
  .ch .name{font-weight:800;font-size:1.2rem}
  .ch .path{font-family:var(--mono);font-size:.88rem;color:var(--ink-faint)}
  .ch .count{margin-left:auto;font-family:var(--mono);font-size:.85rem;
    color:var(--ink-faint)}
  .ch .actions{margin-left:.8rem;display:flex;gap:.45rem}

  table{width:100%;border-collapse:collapse;font-size:1rem}
  th,td{padding:.75rem 1rem;text-align:left;border-bottom:1px solid var(--line-soft);
    vertical-align:top}
  th{font-family:var(--mono);font-size:.78rem;letter-spacing:.14em;
    text-transform:uppercase;color:var(--ink-faint);font-weight:600}
  td.cell{font-family:var(--mono);font-size:.96rem;color:var(--ink);
    max-width:28ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  td.id{color:var(--violet);font-weight:700}
  td.edit{cursor:text;border-bottom:1px dashed var(--line-soft);
    transition:background .15s,border-color .15s}
  td.edit:hover{background:rgba(167,139,255,.07);
    border-bottom-color:rgba(167,139,255,.45)}
  td.editing{background:rgba(255,206,115,.10);outline:none;
    border-bottom:1px solid var(--amber);
    box-shadow:inset 0 0 0 1px rgba(255,206,115,.25);
    white-space:normal;overflow:visible;text-overflow:clip;max-width:none}
  td.acts{text-align:right;white-space:nowrap}
  .empty-row td{color:var(--ink-faint);font-style:italic;text-align:center;padding:1.4rem}
  tr.row-flash{animation:flash 1.2s ease-out}
  @keyframes flash{0%{background:rgba(95,227,200,.18)}100%{background:transparent}}
  tr.row-die{animation:die .55s ease-out forwards}
  @keyframes die{to{background:rgba(255,111,174,.15);opacity:0;transform:translateX(8px)}}

  .btn{font-family:var(--mono);font-size:.82rem;font-weight:700;
    letter-spacing:.04em;border:1px solid currentColor;background:transparent;
    padding:.4rem .8rem;border-radius:6px;cursor:pointer;margin-left:.35rem}
  .btn.get{color:var(--teal)}
  .btn.put{color:var(--amber)}
  .btn.del{color:var(--pink)}
  .btn.add{color:var(--violet)}
  .btn.addf{color:var(--amber)}
  .btn:hover{background:rgba(255,255,255,.06)}

  .editor{padding:.6rem .9rem;background:rgba(0,0,0,.3);
    border-top:1px dashed var(--line-soft)}
  .editor input{font-family:var(--mono);font-size:.82rem;
    background:rgba(255,255,255,.04);color:var(--ink);
    border:1px solid var(--line);border-radius:6px;padding:.45rem .65rem;
    margin-right:.4rem}
  .editor input:focus{outline:none;border-color:var(--violet);
    box-shadow:0 0 0 3px rgba(167,139,255,.2)}

  .toast{position:fixed;left:50%;bottom:1.6rem;transform:translateX(-50%);
    background:rgba(10,16,30,.92);border:1px solid var(--line);
    border-radius:999px;padding:.7rem 1.3rem;font-family:var(--mono);
    font-size:.92rem;color:var(--ink);backdrop-filter:blur(12px);
    box-shadow:0 18px 40px -16px rgba(0,0,0,.6);opacity:0;
    transition:opacity .25s,transform .25s;pointer-events:none;z-index:9}
  .toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
  .toast.ok{border-color:rgba(95,227,200,.5)}
  .toast.err{border-color:rgba(255,111,174,.6)}

  .empty-page{padding:3rem;text-align:center;color:var(--ink-faint);
    border:1px dashed var(--line);border-radius:18px;margin-top:1.4rem;
    font-size:1rem;line-height:1.7}
  .empty-page code{font-family:var(--mono);color:var(--violet);
    background:rgba(167,139,255,.12);padding:.12rem .45rem;border-radius:4px}

  footer{margin-top:2.6rem;border-top:1px solid var(--line-soft);
    padding-top:1.2rem;color:var(--ink-faint);font-size:.92rem;line-height:1.7}
  footer a{color:var(--teal);text-decoration:none}
</style>
</head>
<body>
<div class="frame">
  <header>
    <span class="led"></span>
    <div>
      <h1>Data Explorer</h1>
      <div class="sub">resources auto-discovered from <code style="font-family:var(--mono);color:var(--violet)">routes/</code> · reactive across tabs · backed by JSON</div>
    </div>
    <div class="stamp">fs-forge<br>backed by data.json<br>generated from DSL hints</div>
  </header>
  <div class="tip">
    <b style="color:var(--ink)">How to use:</b>
    click any cell to <b style="color:var(--amber)">edit (PUT)</b> ·
    click <b style="color:var(--pink)">DEL</b> to remove ·
    click <b style="color:var(--violet)">+ POST</b> on a collection to create.
    <br>Open <a href="/_data" target="_blank">/_data</a> in another tab —
    every change syncs live. Open the
    <a href="/_inspect" target="_blank">Wire Inspector</a> to see the raw
    HTTP for every action.
  </div>
  <main id="root"></main>
  <footer>
    <a href="/forge">← framework</a> · <a href="/_inspect">/_inspect</a>
    · <a href="/_routes">/_routes</a>
  </footer>
</div>
<div id="toast" class="toast"></div>

<script>
  const root=document.getElementById('root');
  const toastEl=document.getElementById('toast');
  let toastTimer;
  function toast(msg, kind){
    toastEl.textContent=msg;
    toastEl.className='toast show '+(kind||'');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toastEl.className='toast',2000);
  }

  // --- discover collections from /_routes hints --------------------------
  async function discover(){
    const r=await fetch('/_routes');
    const { routes } = await r.json();
    const lists=routes.filter(rt=>rt.hints&&(rt.hints.GET==='list'||rt.hints.POST==='create'));
    return lists.map(list=>{
      // find the sibling :id route
      const itemPath=list.path.replace(/\\/?$/,'')+'/:id';
      const item=routes.find(rt=>rt.path===itemPath)||null;
      return { list, item };
    });
  }

  // --- render --------------------------------------------------------------
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

    const body=document.createElement('div');
    wrap.appendChild(body);
    root.appendChild(wrap);
    await refreshRows(list,item,wrap,name);
  }

  async function refreshRows(list,item,wrap,name){
    const body=wrap.querySelector('table')||document.createElement('div');
    const res=await fetch(list.path);
    const data=await res.json();
    const rows=Array.isArray(data)?data:[];
    wrap.querySelector('#count-'+name).textContent=rows.length+' row'+(rows.length===1?'':'s');

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
      if(item.hints.PUT==='update')
        acts.push('<button class="btn addf" data-act="addfield" data-id="'+r.id+'" title="Add a new field to this row (PUT)">+ field</button>');
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
    // Inline edit: click a cell, type, Enter to commit (PUT), Esc to cancel.
    wrap.querySelectorAll('td.edit').forEach(td=>{
      td.onclick=()=>beginEdit(td,list,item,wrap,name);
      td.onkeydown=(e)=>{if(e.key==='Enter'){e.preventDefault();beginEdit(td,list,item,wrap,name);}};
    });
  }

  function beginEdit(td,list,item,wrap,name){
    if(td.isContentEditable) return; // already editing
    const original=td.textContent;
    const field=td.dataset.field;
    const id=td.parentNode.dataset.id;
    td.contentEditable='true';
    td.classList.add('editing');
    td.focus();
    // place caret at end
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
    if(act==='addfield'){
      // Add an arbitrary new field to this row. The route's PUT[update]
      // merges any query field into the record, so this is generic — it
      // works for users (age, email…), posts, or any future collection.
      const field=prompt('New field name? (e.g. age, email, city)');
      if(!field) return;
      const key=field.trim();
      if(!key || key==='id'){ toast('invalid field name','err'); return; }
      const val=prompt('Value for "'+key+'"?');
      if(val===null) return;
      const url=itemUrl+'?'+encodeURIComponent(key)+'='+encodeURIComponent(val);
      const r=await fetch(url,{method:'PUT'});
      toast('PUT '+key+' → '+r.status, r.ok?'ok':'err');
      await refreshRows(list,item,wrap,name);
      const row=wrap.querySelector('tr[data-id="'+CSS.escape(id)+'"]');
      if(row) row.classList.add('row-flash');
      return;
    }
  }

  // Pick the first non-id field the new row should carry. Uses the
  // existing rows' shape if any; falls back to "name".
  // Best-effort: pick the most-likely "primary" field for a collection by
  // inspecting an existing row (e.g. users → "name", posts → "title").
  // Falls back to "name" when the collection is empty.
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

  // POST a new row. The posts collection is special: its server-side
  // route enforces the same gate as the landing-page Wall — only an
  // author that already exists in the users collection may post. So
  // when creating a post we ask for BOTH title and author and forward
  // whatever the server says (201 → flash; 403 → toast with the hint).
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
      // Surface the server's hint (e.g. "unknown author") so it doesn't
      // just look like a silent failure.
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

  // Cache item-route lookup for the "+ POST" handler to refresh correctly.
  (async()=>{
    const cols=await discover();
    window._cols={};
    cols.forEach(c=>window._cols[collectionName(c.list.path)]=c);
    await render();
    subscribeToChanges();
  })();

  // --- Reactive sync ----------------------------------------------------
  // Open two tabs at /_data, change anything in one, and it appears in
  // the other in real time. The framework's store emits change events;
  // the dispatcher streams them over SSE; every open Data Explorer tab
  // refreshes the affected collection's table when one arrives.
  function subscribeToChanges(){
    if(!window.EventSource) return;
    const es=new EventSource('/_data/events');
    es.addEventListener('hello', ()=>{
      // Just a connection probe — nothing to do.
    });
    es.onmessage=async(m)=>{
      let evt; try{ evt=JSON.parse(m.data); }catch{ return; }
      if(!evt || !evt.collection) return;
      const c=window._cols[evt.collection];
      if(!c) return;
      const wrap=document.querySelector('section.collection [id="count-'+evt.collection+'"]')
        && document.querySelector('section.collection [id="count-'+evt.collection+'"]').closest('section.collection');
      if(!wrap) return;
      await refreshRows(c.list, c.item, wrap, evt.collection);
      // Flash the changed row (insert/update) or briefly highlight that
      // a removal happened (the row is already gone after refresh).
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
</html>`;
