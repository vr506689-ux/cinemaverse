// Builds the whole cinema: lobby, reception, snack bar, lounge and the main auditorium.
// Layout (top-down): the lobby is z = 0..18 (street at z = 18+). The auditorium is behind it, z = 0 to -32.
// The auditorium floor steps DOWN toward the big screen, like a real cinema.
import * as THREE from 'three';
import * as TX from './textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addDecor } from './decor.js';

export function buildCinema(scene) {
  const colliders = [], interactables = [], updaters = [], shadowLights = [], lights = [];
  const root = new THREE.Group(); scene.add(root);
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x2b2430, 0.2); scene.add(hemi);
  let cinemaTarget = 0, cinema = 0, movieActive = false, beamEnabled = true;

  // ---------- helpers ----------
  const mcache = new Map();
  const std = (color, o = {}) => { const k = 's' + color + JSON.stringify(o); if (!mcache.has(k)) mcache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o })); return mcache.get(k); };
  const glow = (color, i = 1.4) => { const k = 'g' + color + i; if (!mcache.has(k)) mcache.set(k, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: i })); return mcache.get(k); };

  function addCollider(minX, maxX, minY, maxY, minZ, maxZ, cam) {
    const c = { minX, maxX, minY, maxY, minZ, maxZ, enabled: true, cam: cam ?? (maxY - minY > 1.3) };
    c.box = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
    colliders.push(c); return c;
  }
  function box(x, y, z, w, h, d, mat, o = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; root.add(m);
    if (o.solid !== false) addCollider(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2, o.cam);
    return m;
  }
  function plane(x, y, z, w, h, mat, rotY = 0, rotX = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.set(rotX, rotY, 0); m.receiveShadow = true; root.add(m); return m;
  }
  const floorPlane = (x, y, z, w, d, mat) => plane(x, y, z, w, d, mat, 0, -Math.PI / 2);
  function pointLight(color, intensity, distance, x, y, z, lowOff = false) {
    const l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(x, y, z); root.add(l);
    lights.push({ light: l, lowOff }); return l;
  }
  function interact(x, z, r, prompt, message, y = 0) { const it = { x, y, z, r, prompt, message }; interactables.push(it); return it; }

  // ---------- materials ----------
  const wallLobby = std(0x4a1520, { roughness: 0.9 });
  const brass = std(0xb8893b, { metalness: 0.9, roughness: 0.35 });
  const darkWall = std(0x0e0c12, { roughness: 0.95 });
  const ceilingMat = std(0xe8dcc6, { roughness: 0.95 });
  const marble = new THREE.MeshStandardMaterial({ map: TX.marbleTexture(7, 4.6), roughness: 0.22, metalness: 0.05 });
  const wood = new THREE.MeshStandardMaterial({ map: TX.woodTexture(2, 1), roughness: 0.55 });
  const counterTop = std(0xf0eadf, { roughness: 0.25, metalness: 0.05 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false });
  const steel = std(0x9aa0a8, { metalness: 0.85, roughness: 0.35 });
  const seatMat = std(0x7a1020, { roughness: 0.85 });
  const darkMetal = std(0x1c1a20, { metalness: 0.6, roughness: 0.5 });
  const platformSide = std(0x140c10, { roughness: 0.95 });

  // ======================================================================
  //  LOBBY  (x -14..14, z -0.3..18, ceiling 7)
  // ======================================================================
  floorPlane(0, 0.002, 8.85, 28, 18.3, marble);
  addCollider(-14, 14, -1, 0, -0.3, 18);
  // street porch outside
  const porchMat = new THREE.MeshStandardMaterial({ map: TX.concreteTexture(7, 1.6), roughness: 0.95 });
  floorPlane(0, 0.002, 21, 28, 6, porchMat);
  addCollider(-14, 14, -1, 0, 18, 24);
  addCollider(-14.4, 14.4, -1, 8, 24, 24.5, false); addCollider(-14.5, -14.4, -1, 8, 18, 24.5, false); addCollider(14.4, 14.5, -1, 8, 18, 24.5, false);

  // walls
  box(-14.2, 3.5, 1.8, 0.4, 7, 4.2, wallLobby); box(-14.2, 3.5, 11.8, 0.4, 7, 13, wallLobby); box(-14.2, 4.75, 4.6, 0.4, 4.5, 1.4, wallLobby); box(14.2, 3.5, 9, 0.4, 7, 18.6, wallLobby);
  box(-8.45, 4.65, 0, 11.9, 14.7, 0.6, wallLobby); box(8.45, 4.65, 0, 11.9, 14.7, 0.6, wallLobby);
  box(0, 7.7, 0, 5, 8.6, 0.6, wallLobby);
  // wood panelling + brass rail
  plane(-13.99, 0.7, 1.8, 4.2, 1.4, wood, Math.PI / 2); plane(-13.99, 0.7, 11.8, 13, 1.4, wood, Math.PI / 2); plane(13.99, 0.7, 9, 18, 1.4, wood, -Math.PI / 2);
  box(-13.95, 1.43, 1.8, 0.08, 0.06, 4.2, brass, { solid: false }); box(-13.95, 1.43, 11.8, 0.08, 0.06, 13, brass, { solid: false }); box(13.95, 1.43, 9, 0.08, 0.06, 18, brass, { solid: false });
  box(-8.45, 1.43, 0.33, 11.9, 0.06, 0.06, brass, { solid: false }); box(8.45, 1.43, 0.33, 11.9, 0.06, 0.06, brass, { solid: false });
  plane(-8.45, 0.7, 0.31, 11.9, 1.4, wood); plane(8.45, 0.7, 0.31, 11.9, 1.4, wood);

  // ceiling, beams and light bars
  box(0, 7.15, 9, 28.8, 0.3, 18.6, ceilingMat, { solid: false, cast: false });
  for (const z of [4.5, 9, 13.5]) box(0, 6.9, z, 28, 0.25, 0.4, std(0xd9c9ab), { solid: false, cast: false });
  for (const x of [-9, 0, 9]) box(x, 6.9, 9, 0.4, 0.25, 18, std(0xd9c9ab), { solid: false, cast: false });
  for (const x of [-5, 5]) for (const z of [4.5, 9, 13.5]) box(x, 6.75, z, 6, 0.06, 0.25, glow(0xfff0d0, 1.8), { solid: false, cast: false });

  // lobby lights (kept away from the auditorium wall so light doesn't leak in)
  pointLight(0xffe2bd, 100, 12, -7, 6.3, 8); pointLight(0xffe2bd, 100, 12, 7, 6.3, 8);
  pointLight(0xffe2bd, 100, 12, -7, 6.3, 14.5, true); pointLight(0xffe2bd, 100, 12, 7, 6.3, 14.5, true);
  const keyLight = new THREE.SpotLight(0xfff0dd, 140, 10.5, 1.1, 0.8, 2);
  keyLight.position.set(0, 6.8, 9); keyLight.target.position.set(0, 0, 9); root.add(keyLight, keyLight.target);
  keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.bias = -0.0004; keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 12;
  shadowLights.push(keyLight); lights.push({ light: keyLight, lowOff: true });

  // glass front + automatic doors
  const frame = (x, w) => { for (let i = 0; i <= Math.round(w / 2.3); i++) box(x - w / 2 + i * (w / Math.round(w / 2.3)), 3.5, 18, 0.08, 7, 0.1, steel, { solid: false }); };
  box(-8.25, 3.5, 18, 11.5, 7, 0.06, glass, { cast: false }); box(8.25, 3.5, 18, 11.5, 7, 0.06, glass, { cast: false });
  frame(-8.25, 11.5); frame(8.25, 11.5);
  box(0, 5.1, 18, 5, 3.8, 0.2, darkMetal);
  box(0, 3.2, 18, 5.2, 0.12, 0.2, steel, { solid: false });
  const doorGeo = new THREE.BoxGeometry(2.5, 3.1, 0.06);
  const doors = [-1, 1].map((s) => {
    const m = new THREE.Mesh(doorGeo, glass); m.position.set(s * 1.25, 1.6, 18.12); m.userData.keep = true; root.add(m);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.1, 0.1), steel); edge.position.set(-s * 1.2, 0, 0); m.add(edge);
    const c = addCollider(s * 1.25 - 1.25, s * 1.25 + 1.25, 0, 3.2, 17.95, 18.3, false);
    return { m, s, c };
  });
  let doorOpen = 0;
  updaters.push((dt, t, p) => {
    const near = Math.hypot(p.x, p.z - 18) < 4.6;
    doorOpen += ((near ? 1 : 0) - doorOpen) * Math.min(1, dt * 4);
    for (const d of doors) { d.m.position.x = d.s * (1.25 + 2.35 * doorOpen); d.c.enabled = doorOpen < 0.6; }
  });
  const signOut = plane(0, 5.1, 18.13, 4.8, 1.2, new THREE.MeshBasicMaterial({ map: TX.signTexture('Cinemaverse', { size: 130, color: '#ffd9a0' }), transparent: true, toneMapped: false }));
  const signIn = plane(0, 5.1, 17.89, 4.8, 1.2, new THREE.MeshBasicMaterial({ map: TX.signTexture('Cinemaverse', { size: 130, color: '#ffd9a0' }), transparent: true, toneMapped: false }), Math.PI);
  signOut.receiveShadow = signIn.receiveShadow = false;

  // ---- reception / ticket office ----
  box(-8, 0.56, 4, 6, 1.12, 1.2, wood);
  box(-8, 1.15, 4, 6.3, 0.06, 1.5, counterTop, { solid: false });
  for (const x of [-9.4, -6.6]) {
    const mon = box(x, 1.52, 3.8, 0.7, 0.45, 0.05, glow(0x6fb3ff, 0.9), { solid: false }); mon.rotation.x = -0.15;
  }
  plane(-8, 3.6, 0.32, 4.2, 1.05, new THREE.MeshBasicMaterial({ map: TX.signTexture('Ticket office', { w: 1024, h: 256, size: 110, color: '#ffd9a0', bg: '#1a0b10' }), toneMapped: false }));
  interact(-8, 5.6, 2.6, 'Ticket office', 'The ticket office opens in Phase 3, when private rooms and room codes arrive.');

  // ---- snack bar ----
  box(8, 0.56, 4, 6, 1.12, 1.2, wood);
  box(8, 1.15, 4, 6.3, 0.06, 1.5, counterTop, { solid: false });
  plane(8, 3.3, 0.32, 5, 1.55, new THREE.MeshBasicMaterial({ map: TX.menuBoardTexture(), toneMapped: false }));
  const pm = new THREE.Group(); pm.position.set(6.4, 1.18, 4); root.add(pm);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.6), std(0xb01822, { metalness: 0.4, roughness: 0.4 })); cab.position.y = 0.06; pm.add(cab);
  const cabTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.6), std(0xb01822, { metalness: 0.4, roughness: 0.4 })); cabTop.position.y = 1.0; pm.add(cabTop);
  const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.8, 0.54), new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffc860, emissiveIntensity: 0.55, transparent: true, opacity: 0.6, roughness: 0.1 })); cabGlass.position.y = 0.55; pm.add(cabGlass);
  const popGeo = new THREE.IcosahedronGeometry(0.045, 0), pops = new THREE.InstancedMesh(popGeo, std(0xfff0c4, { roughness: 0.9 }), 90), o3 = new THREE.Object3D();
  for (let i = 0; i < 90; i++) { o3.position.set((Math.random() - .5) * 0.62, 0.18 + Math.random() * 0.5, (Math.random() - .5) * 0.44); o3.rotation.set(Math.random() * 3, Math.random() * 3, 0); o3.updateMatrix(); pops.setMatrixAt(i, o3.matrix); }
  pm.add(pops);
  addCollider(6, 6.8, 1.12, 2.3, 3.7, 4.3, false);
  box(11.6, 1.1, 1.0, 1.2, 2.2, 0.8, darkMetal); box(11.6, 1.2, 1.41, 1.0, 1.7, 0.04, glow(0x9fd8ff, 0.5), { solid: false });
  interact(8, 5.6, 2.6, 'Snack bar', 'Smells like fresh popcorn. The snack bar opens in a later phase.');

  // ---- ticket gates beside the auditorium door ----
  for (const x of [-3.4, 3.4]) { box(x, 0.55, 2.4, 0.45, 1.1, 0.45, darkMetal); box(x, 1.14, 2.4, 0.3, 0.05, 0.3, glow(0x45ff9a, 1.6), { solid: false }); }
  plane(0, 3.9, 0.32, 3.6, 0.9, new THREE.MeshBasicMaterial({ map: TX.signTexture('Screen 1', { w: 768, h: 192, size: 100, color: '#ffd9a0', bg: '#1a0b10' }), toneMapped: false }));
  interact(0, 2.6, 2.6, 'Scan your ticket', 'Ticket scanned. Enjoy the show!');

  // ---- lounge ----
  // coffee tables beside the sofas (the middle of the lobby stays clear for the red carpet)
  for (const x of [-7.6, 7.6]) { box(x, 0.25, 13.9, 1.1, 0.5, 0.9, wood); box(x, 0.52, 13.9, 1.2, 0.04, 1.0, counterTop, { solid: false }); }
  const leather = std(0x2c1d18, { roughness: 0.5 });
  function sofa(x, z, dir) {
    box(x, 0.27, z, 0.95, 0.54, 2.6, leather);
    box(x - dir * 0.5, 0.82, z, 0.25, 1.1, 2.6, leather);
    box(x, 0.45, z - 1.35, 0.95, 0.9, 0.2, leather); box(x, 0.45, z + 1.35, 0.95, 0.9, 0.2, leather);
  }
  sofa(-10.2, 12.2, 1); sofa(10.2, 12.2, -1); sofa(-10.2, 15.6, 1); sofa(10.2, 15.6, -1);
  interact(-8.6, 12.2, 2.4, 'Lounge sofa', 'Sitting down arrives in Phase 2.'); interact(8.6, 12.2, 2.4, 'Lounge sofa', 'Sitting down arrives in Phase 2.');

  // ---- plants ----
  const pot = std(0xf1ece2, { roughness: 0.4 }), soil = std(0x2a1d14), leafMats = [std(0x2f7a3c), std(0x3a8f46), std(0x24663a)].map((m) => { m.side = THREE.DoubleSide; return m; });
  function plant(x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 16), pot); p.position.y = 0.3; p.castShadow = p.receiveShadow = true; g.add(p);
    const so = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 16), soil); so.position.y = 0.6; g.add(so);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2, geo = new THREE.SphereGeometry(0.2, 8, 6); geo.scale(0.55, 2.6, 0.1);
      const leaf = new THREE.Mesh(geo, leafMats[i % 3]); leaf.position.set(Math.cos(a) * 0.14, 1.15 + (i % 3) * 0.15, Math.sin(a) * 0.14);
      leaf.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5); leaf.castShadow = true; g.add(leaf);
    }
    addCollider(x - 0.35 * s, x + 0.35 * s, 0, 1.9 * s, z - 0.35 * s, z + 0.35 * s, false);
  }
  [[-12.8, 17], [12.8, 17], [-12.8, 1.4], [12.8, 1.4], [-5.4, 16.8], [5.4, 16.8], [-12.8, 8.6], [12.8, 8.6]].forEach(([x, z]) => plant(x, z, 1 + ((x * z) % 3) * 0.05));

  // ---- posters + digital board ----
  const posterMats = TX.FILMS.map((f) => new THREE.MeshBasicMaterial({ map: TX.posterTexture(f), toneMapped: false }));
  [[6.5, 0], [10, 1], [13.5, 2]].forEach(([z, i]) => {
    box(-13.9, 2.7, z, 0.06, 3.1, 2.1, darkMetal, { solid: false });
    plane(-13.86, 2.7, z, 2, 3, posterMats[i], Math.PI / 2);
    interact(-12.5, z, 1.8, TX.FILMS[i].title, `"${TX.FILMS[i].title}" is a made-up film for this demo.`);
  });
  const bc = document.createElement('canvas'); bc.width = 800; bc.height = 450;
  const bctx = bc.getContext('2d'), bTex = new THREE.CanvasTexture(bc); bTex.colorSpace = THREE.SRGBColorSpace;
  box(13.88, 3.2, 10, 0.1, 2.95, 5.15, darkMetal, { solid: false });
  plane(13.82, 3.2, 10, 5, 2.81, new THREE.MeshBasicMaterial({ map: bTex, toneMapped: false }), -Math.PI / 2);
  let bIdx = 0, bT = 0, lastStep = -1; TX.drawBanner(bctx, TX.FILMS[0], 0); bTex.needsUpdate = true;
  let bannerInfo = null, bInfoT = 1;
  updaters.push((dt, t, p) => {
    if (p.z < 0.5) return; // only while the lobby is in view
    if (bannerInfo) { bInfoT += dt; if (bInfoT > 0.5) { bInfoT = 0; TX.drawBannerText(bctx, bannerInfo); bTex.needsUpdate = true; } return; }
    bT += dt; if (bT > 4) { bT = 0; bIdx = (bIdx + 1) % TX.FILMS.length; lastStep = -1; }
    const step = Math.floor((bT / 4) * 16);
    if (step !== lastStep) { lastStep = step; TX.drawBanner(bctx, TX.FILMS[bIdx], bT / 4); bTex.needsUpdate = true; }
  });

  // ======================================================================
  //  AUDITORIUM  (x -12..12, z -0.3..-32, floor steps down from y=0 to y=-2.45)
  // ======================================================================
  const carpetTop = new THREE.MeshStandardMaterial({ map: TX.carpetTexture(12, 1.2), roughness: 1 });
  const rowTops = [];
  // landing just inside the door
  box(0, -1.35, -3.05, 24, 2.7, 5.5, platformSide);
  floorPlane(0, 0.003, -3.05, 24, 5.5, carpetTop.clone());
  const ROWS = 7, ROW_D = 2.4, RISE = 0.35;
  for (let k = 0; k < ROWS; k++) {
    const zc = -7 - ROW_D * k, top = -RISE * k; rowTops.push({ zc, top });
    box(0, (top - 2.7) / 2, zc, 24, top + 2.7, ROW_D, platformSide);
    floorPlane(0, top + 0.003, zc, 24, ROW_D, carpetTop);
  }
  const apronTop = -RISE * (ROWS - 1) - RISE; // -2.45
  box(0, (apronTop - 2.7) / 2, -27.3, 24, apronTop + 2.7, 9.4, platformSide);
  floorPlane(0, apronTop + 0.003, -27.3, 24, 9.4, new THREE.MeshStandardMaterial({ map: TX.carpetTexture(12, 4.7, '#2a0c14', '#3d1320'), roughness: 1 }));
  box(0, apronTop + 0.125, -31.3, 23, 0.25, 1.4, std(0x1b1114), {}); // small stage in front of the screen

  // shell
  box(-12.3, 4.65, -16.45, 0.6, 14.7, 32.3, darkWall); box(12.3, 4.65, -16.45, 0.6, 14.7, 32.3, darkWall);
  box(0, 4.65, -32.3, 25.2, 14.7, 0.6, darkWall);
  box(0, 12.15, -16.3, 25.2, 0.3, 32.6, std(0x0a090d), { solid: false, cast: false });
  const slat = TX.slatTexture(16, 3.2);
  plane(-11.99, 4.4, -16.3, 31.4, 14.2, new THREE.MeshStandardMaterial({ map: slat, roughness: 0.9 }), Math.PI / 2);
  plane(11.99, 4.4, -16.3, 31.4, 14.2, new THREE.MeshStandardMaterial({ map: slat, roughness: 0.9 }), -Math.PI / 2);
  for (let i = 0; i < 6; i++) box(0, 11.3, -4 - i * 5, 24, 0.55, 0.35, std(0x15131a), { solid: false, cast: false });

  // seats (one instanced mesh per part = very cheap to draw)
  const BLOCKS = [[-8.6, -1.8], [1.8, 8.6]], PER = 12;
  const total = ROWS * BLOCKS.length * PER;
  const baseI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.52), seatMat, total);
  const backI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.78, 0.12), seatMat, total);
  const armI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.3, 0.5), darkMetal, ROWS * BLOCKS.length * (PER + 1));
  baseI.castShadow = backI.castShadow = armI.castShadow = true; baseI.receiveShadow = backI.receiveShadow = true;
  const dummy = new THREE.Object3D(); let si = 0, ai = 0;
  rowTops.forEach(({ zc, top }) => {
    BLOCKS.forEach(([x0, x1]) => {
      const w = (x1 - x0) / PER;
      for (let i = 0; i < PER; i++) {
        const x = x0 + w * (i + 0.5);
        dummy.rotation.set(0, 0, 0); dummy.position.set(x, top + 0.45, zc); dummy.updateMatrix(); baseI.setMatrixAt(si, dummy.matrix);
        dummy.rotation.set(-0.12, 0, 0); dummy.position.set(x, top + 0.85, zc + 0.27); dummy.updateMatrix(); backI.setMatrixAt(si, dummy.matrix); si++;
      }
      for (let i = 0; i <= PER; i++) { dummy.rotation.set(0, 0, 0); dummy.position.set(x0 + w * i, top + 0.62, zc - 0.02); dummy.updateMatrix(); armI.setMatrixAt(ai++, dummy.matrix); }
      addCollider(x0, x1, top, top + 0.95, zc - 0.36, zc + 0.4, false);
    });
    // soft aisle lights on each step edge
    for (const [x, w] of [[0, 3.4], [-10.3, 3], [10.3, 3]]) box(x, top + 0.012, zc - 1.12, w, 0.02, 0.06, glow(0xffb866, 1.5), { solid: false, cast: false });
  });
  root.add(baseI, backI, armI);

  // emergency exits (front corners)
  for (const s of [-1, 1]) {
    box(s * 11.92, apronTop + 1.2, -26.5, 0.06, 2.4, 1.8, std(0x2a2d33, { metalness: 0.5 }), { solid: false });
    box(s * 11.86, apronTop + 1.0, -26.5, 0.05, 0.08, 1.2, std(0xaa2222), { solid: false });
    box(s * 11.88, apronTop + 2.7, -26.5, 0.04, 0.28, 0.8, glow(0x35ff8c, 2), { solid: false });
    interact(s * 10.7, -26.5, 1.8, 'Exit door', 'Emergency exit. It stays locked in this demo.', apronTop);
  }

  // curtains + valance
  const curtain = new THREE.MeshStandardMaterial({ map: TX.curtainTexture(3, 6), roughness: 0.95 });
  box(-11.4, 4.75, -31.5, 1.2, 14.3, 0.4, curtain); box(11.4, 4.75, -31.5, 1.2, 14.3, 0.4, curtain);
  box(0, 11.5, -31.5, 24, 1.0, 0.4, new THREE.MeshStandardMaterial({ map: TX.curtainTexture(10, 1), roughness: 0.95 }), { solid: false });

  // THE SCREEN (animated placeholder until real video arrives in Phase 4)
  const SW = 21, SH = 11.8125, SCY = -1.0 + SH / 2; // bigger 16:9 screen
  box(0, SCY, -31.85, SW + 0.3, SH + 0.3, 0.15, std(0x050505), { solid: false });
  const sc = document.createElement('canvas'); sc.width = 1280; sc.height = 720;
  const sctx = sc.getContext('2d'), sTex = new THREE.CanvasTexture(sc); sTex.colorSpace = THREE.SRGBColorSpace;
  const screenMesh = plane(0, SCY, -31.76, SW, SH, new THREE.MeshBasicMaterial({ map: sTex, toneMapped: false }));
  screenMesh.name = 'cinemaScreen'; screenMesh.receiveShadow = false; screenMesh.userData.keep = true;
  let sT = 0, sAcc = 1, screenInfo = null;
  function drawScreen(t) {
    const g = sctx, W = 1280, H = 720;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `hsl(${(t * 8) % 360},55%,16%)`); grad.addColorStop(1, `hsl(${(t * 8 + 70) % 360},60%,28%)`);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
    for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const inf = screenInfo || { title: 'Cinemaverse', sub: 'Welcome. Take a seat.', small: '' };
    g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.font = `${inf.title.length > 18 ? 84 : 110}px Limelight, Georgia, serif`; g.fillText(inf.title, W / 2, H / 2 - 40, W - 120);
    g.font = '58px Arial, sans-serif'; g.fillText(inf.sub || '', W / 2, H / 2 + 70, W - 120);
    g.font = '34px Arial, sans-serif'; g.fillStyle = 'rgba(255,243,220,.8)'; g.fillText(inf.small || '', W / 2, H / 2 + 140, W - 120);
  }
  drawScreen(0); sTex.needsUpdate = true;
  updaters.push((dt, t, p) => { if (movieActive || p.z > -0.3) return; sT += dt; if (sT > 0.25) { sT = 0; drawScreen(t); sTex.needsUpdate = true; } });

  // lighting inside the auditorium
  const screenGlow = pointLight(0xbfd2ff, 95, 34, 0, 3.8, -29.2);
  const washes = [pointLight(0xffb070, 14, 11, -10.8, 1.5, -10, true), pointLight(0xffb070, 14, 11, 10.8, 1.5, -10, true)];
  // projector + visible light beam
  const proj = new THREE.Vector3(0, 10.2, -1.6), tgt = new THREE.Vector3(0, SCY, -31.8);
  box(0, 10.2, -1.2, 0.8, 0.5, 1, std(0x2a2a2e, { metalness: 0.6 }), { solid: false });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 14), glow(0xfff6e0, 3)); lens.rotation.x = Math.PI / 2; lens.position.set(0, 10.2, -1.75); root.add(lens);
  const L = proj.distanceTo(tgt), dir = tgt.clone().sub(proj).normalize();
  const coneGeo = new THREE.ConeGeometry(12, L, 28, 1, true); coneGeo.translate(0, -L / 2, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.copy(proj); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); cone.visible = false; root.add(cone);

  // door frame between lobby and auditorium
  box(-2.6, 1.6, 0.34, 0.12, 3.2, 0.1, brass, { solid: false }); box(2.6, 1.6, 0.34, 0.12, 3.2, 0.1, brass, { solid: false });
  interact(0, -3.6, 2.6, 'Open movie controls', '', 0).action = 'movie';

  // ---------- audience (3 instanced meshes = 3 draw calls for ~46 people) ----------
  const SEATS = [];
  rowTops.forEach(({ zc, top }) => BLOCKS.forEach(([x0, x1]) => { const w = (x1 - x0) / PER; for (let i = 0; i < PER; i++) SEATS.push({ x: x0 + w * (i + 0.5), z: zc, top }); }));
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = SEATS.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [SEATS[i], SEATS[j]] = [SEATS[j], SEATS[i]]; }
  const AUD = 46, audMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const legGeo = new THREE.BoxGeometry(0.34, 0.16, 0.5);
  const aTorso = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.28, 2, 8), audMat, AUD);
  const aHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 10, 8), audMat, AUD);
  const aLegs = new THREE.InstancedMesh(legGeo, audMat, AUD);
  const shirts = ['#3b5b8c', '#8c3b3b', '#3b8c5b', '#8c7a3b', '#6b3b8c', '#444', '#c9c9c9', '#2d6a6a'], skins = ['#f1c9a0', '#d9a77c', '#b98258', '#8a5a3b', '#6b4430'];
  const col = new THREE.Color();
  for (let i = 0; i < AUD; i++) {
    const st = SEATS[i], y0 = st.top + 0.52, ry = (rnd() - 0.5) * 0.3;
    dummy.rotation.set(0, 0, 0); dummy.position.set(st.x, y0 + 0.26, st.z + 0.12); dummy.updateMatrix(); aTorso.setMatrixAt(i, dummy.matrix); aTorso.setColorAt(i, col.set(shirts[i % shirts.length]));
    dummy.rotation.set(0, ry, 0); dummy.position.set(st.x, y0 + 0.74, st.z + 0.12); dummy.updateMatrix(); aHead.setMatrixAt(i, dummy.matrix); aHead.setColorAt(i, col.set(skins[i % skins.length]));
    dummy.rotation.set(0, 0, 0); dummy.position.set(st.x, y0 + 0.1, st.z - 0.2); dummy.updateMatrix(); aLegs.setMatrixAt(i, dummy.matrix); aLegs.setColorAt(i, col.set('#26304a'));
  }
  for (const m of [aTorso, aHead, aLegs]) { m.count = 0; m.frustumCulled = false; root.add(m); }
  // every seat can be sat in (E). If the player takes a seat an audience member was using, that member steps aside.
  const orig = {}; const tmpM = new THREE.Matrix4(), zeroM = new THREE.Matrix4().makeScale(0, 0, 0), hiddenSeats = new Set();
  SEATS.forEach((st, i) => { st.i = i; const it = interact(st.x, st.z, 1.25, 'Sit down', '', st.top); it.action = 'sit'; it.seat = st; it.frontOnly = true; });
  // when any player (you or someone online) takes a seat an audience member was using, that member steps aside
  function setSeatOccupied(i, on) {
    if (i < 0 || i >= AUD) return;
    if (on && !hiddenSeats.has(i)) { hiddenSeats.add(i); for (const m of [aTorso, aHead, aLegs]) { m.getMatrixAt(i, tmpM); orig[m.uuid + i] = tmpM.clone(); m.setMatrixAt(i, zeroM); m.instanceMatrix.needsUpdate = true; } }
    else if (!on && hiddenSeats.has(i)) { hiddenSeats.delete(i); for (const m of [aTorso, aHead, aLegs]) { m.setMatrixAt(i, orig[m.uuid + i]); m.instanceMatrix.needsUpdate = true; } }
  }
  let localSeat = -1;
  function onSeat(st) { if (localSeat >= 0) setSeatOccupied(localSeat, false); localSeat = st ? st.i : -1; if (st) setSeatOccupied(st.i, true); }
  function setAudience(on) { for (const m of [aTorso, aHead, aLegs]) m.count = on ? AUD : 0; }

  // ---------- restroom (west side of the lobby, through the door beside the ticket office) ----------
  {
    const tile = std(0xd6e2e6, { roughness: 0.35 }), white = std(0xf4f6f7, { roughness: 0.4 });
    floorPlane(-16.7, 0.003, 5, 5.4, 5, new THREE.MeshStandardMaterial({ map: TX.marbleTexture(1.4, 1.3), roughness: 0.3 }));
    addCollider(-19.4, -14, -1, 0, 2.5, 7.5);
    box(-16.9, 1.6, 2.3, 5.8, 3.2, 0.4, tile); box(-16.9, 1.6, 7.7, 5.8, 3.2, 0.4, tile); box(-19.6, 1.6, 5, 0.4, 3.2, 5.8, tile);
    box(-16.9, 3.3, 5, 5.8, 0.2, 5.8, ceilingMat, { solid: false, cast: false });
    for (const x of [-18, -16.6, -15.2]) box(x, 1.1, 3.2, 0.04, 1.7, 1.4, white);
    [-18.7, -17.3, -15.9].forEach((x) => { box(x, 1.1, 3.9, 1.3, 1.7, 0.04, std(0x6fa3b8, { roughness: 0.4 })); box(x, 0.3, 2.85, 0.4, 0.5, 0.5, white, { solid: false }); box(x, 0.75, 2.62, 0.4, 0.4, 0.15, white, { solid: false }); });
    box(-16.9, 0.4, 7.2, 3.8, 0.8, 0.5, wood); box(-16.9, 0.83, 7.2, 4.0, 0.06, 0.6, counterTop, { solid: false });
    [-18, -16.9, -15.8].forEach((x) => { box(x, 0.87, 7.15, 0.4, 0.03, 0.3, std(0x2b2f35), { solid: false }); box(x, 1.0, 7.38, 0.04, 0.2, 0.04, brass, { solid: false }); });
    plane(-16.9, 1.75, 7.49, 3.6, 1.1, new THREE.MeshStandardMaterial({ color: 0xdfe8ee, metalness: 1, roughness: 0.06 }), Math.PI);
    const rl = pointLight(0xfff2dd, 45, 9, -16.9, 2.9, 5, true);
    plane(-13.97, 3.1, 4.6, 1.3, 0.34, new THREE.MeshBasicMaterial({ map: TX.signTexture('Restrooms', { w: 512, h: 128, size: 66, color: '#9fd8ff', bg: '#0e1a22' }), toneMapped: false }), Math.PI / 2);
    interact(-16.9, 5.6, 2.6, 'Mirror', 'Looking sharp! Remember to wash your hands.');
  }

  // ---------- decorations ----------
  addDecor({ THREE, TX, root, box, plane, floorPlane, std, glow, interact, addCollider, wood, brass, darkMetal, steel, counterTop, updaters, apronTop, rowTops });

  // ---------- speed-up: merge thousands of static pieces into a handful of draw calls ----------
  (function optimise() {
    const groups = new Map();
    const all = []; root.traverse((o) => { if (o.isMesh) all.push(o); });
    const kept = (o) => { for (let q = o; q && q !== root; q = q.parent) if (q.userData.keep) return true; return false; };
    for (const m of all) {
      if (m.isInstancedMesh || kept(m)) continue;
      const g = m.geometry, mt = m.material;
      if (!g.index || !g.attributes.uv || Array.isArray(mt) || mt.transparent) continue;
      if (!(mt.isMeshStandardMaterial || mt.isMeshBasicMaterial)) continue;
      const key = mt.uuid + (m.castShadow ? 'c' : '') + (m.receiveShadow ? 'r' : '');
      if (!groups.has(key)) groups.set(key, { mt, cast: m.castShadow, recv: m.receiveShadow, list: [] });
      m.updateWorldMatrix(true, false); groups.get(key).list.push(m);
    }
    for (const { mt, cast, recv, list } of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); return g; });
      const merged = mergeGeometries(geos, false); if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mt); mesh.castShadow = cast; mesh.receiveShadow = recv; root.add(mesh);
      list.forEach((m) => { m.parent.remove(m); m.geometry.dispose(); }); geos.forEach((g) => g.dispose());
    }
  })();

  // ---------- ground height (used by NPCs) ----------
  function groundAt(x, z, feet) {
    let g = -2.6;
    for (const c of colliders) if (c.enabled && x > c.minX - 0.1 && x < c.maxX + 0.1 && z > c.minZ - 0.1 && z < c.maxZ + 0.1 && c.maxY <= feet + 0.46 && c.maxY > g) g = c.maxY;
    return g;
  }

  // ---------- cinema mode: lights fade down while a film plays ----------
  const lerp = THREE.MathUtils.lerp;
  function applyLights(dt) {
    cinema += (cinemaTarget - cinema) * Math.min(1, dt * 1.3);
    if (Math.abs(cinemaTarget - cinema) < 0.002) cinema = cinemaTarget;
    hemi.intensity = lerp(0.2, 0.012, cinema); scene.environmentIntensity = lerp(0.22, 0.025, cinema);
    for (const w of washes) w.intensity = lerp(14, 0, cinema);
    screenGlow.intensity = lerp(95, movieActive ? 150 : 95, cinema);
    cone.visible = beamEnabled && cinema > 0.05; cone.material.opacity = 0.05 * cinema;
  }

  return {
    colliders, interactables, shadowLights, lights, hemi, groundAt, setAudience, onSeat, setSeatOccupied,
    spawn: { x: 0, z: 15, yaw: 0 },
    screenMesh, idleTexture: sTex, screen: { y: SCY, z: -31.76, w: SW, h: SH },
    zoneAt(p) { return p.z > 18.2 ? 'Street' : p.z > -0.3 ? 'Main lobby' : 'Auditorium 1'; },
    // level 0 = house lights up, 1 = lights down. active = a film is loaded
    setCinema(level, active, audience = active) { cinemaTarget = level; movieActive = active; setAudience(audience); },
    setScreenInfo(i) { screenInfo = i; sT = 1; },
    setBannerInfo(i) { bannerInfo = i; bInfoT = 1; },
    setBeamEnabled(on) { beamEnabled = on; },
    update(dt, t, p) { for (const u of updaters) u(dt, t, p); applyLights(dt); }
  };
}
