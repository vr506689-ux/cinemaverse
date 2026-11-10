// A friendly stylised character built from simple shapes, animated by code.
import * as THREE from 'three';

const approach = (cur, target, k) => cur + (target - cur) * Math.min(1, k);

export function createAvatar({ shirt = '#c8323c', pants = '#222a44', name = 'Guest', skin = '#d9a77c', hair = '#1b1412', cap = null, showLabel = false } = {}) {
  const group = new THREE.Group();
  const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const mSkin = mat(skin, 0.6), mShirt = mat(shirt, 0.75), mPants = mat(pants, 0.8), mHair = mat(hair, 0.5), mShoe = mat('#efefef', 0.5);
  const mEye = new THREE.MeshBasicMaterial({ color: '#15101a' });

  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const body = new THREE.Group(); group.add(body);
  add(body, new THREE.CapsuleGeometry(0.21, 0.42, 4, 12), mShirt, 0, 1.17, 0);
  add(body, new THREE.CylinderGeometry(0.2, 0.22, 0.22, 14), mPants, 0, 0.82, 0);

  const head = new THREE.Group(); head.position.y = 1.74; body.add(head);
  add(head, new THREE.SphereGeometry(0.17, 20, 16), mSkin);
  if (cap) {
    const mCap = mat(cap, 0.6);
    add(head, new THREE.SphereGeometry(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mCap, 0, 0.03, 0);
    add(head, new THREE.BoxGeometry(0.2, 0.025, 0.14), mCap, 0, 0.05, 0.17);
  } else {
    add(head, new THREE.SphereGeometry(0.18, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mHair, 0, 0.015, -0.015);
  }
  add(head, new THREE.SphereGeometry(0.022, 8, 8), mEye, -0.06, 0.015, 0.15);
  add(head, new THREE.SphereGeometry(0.022, 8, 8), mEye, 0.06, 0.015, 0.15);

  function limb(x, y, r, len, m, tipGeo, tipMat, tipY, tipZ = 0) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    add(pivot, new THREE.CapsuleGeometry(r, len, 4, 10), m, 0, -(len + 2 * r) / 2 + r * 0.4, 0);
    add(pivot, tipGeo, tipMat, 0, tipY, tipZ);
    return pivot;
  }
  const shoeGeo = new THREE.SphereGeometry(0.11, 10, 8); shoeGeo.scale(1, 0.55, 1.5);
  const legL = limb(-0.1, 0.9, 0.095, 0.6, mPants, shoeGeo, mShoe, -0.79, 0.05);
  const legR = limb(0.1, 0.9, 0.095, 0.6, mPants, shoeGeo, mShoe, -0.79, 0.05);
  const handGeo = new THREE.SphereGeometry(0.065, 10, 8);
  const armL = limb(-0.29, 1.5, 0.065, 0.44, mShirt, handGeo, mSkin, -0.56);
  const armR = limb(0.29, 1.5, 0.065, 0.44, mShirt, handGeo, mSkin, -0.56);

  if (showLabel) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const g = c.getContext('2d'); g.font = '700 44px "Hanken Grotesk", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(30,8,14,.7)'; g.fillRect(0, 12, 512, 72); g.fillStyle = '#f6ecd9'; g.fillText(name, 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    label.scale.set(1.3, 0.24, 1); label.position.y = 2.15; label.renderOrder = 10; group.add(label);
  }

  let phase = 0, time = 0, seated = false, emote = null, emoteT = 0;
  function emotePose(dt) {
    emoteT += dt; const e = emoteT;
    if (emote === 'wave') { armR.rotation.x = -2.7; armR.rotation.z = Math.sin(e * 9) * 0.5; }
    else if (emote === 'clap') { const s = 0.12 + (Math.sin(e * 14) + 1) * 0.14; armL.rotation.x = armR.rotation.x = -1.3; armL.rotation.z = s; armR.rotation.z = -s; }
    else if (emote === 'cheer') { armL.rotation.x = armR.rotation.x = -3.0; armL.rotation.z = 0.25 + Math.sin(e * 8) * 0.15; armR.rotation.z = -armL.rotation.z; body.position.y = Math.abs(Math.sin(e * 7)) * 0.05; }
    else if (emote === 'dance') {
      body.position.y = Math.abs(Math.sin(e * 6)) * 0.07; body.rotation.y = Math.sin(e * 3) * 0.45;
      armL.rotation.x = -2.5 + Math.sin(e * 6) * 0.5; armR.rotation.x = -2.5 + Math.sin(e * 6 + Math.PI) * 0.5; armL.rotation.z = 0.2; armR.rotation.z = -0.2;
      legL.rotation.x = Math.sin(e * 6) * 0.5; legR.rotation.x = -Math.sin(e * 6) * 0.5;
    }
  }
  function update(dt, speed, grounded) {
    time += dt;
    if (seated) {
      body.position.y = approach(body.position.y, -0.33 + Math.sin(time * 1.6) * 0.004, dt * 10); body.rotation.y = approach(body.rotation.y, 0, dt * 8);
      legL.rotation.x = legR.rotation.x = approach(legL.rotation.x, -1.2, dt * 10);
      for (const [a, z] of [[armL, 0.08], [armR, -0.08]]) { a.rotation.x = approach(a.rotation.x, -0.55, dt * 10); a.rotation.z = approach(a.rotation.z, z, dt * 10); }
      if (emote === 'wave' || emote === 'clap' || emote === 'cheer') emotePose(dt);
      return;
    }
    if (emote && grounded && speed < 0.3) { emotePose(dt); return; }
    body.rotation.y = approach(body.rotation.y, 0, dt * 10);
    if (!grounded) {
      armL.rotation.x = approach(armL.rotation.x, -2.3, dt * 12); armR.rotation.x = approach(armR.rotation.x, -2.3, dt * 12);
      legL.rotation.x = approach(legL.rotation.x, -0.5, dt * 12); legR.rotation.x = approach(legR.rotation.x, 0.35, dt * 12);
      body.position.y = approach(body.position.y, 0, dt * 10);
    } else if (speed > 0.3) {
      phase += dt * (3.5 + speed * 1.7);
      const a = Math.sin(phase) * Math.min(0.5 + speed * 0.09, 1.1);
      legL.rotation.x = a; legR.rotation.x = -a; armL.rotation.x = -a * 0.9; armR.rotation.x = a * 0.9;
      armL.rotation.z = 0; armR.rotation.z = 0;
      body.position.y = Math.abs(Math.cos(phase)) * 0.045;
    } else {
      for (const p of [legL, legR, armL, armR]) { p.rotation.x = approach(p.rotation.x, 0, dt * 10); p.rotation.z = approach(p.rotation.z, 0, dt * 10); }
      body.position.y = Math.sin(time * 2) * 0.006;
    }
  }
  let mic = null;
  function setSpeaking(on) {
    if (!mic && !on) return;
    if (!mic) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = 'rgba(20,120,70,.92)'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(25, 14, 14, 22, 7) : g.rect(25, 14, 14, 22); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 12, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); g.fillRect(30, 44, 4, 7);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      mic = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); mic.scale.set(0.34, 0.34, 1); mic.position.y = 2.5; mic.renderOrder = 11; group.add(mic);
    }
    mic.visible = on;
  }
  function setShirt(color) { mShirt.color.set(color); }
  function setSeated(on) { seated = on; if (!on) body.position.y = 0; }
  function setEmote(name) { emote = name; emoteT = 0; }
  return { group, update, setShirt, setSeated, setEmote, setSpeaking, parts: { body, head, legL, legR, armL, armR } };
}
