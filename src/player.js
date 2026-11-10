// Player movement, gravity, jumping, collisions and the camera.
import * as THREE from 'three';

export const PHYS = { RADIUS: 0.35, HEIGHT: 1.8, STEP: 0.45, GRAVITY: 22, JUMP: 7.2, FLOOR: -2.6, WALK: 3.4, RUN: 6.4 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Player {
  constructor(camera, world) {
    this.camera = camera; this.world = world; this.avatar = null;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0;
    this.face = 0; this.camYaw = 0; this.camPitch = -0.2; this.camDist = 4.2; this.camMode = 'third';
    this.keys = new Set(); this.onGround = true; this.enabled = false; this.sens = 0.0022;
    this.camY = 0; this.hSpeed = 0; this.nearby = null; this.onInteract = null;
    this.axis = { x: 0, y: 0 }; this.runToggle = false; this.seat = null; this.prevMode = 'third'; this.emote = null; this.theatre = false;
    this.standItem = { prompt: 'Stand up', x: 0, z: 0, y: 0, r: 0, message: '' };
    this._target = new THREE.Vector3(); this._want = new THREE.Vector3(); this._dir = new THREE.Vector3();
    this._ray = new THREE.Ray(); this._hit = new THREE.Vector3();
  }

  setAvatar(a) { this.avatar = a; }

  spawn() {
    const s = this.world.spawn;
    this.pos.set(s.x, 0, s.z); this.vel.set(0, 0, 0); this.vy = 0;
    this.camYaw = s.yaw; this.face = s.yaw + Math.PI; this.camPitch = -0.2; this.camY = 0; this.onGround = true; this.keys.clear(); this.axis.x = this.axis.y = 0; this.runToggle = false;
    this.seat = null; this.emote = null; if (this.avatar) { this.avatar.setSeated(false); this.avatar.setEmote(null); } this.world.onSeat && this.world.onSeat(null);
  }

  sitAt(seat) {
    if (this.seat) return;
    this.seat = seat; this.pos.set(seat.x, seat.top, seat.z + 0.12); this.vel.set(0, 0, 0); this.vy = 0; this.onGround = true;
    this.face = Math.PI; this.camYaw = 0; this.camPitch = 0.1; this.prevMode = this.camMode; this.camMode = 'first'; this.emote = null;
    if (this.avatar) { this.avatar.setSeated(true); this.avatar.setEmote(null); } this.world.onSeat && this.world.onSeat(seat);
  }
  standUp() {
    if (!this.seat) return; const s = this.seat; this.seat = null;
    this.onStand && this.onStand();
    this.pos.set(s.x, s.top, s.z - 0.75); this.camMode = this.prevMode; this.camPitch = this.camMode === 'first' ? 0 : -0.2; this.emote = null;
    if (this.avatar) { this.avatar.setSeated(false); this.avatar.setEmote(null); } this.world.onSeat && this.world.onSeat(null);
  }
  setTheatre(on) {
    this.theatre = on; this.enabled = !on; this.keys.clear(); this.axis.x = this.axis.y = 0;
    if (!on) { this.camera.fov = 70; this.camera.updateProjectionMatrix(); }
  }
  theatreCamera() { // a fixed view of the whole screen, sized to fit any phone, tablet or monitor
    const sc = this.world.screen, d = 12.6, cam = this.camera, a = cam.aspect;
    const hf = 2 * Math.atan((sc.w / 2 * 1.06) / d); let vf = 2 * Math.atan(Math.tan(hf / 2) / a);
    vf = Math.min(2.2, Math.max(vf, 2 * Math.atan((sc.h / 2 * 1.06) / d)));
    const fov = (vf * 180) / Math.PI; if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.position.set(0, sc.y, sc.z + d); cam.lookAt(0, sc.y, sc.z);
  }
  toggleEmote(name) { if (!this.enabled) return; this.emote = this.emote === name ? null : name; this.avatar && this.avatar.setEmote(this.emote); }

  keyDown(code) {
    if (!this.enabled) return;
    this.keys.add(code);
    if (code === 'KeyV') { this.camMode = this.camMode === 'third' ? 'first' : 'third'; if (this.camMode === 'first') this.camPitch = 0; else this.camPitch = -0.2; }
    if (code === 'KeyE') { if (this.seat) this.standUp(); else if (this.nearby && this.onInteract) this.onInteract(this.nearby); }
  }
  keyUp(code) { this.keys.delete(code); }
  mouseMove(dx, dy) {
    if (!this.enabled) return;
    this.camYaw -= dx * this.sens; this.camPitch = clamp(this.camPitch - dy * this.sens, -1.3, 1.3);
  }
  wheel(dy) { if (this.enabled) this.camDist = clamp(this.camDist + dy * 0.003, 1.8, 9); }

  groundHeight() {
    let g = PHYS.FLOOR; const { x, z } = this.pos, feet = this.pos.y;
    for (const c of this.world.colliders) {
      if (!c.enabled) continue;
      if (x > c.minX - 0.1 && x < c.maxX + 0.1 && z > c.minZ - 0.1 && z < c.maxZ + 0.1 && c.maxY <= feet + PHYS.STEP + 1e-3 && c.maxY > g) g = c.maxY;
    }
    return g;
  }

  resolveXZ() {
    const R = PHYS.RADIUS, feet = this.pos.y;
    for (let it = 0; it < 3; it++) {
      for (const c of this.world.colliders) {
        if (!c.enabled) continue;
        if (c.maxY <= feet + PHYS.STEP + 1e-3) continue;
        if (c.minY >= feet + PHYS.HEIGHT) continue;
        let x = this.pos.x, z = this.pos.z;
        const px = clamp(x, c.minX, c.maxX), pz = clamp(z, c.minZ, c.maxZ);
        const dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = R - d; x += (dx / d) * push; z += (dz / d) * push; }
        else {
          const l = x - c.minX, r = c.maxX - x, t = z - c.minZ, b = c.maxZ - z, m = Math.min(l, r, t, b);
          if (m === l) x = c.minX - R; else if (m === r) x = c.maxX + R; else if (m === t) z = c.minZ - R; else z = c.maxZ + R;
        }
        this.pos.x = x; this.pos.z = z;
      }
    }
  }

  update(dt) {
    if (this.seat) {
      const k = this.keys, moving = k.has('KeyW') || k.has('KeyA') || k.has('KeyS') || k.has('KeyD') || k.has('Space') || Math.hypot(this.axis.x, this.axis.y) > 0.3;
      if (moving && this.enabled) this.standUp();
      else {
        this.hSpeed = 0; this.nearby = this.enabled ? this.standItem : null;
        if (this.avatar) { this.avatar.group.position.copy(this.pos); this.avatar.group.rotation.y = this.face; this.avatar.group.visible = this.camMode === 'third'; this.avatar.update(dt, 0, true); }
        this.updateCamera(dt); return;
      }
    }
    if (this.enabled) {
      if (this.emote && (this.keys.has('KeyW') || this.keys.has('KeyA') || this.keys.has('KeyS') || this.keys.has('KeyD') || this.keys.has('Space') || Math.hypot(this.axis.x, this.axis.y) > 0.3)) { this.emote = null; this.avatar && this.avatar.setEmote(null); }
      const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.axis.y;
      const r = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.axis.x;
      const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.runToggle;
      let tx = 0, tz = 0;
      if (f || r) {
        const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
        let mx = fx * f + rx * r, mz = fz * f + rz * r; const len = Math.hypot(mx, mz) || 1;
        const sp = (run ? PHYS.RUN : PHYS.WALK) * Math.min(1, Math.hypot(f, r)); tx = (mx / len) * sp; tz = (mz / len) * sp;
      }
      const k = Math.min(1, dt * (this.onGround ? 11 : 3));
      this.vel.x += (tx - this.vel.x) * k; this.vel.z += (tz - this.vel.z) * k;
      if (f || r) { const target = Math.atan2(this.vel.x, this.vel.z); this.face += wrapAngle(target - this.face) * Math.min(1, dt * 12); }
      if (this.keys.has('Space') && this.onGround) { this.vy = PHYS.JUMP; this.onGround = false; this._jumped = true; }
    } else { this.vel.x = this.vel.z = 0; }

    this.hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    this.resolveXZ();

    const wasGround = this.onGround;
    this.vy -= PHYS.GRAVITY * dt; this.pos.y += this.vy * dt;
    const ground = this.groundHeight();
    if (ground > this.pos.y) { this.pos.y = ground; this.vy = 0; this.onGround = true; }
    else if (this.pos.y <= ground + 1e-3) { this.pos.y = ground; this.vy = 0; this.onGround = true; }
    else if (wasGround && !this._jumped && this.pos.y - ground <= PHYS.STEP + 0.05) { this.pos.y = ground; this.vy = 0; this.onGround = true; }
    else this.onGround = false;
    if (this.onGround) this._jumped = false;
    if (this.pos.y < PHYS.FLOOR - 3) this.spawn();

    // nearest interactable
    let best = null, bd = Infinity;
    for (const it of this.world.interactables) {
      const dx = this.pos.x - it.x, dz = this.pos.z - it.z, d = dx * dx + dz * dz;
      if (it.frontOnly && this.pos.z > it.z - 0.1) continue;
      if (d < it.r * it.r && Math.abs(this.pos.y - it.y) < 2.5 && d < bd) { best = it; bd = d; }
    }
    this.nearby = this.enabled ? best : null;

    if (this.avatar) {
      this.avatar.group.position.copy(this.pos); this.avatar.group.rotation.y = this.face;
      this.avatar.group.visible = this.camMode === 'third';
      this.avatar.update(dt, this.hSpeed, this.onGround);
    }
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.camera;
    if (this.theatre) { this.theatreCamera(); return; }
    this.camY = Math.abs(this.pos.y - this.camY) > 1.2 ? this.pos.y : this.camY + (this.pos.y - this.camY) * Math.min(1, dt * 12);
    if (this.camMode === 'first') {
      cam.position.set(this.pos.x, this.camY + (this.seat ? 1.2 : 1.62), this.pos.z);
      cam.rotation.order = 'YXZ'; cam.rotation.set(this.camPitch, this.camYaw, 0);
      return;
    }
    const t = this._target.set(this.pos.x, this.camY + (this.seat ? 1.15 : 1.5), this.pos.z);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dir = this._dir.set(Math.sin(this.camYaw) * cp, -sp, Math.cos(this.camYaw) * cp);
    let dist = this.camDist;
    this._ray.set(t, dir);
    for (const c of this.world.colliders) {
      if (!c.enabled || !c.cam) continue;
      if (this._ray.intersectBox(c.box, this._hit)) { const d = this._hit.distanceTo(t); if (d < dist) dist = d; }
    }
    dist = Math.max(0.6, dist - 0.25);
    this._want.copy(t).addScaledVector(dir, dist);
    this._want.y = Math.max(this._want.y, this.camY + 0.2);
    cam.position.copy(this._want); cam.lookAt(t);
  }
}
