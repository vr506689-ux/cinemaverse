// Cinema staff and visitors. They work, walk, wave and chat so the place feels alive.
import * as THREE from 'three';
import { createAvatar } from './avatar.js';

const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const DEFS = [
  { name: 'Ticket clerk', kind: 'work', core: true, x: -8, z: 2.7, face: 0, shirt: '#6b1220', pants: '#1a1a22', skin: '#d9a77c', hair: '#1b1412',
    lines: ['Welcome to Cinemaverse! Screen 1 is straight ahead.', 'Tickets are free for now. Private rooms are coming soon.', 'Press M any time to open the movie controls.'] },
  { name: 'Snack bar', kind: 'work', core: true, x: 8, z: 2.7, face: 0, shirt: '#b01822', pants: '#1a1a22', cap: '#b01822', skin: '#b98258', hair: '#111',
    lines: ['Fresh popcorn, made every hour!', 'The snack bar opens for real in a later update.', 'Filter coffee is my favourite. Sadly the machine is painted on.'] },
  { name: 'Usher', kind: 'walk', core: true, floor: true, speed: 1.4, x: 0, z: -3, shirt: '#1d2a4a', pants: '#10131c', cap: '#1d2a4a', skin: '#8a5a3b', hair: '#111', prop: 'torch',
    wps: [[0, -3, 3], [10.3, -3, 0], [10.3, -20, 3], [10.3, -3, 0], [0, -3, 4], [-10.3, -3, 0], [-10.3, -20, 3], [-10.3, -3, 0]],
    lines: ['Seats are first come, first served.', 'Please keep your voice down once the film starts.', 'Mind the steps, they are low but sneaky.'] },
  { name: 'Cleaner', kind: 'walk', core: false, speed: 0.9, x: -6, z: 16, shirt: '#2f7a8f', pants: '#333a44', skin: '#f1c9a0', hair: '#4a3a2a', prop: 'broom',
    wps: [[-6, 16, 2], [6, 16, 2], [6, 9.6, 2], [-6, 9.6, 2]],
    lines: ['Mind the floor, I just cleaned it!', 'Popcorn gets everywhere. Everywhere!', 'Lovely lobby, isn\'t it?'] },
  { name: 'Visitor Asha', kind: 'walk', core: false, speed: 1.0, rest: [2, 6], x: -4, z: 8, shirt: '#d46aa6', pants: '#2a2f55', skin: '#b98258', hair: '#1b1412',
    wps: [[-4, 8], [4, 8]],
    lines: ['This lobby is gorgeous. Which film are you seeing?', 'I could look at these posters all day.', 'Is the demo reel any good? I heard it has stars.'] },
  { name: 'Visitor Ravi', kind: 'walk', core: false, speed: 1.1, rest: [2, 6], x: 4, z: 14, shirt: '#3b8c5b', pants: '#3a3a3a', skin: '#8a5a3b', hair: '#111', prop: 'popcorn',
    wps: [[4, 14], [-4, 14]],
    lines: ['Popcorn first, then the film. Always.', 'I hope the seats near the back are free.', 'Wave at me if you want a movie buddy!'] }
];

