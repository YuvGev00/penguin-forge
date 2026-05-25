// Outside / public rooms: Plaza, Café, Arcade — Club Penguin-flavored
// 1200×720 SVG mockups. Each room respects the world.js gameplay zones:
//   - doors at fixed positions (side panels x:0..64 / 1136..1200, y:290..440)
//   - the Plaza's "soft" university entry at x:552..648 y:392..542
//   - the Arcade's cabinet zones at x:175,y:360 and x:895,y:360 (w:130 h:150)
//
// Colors come from a `p` palette object so the Tweaks panel can swap them.

// ───────── helpers ─────────
function Door({ x, y, w = 64, h = 150, label, palette: p, accent }) {
  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g>
      {/* warm halo behind the door */}
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx="22"
        fill={accent || p.amberSoft} opacity="0.55" />
      {/* door body */}
      <rect x={x} y={y} width={w} height={h} rx="14"
        fill={p.wood} stroke={p.woodDark} strokeWidth="3" />
      {/* top highlight */}
      <rect x={x + 8} y={y + 4} width={w - 16} height="3" rx="1.5"
        fill="rgba(255,255,255,0.35)" />
      {/* doorknob */}
      <circle cx={x + w - 14} cy={cy} r="3.5" fill={p.amber} />
      {/* contact shadow */}
      <ellipse cx={cx} cy={y + h + 6} rx={w * 0.42} ry="4" fill="rgba(0,0,0,0.2)" />
      {/* label */}
      <text x={cx} y={cy + 5} textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="13"
        fill="#fff" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.6))' }}>
        {label}
      </text>
    </g>
  );
}

function PineTree({ x, y, s = 1, palette: p }) {
  const dark = p.pineDark || '#2e5a3f';
  const lit = p.pine || '#4a8a5e';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-6" y="0" width="12" height="20" fill="#5a3b22" />
      {[0, -26, -52].map((dy, i) => {
        const w = 50 - i * 12;
        return (
          <g key={i}>
            <path d={`M 0 ${dy - 44} L ${-w} ${dy} L ${w} ${dy} Z`} fill={dark} />
            <path d={`M 0 ${dy - 44} L ${-w * 0.7} ${dy - 10} L ${w * 0.4} ${dy - 14} L 0 ${dy - 30} Z`} fill={lit} opacity="0.7" />
            {/* snow cap */}
            <path d={`M 0 ${dy - 40} L ${-w * 0.35} ${dy - 18} L ${w * 0.35} ${dy - 18} Z`} fill="#fff" opacity="0.95" />
          </g>
        );
      })}
    </g>
  );
}

