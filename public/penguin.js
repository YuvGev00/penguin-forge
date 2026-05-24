'use strict';

// Hand-drawn canvas penguin — no images. Designed for "cute but unmistakably
// a penguin" (dark body, white belly, orange beak + feet, flippers) with
// squash-and-stretch juice. `phase` (0..1) drives the waddle; `squash`
// (0..1, decaying) is a landing/click pop.

function drawPenguin(ctx, x, y, color, facing, walking, phase, squash) {
  squash = squash || 0;
  const bob = walking ? Math.abs(Math.sin(phase * Math.PI * 2)) * 3 : 0;
  // squash: wider + shorter for a beat after landing/spawn
  const sx = 1 + squash * 0.18;
  const sy = 1 - squash * 0.18;
  const tilt = walking ? Math.sin(phase * Math.PI * 2) * 0.06 : 0;

  ctx.save();
  ctx.translate(x, y - bob);

  // fake contact shadow (NO shadowBlur — cheap translucent ellipse)
  ctx.fillStyle = 'rgba(20,24,40,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 27, 17 - bob * 0.4, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(tilt);
  ctx.scale(facing * sx, sy);

  // feet — alternate forward/back while walking
  const sw = walking ? Math.sin(phase * Math.PI * 2) * 6 : 0;
  ctx.fillStyle = '#ff9d2e';
  foot(ctx, -7 + sw, 23);
  foot(ctx, 7 + sw, 23);

  // body: soft pear shape with radial volume shading (lit upper-left)
  const grd = ctx.createRadialGradient(-9, -16, 4, 0, 2, 34);
  grd.addColorStop(0, lighten(color, 40));
  grd.addColorStop(0.5, lighten(color, 12));
  grd.addColorStop(1, shade(color, -26));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.bezierCurveTo(22, -28, 24, 6, 16, 22);
  ctx.bezierCurveTo(8, 30, -8, 30, -16, 22);
  ctx.bezierCurveTo(-24, 6, -22, -28, 0, -30);
  ctx.fill();
  // rim light on the lit edge
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-15, 18);
  ctx.bezierCurveTo(-23, 4, -21, -26, -1, -29);
  ctx.stroke();

  // belly patch (cream) with a soft inner shadow for depth
  const bg = ctx.createRadialGradient(-2, -6, 3, 0, 4, 22);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.7, '#fdf9ee');
  bg.addColorStop(1, '#ead9bf');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.bezierCurveTo(13, -12, 14, 8, 8, 19);
  ctx.bezierCurveTo(3, 24, -3, 24, -8, 19);
  ctx.bezierCurveTo(-14, 8, -13, -12, 0, -14);
  ctx.fill();

  // near flipper (slight swing)
  ctx.fillStyle = shade(color, -16);
  ctx.save();
  ctx.translate(-16, -2);
  ctx.rotate(walking ? Math.sin(phase * Math.PI * 2) * 0.35 - 0.15 : -0.1);
  ctx.beginPath();
  ctx.ellipse(0, 6, 5.5, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // cheeks (soft blush)
  ctx.fillStyle = 'rgba(255,150,170,0.40)';
  ctx.beginPath(); ctx.arc(-7, -17, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -17, 4.2, 0, Math.PI * 2); ctx.fill();

  // eyes — big, on the head, with a sparkle (kept high = readable face)
  drawEye(ctx, -3.5, -23);
  drawEye(ctx, 7.5, -23);

  // beak — rounded little triangle
  ctx.fillStyle = '#ff9d2e';
  ctx.beginPath();
  ctx.moveTo(10, -19);
  ctx.quadraticCurveTo(21, -17.5, 10, -14);
  ctx.quadraticCurveTo(7, -16.5, 10, -19);
  ctx.fill();

  ctx.restore();
}

function drawEye(ctx, ex, ey) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(ex, ey, 4.3, 5.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#16181f';
  ctx.beginPath(); ctx.arc(ex + 0.6, ey + 0.6, 2.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ex + 1.7, ey - 0.8, 1.1, 0, Math.PI * 2); ctx.fill();
}

function foot(ctx, fx, fy) {
  ctx.beginPath();
  ctx.ellipse(fx, fy, 6.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shade(hex, amt) { return adjust(hex, amt); }
function lighten(hex, amt) { return adjust(hex, amt); }
function adjust(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 255) + amt),
    b = clamp((n & 255) + amt);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function clamp(v) { return Math.max(0, Math.min(255, v | 0)); }

window.drawPenguin = drawPenguin;
