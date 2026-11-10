// Extra decorations. Everything here is merged into a few draw calls by world.js, so it stays cheap.
export function addDecor(c) {
  const { THREE, TX, root, box, plane, floorPlane, std, glow, interact, addCollider, wood, brass, darkMetal, steel, updaters, apronTop } = c;
  const cyl = (x, y, z, rt, rb, h, mat, solid = false, seg = 14) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; root.add(m);
    if (solid) { const r = Math.max(rt, rb); addCollider(x - r, x + r, y - h / 2, y + h / 2, z - r, z + r, false); } return m;
  };
  const torus = (x, y, z, R, r, mat) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 36), mat); m.position.set(x, y, z); m.rotation.x = Math.PI / 2; root.add(m); return m; };
  const sphere = (x, y, z, r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat); m.position.set(x, y, z); root.add(m); return m; };
  const basic = (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const redRope = std(0x8e1f2f, { roughness: 0.6 });

  // ---- red carpet runner + brass queue posts ----
  floorPlane(0, 0.008, 9, 3.0, 17.2, new THREE.MeshStandardMaterial({ map: TX.carpetTexture(1.5, 8.6, '#7a1022', '#9a1c32'), roughness: 1 }));
  const posts = [3.2, 6.2, 9.2, 12.2, 15.2];
  for (const x of [-2.0, 2.0]) {
    posts.forEach((z) => { cyl(x, 0.015, z, 0.15, 0.15, 0.03, brass); cyl(x, 0.5, z, 0.03, 0.03, 0.95, brass); sphere(x, 1.0, z, 0.06, brass); addCollider(x - 0.12, x + 0.12, 0, 1.0, z - 0.12, z + 0.12, false); });
    for (const [a, b] of [[3.2, 6.2], [9.2, 12.2]]) box(x, 0.85, (a + b) / 2, 0.025, 0.025, b - a - 0.1, redRope, { solid: false });
  }
  // floor emblem
  const med = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), new THREE.MeshStandardMaterial({ map: TX.signTexture('CV', { w: 256, h: 256, size: 150, color: '#ffd9a0', bg: '#5a1220' }), roughness: 0.4 }));
  med.rotation.x = -Math.PI / 2; med.position.set(0, 0.014, 9.4); root.add(med);

  // ---- chandelier over the lounge ----
  const gold = std(0xc9a14a, { metalness: 0.9, roughness: 0.3 }), bulb = glow(0xffe2a8, 2.4);
  [[1.5, 6.0], [1.0, 5.75], [0.5, 5.5]].forEach(([R, y]) => torus(0, y, 13, R, 0.045, gold));
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; sphere(Math.cos(a) * 1.5, 5.93, 13 + Math.sin(a) * 1.5, 0.07, bulb); }
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cyl(dx * 1.2, 6.5, 13 + dz * 1.2, 0.015, 0.015, 1.1, gold);
  sphere(0, 5.35, 13, 0.14, bulb);

  // ---- arcade machines (east wall) ----
  [['Space Race', 13.4, '#7dffb0'], ['Pixel Pop', 14.5, '#ff9de0'], ['Racer 88', 15.6, '#ffd45e']].forEach(([title, z, col], i) => {
    box(13.25, 0.9, z, 0.9, 1.8, 0.8, std(0x14306a, { roughness: 0.5 }));
    plane(12.79, 1.3, z, 0.58, 0.46, basic(TX.signTexture(title, { w: 256, h: 200, size: 46, color: col, bg: '#06141c' })), -Math.PI / 2);
    box(12.95, 1.82, z, 0.2, 0.2, 0.74, glow(new THREE.Color(col).getHex(), 1.6), { solid: false });
    box(12.72, 0.95, z, 0.3, 0.1, 0.6, std(0x0a0a0e), { solid: false });
    cyl(12.68, 1.02, z - 0.12, 0.02, 0.02, 0.16, std(0xd01818), false, 8);
    if (i === 0) interact(12.0, z + 0.5, 2.2, 'Arcade machine', 'Arcade games are on the wish-list for a later phase.');
  });

  // ---- vending machine + water cooler (west wall) ----
  box(-13.3, 1.0, 15.7, 0.9, 2.0, 1.0, std(0xb01822, { roughness: 0.4, metalness: 0.2 }));
  plane(-12.84, 1.25, 15.7, 0.82, 1.4, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xbfe0ff, emissiveIntensity: 0.55 }), Math.PI / 2);
  cyl(-13.4, 0.45, 14.8, 0.22, 0.22, 0.9, std(0xe8eef2), true); cyl(-13.4, 1.0, 14.8, 0.2, 0.2, 0.25, std(0x6fb3ff, { roughness: 0.2 }));

  // ---- standees, kiosks, benches, bins ----
  [[-6.8, 0], [6.8, 3]].forEach(([x, f]) => {
    box(x, 1.0, 11.3, 0.95, 2.0, 0.06, std(0x222026)); box(x, 0.04, 11.3, 0.8, 0.08, 0.55, darkMetal, { solid: false });
    plane(x, 1.05, 11.34, 0.85, 1.75, basic(TX.posterTexture(TX.FILMS[f])), 0);
    interact(x, 12.6, 1.8, TX.FILMS[f].title, `"${TX.FILMS[f].title}" - a made-up film for this demo.`);
  });
  for (const x of [-4.8, 4.8]) {
    box(x, 0.75, 6.0, 0.7, 1.5, 0.5, darkMetal);
    plane(x, 1.2, 6.26, 0.5, 0.4, basic(TX.signTexture('Tickets', { w: 256, h: 200, size: 54, color: '#ffd9a0', bg: '#1a0b10' })), 0);
  }
  interact(-4.8, 7.4, 2.2, 'Ticket kiosk', 'Self-service tickets arrive with private rooms in Phase 3.');
  for (const x of [-8, 8]) { box(x, 0.45, 16.8, 2.4, 0.1, 0.6, wood); box(x - 1.0, 0.2, 16.8, 0.08, 0.4, 0.5, brass, { solid: false }); box(x + 1.0, 0.2, 16.8, 0.08, 0.4, 0.5, brass, { solid: false }); }
  for (const [x, z] of [[-12.0, 0.9], [12.0, 0.9], [-12.8, 11.5], [12.8, 5.5]]) cyl(x, 0.4, z, 0.22, 0.18, 0.8, std(0x34383f, { metalness: 0.6 }), true);

  // ---- wall clock (shows your real time) ----
  const cc = document.createElement('canvas'); cc.width = cc.height = 256; const cg = cc.getContext('2d'), cTex = new THREE.CanvasTexture(cc); cTex.colorSpace = THREE.SRGBColorSpace;
  let lastMin = -1;
  function drawClock() {
    const d = new Date(), m = d.getMinutes(); if (m === lastMin) return; lastMin = m;
    cg.clearRect(0, 0, 256, 256); cg.fillStyle = '#f6ecd9'; cg.beginPath(); cg.arc(128, 128, 120, 0, 7); cg.fill(); cg.lineWidth = 10; cg.strokeStyle = '#c9a14a'; cg.stroke();
    cg.fillStyle = '#2a1a16'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.font = '26px Georgia';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; cg.fillText(String(i), 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); }
    const hand = (ang, len, w) => { cg.lineWidth = w; cg.lineCap = 'round'; cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(128 + Math.sin(ang) * len, 128 - Math.cos(ang) * len); cg.stroke(); };
    cg.strokeStyle = '#2a1a16'; hand(((d.getHours() % 12) + m / 60) / 12 * Math.PI * 2, 56, 9); hand((m / 60) * Math.PI * 2, 82, 6); cTex.needsUpdate = true;
  }
  drawClock(); plane(0, 5.7, 0.33, 1.3, 1.3, new THREE.MeshBasicMaterial({ map: cTex, transparent: true, toneMapped: false }), 0);
  let ck = 0; updaters.push((dt, t, p) => { if (p.z < 0.5) return; ck += dt; if (ck > 5) { ck = 0; drawClock(); } });

  // ---- lobby wall lights, film reels ----
  const lamp = glow(0xffc46b, 2.0);
  for (const z of [3, 6.5, 10, 13.5, 16.5]) for (const s of [-1, 1]) { box(s * 13.9, 5.0, z, 0.1, 0.36, 0.22, brass, { solid: false }); box(s * 13.82, 5.0, z, 0.08, 0.28, 0.14, lamp, { solid: false }); }
  [3.8, 5.6].forEach((z) => {
    cyl(13.85, 3.0, z, 0.7, 0.7, 0.1, brass, false, 32).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cyl(13.79, 3 + Math.cos(a) * 0.4, z + Math.sin(a) * 0.4, 0.12, 0.12, 0.04, std(0x120d10), false, 12).rotation.z = Math.PI / 2; }
  });

  // ---- auditorium ----
  const spk = std(0x0b0b0e, { roughness: 0.6 });
  for (const z of [-8, -14, -20, -26]) for (const s of [-1, 1]) {
    box(s * 11.62, 5.6, z, 0.6, 0.9, 0.5, spk, { solid: false }); cyl(s * 11.3, 5.45, z, 0.19, 0.19, 0.05, std(0x1b1b20), false, 16).rotation.z = Math.PI / 2; cyl(s * 11.3, 5.9, z, 0.06, 0.06, 0.05, std(0x1b1b20), false, 10).rotation.z = Math.PI / 2;
  }
  for (const s of [-1, 1]) box(s * 6.2, apronTop + 0.4, -30.2, 1.3, 0.8, 0.85, spk);
  box(0, apronTop + 0.27, -30.56, 22, 0.04, 0.05, glow(0xffb866, 1.4), { solid: false });
  c.rowTops.forEach(({ zc, top }) => { for (const s of [-1, 1]) { box(s * 11.94, top + 2.0, zc, 0.08, 0.3, 0.22, brass, { solid: false }); box(s * 11.88, top + 2.0, zc, 0.06, 0.22, 0.15, glow(0xffa94d, 1.8), { solid: false }); } });
  c.rowTops.forEach(({ zc, top }, k) => { const m = basic(TX.signTexture(String.fromCharCode(65 + k), { w: 128, h: 128, size: 90, color: '#ffd9a0' })); plane(-11.96, top + 1.15, zc, 0.36, 0.36, m, Math.PI / 2); plane(11.96, top + 1.15, zc, 0.36, 0.36, m, -Math.PI / 2); });
  plane(0, 3.75, -0.33, 1.5, 0.38, basic(TX.signTexture('Exit', { w: 512, h: 128, size: 76, color: '#35ff8c', bg: '#0b1a10' })), Math.PI);
  [[-6.5, 3], [6.5, 4]].forEach(([x, f]) => { box(x, 3.2, -0.3, 1.95, 2.85, 0.04, darkMetal, { solid: false }); plane(x, 3.2, -0.34, 1.8, 2.7, basic(TX.posterTexture(TX.FILMS[f])), Math.PI); });
}