function Snowman({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="22" ry="6" fill="rgba(0,0,0,0.15)" />
      <circle cx="0" cy="0" r="20" fill="#fff" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <circle cx="0" cy="-30" r="15" fill="#fff" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <circle cx="0" cy="-54" r="11" fill="#fff" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <circle cx="-4" cy="-56" r="1.6" fill="#1a1a1a" />
      <circle cx="4" cy="-56" r="1.6" fill="#1a1a1a" />
      <path d="M 0 -52 L 12 -50 L 0 -49 Z" fill="#ff8a1e" />
      {/* scarf */}
      <rect x="-13" y="-44" width="26" height="6" rx="2" fill="#e23636" />
      <rect x="-2" y="-40" width="6" height="10" rx="2" fill="#c01919" />
      {/* stick arms */}
      <line x1="-15" y1="-25" x2="-32" y2="-35" stroke="#6a4a2a" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="-25" x2="32" y2="-35" stroke="#6a4a2a" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Igloo({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="8" rx="68" ry="9" fill="rgba(0,0,0,0.18)" />
      <path d="M -60 0 A 60 60 0 0 1 60 0 Z" fill="#e6effa" stroke="#b6c8de" strokeWidth="2" />
      {/* brick seams */}
      <path d="M -60 0 A 60 60 0 0 1 60 0" fill="none" stroke="rgba(120,150,180,0.5)" strokeWidth="1.5" />
      <path d="M -45 -30 A 45 45 0 0 1 45 -30" fill="none" stroke="rgba(120,150,180,0.5)" strokeWidth="1.5" />
      <line x1="-40" y1="-46" x2="-30" y2="0" stroke="rgba(120,150,180,0.5)" strokeWidth="1.5" />
      <line x1="0" y1="-60" x2="0" y2="-30" stroke="rgba(120,150,180,0.5)" strokeWidth="1.5" />
      <line x1="40" y1="-46" x2="30" y2="0" stroke="rgba(120,150,180,0.5)" strokeWidth="1.5" />
      {/* entry tunnel */}
      <path d="M 18 0 A 22 22 0 0 1 62 0 Z" fill="#dfe9f5" stroke="#b6c8de" strokeWidth="2" />
      <path d="M 22 0 A 18 18 0 0 1 58 0 Z" fill="#0e1a2e" />
    </g>
  );
}

function Lamppost({ x, y, palette: p }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-3" y="-150" width="6" height="150" fill="#3a3a45" />
      <rect x="-12" y="0" width="24" height="8" rx="2" fill="#3a3a45" />
      {/* lantern */}
      <path d="M -10 -158 L 10 -158 L 8 -148 L -8 -148 Z" fill="#2a2a35" />
      <circle cx="0" cy="-156" r="9" fill={p.amber} />
      <circle cx="0" cy="-156" r="9" fill="url(#lamp-halo)" />
      {/* halo */}
      <circle cx="0" cy="-156" r="55" fill={p.amberSoft} opacity="0.45" />
    </g>
  );
}

function GothicFacade({ cx, topY, fw, fh, palette: p }) {
  const L = cx - fw / 2, Rt = cx + fw / 2, B = topY + fh;
  const stone = p.stone, stoneDark = p.stoneDark;
  // a slightly darker tone for shadowed faces, and a lighter sun-side tone
  const stoneShade = `color-mix(in oklab, ${stoneDark} 65%, #000)`;
  const stoneLight = `color-mix(in oklab, ${stone} 80%, #fff)`;
  const ROOF = stoneDark;
  // central nave width
  const NW = Math.min(260, fw - 120);
  const NL = cx - NW / 2, NR = cx + NW / 2;
  return (
    <g>
      {/* ── flying buttresses (under everything) ───────────── */}
      {[L - 60, Rt + 20].map((bx, i) => (
        <g key={i} opacity="0.85">
          <path d={`M ${bx} ${B - 20}
                    L ${bx + (i === 0 ? 20 : -20)} ${topY + 100}
                    L ${bx + (i === 0 ? 28 : -28)} ${topY + 110}
                    L ${bx + (i === 0 ? 8 : -8)} ${B - 10} Z`}
            fill={stoneShade} />
        </g>
      ))}

      {/* ── main facade block ─────────────────────────────── */}
      <rect x={L} y={topY + 30} width={fw} height={fh - 30} fill={stone} />
      <rect x={L} y={topY + 30} width={fw} height={fh - 30} fill="url(#stone-shade)" />
      {/* horizontal block courses */}
      <g stroke={stoneShade} strokeWidth="1" fill="none" opacity="0.4">
        {[80, 150, 220, 290, 360, 430].map(d =>
          d < fh - 30 ? <line key={d} x1={L} y1={topY + 30 + d} x2={Rt} y2={topY + 30 + d} /> : null
        )}
      </g>
      {/* light side of nave */}
      <rect x={NL} y={topY + 30} width={NW * 0.4} height={fh - 30} fill={stoneLight} opacity="0.18" />

      {/* ── central nave with steep pitched roof ───────────── */}
      <path d={`M ${NL - 8} ${topY + 30}
                L ${cx} ${topY - 80}
                L ${NR + 8} ${topY + 30} Z`} fill={ROOF} />
      {/* roof shading + ridge highlight */}
      <path d={`M ${NL - 8} ${topY + 30} L ${cx} ${topY - 80} L ${cx} ${topY + 30} Z`}
        fill="rgba(0,0,0,0.18)" />
      <line x1={cx} y1={topY - 78} x2={cx} y2={topY + 30} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* snow on roof */}
      <path d={`M ${NL - 4} ${topY + 32}
                Q ${cx - 60} ${topY - 24} ${cx} ${topY - 70}
                Q ${cx + 60} ${topY - 24} ${NR + 4} ${topY + 32}
                Q ${cx + 40} ${topY + 10} ${cx} ${topY - 4}
                Q ${cx - 40} ${topY + 10} ${NL - 4} ${topY + 32} Z`}
        fill="#eef3f9" opacity="0.9" />
      {/* central spire on the ridge */}
      <path d={`M ${cx} ${topY - 80} L ${cx - 5} ${topY - 130} L ${cx + 5} ${topY - 130} Z`} fill={stoneDark} />
      <path d={`M ${cx} ${topY - 130} L ${cx - 4} ${topY - 144} L ${cx + 4} ${topY - 144} Z`} fill={stoneDark} />
      <circle cx={cx} cy={topY - 148} r="2.5" fill={p.amber} />
      <circle cx={cx} cy={topY - 148} r="9" fill={p.amber} opacity="0.5" />

      {/* ── crenellation row on the side wings ─────────────── */}
      {Array.from({ length: Math.floor(fw / 26) }, (_, i) => {
        const x = L + i * 26;
        // skip the area under the nave roof
        if (x > NL - 10 && x < NR - 10) return null;
        return (
          <g key={i}>
            <rect x={x} y={topY + 18} width="16" height="16" fill={stoneDark} />
            {/* tiny snow cap on each crenellation */}
            <rect x={x} y={topY + 16} width="16" height="3" fill="#eef3f9" opacity="0.9" />
          </g>
        );
      })}

      {/* ── side towers ────────────────────────────────────── */}
      {[L - 30, Rt - 14].map((tx, i) => (
        <g key={i}>
          {/* base */}
          <rect x={tx} y={topY - 20} width="44" height={fh + 20} fill={stone} />
          <rect x={tx} y={topY - 20} width="44" height={fh + 20} fill="url(#stone-shade)" />
          {/* belt course */}
          <rect x={tx - 4} y={topY - 26} width="52" height="6" fill={stoneDark} />
          <rect x={tx - 6} y={topY + 60} width="56" height="4" fill={stoneDark} opacity="0.55" />
          <rect x={tx - 6} y={topY + 200} width="56" height="4" fill={stoneDark} opacity="0.55" />
          {/* taller, sharper spire */}
          <path d={`M ${tx - 8} ${topY - 26} L ${tx + 22} ${topY - 96} L ${tx + 52} ${topY - 26} Z`} fill={stoneDark} />
          {/* spire shading */}
          <path d={`M ${tx - 8} ${topY - 26} L ${tx + 22} ${topY - 96} L ${tx + 22} ${topY - 26} Z`}
            fill="rgba(0,0,0,0.22)" />
          {/* snow on spire */}
          <path d={`M ${tx - 6} ${topY - 28} Q ${tx + 22} ${topY - 88} ${tx + 50} ${topY - 28}
                    Q ${tx + 30} ${topY - 36} ${tx + 22} ${topY - 50}
                    Q ${tx + 14} ${topY - 36} ${tx - 6} ${topY - 28} Z`}
            fill="#eef3f9" opacity="0.85" />
          {/* finial */}
          <path d={`M ${tx + 22} ${topY - 104} L ${tx + 18} ${topY - 116} L ${tx + 26} ${topY - 116} Z`}
            fill={stoneDark} />
          <circle cx={tx + 22} cy={topY - 120} r="2.5" fill={p.amber} />
          <circle cx={tx + 22} cy={topY - 120} r="8" fill={p.amber} opacity="0.55" />
          {/* corner pinnacles flanking the spire base */}
          {[-12, 56].map((px, k) => (
            <g key={k}>
              <rect x={tx + px - 2} y={topY - 38} width="4" height="14" fill={stoneDark} />
              <path d={`M ${tx + px - 4} ${topY - 38} L ${tx + px} ${topY - 50} L ${tx + px + 4} ${topY - 38} Z`}
                fill={stoneDark} />
            </g>
          ))}
          {/* lancet windows — taller, with tracery */}
          {[0, 1, 2, 3].map(k => {
            const wy = topY + 50 + k * 70;
            return (
              <g key={k}>
                {/* outer frame */}
                <path d={`M ${tx + 9} ${wy + 38}
                          L ${tx + 9} ${wy + 14}
                          Q ${tx + 22} ${wy - 16} ${tx + 35} ${wy + 14}
                          L ${tx + 35} ${wy + 38} Z`}
                  fill={stoneDark} />
                {/* glass */}
                <path d={`M ${tx + 12} ${wy + 36}
                          L ${tx + 12} ${wy + 16}
                          Q ${tx + 22} ${wy - 10} ${tx + 32} ${wy + 16}
                          L ${tx + 32} ${wy + 36} Z`}
                  fill={p.windowGlow} />
                {/* mullion (vertical) */}
                <line x1={tx + 22} y1={wy - 2} x2={tx + 22} y2={wy + 36} stroke={stoneDark} strokeWidth="1.4" />
                {/* transom (horizontal) */}
                <line x1={tx + 12} y1={wy + 22} x2={tx + 32} y2={wy + 22} stroke={stoneDark} strokeWidth="1.2" />
                {/* warm bloom */}
                <circle cx={tx + 22} cy={wy + 18} r="18" fill={p.amber} opacity="0.35" />
                {/* sill */}
                <rect x={tx + 9} y={wy + 36} width="26" height="3" fill={stoneDark} />
                {/* snow on sill */}
                <rect x={tx + 9} y={wy + 34} width="26" height="2" fill="#eef3f9" opacity="0.85" />
              </g>
            );
          })}
        </g>
      ))}

      {/* ── rose window with tracery ──────────────────────── */}
      <g>
        {/* stone frame */}
        <circle cx={cx} cy={topY + 90} r="42" fill={stoneDark} />
        <circle cx={cx} cy={topY + 90} r="36" fill={p.windowGlow} />
        {/* eight outer petal frames */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(a => {
          const ang = a * Math.PI / 4;
          const x1 = cx + 12 * Math.cos(ang), y1 = topY + 90 + 12 * Math.sin(ang);
          const x2 = cx + 36 * Math.cos(ang), y2 = topY + 90 + 36 * Math.sin(ang);
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stoneDark} strokeWidth="2.2" />;
        })}
        {/* inner ring */}
        <circle cx={cx} cy={topY + 90} r="12" fill={stoneDark} />
        <circle cx={cx} cy={topY + 90} r="8" fill={p.amber} opacity="0.95" />
        {/* outer ring shadow + halo */}
        <circle cx={cx} cy={topY + 90} r="42" fill="none" stroke={stoneShade} strokeWidth="1.2" opacity="0.6" />
        <circle cx={cx} cy={topY + 90} r="78" fill={p.amber} opacity="0.18" />
        {/* hooded drip stone over the rose */}
        <path d={`M ${cx - 50} ${topY + 90}
                  Q ${cx} ${topY + 30} ${cx + 50} ${topY + 90}`}
          stroke={stoneDark} strokeWidth="3" fill="none" />
      </g>

      {/* ── archway entrance ─────────────────────────────── */}
      {/* outer hood mold */}
      <path d="M 488 542 L 488 380 Q 600 280 712 380 L 712 542
               L 696 542 L 696 386 Q 600 296 504 386 L 504 542 Z"
        fill={stoneDark} />
      {/* outer arch */}
      <path d="M 504 542 L 504 386 Q 600 296 696 386 L 696 542 Z" fill={stoneShade} />
      {/* inner threshold */}
      <path d="M 552 542 L 552 426 Q 600 362 648 426 L 648 542 Z" fill="#1c1528" />
      {/* warm amber glow inside the archway */}
      <ellipse cx="600" cy="518" rx="60" ry="40" fill={p.amber} opacity="0.55" />
      <path d="M 552 542 L 552 426 Q 600 362 648 426 L 648 542 Z" fill="url(#arch-glow)" />
      {/* keystone */}
      <path d="M 593 360 L 607 360 L 604 376 L 596 376 Z" fill={stoneLight} />
      {/* arch voussoirs (radiating wedges) */}
      {[-60, -45, -30, -15, 15, 30, 45, 60].map((deg, i) => {
        const a = (deg * Math.PI) / 180 - Math.PI / 2;
        const inR = 64, outR = 86;
        const x1 = 600 + Math.cos(a) * inR, y1 = 426 + Math.sin(a) * inR;
        const x2 = 600 + Math.cos(a) * outR, y2 = 426 + Math.sin(a) * outR;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stoneShade} strokeWidth="1.4" />;
      })}
      {/* ENTER text */}
      <text x="600" y="528" textAnchor="middle" fontFamily="Georgia, serif"
        fontWeight="800" fontSize="15" fill="#fff5da">▲ ENTER</text>
      {/* flanking entrance lanterns */}
      {[-94, 94].map((dx, i) => (
        <g key={i} transform={`translate(${600 + dx} ${495})`}>
          <rect x="-1" y="-2" width="2" height="28" fill={stoneDark} />
          <path d="M -7 -16 L 7 -16 L 5 -4 L -5 -4 Z" fill={stoneDark} />
          <circle cx="0" cy="-10" r="3" fill={p.amber} />
          <circle cx="0" cy="-10" r="14" fill={p.amber} opacity="0.55" />
        </g>
      ))}

      {/* ── stone steps with side cheeks ─────────────────── */}
      <rect x="484" y="542" width="232" height="12" fill={p.stoneStep} />
      <rect x="468" y="554" width="264" height="14" fill={p.stoneStepLit} />
      <rect x="452" y="568" width="296" height="16" fill={p.stoneStep} />
      {/* mortar gaps */}
      <line x1="540" y1="542" x2="540" y2="568" stroke={stoneShade} strokeWidth="1" opacity="0.55" />
      <line x1="660" y1="542" x2="660" y2="568" stroke={stoneShade} strokeWidth="1" opacity="0.55" />
      <line x1="500" y1="554" x2="500" y2="584" stroke={stoneShade} strokeWidth="1" opacity="0.55" />
      <line x1="700" y1="554" x2="700" y2="584" stroke={stoneShade} strokeWidth="1" opacity="0.55" />

      {/* ── banner ────────────────────────────────────────── */}
      <rect x={cx - 80} y={topY + 158} width="160" height="34" fill="#a02830" stroke="#6e1c22" strokeWidth="2" />
      <path d={`M ${cx - 80} ${topY + 192} L ${cx - 70} ${topY + 202} L ${cx - 60} ${topY + 192} Z`} fill="#6e1c22" />
      <path d={`M ${cx + 60} ${topY + 192} L ${cx + 70} ${topY + 202} L ${cx + 80} ${topY + 192} Z`} fill="#6e1c22" />
      <rect x={cx - 80} y={topY + 158} width="160" height="3" fill="rgba(255,255,255,0.18)" />
      <text x={cx} y={topY + 180} textAnchor="middle" fontFamily="Georgia, serif"
        fontWeight="800" fontSize="14" fill="#fff5da" letterSpacing="2">UNIVERSITAS</text>
    </g>
  );
}

