// All textures are drawn by code on invisible canvases, so there are no image files
// to download and no licence problems.
import * as THREE from 'three';

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function marbleTexture(rx = 1, ry = 1) {
  const [c, g] = mk(512, 512); const r = rng(7);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = 205 + r() * 28; g.fillStyle = `rgb(${v},${v - 5},${v - 14})`; g.fillRect(i * 128, j * 128, 128, 128);
  }
  g.strokeStyle = 'rgba(110,100,92,0.22)'; g.lineWidth = 1.3;
  for (let k = 0; k < 34; k++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - .5) * 90; y += (r() - .5) * 90; g.lineTo(x, y); } g.stroke(); }
  g.strokeStyle = 'rgba(60,52,46,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
  return tex(c, rx, ry);
}

export function carpetTexture(rx = 1, ry = 1, base = '#3b0f1a', hi = '#5a1a28') {
  const [c, g] = mk(256, 256); const r = rng(11);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.fillStyle = hi; g.globalAlpha = .5;
  for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) {
    g.beginPath(); g.moveTo(x + 16, y + 4); g.lineTo(x + 28, y + 16); g.lineTo(x + 16, y + 28); g.lineTo(x + 4, y + 16); g.closePath(); g.fill();
  }
  g.globalAlpha = .18;
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() > .5 ? '#000' : '#fff'; g.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
  return tex(c, rx, ry);
}

export function slatTexture(rx = 1, ry = 1) {
  const [c, g] = mk(256, 128);
  for (let i = 0; i < 16; i++) {
    const grad = g.createLinearGradient(i * 16, 0, i * 16 + 16, 0);
    grad.addColorStop(0, '#15121a'); grad.addColorStop(.5, '#27222d'); grad.addColorStop(1, '#100e14');
    g.fillStyle = grad; g.fillRect(i * 16, 0, 16, 128);
  }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 62, 256, 4);
  return tex(c, rx, ry);
}

export function curtainTexture(rx = 1, ry = 1) {
  const [c, g] = mk(256, 64);
  for (let i = 0; i < 8; i++) {
    const grad = g.createLinearGradient(i * 32, 0, i * 32 + 32, 0);
    grad.addColorStop(0, '#4d0c18'); grad.addColorStop(.5, '#a52638'); grad.addColorStop(1, '#4d0c18');
    g.fillStyle = grad; g.fillRect(i * 32, 0, 32, 64);
  }
  return tex(c, rx, ry);
}

export function woodTexture(rx = 1, ry = 1) {
  const [c, g] = mk(256, 256); const r = rng(5);
  g.fillStyle = '#5b3a24'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${20 + r() * 40},${10 + r() * 20},5,${.12 + r() * .2})`; g.lineWidth = 1 + r() * 2; const y = r() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 12 - 6, 170, y + r() * 12 - 6, 256, y); g.stroke(); }
  return tex(c, rx, ry);
}

export function concreteTexture(rx = 1, ry = 1) {
  const [c, g] = mk(256, 256); const r = rng(3);
  g.fillStyle = '#5d5b61'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const v = 70 + r() * 60; g.fillStyle = `rgba(${v},${v},${v + 4},.35)`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
  return tex(c, rx, ry);
}

// ---- film posters (made-up titles) ----
export const FILMS = [
  { title: 'Monsoon Express', tag: 'One train. One night.', hue: 205 },
  { title: 'The Last Lantern', tag: 'Some lights never go out.', hue: 32 },
  { title: 'Neon Harbour', tag: 'The city never sleeps.', hue: 300 },
  { title: 'Paper Moon Heist', tag: 'Steal the sky.', hue: 48 },
  { title: 'Salt & Sparrow', tag: 'A summer by the sea.', hue: 172 },
  { title: 'Midnight Kaveri', tag: 'The river remembers.', hue: 350 }
];

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = ''; const lines = [];
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line); lines.forEach((l, i) => g.fillText(l, x, y + i * lh)); return lines.length;
}

export function posterTexture(film) {
  const [c, g] = mk(400, 600);
  const grad = g.createLinearGradient(0, 0, 0, 600);
  grad.addColorStop(0, `hsl(${film.hue},70%,22%)`); grad.addColorStop(.6, `hsl(${film.hue},65%,38%)`); grad.addColorStop(1, `hsl(${film.hue},60%,10%)`);
  g.fillStyle = grad; g.fillRect(0, 0, 400, 600);
  g.fillStyle = `hsla(${film.hue + 30},90%,70%,.9)`; g.beginPath(); g.arc(200, 230, 90, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(0, 360);
  for (let x = 0; x <= 400; x += 25) g.lineTo(x, 330 + Math.sin(x * .07) * 22 + (x % 50 ? 10 : -14)); g.lineTo(400, 600); g.lineTo(0, 600); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 46px Georgia, serif'; wrap(g, film.title, 200, 440, 340, 50);
  g.font = 'italic 22px Georgia, serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(film.tag, 200, 548);
  return tex(c, 1, 1);
}

export function signTexture(text, { w = 1024, h = 256, color = '#ffd9a0', bg = null, size = 120, sub = null } = {}) {
  const [c, g] = mk(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color;
  g.font = `${size}px Limelight, Georgia, serif`; g.fillText(text, w / 2, sub ? h * .42 : h / 2);
  if (sub) { g.shadowBlur = 8; g.font = `${Math.round(size * .36)}px 'Hanken Grotesk', Arial, sans-serif`; g.fillText(sub, w / 2, h * .8); }
  return tex(c, 1, 1);
}

export function menuBoardTexture() {
  const [c, g] = mk(1024, 320);
  g.fillStyle = '#140a0c'; g.fillRect(0, 0, 1024, 320);
  g.fillStyle = '#ffd9a0'; g.font = '64px Limelight, Georgia, serif'; g.textAlign = 'center'; g.fillText('Snacks & Drinks', 512, 80);
  g.font = '40px Arial, sans-serif'; g.fillStyle = '#fff1d6';
  const items = ['Popcorn', 'Nachos', 'Samosa', 'Cola', 'Filter coffee', 'Ice cream'];
  items.forEach((it, i) => g.fillText(it, 190 + (i % 3) * 320, 170 + Math.floor(i / 3) * 80));
  return tex(c, 1, 1);
}

export function drawBanner(ctx, film, progress) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `hsl(${film.hue},70%,20%)`); grad.addColorStop(1, `hsl(${film.hue + 25},65%,36%)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.textAlign = 'left';
  ctx.font = '34px Arial, sans-serif'; ctx.fillText('Now showing', 50, 70);
  ctx.font = 'bold 84px Georgia, serif'; ctx.fillText(film.title, 50, 200);
  ctx.font = 'italic 38px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(film.tag, 50, 262);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(50, H - 50, W - 100, 8);
  ctx.fillStyle = '#ffd9a0'; ctx.fillRect(50, H - 50, (W - 100) * progress, 8);
}

export function drawBannerText(ctx, info) {
  const W = ctx.canvas.width, H = ctx.canvas.height, hue = info.hue ?? 28;
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `hsl(${hue},70%,20%)`); grad.addColorStop(1, `hsl(${hue + 25},65%,36%)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '40px Arial, sans-serif'; ctx.fillText(info.l1 || '', 50, 80);
  ctx.font = `bold ${info.title && info.title.length > 18 ? 64 : 84}px Georgia, serif`; ctx.fillText(info.title || '', 50, 210, W - 100);
  ctx.font = 'italic 44px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(info.l2 || '', 50, 290, W - 100);
}
