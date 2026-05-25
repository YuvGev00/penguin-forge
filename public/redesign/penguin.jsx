// Hand-drawn penguin mascot — SVG version of the game's canvas penguin.
// Used in landing pages + sprinkled in room mockups for scale.
//
// Usage:  <Penguin x={0} y={0} size={1} color="#3b82f6" facing={1} />
//   x,y    — translate origin (penguin's feet/center are roughly 0,0)
//   size   — uniform scale (1 = same as game's ~50px-tall penguin)
//   color  — body color
//   facing — 1 right, -1 left

function Penguin({ x = 0, y = 0, size = 1, color = '#3b82f6', facing = 1 }) {
  // mirror-on-facing implemented via the outer scale transform
  return (
    <g transform={`translate(${x} ${y}) scale(${facing * size} ${size})`}>
      {/* contact shadow */}
      <ellipse cx="0" cy="27" rx="17" ry="5.5" fill="rgba(20,24,40,0.22)" />
      {/* feet */}
      <ellipse cx="-7" cy="23" rx="6.5" ry="3.6" fill="#ff9d2e" />
      <ellipse cx="7" cy="23" rx="6.5" ry="3.6" fill="#ff9d2e" />
      {/* body — single-color, club-penguin flat */}
      <path
        d="M 0 -30 C 22 -28 24 6 16 22 C 8 30 -8 30 -16 22 C -24 6 -22 -28 0 -30 Z"
        fill={color}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="1.5"
      />
      {/* belly */}
      <path
        d="M 0 -14 C 13 -12 14 8 8 19 C 3 24 -3 24 -8 19 C -14 8 -13 -12 0 -14 Z"
        fill="#fdf9ee"
      />
      {/* flipper */}
      <ellipse cx="-16" cy="4" rx="5.5" ry="13" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="1" transform="rotate(-8 -16 4)" />
      {/* cheeks */}
      <circle cx="-7" cy="-17" r="4.2" fill="rgba(255,150,170,0.4)" />
      <circle cx="11" cy="-17" r="4.2" fill="rgba(255,150,170,0.4)" />
      {/* eyes */}
      <g>
        <ellipse cx="-3.5" cy="-23" rx="4.3" ry="5.2" fill="#fff" />
        <circle cx="-2.9" cy="-22.4" r="2.7" fill="#16181f" />
        <circle cx="-1.8" cy="-23.8" r="1.1" fill="#fff" />
      </g>
      <g>
        <ellipse cx="7.5" cy="-23" rx="4.3" ry="5.2" fill="#fff" />
        <circle cx="8.1" cy="-22.4" r="2.7" fill="#16181f" />
        <circle cx="9.2" cy="-23.8" r="1.1" fill="#fff" />
      </g>
      {/* beak */}
      <path d="M 10 -19 Q 21 -17.5 10 -14 Q 7 -16.5 10 -19 Z" fill="#ff9d2e" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
    </g>
  );
}

// Tiny snow particle field — purely decorative, deterministic positions.
function SnowField({ count = 30, w = 1200, h = 720, seed = 7 }) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const flakes = Array.from({ length: count }, () => ({
    x: rnd() * w, y: rnd() * h, r: rnd() * 2 + 1, op: 0.5 + rnd() * 0.5,
  }));
  return (
    <g>
      {flakes.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={f.r} fill={`rgba(255,255,255,${f.op})`} />
      ))}
    </g>
  );
}

Object.assign(window, { Penguin, SnowField });