// ═════════════════════════════════════════════════════════════════
// PLAZA — the hub. Snow + mountains + university landmark.
// ═════════════════════════════════════════════════════════════════
function RoomPlaza({ palette: p }) {
  return (
    <svg viewBox="0 0 1200 720" width="1200" height="720" style={{ display: 'block', background: p.sky }}>
      <defs>
        <linearGradient id="plaza-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="0.5" stopColor={p.skyMid} />
          <stop offset="1" stopColor={p.skyBot} />
        </linearGradient>
        <linearGradient id="plaza-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.snowDeep} />
          <stop offset="1" stopColor={p.snowNear} />
        </linearGradient>
        <radialGradient id="lamp-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff5d6" stopOpacity="0.8" />
          <stop offset="1" stopColor={p.amber} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sun-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff5d6" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff5d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stone-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
        <radialGradient id="arch-glow" cx="0.5" cy="0.85" r="0.5">
          <stop offset="0" stopColor={p.amber} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.amber} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect width="1200" height="720" fill="url(#plaza-sky)" />
      {/* sun glow upper-right */}
      <circle cx="950" cy="110" r="200" fill="url(#sun-glow)" />
      <circle cx="950" cy="110" r="48" fill="#fff5d6" opacity="0.85" />

      {/* far cloud puffs */}
      {[[180, 130, 60], [340, 90, 44], [780, 80, 50], [1080, 150, 38]].map(([cx, cy, r], i) => (
        <g key={i} opacity="0.85">
          <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.45} fill="#fff" />
          <ellipse cx={cx - r * 0.5} cy={cy + 4} rx={r * 0.7} ry={r * 0.4} fill="#fff" />
          <ellipse cx={cx + r * 0.6} cy={cy + 6} rx={r * 0.65} ry={r * 0.35} fill="#fff" />
        </g>
      ))}

      {/* far mountains */}
      <path d="M 0 360 L 170 200 L 330 330 L 520 170 L 720 320 L 940 210 L 1150 340 L 1200 250 L 1200 420 L 0 420 Z"
        fill={p.mountain} />
      <path d="M 520 170 L 488 218 L 552 218 Z" fill="#fff" opacity="0.85" />
      <path d="M 940 210 L 910 252 L 968 252 Z" fill="#fff" opacity="0.85" />

      {/* snow drifts */}
      <path d="M 0 720 L 0 440 Q 200 400 400 430 Q 700 470 1000 420 Q 1150 405 1200 425 L 1200 720 Z"
        fill="url(#plaza-ground)" />
      <path d="M 0 720 L 0 520 Q 300 480 600 510 Q 900 540 1200 500 L 1200 720 Z"
        fill="#fff" opacity="0.7" />

      {/* university — centered, big landmark */}
      <GothicFacade cx={600} topY={56} fw={460} fh={470} palette={p} />

      {/* trees */}
      <PineTree x={90} y={500} s={1.05} palette={p} />
      <PineTree x={170} y={520} s={0.7} palette={p} />
      <PineTree x={1110} y={500} s={1.05} palette={p} />
      <PineTree x={1030} y={520} s={0.7} palette={p} />
      <PineTree x={360} y={520} s={0.6} palette={p} />
      <PineTree x={860} y={524} s={0.55} palette={p} />

      {/* igloo + snowman */}
      <Igloo x={210} y={580} />
      <Snowman x={960} y={620} />

      {/* lampposts */}
      <Lamppost x={150} y={580} palette={p} />
      <Lamppost x={1050} y={580} palette={p} />

      {/* side doors (game zones) */}
      <Door x={1136} y={290} label="☕ Café" palette={p} accent="#ffd47e" />
      <Door x={0} y={290} label="🕹 Arcade" palette={p} accent="#c4a3ff" />

      {/* snow flakes */}
      <SnowField count={40} />

      {/* tiny penguin mascots for scale */}
      <g transform="translate(500 650)"><Penguin size={1.4} color="#3b82f6" facing={1} /></g>
      <g transform="translate(720 660)"><Penguin size={1.2} color="#e23636" facing={-1} /></g>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════
