/* global PALETTES, LandingScrollFade, ReactDOM */
// Mounts the landing and keeps it scaled to the viewport. Compiled from JSX
// to plain JS at build time (see public/redesign/app.js) so the page needs no
// in-browser Babel and no CDN — it runs fully offline.
function App() {
  const palette = PALETTES['icy-amber'];
  return /*#__PURE__*/React.createElement(LandingScrollFade, {
    palette: palette
  });
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));

// Scale the fixed 1440×900 design to fill the viewport width.
const fixed = document.getElementById('landing-fixed');
function fit() {
  const s = window.innerWidth / 1440;
  fixed.style.transform = `scale(${s})`;
  // Size the landing's OWN scroll container (the LandingScrollFade root,
  // i.e. #root's first child) to the viewport height in pre-scale pixels,
  // so the scaled container fills the screen and its overflowY:auto still
  // scrolls the full content (hero + transition + console) to the bottom.
  const root = document.getElementById('root');
  const sc = root && root.firstElementChild;
  if (sc) sc.style.height = window.innerHeight / s + 'px';
}
fit();
window.addEventListener('resize', fit);
window.addEventListener('load', fit);
// React mounts asynchronously, so #root is empty on the first fit() calls;
// re-run until the scroll container exists and gets its height.
let tries = 0;
const retry = setInterval(() => {
  fit();
  const root = document.getElementById('root');
  if (root && root.firstElementChild || ++tries > 40) clearInterval(retry);
}, 100);