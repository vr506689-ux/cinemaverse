// CINEMAVERSE multiplayer server (Phase 3).
// Free to run: one Node process handles rooms, players, chat and (later) movie sync.
// Rooms live in memory, so they disappear if the server restarts (accounts + saved data arrive in Phase 6).
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { buildSchedule, cleanFilms } from './schedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const PUBLIC_CAP = Number(process.env.PUBLIC_CAP) || 20;     // players per public cinema hall
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 300;
const MAX_PER_IP = Number(process.env.MAX_PER_IP) || 10;
const ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : '*';

const BOUNDS = { minX: -19.7, maxX: 14.6, minZ: -32.5, maxZ: 24.4, minY: -2.8, maxY: 6 };
const SEAT_COUNT = 168;
const VOICE_MAX = Number(process.env.VOICE_MAX) || 8; // voice is peer-to-peer, so each room keeps to a small group
let ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
try { if (process.env.ICE_SERVERS_JSON) ICE = JSON.parse(process.env.ICE_SERVERS_JSON); } catch { console.error('ICE_SERVERS_JSON is not valid JSON; using the default STUN servers.'); }
const MAX_SPEED = 7.5; // run is 6.4 m/s; the rest is slack for lag
const EMOTES = new Set(['wave', 'clap', 'dance', 'cheer']);
const NAME_RE = /^[\p{L}\p{N} _-]{2,16}$/u;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const BAD = /\b(fuck\w*|shit\w*|bitch\w*|asshole|cunt|nigg\w*)\b/gi;

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, online: io.engine.clientsCount }));
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGINS }, maxHttpBufferSize: 1e5, pingInterval: 10000, pingTimeout: 15000 });