// CAFÉ — warm wood interior, fireplace, snowy night window.
// ═════════════════════════════════════════════════════════════════
function RoomCafe({ palette: p }) {
  return (
    <svg viewBox="0 0 1200 720" width="1200" height="720" style={{ display: 'block', background: p.cafeWall }}>
      <defs>
        <linearGradient id="cafe-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.cafeWallTop} />
          <stop offset="1" stopColor={p.cafeWall} />
        </linearGradient>
        <linearGradient id="cafe-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2a4e" />
          <stop offset="1" stopColor="#3a4e7a" />
        </linearGradient>
        <radialGradient id="fire-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb84e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb84e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="amber-pendant" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffce73" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffce73" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* back wall */}
      <rect width="1200" height="420" fill="url(#cafe-wall)" />
      {/* plank wainscot detail */}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={i * 150} y1="0" x2={i * 150} y2="420"
          stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      ))}

      {/* window onto snowy night */}
      <g>
        <rect x="100" y="60" width="280" height="220" fill="url(#cafe-window)" />
        {/* moon */}
        <circle cx="320" cy="118" r="22" fill="#e6effa" />
        <circle cx="312" cy="112" r="18" fill="url(#cafe-window)" opacity="0.5" />
        {/* stars */}
        {[[140, 90], [180, 120], [220, 80], [260, 140], [200, 180], [150, 150]].map(([sx, sy], i) => (
          <circle key={i} cx={sx} cy={sy} r="1.4" fill="#fff" opacity={0.6 + (i % 3) * 0.15} />
        ))}
        {/* distant snowy hills inside window */}
        <path d="M 100 250 Q 180 220 240 240 Q 320 260 380 230 L 380 280 L 100 280 Z" fill="#dfe9f5" opacity="0.85" />
        {/* window frame */}
        <rect x="100" y="60" width="280" height="220" fill="none" stroke="#2a1d14" strokeWidth="10" />
        <line x1="240" y1="60" x2="240" y2="280" stroke="#2a1d14" strokeWidth="5" />
        <line x1="100" y1="170" x2="380" y2="170" stroke="#2a1d14" strokeWidth="5" />
        {/* sill */}
        <rect x="85" y="280" width="310" height="10" fill="#3a281f" />
        {/* little plant on sill */}
        <rect x="200" y="266" width="18" height="14" rx="2" fill="#7a4a28" />
        <circle cx="209" cy="262" r="9" fill="#3f7a45" />
      </g>

      {/* fireplace (center landmark) */}
      <g transform="translate(600 0)">
        <rect x="-95" y="180" width="190" height="200" rx="10" fill="#2a1a12" />
        <rect x="-105" y="372" width="210" height="16" fill="#3a281c" />
        <rect x="-64" y="232" width="128" height="148" rx="8" fill="#0e0907" />
        {/* flames */}
        <circle cx="0" cy="350" r="160" fill="url(#fire-glow)" />
        {[[-30, 100], [-10, 120], [10, 110], [25, 90], [-22, 90]].map(([fx, h], i) => (
          <path key={i}
            d={`M ${fx} 376 Q ${fx + 8} ${376 - h} ${fx + 16} 376 Z`}
            fill={i % 2 ? '#ff8a1e' : '#ffd24a'} />
        ))}
        {/* logs */}
        <ellipse cx="0" cy="372" rx="40" ry="6" fill="#5a3b22" />
        <ellipse cx="-12" cy="370" rx="6" ry="3" fill="#7a5436" />
        <ellipse cx="14" cy="368" rx="6" ry="3" fill="#7a5436" />
        {/* mantel candle + clock */}
        <rect x="-50" y="172" width="6" height="14" fill="#fff5da" />
        <circle cx="-47" cy="170" r="2" fill="#ffce73" />
        <circle cx="40" cy="178" r="10" fill="#fff5da" stroke="#3a281f" strokeWidth="1.5" />
        <line x1="40" y1="178" x2="40" y2="172" stroke="#3a281f" strokeWidth="1" />
        <line x1="40" y1="178" x2="44" y2="178" stroke="#3a281f" strokeWidth="1" />
      </g>

      {/* pendant lamps */}
      {[760, 980].map((lx, i) => (
        <g key={i}>
          <line x1={lx} y1="0" x2={lx} y2="60" stroke="#2a1d14" strokeWidth="2" />
          <path d={`M ${lx - 26} 100 L ${lx + 26} 100 L ${lx + 16} 60 L ${lx - 16} 60 Z`}
            fill="#caa15a" stroke="#3a281f" strokeWidth="1.5" />
          <circle cx={lx} cy={120} r="80" fill="url(#amber-pendant)" />
        </g>
      ))}

      {/* shelf with jars */}
      <rect x="860" y="150" width="280" height="10" fill="#3a281c" />
      {['#c0894e', '#8fae6b', '#b9676a', '#6f93b0', '#caa15a', '#a44a5c'].map((c, i) => (
        <g key={i}>
          <rect x={870 + i * 44} y="120" width="28" height="30" rx="4" fill={c} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
          <rect x={874 + i * 44} y="116" width="20" height="6" rx="2" fill="#3a281c" />
        </g>
      ))}

      {/* oak plank floor */}
      {Array.from({ length: 10 }, (_, i) => {
        const y = 420 + i * 30;
        const k = i / 10;
        return (
          <g key={i}>
            <rect x="0" y={y} width="1200" height="30"
              fill={i % 2 ? `rgb(${107 - k * 20},${74 - k * 14},${50 - k * 10})`
                : `rgb(${94 - k * 18},${63 - k * 12},${42 - k * 8})`} />
            <line x1="0" y1={y} x2="1200" y2={y} stroke="rgba(30,18,10,0.55)" />
            {/* random plank breaks */}
            {[200 + (i * 137) % 800, 700 + (i * 71) % 400].map((bx, j) => (
              <line key={j} x1={bx} y1={y} x2={bx} y2={y + 30} stroke="rgba(30,18,10,0.4)" />
            ))}
          </g>
        );
      })}

      {/* rug */}
      <ellipse cx="600" cy="580" rx="240" ry="72" fill="rgba(150,70,55,0.45)" />
      <ellipse cx="600" cy="580" rx="208" ry="60" fill="none" stroke="rgba(220,170,90,0.55)" strokeWidth="4" />
      <ellipse cx="600" cy="580" rx="180" ry="48" fill="rgba(120,40,40,0.4)" />

      {/* counter (front-left) */}
      <rect x="70" y="470" width="280" height="70" rx="8" fill="#7a5436" stroke="#3a281c" strokeWidth="2" />
      <rect x="70" y="530" width="280" height="16" fill="#5e3f2a" />
      {/* mugs on counter */}
      <g transform="translate(110 460)">
        <rect x="0" y="-8" width="16" height="20" rx="3" fill="#fff" stroke="#3a281c" strokeWidth="1" />
        <circle cx="20" cy="2" r="4" fill="none" stroke="#fff" strokeWidth="2" />
      </g>
      <g transform="translate(200 460)">
        <rect x="0" y="-8" width="16" height="20" rx="3" fill="#a44a5c" stroke="#3a281c" strokeWidth="1" />
        <circle cx="20" cy="2" r="4" fill="none" stroke="#a44a5c" strokeWidth="2" />
      </g>
      {/* steam */}
      <path d="M 200 442 q 4 -8 0 -16 q -4 -6 0 -14" stroke="rgba(255,255,255,0.55)" strokeWidth="2" fill="none" />
      <path d="M 220 442 q 4 -8 0 -16 q -4 -6 0 -14" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />

      {/* potted plant */}
      <g transform="translate(90 540)">
        <path d="M -22 0 L 22 0 L 16 50 L -16 50 Z" fill="#7a4a28" stroke="#3a281c" strokeWidth="1.5" />
        <ellipse cx="-14" cy="-20" rx="8" ry="28" fill="#3f7a45" transform="rotate(-12 -14 -20)" />
        <ellipse cx="0" cy="-26" rx="8" ry="32" fill="#4a8a55" />
        <ellipse cx="14" cy="-20" rx="8" ry="28" fill="#3f7a45" transform="rotate(12 14 -20)" />
      </g>

      {/* door */}
      <Door x={0} y={290} label="← Plaza" palette={p} accent="#ffd47e" />

      {/* penguins */}
      <g transform="translate(500 620)"><Penguin size={1.3} color="#a44a5c" facing={1} /></g>
      <g transform="translate(800 640)"><Penguin size={1.15} color="#ffb02e" facing={-1} /></g>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════