export function createNPCs(scene, world) {
  const list = [];
  function make(d) {
    const av = createAvatar({ shirt: d.shirt, pants: d.pants, cap: d.cap, skin: d.skin, hair: d.hair, name: d.name, showLabel: true });
    av.group.position.set(d.x, 0, d.z); av.group.rotation.y = d.face || 0; scene.add(av.group);
    const P = av.parts;
    if (d.prop === 'torch') { const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })); m.position.set(0, -0.58, 0.05); P.armR.add(m); }
    let broom = null;
    if (d.prop === 'broom') {
      broom = new THREE.Group(); broom.position.set(0.25, 0, 0.5);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a2b })); st.position.y = 0.65;
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0xc9a14a })); br.position.y = 0.04; broom.add(st, br); av.group.add(broom);
    }
    if (d.prop === 'popcorn') {
      const b = new THREE.Group(); b.position.set(0, -0.5, 0.14);
      const cup = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), new THREE.MeshStandardMaterial({ color: 0xc81e28 }));
      const pc = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff0c4 })); pc.position.y = 0.13; b.add(cup, pc); P.armR.add(b);
    }
    const it = { x: d.x, y: 0, z: d.z, r: 2.4, prompt: 'Talk to ' + d.name, message: () => pick(d.lines), speaker: d.name };
    world.interactables.push(it);
    list.push({ d, av, P, broom, it, pos: av.group.position, face: d.face || 0, wp: 0, wait: Math.random() * 3, t: Math.random() * 20, on: true });
  }
  DEFS.forEach(make);

  return {
    setQuality(q) { for (const n of list) { n.on = q !== 'low' || n.d.core; n.av.group.visible = n.on; n.it.r = n.on ? 2.4 : 0; } },
    ambient() { const v = list.filter((n) => n.on && n.d.kind === 'walk' && !n.d.core); const n = pick(v.length ? v : list); return { name: n.d.name, text: pick(n.d.lines) }; },
    update(dt, t, pp) {
      for (const n of list) {
        if (!n.on) continue;
        const d = n.d, pos = n.pos; n.t += dt;
        const dxp = pp.x - pos.x, dzp = pp.z - pos.z, near = Math.hypot(dxp, dzp) < 4.5 && Math.abs((pp.y || 0) - pos.y) < 2.5;
        let speed = 0;
        if (d.wps) {
          if (n.wait > 0) n.wait -= dt;
          else {
            const w = d.wps[n.wp], dx = w[0] - pos.x, dz = w[1] - pos.z, dist = Math.hypot(dx, dz);
            if (dist < 0.15) { n.wait = w[2] ?? (d.rest ? d.rest[0] + Math.random() * (d.rest[1] - d.rest[0]) : 0); n.wp = (n.wp + 1) % d.wps.length; }
            else { speed = d.speed; pos.x += (dx / dist) * speed * dt; pos.z += (dz / dist) * speed * dt; n.face = lerpAngle(n.face, Math.atan2(dx, dz), dt * 6); }
          }
        }
        if (speed === 0) {
          if (near) n.face = lerpAngle(n.face, Math.atan2(dxp, dzp), dt * 4);
          else if (d.kind === 'work') n.face = lerpAngle(n.face, d.face, dt * 3);
        }
        if (d.floor) pos.y += (world.groundAt(pos.x, pos.z, pos.y) - pos.y) * Math.min(1, dt * 10);
        n.av.group.rotation.y = n.face; n.av.update(dt, speed, true);
        const P = n.P;
        if (d.kind === 'work') {
          if (near) { P.armR.rotation.x = -2.8; P.armR.rotation.z = Math.sin(n.t * 9) * 0.45; P.armL.rotation.x = 0; }
          else { P.armL.rotation.x = -1.0 + Math.sin(n.t * 9) * 0.12; P.armR.rotation.x = -1.0 + Math.sin(n.t * 9 + 1.7) * 0.12; P.armR.rotation.z = 0; }
          P.head.rotation.y = near ? 0 : Math.sin(n.t * 0.5) * 0.4; P.head.rotation.x = near ? 0 : 0.18;
        } else if (d.prop === 'broom') {
          P.armL.rotation.x = -0.85; P.armR.rotation.x = -0.85; n.broom && (n.broom.rotation.x = speed ? Math.sin(n.t * 4) * 0.3 : 0.1);
        } else if (d.prop === 'popcorn') { P.armR.rotation.x = -1.15; if (speed === 0 && near) { P.armL.rotation.x = -2.8; P.armL.rotation.z = Math.sin(n.t * 9) * 0.4; } }
        else if (d.prop === 'torch') { P.armR.rotation.x = -0.75; }
        else if (speed === 0 && near) { P.armR.rotation.x = -2.8; P.armR.rotation.z = Math.sin(n.t * 9) * 0.45; }
        n.it.x = pos.x; n.it.z = pos.z; n.it.y = pos.y;
      }
    }
  };
}