// ---------- helpers ----------
const rooms = new Map();
let instanceCounter = 0;
const ipCount = new Map();
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const limiter = (max, ms) => { const hits = []; return () => { const n = Date.now(); while (hits.length && n - hits[0] > ms) hits.shift(); if (hits.length >= max) return false; hits.push(n); return true; }; };
const hashPw = (pw) => { const salt = crypto.randomBytes(16); return { salt, hash: crypto.scryptSync(pw, salt, 32) }; };
const checkPw = (room, pw) => { if (!room.pw) return true; if (typeof pw !== 'string') return false; const h = crypto.scryptSync(pw.slice(0, 64), room.pw.salt, 32); return crypto.timingSafeEqual(h, room.pw.hash); };
const pub = (p) => ({ id: p.id, name: p.name, shirt: p.shirt, x: p.x, y: p.y, z: p.z, f: p.f, s: p.s, g: p.g, e: p.e, q: p.seat });
const info = (r) => ({ code: r.code, name: r.name, isPublic: r.isPublic, max: r.max, locked: !!r.pw, hostId: r.hostId, instance: r.kind === 'instance', count: r.players.size });
const ipOf = (s) => (s.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim() || s.handshake.address;

function newCode() {
  for (let i = 0; i < 60; i++) { const c = 'CINE-' + crypto.randomInt(10000, 100000); if (!rooms.has(c)) return c; }
  return null;
}
function makeInstance() {
  instanceCounter++;
  const room = { code: 'PUBLIC-' + instanceCounter, name: 'Public Cinema #' + instanceCounter, isPublic: true, max: PUBLIC_CAP, kind: 'instance', pw: null, hostId: null, players: new Map(), seats: new Map(), banned: new Set(), dirty: new Set(), timer: null, show: null, voice: new Set() };
  rooms.set(room.code, room); return room;
}
makeInstance();

function leaveCurrent(sock) {
  const code = sock.data.room; if (!code) return;
  sock.data.room = null; sock.leave(code);
  const room = rooms.get(code); if (!room) return;
  const p = room.players.get(sock.id);
  if (p && p.seat >= 0) room.seats.delete(p.seat);
  if (room.voice.delete(sock.id)) io.to(code).emit('voice:state', { id: sock.id, on: false });
  room.players.delete(sock.id); room.dirty.delete(sock.id);
  io.to(code).emit('player:leave', sock.id);
  if (room.hostId === sock.id) { room.hostId = room.kind === 'instance' ? null : (room.players.keys().next().value || null); io.to(code).emit('room:update', { hostId: room.hostId, count: room.players.size }); }
  else io.to(code).emit('room:update', { count: room.players.size });
  if (room.players.size === 0) {
    const isFirst = room.code === 'PUBLIC-1';
    if (!isFirst) { clearTimeout(room.timer); room.timer = setTimeout(() => { if (room.players.size === 0) rooms.delete(code); }, room.kind === 'instance' ? 30000 : 90000); }
  }
}

function joinRoom(sock, room, profile) {
  leaveCurrent(sock);
  clearTimeout(room.timer);
  const p = { id: sock.id, name: profile.name, shirt: profile.shirt, x: 0, y: 0, z: 15, f: Math.PI, s: 0, g: true, e: null, seat: -1, last: Date.now() };
  room.players.set(sock.id, p); sock.join(room.code); sock.data.room = room.code;
  if (room.kind === 'user' && !room.hostId) room.hostId = sock.id;
  sock.to(room.code).emit('player:join', pub(p));
  io.to(room.code).emit('room:update', { count: room.players.size, hostId: room.hostId });
  return { ok: true, room: info(room), you: sock.id, players: [...room.players.values()].map(pub), show: room.show, now: Date.now() };
}

function readProfile(d) {
  const name = clean(d && d.name, 16), shirt = d && d.shirt;
  if (!NAME_RE.test(name)) return { error: 'Use 2 to 16 letters, numbers, spaces, - or _ for your name.' };
  return { name, shirt: typeof shirt === 'string' && COLOR_RE.test(shirt) ? shirt : '#c8323c' };
}
function normaliseCode(c) {
  const s = String(c || '').toUpperCase().replace(/\s/g, '');
  if (/^\d{5}$/.test(s)) return 'CINE-' + s;
  return /^(CINE-\d{5}|PUBLIC-\d{1,3})$/.test(s) ? s : null;
}

// ---------- connections ----------
io.use((sock, next) => {
  const ip = ipOf(sock), n = ipCount.get(ip) || 0;
  if (n >= MAX_PER_IP) return next(new Error('Too many connections from your network.'));
  ipCount.set(ip, n + 1); sock.data.ip = ip; next();
});

io.on('connection', (sock) => {
  const lim = { move: limiter(40, 1000), chat: limiter(4, 5000), create: limiter(3, 60000), join: limiter(12, 30000), misc: limiter(30, 5000), report: limiter(5, 60000) };
  sock.data.room = null; sock.data.owned = 0;
  const ack = (cb, v) => { if (typeof cb === 'function') cb(v); };

  // ----- voice chat: the server only passes connection messages along; the audio itself goes directly between players -----
  sock.on('rtc:config', (_d, cb) => ack(cb, { ok: true, iceServers: ICE }));
  sock.on('voice:join', (_d, cb) => {
    const room = rooms.get(sock.data.room); if (!room || !lim.misc()) return ack(cb, { ok: false, error: 'Join a room first.' });
    if (!room.voice.has(sock.id) && room.voice.size >= VOICE_MAX) return ack(cb, { ok: false, error: `Voice is full (${VOICE_MAX} people per room). You can still use text chat.` });
    const peers = [...room.voice].filter((id) => id !== sock.id); room.voice.add(sock.id);
    sock.to(room.code).emit('voice:state', { id: sock.id, on: true }); ack(cb, { ok: true, peers, max: VOICE_MAX });
  });
  sock.on('voice:leave', (_d, cb) => { const room = rooms.get(sock.data.room); if (room && room.voice.delete(sock.id)) io.to(room.code).emit('voice:state', { id: sock.id, on: false }); ack(cb, { ok: true }); });
  sock.data.sigLim = limiter(300, 10000);
  sock.on('rtc:signal', (d) => {
    const room = rooms.get(sock.data.room); if (!room || !sock.data.sigLim() || !d || typeof d.to !== 'string') return;
    if (!room.voice.has(sock.id) || !room.voice.has(d.to) || !d.data || typeof d.data !== 'object' || !['offer', 'answer', 'candidate'].includes(d.data.type)) return;
    io.to(d.to).emit('rtc:signal', { from: sock.id, data: d.data });
  });
  sock.on('whisper', (d) => {
    const room = rooms.get(sock.data.room); const p = room && room.players.get(sock.id); if (!p) return;
    if (!lim.chat()) return sock.emit('system', { text: 'Slow down a little - too many messages.' });
    const to = room.players.get(String(d && d.to)); const text = clean(d && d.text, 200).replace(BAD, '***');
    if (!to || !text || to.id === p.id) return sock.emit('system', { text: 'Could not send that private message.' });
    const m = { from: p.id, fromName: p.name, to: to.id, toName: to.name, text, t: Date.now() };
    io.to(to.id).emit('whisper', m); sock.emit('whisper', m);
  });

  sock.on('time:sync', (_d, cb) => ack(cb, { now: Date.now() }));
  sock.on('schedule:get', (_d, cb) => { if (!lim.misc()) return ack(cb, { ok: false }); ack(cb, { ok: true, ...buildSchedule() }); });

  // ----- private-room movie controls (host only). Public halls follow the timetable and cannot be paused. -----
  const hostRoom = (cb) => {
    const room = rooms.get(sock.data.room);
    if (!room || room.kind !== 'user') { ack(cb, { ok: false, error: 'Public halls play the scheduled shows. Create your own room to choose a film.' }); return null; }
    if (room.hostId !== sock.id) { ack(cb, { ok: false, error: 'Only the host controls the film.' }); return null; }
    if (!lim.misc()) { ack(cb, { ok: false, error: 'Slow down a little.' }); return null; }
    return room;
  };
  const pushShow = (room) => io.to(room.code).emit('show:update', { show: room.show, now: Date.now() });
  sock.on('movie:set', (d, cb) => {
    const room = hostRoom(cb); if (!room) return;
    let film = null;
    if (d && typeof d.filmId === 'string') film = buildSchedule().films.find((f) => f.id === d.filmId) || null;
    else if (d && typeof d.url === 'string') {
      try { const u = new URL(d.url.trim()); if (u.protocol === 'https:' && !u.username && !u.password && u.href.length < 500) film = { id: 'link', title: clean(d.title, 60) || (u.hostname + u.pathname.split('/').pop()), url: u.href, durationSec: 0 }; } catch { /* invalid */ }
    }
    if (!film) return ack(cb, { ok: false, error: 'Pick a film from the list, or paste a direct https link to a video file.' });
    room.show = { film: { id: film.id, title: film.title, url: film.url, durationSec: film.durationSec }, startedAt: Date.now(), paused: true, pausePos: 0 };
    pushShow(room); ack(cb, { ok: true });
  });
  sock.on('movie:play', (_d, cb) => { const room = hostRoom(cb); if (!room) return; const sh = room.show; if (!sh) return ack(cb, { ok: false, error: 'Load a film first.' }); if (sh.paused) { sh.startedAt = Date.now() - sh.pausePos * 1000; sh.paused = false; pushShow(room); } ack(cb, { ok: true }); });
  sock.on('movie:pause', (_d, cb) => { const room = hostRoom(cb); if (!room) return; const sh = room.show; if (sh && !sh.paused) { sh.pausePos = Math.max(0, (Date.now() - sh.startedAt) / 1000); sh.paused = true; pushShow(room); } ack(cb, { ok: true }); });
  sock.on('movie:seek', (d, cb) => { const room = hostRoom(cb); if (!room) return; const sh = room.show, pos = Number(d && d.pos); if (!sh || !Number.isFinite(pos)) return ack(cb, { ok: false }); const p = Math.min(Math.max(pos, 0), 86400); if (sh.paused) sh.pausePos = p; else sh.startedAt = Date.now() - p * 1000; pushShow(room); ack(cb, { ok: true }); });
  sock.on('movie:stop', (_d, cb) => { const room = hostRoom(cb); if (!room) return; room.show = null; pushShow(room); ack(cb, { ok: true }); });

  sock.on('lobby:list', (_d, cb) => {
    if (!lim.misc()) return ack(cb, { ok: false, error: 'Slow down a little.' });
    const list = [...rooms.values()].filter((r) => r.isPublic).map(info).sort((a, b) => Number(b.instance) - Number(a.instance) || a.name.localeCompare(b.name));
    ack(cb, { ok: true, online: io.engine.clientsCount, rooms: list });
  });

  sock.on('room:joinPublic', (d, cb) => {
    if (!lim.join()) return ack(cb, { ok: false, error: 'Too many tries. Wait a moment.' });
    const prof = readProfile(d); if (prof.error) return ack(cb, { ok: false, error: prof.error });
    let room = [...rooms.values()].find((r) => r.kind === 'instance' && r.players.size < r.max && !r.banned.has(sock.data.ip));
    if (!room) { if (rooms.size >= MAX_ROOMS) return ack(cb, { ok: false, error: 'The cinema is very busy. Try again soon.' }); room = makeInstance(); }
    ack(cb, joinRoom(sock, room, prof));
  });

  sock.on('room:create', (d, cb) => {
    if (!lim.create()) return ack(cb, { ok: false, error: 'You are creating rooms too fast. Wait a minute.' });
    const prof = readProfile(d); if (prof.error) return ack(cb, { ok: false, error: prof.error });
    const name = clean(d && d.name, 30) || prof.name + "'s cinema";
    const max = Math.min(PUBLIC_CAP, Math.max(2, Math.floor(Number(d && d.max)) || 10));
    const password = typeof (d && d.password) === 'string' ? d.password.slice(0, 32) : '';
    if (sock.data.owned >= 3) return ack(cb, { ok: false, error: 'You can only host 3 rooms at once.' });
    if (rooms.size >= MAX_ROOMS) return ack(cb, { ok: false, error: 'The server is full of rooms. Try again soon.' });
    const code = newCode(); if (!code) return ack(cb, { ok: false, error: 'Could not make a room code. Try again.' });
    const room = { code, name, isPublic: !!(d && d.isPublic), max, kind: 'user', pw: password ? hashPw(password) : null, hostId: null, players: new Map(), seats: new Map(), banned: new Set(), dirty: new Set(), timer: null, show: null, voice: new Set() };
    rooms.set(code, room); sock.data.owned++;
    ack(cb, joinRoom(sock, room, prof));
  });

  sock.on('room:joinCode', (d, cb) => {
    if (!lim.join()) return ack(cb, { ok: false, error: 'Too many tries. Wait a moment.' });
    const prof = readProfile(d); if (prof.error) return ack(cb, { ok: false, error: prof.error });
    const code = normaliseCode(d && d.code); if (!code) return ack(cb, { ok: false, error: 'That does not look like a room code. It should look like CINE-48291.' });
    const room = rooms.get(code); if (!room) return ack(cb, { ok: false, error: 'No room with that code. Check it and try again.' });
    if (room.banned.has(sock.data.ip)) return ack(cb, { ok: false, error: 'You were removed from this room by the host.' });
    if (room.players.size >= room.max && !room.players.has(sock.id)) return ack(cb, { ok: false, error: 'That room is full.' });
    if (room.pw && !checkPw(room, d && d.password)) return ack(cb, { ok: false, needPassword: true, error: d && d.password ? 'Wrong password.' : 'This room needs a password.' });
    ack(cb, joinRoom(sock, room, prof));
  });

  sock.on('room:leave', (_d, cb) => { leaveCurrent(sock); ack(cb, { ok: true }); });

  sock.on('move', (m) => {
    const room = rooms.get(sock.data.room); if (!room || !lim.move()) return;
    const p = room.players.get(sock.id); if (!p || !m || typeof m !== 'object') return;
    for (const k of ['x', 'y', 'z', 'f', 's']) if (!Number.isFinite(m[k])) return;
    const x = m.x, y = m.y, z = m.z;
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ || y < BOUNDS.minY || y > BOUNDS.maxY) { sock.emit('correct', { x: p.x, y: p.y, z: p.z }); return; }
    const now = Date.now(), dt = Math.min(1, Math.max(0.03, (now - p.last) / 1000));
    const dist = Math.hypot(x - p.x, z - p.z), allow = MAX_SPEED * dt + (p.seat >= 0 || p.justSat ? 1.6 : 0.6);
    if (dist > allow) { sock.emit('correct', { x: p.x, y: p.y, z: p.z }); return; }
    p.justSat = false; p.last = now; p.x = x; p.y = y; p.z = z; p.f = m.f; p.s = Math.min(Math.max(m.s, 0), 10); p.g = !!m.g;
    p.e = EMOTES.has(m.e) ? m.e : null; room.dirty.add(p.id);
  });

  sock.on('sit', (d, cb) => {
    const room = rooms.get(sock.data.room); const p = room && room.players.get(sock.id); if (!p || !lim.misc()) return ack(cb, { ok: false });
    const i = Number(d && d.i); if (!Number.isInteger(i) || i < 0 || i >= SEAT_COUNT) return ack(cb, { ok: false, error: 'No such seat.' });
    const holder = room.seats.get(i); if (holder && holder !== sock.id) return ack(cb, { ok: false, error: 'That seat is taken.' });
    if (p.seat >= 0) room.seats.delete(p.seat);
    room.seats.set(i, sock.id); p.seat = i; p.justSat = true; room.dirty.add(p.id); ack(cb, { ok: true });
  });
  sock.on('stand', () => {
    const room = rooms.get(sock.data.room); const p = room && room.players.get(sock.id); if (!p || p.seat < 0) return;
    room.seats.delete(p.seat); p.seat = -1; p.justSat = true; room.dirty.add(p.id);
  });

  sock.on('chat', (d) => {
    const room = rooms.get(sock.data.room); const p = room && room.players.get(sock.id); if (!p) return;
    if (!lim.chat()) return sock.emit('system', { text: 'Slow down a little - too many messages.' });
    const text = clean(d && d.text, 200).replace(BAD, '***'); if (!text) return;
    io.to(room.code).emit('chat', { id: p.id, name: p.name, text, t: Date.now() });
  });

  sock.on('report', (d, cb) => {
    const room = rooms.get(sock.data.room); if (!room || !lim.report()) return ack(cb, { ok: false });
    const target = room.players.get(String(d && d.id)); if (!target) return ack(cb, { ok: false });
    console.log(`[REPORT] room=${room.code} reporter=${sock.id} target=${target.id} (${target.name}) reason=${clean(d && d.reason, 80)}`);
    ack(cb, { ok: true });
  });

  sock.on('kick', (d, cb) => {
    const room = rooms.get(sock.data.room); if (!room || room.hostId !== sock.id) return ack(cb, { ok: false, error: 'Only the host can remove players.' });
    const id = String(d && d.id); if (id === sock.id || !room.players.has(id)) return ack(cb, { ok: false });
    const t = io.sockets.sockets.get(id); if (!t) return ack(cb, { ok: false });
    room.banned.add(t.data.ip); t.emit('kicked', { reason: 'The host removed you from the room.' }); leaveCurrent(t); ack(cb, { ok: true });
  });

  sock.on('disconnect', () => {
    leaveCurrent(sock);
    const n = (ipCount.get(sock.data.ip) || 1) - 1; if (n <= 0) ipCount.delete(sock.data.ip); else ipCount.set(sock.data.ip, n);
  });
});

// send changed player states to each room 15 times a second
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.dirty.size) continue;
    const list = [];
    for (const id of room.dirty) { const p = room.players.get(id); if (p) list.push(pub(p)); }
    room.dirty.clear(); if (list.length) io.to(room.code).emit('snap', list);
  }
}, 66);

server.listen(PORT, () => console.log(`CINEMAVERSE server listening on port ${PORT}`));