// ARCADE — neon night, perspective grid, two cabinets.
// ═════════════════════════════════════════════════════════════════
function RoomArcade({ palette: p }) {
  return (
    <svg viewBox="0 0 1200 720" width="1200" height="720" style={{ display: 'block', background: '#0d0420' }}>
      <defs>
        <linearGradient id="arc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a062e" />
          <stop offset="0.5" stopColor="#0d0420" />
          <stop offset="1" stopColor="#070213" />
        </linearGradient>
        <radialGradient id="arc-sign-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff5db0" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ff5db0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="arc-cyan-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="arc-mag-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff5db0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff5db0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="720" fill="url(#arc-bg)" />

      {/* back wall neon sign */}
      <circle cx="600" cy="90" r="250" fill="url(#arc-sign-glow)" />
      <text x="600" y="105" textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="58"
        fill="#ff5db0" style={{ filter: 'drop-shadow(0 0 16px #ff5db0)' }}>
        ★ ARCADE ★
      </text>
      <text x="600" y="138" textAnchor="middle"
        fontFamily="ui-monospace, monospace" fontWeight="600" fontSize="13"
        fill="#22d3ee" letterSpacing="6">PENGUIN  COIN-OP</text>

      {/* neon side bars */}
      <rect x="40" y="130" width="6" height="180" fill="#22d3ee" />
      <rect x="40" y="130" width="6" height="180" fill="#22d3ee" filter="url(#arc-cyan-glow)" />
      <rect x="1154" y="130" width="6" height="180" fill="#22d3ee" />

      {/* ceiling spotlights */}
      <circle cx="360" cy="120" r="130" fill="url(#arc-cyan-glow)" />
      <circle cx="600" cy="120" r="140" fill="url(#arc-mag-glow)" />
      <circle cx="840" cy="120" r="130" fill="url(#arc-cyan-glow)" />

      {/* perspective floor grid */}
      <g opacity="0.6">
        {Array.from({ length: 25 }, (_, i) => {
          const k = i - 12;
          return (
            <line key={i}
              x1={600 + k * 64} y1="720"
              x2={600 + k * 7} y2="280"
              stroke="#22d3ee" strokeOpacity={0.35 - Math.abs(k) * 0.02} strokeWidth="1" />
          );
        })}
        {Array.from({ length: 14 }, (_, i) => {
          const gy = 280 + Math.pow(i + 1, 1.8) * 5;
          if (gy > 720) return null;
          return (
            <line key={`h${i}`} x1="0" y1={gy} x2="1200" y2={gy}
              stroke="#ff5db0" strokeOpacity={0.15 + i * 0.025} strokeWidth="1" />
          );
        })}
      </g>

      {/* horizon glow */}
      <rect x="0" y="276" width="1200" height="6" fill="#ff5db0" opacity="0.7" />
      <rect x="0" y="270" width="1200" height="20" fill="url(#arc-mag-glow)" />

      {/* floor speakers */}
      {[[70, 600], [1130, 600]].map(([sx, sy], i) => (
        <g key={i} transform={`translate(${sx} ${sy})`}>
          <rect x="-28" y="-60" width="56" height="120" rx="6" fill="#15101f" stroke="#3a2a4e" strokeWidth="2" />
          <circle cx="0" cy="-24" r="16" fill="#241834" stroke="#3a2a4e" strokeWidth="1.5" />
          <circle cx="0" cy="-24" r="6" fill="#3a2a4e" />
          <circle cx="0" cy="26" r="22" fill="#241834" stroke="#3a2a4e" strokeWidth="1.5" />
          <circle cx="0" cy="26" r="8" fill="#3a2a4e" />
        </g>
      ))}

      {/* cabinet zones (DRAW + DUEL) — match world.js zones */}
      {[{ id: 'draw', x: 175, y: 360, w: 130, h: 150, label: '🎨 Draw & Guess', neon: '#22d3ee', neon2: '#3b82f6' },
      { id: 'duel', x: 895, y: 360, w: 130, h: 150, label: '⚡ Reaction Duel', neon: '#ff5db0', neon2: '#ffb02e' }]
        .map((cab, i) => {
          const cxp = cab.x + cab.w / 2;
          return (
            <g key={i}>
              {/* floor pad */}
              <rect x={cab.x} y={cab.y} width={cab.w} height={cab.h} rx="16"
                fill={cab.neon} opacity="0.14" />
              <rect x={cab.x} y={cab.y} width={cab.w} height={cab.h} rx="16"
                fill="none" stroke={cab.neon} strokeWidth="2" strokeDasharray="6 6" opacity="0.55" />
              <circle cx={cxp} cy={cab.y + cab.h / 2} r="80"
                fill={cab.neon} opacity="0.08" />

              {/* cabinet body */}
              <g>
                <rect x={cxp - 60} y={cab.y - 165} width="120" height="165" rx="12"
                  fill="#1b1030" stroke={cab.neon} strokeWidth="2" />
                {/* marquee */}
                <rect x={cxp - 54} y={cab.y - 162} width="108" height="18" rx="4" fill={cab.neon2} />
                {/* screen */}
                <rect x={cxp - 42} y={cab.y - 138} width="84" height="92" rx="6" fill="#0a0118" />
                <rect x={cxp - 42} y={cab.y - 138} width="84" height="92" rx="6" fill={cab.neon} opacity="0.7" />
                {/* screen pixel pattern */}
                {cab.id === 'draw' ? (
                  <g fill="#fff" opacity="0.85">
                    <circle cx={cxp - 14} cy={cab.y - 100} r="4" />
                    <circle cx={cxp + 8} cy={cab.y - 96} r="3" />
                    <path d={`M ${cxp - 22} ${cab.y - 80} L ${cxp + 22} ${cab.y - 76}`} stroke="#fff" strokeWidth="2" fill="none" />
                  </g>
                ) : (
                  <g fill="#fff" opacity="0.95">
                    <text x={cxp} y={cab.y - 90} textAnchor="middle" fontFamily="ui-monospace" fontWeight="900" fontSize="20" fill="#fff5da">GO!</text>
                  </g>
                )}
                {/* control panel */}
                <rect x={cxp - 50} y={cab.y - 44} width="100" height="20" rx="3" fill="#0a0118" />
                <circle cx={cxp - 28} cy={cab.y - 34} r="5" fill="#e23636" />
                <circle cx={cxp - 12} cy={cab.y - 34} r="5" fill="#ffd24a" />
                <circle cx={cxp + 4} cy={cab.y - 34} r="5" fill="#22d3ee" />
                <rect x={cxp + 20} y={cab.y - 40} width="22" height="12" rx="2" fill="#3a2a4e" />
                {/* coin slot */}
                <rect x={cxp - 8} y={cab.y - 20} width="16" height="3" rx="1" fill="#3a2a4e" />
                {/* glow under */}
                <circle cx={cxp} cy={cab.y - 90} r="95"
                  fill={cab.id === 'draw' ? 'url(#arc-cyan-glow)' : 'url(#arc-mag-glow)'} />
              </g>

              {/* label */}
              <text x={cxp} y={cab.y + cab.h + 24} textAnchor="middle"
                fontFamily="system-ui" fontWeight="800" fontSize="15" fill="#fff">
                {cab.label}
              </text>
              <text x={cxp} y={cab.y + cab.h + 42} textAnchor="middle"
                fontFamily="ui-monospace" fontSize="11" fill="#aab8d4">
                walk in to play
              </text>
            </g>
          );
        })}

      {/* door back to plaza */}
      <Door x={1136} y={290} label="Plaza →" palette={p} accent="#ff5db0" />

      {/* penguins */}
      <g transform="translate(600 580)"><Penguin size={1.3} color="#22d3ee" facing={1} /></g>
      <g transform="translate(450 620)"><Penguin size={1.1} color="#ff5db0" facing={-1} /></g>
    </svg>
  );
}

Object.assign(window, {
  RoomPlaza, RoomCafe, RoomArcade,
  Door, PineTree, Snowman, Igloo, Lamppost, GothicFacade,
});
