// Other players: smooth movement, animations, seats. Only the nearest few are drawn on weaker devices.
import { createAvatar } from './avatar.js';

const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); };
const SKINS = ['#f1c9a0', '#d9a77c', '#b98258', '#8a5a3b', '#6b4430'], HAIRS = ['#1b1412', '#3a2a1c', '#5a3a1a', '#111', '#6b6b6b'];
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export function createRemotePlayers(scene, world) {
  const map = new Map();
  let maxShown = 8, rankT = 0;
  const api = {
    setMax(n) { maxShown = n; },
    has(id) { return map.has(id); },
    add(p) {
      if (map.has(p.id)) return;
      const h = hash(p.id + p.name);
      const av = createAvatar({ shirt: p.shirt, name: p.name, skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 3) % HAIRS.length], showLabel: true });
      av.group.position.set(p.x, p.y, p.z); scene.add(av.group);
      map.set(p.id, { av, t: { ...p }, seat: -1, emote: null, shown: true, rank: 0 });
      api.snap([p]);
    },
    remove(id) {
      const r = map.get(id); if (!r) return;
      if (r.seat >= 0) world.setSeatOccupied(r.seat, false);
      scene.remove(r.av.group); map.delete(id);
    },
    clear() { for (const id of [...map.keys()]) api.remove(id); },
    snap(list, selfId) {
      for (const s of list) {
        if (s.id === selfId) continue;
        const r = map.get(s.id); if (!r) continue;
        r.t = s;
        if (s.q !== r.seat) {
          if (r.seat >= 0) world.setSeatOccupied(r.seat, false);
          if (s.q >= 0) world.setSeatOccupied(s.q, true);
          r.seat = s.q; r.av.setSeated(s.q >= 0);
        }
        if (s.e !== r.emote) { r.emote = s.e; r.av.setEmote(s.e); }
      }
    },
    seatTaken(i) { for (const r of map.values()) if (r.seat === i) return true; return false; },
    positionOf(id) { const r = map.get(id); return r ? r.av.group.position : null; },
    update(dt, cam, speakingFn) {
      rankT += dt;
      if (rankT > 0.5) { // show only the nearest few
        rankT = 0;
        const arr = [...map.values()].map((r) => ({ r, d: r.av.group.position.distanceToSquared(cam.position) })).sort((a, b) => a.d - b.d);
        arr.forEach((o, i) => { o.r.shown = i < maxShown; o.r.av.group.visible = o.r.shown; });
      }
      const k = 1 - Math.exp(-dt * 14);
      for (const [id, r] of map) {
        const g = r.av.group, t = r.t;
        g.position.x += (t.x - g.position.x) * k; g.position.y += (t.y - g.position.y) * k; g.position.z += (t.z - g.position.z) * k;
        g.rotation.y = lerpAngle(g.rotation.y, t.f, dt * 12);
        if (r.shown) { r.av.update(dt, t.s, t.g); if (speakingFn) r.av.setSpeaking(speakingFn(id)); }
      }
    }
  };
  return api;
}
