import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCinema } from './world.js';
import { createAvatar } from './avatar.js';
import { Player } from './player.js';
import { createNPCs } from './npcs.js';
import { createMovie } from './movie.js';
import { createChat } from './chat.js';
import { createTouch } from './touch.js';
import { createNet } from './net.js';
import { createRemotePlayers } from './remote.js';
import { createLive } from './liveshow.js';
import { createVoice } from './voice.js';

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

// ---------- what kind of device is this? ----------
const ua = navigator.userAgent;
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
const lowEnd = isTouch || (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
if (isTouch) document.body.classList.add('touch');

// ---------- saved settings (kept in your own browser only) ----------
const KEY = 'cinemaverse.settings.v2';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
const saved = load();
const settings = { name: '', shirt: '#c8323c', quality: lowEnd ? 'low' : 'medium', sens: 1, exposure: 1, look: 'drag', voice: 'open', ...saved };
function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ } }

// ---------- renderer / scene ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' }); }
catch (e) { show('fatal'); hide('menu'); throw e; }
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('stage').appendChild(renderer.domElement);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0709);
try { scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22; } catch { /* older GPUs: skip reflections */ }

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 120);
const world = buildCinema(scene);
const player = new Player(camera, world);
const npcs = createNPCs(scene, world);
const remote = createRemotePlayers(scene, world);
let avatar = null;

// ---------- quality ----------
const dpr = window.devicePixelRatio || 1;
const QUALITY = {
  low: () => ({ pr: 1, shadows: false, map: 512, lowLights: true, beam: false }),
  medium: () => ({ pr: Math.min(dpr, 1.25), shadows: false, map: 1024, lowLights: false, beam: false }),
  high: () => ({ pr: Math.min(dpr, 2), shadows: true, map: 2048, lowLights: false, beam: true })
};
function applyQuality(name) {
  const q = QUALITY[name](); settings.quality = name;
  renderer.setPixelRatio(q.pr);
  renderer.shadowMap.enabled = q.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  for (const l of world.shadowLights) { l.castShadow = q.shadows; l.shadow.mapSize.set(q.map, q.map); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
  for (const { light, lowOff } of world.lights) light.visible = !(q.lowLights && lowOff);
  world.setBeamEnabled(q.beam); npcs.setQuality(name); remote.setMax(name === 'low' ? 5 : name === 'medium' ? 10 : 20);
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  resize(); syncSettingsUI(); save();
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- menu ----------
const COLORS = ['#c8323c', '#e0892f', '#d8c13a', '#3fa361', '#2f8fd0', '#7a56c9', '#d46aa6', '#f2f2f2'];
const sw = $('swatches');
COLORS.forEach((c) => {
  const b = document.createElement('button'); b.className = 'swatch'; b.style.background = c; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Shirt colour ' + c);
  b.addEventListener('click', () => { settings.shirt = c; syncSwatches(); }); sw.appendChild(b);
});
function syncSwatches() { [...sw.children].forEach((b, i) => b.setAttribute('aria-checked', String(COLORS[i] === settings.shirt))); }
$('nameInput').value = settings.name; syncSwatches();
function placeNotches() { $('ticket').style.setProperty('--y', $('perf').offsetTop + 'px'); }
requestAnimationFrame(placeNotches); window.addEventListener('resize', placeNotches);
if (isTouch) { $('touchNote').textContent = 'Phone and tablet controls are on: a joystick on the left, swipe on the right to look.'; $('touchNote').hidden = false; }

// ---------- chat ----------
const chat = createChat({ panel: $('chat'), log: $('chatLog'), input: $('chatInput'), send: $('chatSend'), btn: $('chatBtn'), badge: $('chatBadge'), closeBtn: $('chatClose') });
const BOT = [[/\b(hi|hello|hey|vanakkam)\b/i, 'Hello! Welcome to Cinemaverse.'], [/popcorn|snack|food/i, 'The snack bar is on the right as you come in. Fresh popcorn!'], [/movie|film|play|watch/i, 'Press M (or the Movie button) to start a film. The lights go down by themselves.'], [/ticket/i, 'Tickets are free for now. Rooms with codes arrive in Phase 3.'], [/friend|room|code/i, 'Playing with friends arrives in Phase 3. Soon!'], [/help/i, 'Move with W A S D, jump with Space, press E near staff, C for chat, M for movies.']];
chat.onSend = (text) => {
  if (online) {
    if (/^\/(w|msg|whisper)\s/i.test(text)) {
      const rest = text.replace(/^\/\S+\s+/, ''), others = [...online.players.values()].filter((p) => p.id !== online.you).sort((a, b) => b.name.length - a.name.length);
      const t = others.find((p) => rest.toLowerCase().startsWith(p.name.toLowerCase() + ' '));
      if (!t) chat.add('System', 'Private message: type /w Name your message (the name must match a player in this room).', 'sys'); else net.whisper(t.id, rest.slice(t.name.length + 1));
      return;
    }
    net.chat(text); return;
  }
  chat.add(settings.name || 'You', text, 'me');
  setTimeout(() => { const hit = BOT.find(([re]) => re.test(text)); const n = npcs.ambient(); chat.add(n.name, hit ? hit[1] : n.text, 'npc'); }, 900 + Math.random() * 700);
};
setInterval(() => { if (state !== 'menu' && !online && Math.random() < 0.6) { const n = npcs.ambient(); chat.add(n.name, n.text, 'npc'); } }, 50000);

// ---------- movie ----------
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let moviePanelOpen = false, seeking = false;
const movie = createMovie({
  screenMesh: world.screenMesh, idleTexture: world.idleTexture, overlayEl: $('videoOverlay'),
  onChange: (i) => { if (live.active) return; world.setCinema(i.state === 'playing' ? 1 : i.state === 'paused' ? 0.45 : 0, i.state !== 'idle'); refreshMovieUI(i); },
  onError: (m) => { $('movieStatus').textContent = m; toast(m); },
  onNotice: (m) => toast(m)
});
function refreshMovieUI(i = movie.info()) {
  const online_ = live.active, host = online_ && !live.isInstance && online && online.room.hostId === online.you;
  $('mpSolo').classList.toggle('hidden', online_); $('mpSchedule').classList.toggle('hidden', !(online_ && live.isInstance)); $('mpHost').classList.toggle('hidden', !host);
  if (online_) {
    $('movieStatus').textContent = live.status();
    $('movieNote').textContent = live.isInstance ? 'Public halls play the timetable for everyone at once. Nobody can pause or skip, and you can join any time.' : (host ? 'You are the host: you control the film for everyone in this room.' : 'The host controls the film for this room.');
    if (live.isInstance) renderSchedule(); else if (host) renderHost();
    return;
  }
  const idle = i.state === 'idle';
  $('playPause').disabled = idle; $('stopBtn').disabled = idle; $('seek').disabled = idle || !i.duration;
  $('playPause').textContent = i.state === 'playing' ? 'Pause' : 'Play';
  if (!seeking) { $('seek').value = i.duration ? Math.round((i.time / i.duration) * 1000) : 0; }
  $('timeText').textContent = fmt(i.time) + (i.duration ? ' / ' + fmt(i.duration) : '');
  if (idle) { if (!$('movieStatus').dataset.err) $('movieStatus').textContent = 'Nothing playing. Pick a film below and the lights will go down.'; }
  else $('movieStatus').textContent = (i.loading ? 'Loading: ' : i.state === 'playing' ? 'Now playing: ' : 'Paused: ') + i.title;
}
let schedSig = '';
function renderSchedule() {
  const rows = live.rows(), box = $('schedList'), sig = JSON.stringify(rows); if (sig === schedSig) return; schedSig = sig; box.textContent = '';
  if (!rows.length) { box.textContent = 'Loading showtimes...'; return; }
  for (const r of rows) {
    const d = document.createElement('div'); d.className = 'srow' + (r.playing ? ' now' : '');
    const b = document.createElement('b'); b.textContent = r.title + (r.year ? ` (${r.year})` : '');
    const w = document.createElement('div'); w.textContent = `${r.when} - ${r.ends} - ${r.mins} min`; const s = document.createElement('small'); s.textContent = r.desc;
    d.append(b, w, s); box.appendChild(d);
  }
}
let hostFilled = false;
function renderHost() {
  const sel = $('hostFilm'); if (!hostFilled && live.films().length) { hostFilled = true; for (const f of live.films()) { const o = document.createElement('option'); o.value = f.id; o.textContent = f.title; sel.appendChild(o); } }
  const sh = live.roomShow(), dur = live.duration(); $('hostPlay').textContent = sh && !sh.paused ? 'Pause' : 'Play'; $('hostPlay').disabled = !sh; $('hostStop').disabled = !sh; $('hostSeek').disabled = !sh || !dur;
  $('hostTime').textContent = fmt(live.position()) + (dur ? ' / ' + fmt(dur) : ''); if (dur && !seeking) $('hostSeek').value = Math.round(Math.min(1, live.position() / dur) * 1000);
}
const hostDo = async (p) => { const r = await p; if (!r.ok) toast(r.error || 'The host action failed.'); };
$('hostSet').addEventListener('click', () => hostDo(net.movieSet({ filmId: $('hostFilm').value })));
$('hostUrlBtn').addEventListener('click', () => { const u = $('hostUrl').value.trim(); if (u) hostDo(net.movieSet({ url: u })); });
$('hostPlay').addEventListener('click', () => { const sh = live.roomShow(); if (sh) hostDo(sh.paused ? net.moviePlay() : net.moviePause()); });
$('hostStop').addEventListener('click', () => hostDo(net.movieStop()));
$('hostSeek').addEventListener('pointerdown', () => { seeking = true; });
$('hostSeek').addEventListener('change', (e) => { const d = live.duration(); if (d) hostDo(net.movieSeek((+e.target.value / 1000) * d)); });
$('showChip').addEventListener('click', () => toggleMovie(true));
window.addEventListener('pointerdown', () => movie.retry()); window.addEventListener('keydown', () => movie.retry());
$('demoBtn').addEventListener('click', () => movie.playDemo());
$('fileInput').addEventListener('change', (e) => { movie.playFile(e.target.files[0]); e.target.value = ''; });
$('urlBtn').addEventListener('click', () => { const v = $('urlInput').value.trim(); if (v) movie.playUrl(v); });
$('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('urlBtn').click(); });
$('playPause').addEventListener('click', () => movie.toggle());
$('stopBtn').addEventListener('click', () => movie.stop());
$('volume').addEventListener('input', (e) => movie.setVolume(+e.target.value));
$('seek').addEventListener('pointerdown', () => { seeking = true; });
$('seek').addEventListener('input', (e) => movie.seek(+e.target.value / 1000));
window.addEventListener('pointerup', () => { seeking = false; });
$('movieClose').addEventListener('click', () => toggleMovie(false));
$('movieBtn').addEventListener('click', () => toggleMovie());

// ---------- game state ----------
let state = 'menu'; // menu | playing | paused
let releasing = false, prevOverlay = 'menu';
const EMOTES = ['wave', 'clap', 'dance', 'cheer'];
const lockMode = () => !isTouch && settings.look === 'lock';
const uiOpen = () => chat.isOpen || moviePanelOpen;

function relockIfNeeded() { if (state === 'playing' && lockMode() && !uiOpen() && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); }
function releaseLock() { if (document.pointerLockElement) { releasing = true; document.exitPointerLock(); } }
function toggleMovie(force) {
  moviePanelOpen = force === undefined ? !moviePanelOpen : force;
  $('moviePanel').classList.toggle('hidden', !moviePanelOpen); $('movieBtn').setAttribute('aria-expanded', String(moviePanelOpen));
  if (moviePanelOpen) { releaseLock(); refreshMovieUI(); } else relockIfNeeded();
}
chat.onToggle = (open) => { if (open) releaseLock(); else { $('chatInput').blur(); relockIfNeeded(); } };

// ---------- online rooms ----------
let online = null; // { room, you, players: Map }
const muted = new Set();
const live = createLive({ getNet: () => net, movie, world, chip: $('showChip') });
const net = createNet({
  onPlayerJoin(p) { if (!online) return; online.players.set(p.id, p); remote.add(p); chat.add('System', `${p.name} joined.`, 'sys'); refreshRoomUI(); },
  onPlayerLeave(id) { if (!online) return; const p = online.players.get(id); remote.remove(id); online.players.delete(id); muted.delete(id); if (p) chat.add('System', `${p.name} left.`, 'sys'); refreshRoomUI(); },
  onSnap(list) { if (online) remote.snap(list, net.id); },
  onChat(m) { if (!online || muted.has(m.id)) return; chat.add(m.name, m.text, m.id === net.id ? 'me' : 'other'); },
  onSystem(m) { chat.add('System', m.text, 'sys'); },
  onRoomUpdate(u) { if (!online) return; Object.assign(online.room, u); refreshRoomUI(); if (moviePanelOpen) refreshMovieUI(); },
  onShow(u) { live.setRoomShow(u.show); },
  onSignal(from, data) { voice.onSignal(from, data); },
  onVoiceState(id, on) { voice.onState(id, on); },
  onWhisper(m) { if (muted.has(m.from)) return; chat.add(m.from === net.id ? `To ${m.toName}` : `${m.fromName} (private)`, m.text, 'whisper'); },
  onKicked(k) { toast(k.reason || 'You were removed from the room.'); toMenu(); },
  onCorrect(c) { if (state !== 'menu' && !player.seat) { player.pos.set(c.x, c.y, c.z); player.vel.set(0, 0, 0); } },
  onDisconnect() { if (online) { toast('Connection lost. Trying to reconnect...'); voice.leave(); } },
  onReconnect(r) { if (!online) return; if (!r.ok) { toast(r.error || 'Could not rejoin the room.'); toMenu(); } else { if (player.seat) player.standUp(); adoptRoom(r); toast('Reconnected.'); } }
});
// ---------- voice ----------
const voice = createVoice({ getNet: () => net, getLocalPos: () => player.pos, getRemotePos: (id) => remote.positionOf(id), onStatus: () => updateMicUI(), onNotice: (m) => toast(m) });
voice.setPtt(settings.voice === 'ptt');
function updateMicUI() {
  const b = $('micBtn'); if (!online) { b.classList.add('hidden'); $('micLeave').classList.add('hidden'); return; }
  const st = voice.status(), ptt = settings.voice === 'ptt';
  b.classList.remove('hidden'); $('micLeave').classList.toggle('hidden', !voice.joined);
  b.textContent = { off: 'Join voice', connecting: 'Connecting...', on: 'Mic on', muted: ptt ? 'Hold to talk (B)' : 'Muted', listening: 'Listening only', unavailable: 'Voice needs https' }[st];
  b.classList.toggle('live', st === 'on'); b.classList.toggle('muted', st === 'muted'); b.classList.toggle('speaking', voice.localSpeaking);
}
$('micBtn').addEventListener('click', () => { if (!voice.joined) voice.join(); else if (settings.voice !== 'ptt') voice.toggleMic(); });
$('micBtn').addEventListener('pointerdown', () => { if (voice.joined && settings.voice === 'ptt') voice.pttPress(true); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('micBtn').addEventListener(ev, () => { if (settings.voice === 'ptt') voice.pttPress(false); });
$('micLeave').addEventListener('click', () => voice.leave());

function adoptRoom(r) {
  voice.setProximity(!!r.room.instance);
  live.enterRoom(r.room, r.show); hostFilled = false; $('hostFilm').textContent = '';
  remote.clear(); online = { room: r.room, you: r.you, players: new Map(r.players.map((p) => [p.id, p])) };
  for (const p of r.players) if (p.id !== r.you) remote.add(p);
  refreshRoomUI();
}
function leaveRoom() { live.leave(); voice.leave(); if (online) { net.leave(); remote.clear(); online = null; muted.clear(); refreshRoomUI(); } }
function refreshRoomUI() {
  const on = !!online; updateMicUI();
  $('roomCard').classList.toggle('hidden', !on); $('playersBtn').classList.toggle('hidden', !on);
  if (!on) { $('playersPanel').classList.add('hidden'); return; }
  const r = online.room, n = online.players.size;
  $('rcName').textContent = r.name; $('rcCode').textContent = r.instance ? `Public hall - ${n}/${r.max}` : `${r.code} - ${n}/${r.max}`;
  $('rcCopy').classList.toggle('hidden', r.instance); $('playerCount').textContent = n;
  const box = $('playersList'); box.textContent = ''; const iAmHost = r.hostId === online.you;
  for (const p of online.players.values()) {
    const row = document.createElement('div'); row.className = 'prow';
    const dot = document.createElement('i'); dot.style.background = p.shirt; const nm = document.createElement('span');
    nm.textContent = p.name + (p.id === online.you ? ' (you)' : '') + (p.id === r.hostId ? ' - host' : ''); row.append(dot, nm);
    if (p.id !== online.you) {
      const mk = (label, act) => { const b = document.createElement('button'); b.className = 'mini'; b.textContent = label; b.dataset.act = act; b.dataset.id = p.id; row.appendChild(b); };
      mk(muted.has(p.id) ? 'Unmute' : 'Mute', 'mute'); mk('Report', 'report'); if (iAmHost) mk('Remove', 'kick');
    }
    box.appendChild(row);
  }
}
$('playersList').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || !online) return; const id = b.dataset.id, p = online.players.get(id);
  if (b.dataset.act === 'mute') { muted.has(id) ? muted.delete(id) : muted.add(id); voice.setMuted(id, muted.has(id)); refreshRoomUI(); }
  else if (b.dataset.act === 'report') { const r = await net.report(id, 'reported from player list'); toast(r.ok ? `Reported ${p ? p.name : 'player'}. Thank you.` : 'Could not send the report.'); }
  else if (b.dataset.act === 'kick') { const r = await net.kick(id); toast(r.ok ? 'Player removed.' : (r.error || 'Could not remove that player.')); }
});
function togglePlayers(force) { const open = force === undefined ? $('playersPanel').classList.contains('hidden') : force; $('playersPanel').classList.toggle('hidden', !open); $('playersBtn').setAttribute('aria-expanded', String(open)); }
$('playersBtn').addEventListener('click', () => togglePlayers()); $('playersClose').addEventListener('click', () => togglePlayers(false));
$('rcCopy').addEventListener('click', async () => {
  if (!online) return; const link = `${location.origin}${location.pathname}?room=${online.room.code}`;
  try { await navigator.clipboard.writeText(link); toast('Invite link copied. Friends open it, pick a name, and they are in' + (online.room.locked ? ' (they need the password).' : '.')); }
  catch { window.prompt('Copy this invite link:', link); }
});

// ---------- starting the game ----------
const PANELS = ['rooms', 'createRoom', 'joinRoom'];
let busy = false;
function readName() {
  const name = $('nameInput').value.trim();
  if (!/^[\p{L}\p{N} _-]{2,16}$/u.test(name)) { $('nameError').textContent = 'First type a name: 2 to 16 letters, numbers, spaces, - or _.'; $('nameInput').focus(); return null; }
  $('nameError').textContent = ''; settings.name = name; save(); return name;
}
const profile = () => ({ name: settings.name, shirt: settings.shirt });

function beginPlay(onl) {
  if (onl) online = onl; else online = null;
  if (avatar) scene.remove(avatar.group);
  avatar = createAvatar({ shirt: settings.shirt, name: settings.name });
  scene.add(avatar.group); player.setAvatar(avatar); player.sens = 0.0022 * settings.sens;
  player.onStand = () => { if (online) net.stand(); };
  player.spawn(); player.enabled = true; state = 'playing';
  PANELS.forEach(hide); hide('menu'); show('hud'); $('touchUI').classList.toggle('hidden', !isTouch); $('dot').classList.add('hidden');
  if (online) {
    const r = online.room;
    chat.add('System', `Welcome, ${settings.name}! You are in "${r.name}".` + (r.instance ? '' : ` Room code: ${r.code}. Use "Copy invite link" to bring friends.`), 'sys');
  } else chat.add('System', `Welcome, ${settings.name}! You are practising alone. Press C to chat, M for movies.`, 'sys');
  refreshRoomUI(); relockIfNeeded();
}
async function guarded(fn) { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } }
async function connectOrFail(errEl) { const c = await net.connect(); if (!c.ok) { errEl.textContent = c.error + ' You can still use "Practice alone".'; return false; } return true; }
async function joinWith(call, errEl) {
  const r = await call(); if (!r.ok) { errEl.textContent = r.error || 'Could not join.'; return r; }
  adoptRoom(r); beginPlay(online); return r;
}
const enterPublic = () => guarded(async () => { if (!readName()) return; if (!(await connectOrFail($('nameError')))) return; $('nameError').textContent = 'Joining...'; const r = await joinWith(() => net.joinPublic(profile()), $('nameError')); if (r.ok) $('nameError').textContent = ''; });
$('enterBtn').addEventListener('click', enterPublic);
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') enterPublic(); });
$('soloBtn').addEventListener('click', () => { if (readName()) beginPlay(null); });

function showPanel(id) { hide('menu'); PANELS.forEach(hide); show(id); }
function backToMenu() { PANELS.forEach(hide); show('menu'); requestAnimationFrame(placeNotches); }
['roomsBack', 'crBack', 'jrBack'].forEach((id) => $(id).addEventListener('click', backToMenu));

// public rooms list
async function loadRooms() {
  $('roomsErr').textContent = ''; $('roomList').textContent = 'Loading...';
  if (!(await connectOrFail($('roomsErr')))) { $('roomList').textContent = ''; return; }
  const r = await net.lobby(); const box = $('roomList'); box.textContent = '';
  if (!r.ok) { $('roomsErr').textContent = r.error || 'Could not load rooms.'; return; }
  $('roomsInfo').textContent = `${r.online} online now`;
  for (const rm of r.rooms) {
    const row = document.createElement('div'); row.className = 'room';
    const nm = document.createElement('b'); nm.textContent = rm.name; const sm = document.createElement('small'); sm.textContent = `${rm.count}/${rm.max}` + (rm.locked ? ' - password' : '');
    const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = rm.count >= rm.max ? 'Full' : 'Join'; b.disabled = rm.count >= rm.max;
    b.addEventListener('click', () => { if (rm.locked) openJoin(rm.code); else guarded(() => joinWith(() => net.joinCode(profile(), rm.code, ''), $('roomsErr'))); });
    row.append(nm, sm, b); box.appendChild(row);
  }
}
$('browseBtn').addEventListener('click', () => { if (!readName()) return; showPanel('rooms'); loadRooms(); });
$('roomsRefresh').addEventListener('click', () => guarded(loadRooms));
$('quickJoin').addEventListener('click', () => guarded(async () => { if (await connectOrFail($('roomsErr'))) await joinWith(() => net.joinPublic(profile()), $('roomsErr')); }));

// create a room
$('crVis').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => $('crVis').querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)))));
$('createBtn').addEventListener('click', () => { if (!readName()) return; $('crErr').textContent = ''; showPanel('createRoom'); $('crName').focus(); });
$('crGo').addEventListener('click', () => guarded(async () => {
  $('crErr').textContent = ''; if (!(await connectOrFail($('crErr')))) return;
  const opts = { name: $('crName').value.trim(), isPublic: $('crVis').querySelector('[aria-pressed=true]').dataset.v === 'public', max: Number($('crMax').value), password: $('crPw').value };
  await joinWith(() => net.createRoom(profile(), opts), $('crErr')); $('crPw').value = '';
}));

// join with a code
function openJoin(code) { if (!readName()) return; $('jrErr').textContent = ''; $('jrPw').value = ''; $('jrPwField').classList.add('hidden'); if (code) $('jrCode').value = code; showPanel('joinRoom'); (code ? $('jrPw') : $('jrCode')).focus(); }
$('joinBtn').addEventListener('click', () => openJoin());
$('jrGo').addEventListener('click', () => guarded(async () => {
  $('jrErr').textContent = ''; if (!(await connectOrFail($('jrErr')))) return;
  const r = await joinWith(() => net.joinCode(profile(), $('jrCode').value, $('jrPw').value), $('jrErr'));
  if (r && r.needPassword) { $('jrPwField').classList.remove('hidden'); $('jrPw').focus(); }
  if (r && r.ok) $('jrPw').value = '';
}));
$('jrCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('jrGo').click(); }); $('jrPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('jrGo').click(); });

// invite links look like  https://your-site/?room=CINE-48291
const invite = new URLSearchParams(location.search).get('room');
if (invite && /^(CINE-\d{5}|\d{5})$/i.test(invite.trim())) {
  const code = /^\d{5}$/.test(invite.trim()) ? 'CINE-' + invite.trim() : invite.trim().toUpperCase();
  $('jrCode').value = code; $('inviteNote').textContent = `You have been invited to room ${code}. Type your name, then press "Join with a code".`; $('inviteNote').hidden = false;
  if (/^[\p{L}\p{N} _-]{2,16}$/u.test(settings.name || '')) setTimeout(() => openJoin(), 50);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused'; player.enabled = false; player.keys.clear(); touch.reset(); releaseLock(); show('pause');
}
function resumeGame() { hide('pause'); state = 'playing'; player.enabled = true; relockIfNeeded(); }
function toMenu() { exitTheatre(); setUiHidden(false); state = 'menu'; player.enabled = false; hide('pause'); hide('hud'); show('menu'); leaveRoom(); togglePlayers(false); PANELS.forEach(hide); movie.stop(); chat.toggle(false); toggleMovie(false); releaseLock(); requestAnimationFrame(placeNotches); }
$('leaveBtn').addEventListener('click', toMenu);
$('resumeBtn').addEventListener('click', resumeGame);
$('menuBtn').addEventListener('click', pauseGame);

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { if (state === 'paused') { hide('pause'); state = 'playing'; player.enabled = true; } }
  else if (state === 'playing' && !releasing && !uiOpen() && lockMode()) pauseGame();
  releasing = false;
});

// look: hold-and-drag (default) or locked cursor
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (theatre || document.body.classList.contains('hideui')) { showBar(); return; }
  if (e.pointerType === 'touch' || state !== 'playing') return;
  if (lockMode()) { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); return; }
  dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => { if (dragging && state === 'playing') { player.mouseMove(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; } });
const endDrag = () => { dragging = false; canvas.style.cursor = ''; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) player.mouseMove(e.movementX, e.movementY); });
window.addEventListener('wheel', (e) => { if (state === 'playing' && e.target === canvas) player.wheel(e.deltaY); }, { passive: true });
window.addEventListener('blur', () => { player.keys.clear(); endDrag(); });

// ---------- keyboard ----------
function toggleView() { if (player.seat) return; player.keyDown('KeyV'); $('dot').classList.toggle('hidden', player.camMode !== 'first'); }
window.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement;
  if (typing) { if (e.key === 'Escape') { if (e.target.id === 'chatInput') chat.toggle(false); else e.target.blur(); } return; }
  if (state !== 'playing' && state !== 'paused') return;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (theatre) { exitTheatre(); return; }
    if (document.body.classList.contains('hideui')) { setUiHidden(false); return; }
    if (uiOpen()) { chat.toggle(false); toggleMovie(false); } else if (state === 'playing') pauseGame(); else if ($('settings').classList.contains('hidden')) resumeGame();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'KeyT') { theatre ? exitTheatre() : enterTheatre(); return; }
  if (e.code === 'KeyF') { toggleFs(); return; }
  if (e.code === 'KeyH') { setUiHidden(!document.body.classList.contains('hideui')); return; }
  if (e.code === 'KeyB') { if (settings.voice === 'ptt') voice.pttPress(true); return; }
  if (e.code === 'KeyC') { chat.toggle(); return; }
  if (e.code === 'KeyM') { toggleMovie(); return; }
  if (e.code === 'Enter') { e.preventDefault(); chat.focus(); return; }
  if (e.code === 'KeyV') { toggleView(); return; }
  if (/^Digit[1-4]$/.test(e.code)) { player.toggleEmote(EMOTES[+e.code.slice(5) - 1]); return; }
  player.keyDown(e.code);
});
window.addEventListener('keyup', (e) => { player.keyUp(e.code); if (e.code === 'KeyB') voice.pttPress(false); });

// ---------- touch buttons ----------
const touch = createTouch({ canvas, joy: $('joy'), knob: $('knob'), player, isPlaying: () => state === 'playing' && !theatre });
function hold(id, code) { const b = $(id); b.addEventListener('touchstart', (e) => { e.preventDefault(); player.keyDown(code); b.classList.add('on'); }, { passive: false }); const up = (e) => { e.preventDefault(); player.keyUp(code); b.classList.remove('on'); }; b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); }
hold('tJump', 'Space');
$('tUse').addEventListener('touchstart', (e) => { e.preventDefault(); player.keyDown('KeyE'); player.keyUp('KeyE'); }, { passive: false });
$('tView').addEventListener('touchstart', (e) => { e.preventDefault(); toggleView(); }, { passive: false });
let emoteIdx = -1;
$('tEmote').addEventListener('touchstart', (e) => { e.preventDefault(); emoteIdx++; if (emoteIdx >= EMOTES.length) { emoteIdx = -1; if (player.emote) player.toggleEmote(player.emote); } else { if (player.emote !== EMOTES[emoteIdx]) player.toggleEmote(EMOTES[emoteIdx]); } $('tEmote').textContent = emoteIdx < 0 ? 'Emote' : EMOTES[emoteIdx]; }, { passive: false });
$('tRun').addEventListener('touchstart', (e) => { e.preventDefault(); player.runLatch = !player.runLatch; player.runToggle = player.runLatch; $('tRun').classList.toggle('on', player.runLatch); }, { passive: false });

// ---------- settings / about ----------
function syncSettingsUI() {
  document.querySelectorAll('#qualitySeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === settings.quality)));
  document.querySelectorAll('#voiceSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === settings.voice)));
  document.querySelectorAll('#lookSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === settings.look)));
  $('exposure').value = settings.exposure; $('sens').value = settings.sens;
}
document.querySelectorAll('#qualitySeg button').forEach((b) => b.addEventListener('click', () => applyQuality(b.dataset.q)));
document.querySelectorAll('#voiceSeg button').forEach((b) => b.addEventListener('click', () => { settings.voice = b.dataset.v; voice.setPtt(settings.voice === 'ptt'); syncSettingsUI(); updateMicUI(); save(); }));
document.querySelectorAll('#lookSeg button').forEach((b) => b.addEventListener('click', () => { settings.look = b.dataset.l; syncSettingsUI(); save(); }));
$('exposure').addEventListener('input', (e) => { settings.exposure = +e.target.value; renderer.toneMappingExposure = settings.exposure; save(); });
$('sens').addEventListener('input', (e) => { settings.sens = +e.target.value; player.sens = 0.0022 * settings.sens; save(); });
function openSettings(from) { prevOverlay = from; hide(from); show('settings'); }
$('settingsClose').addEventListener('click', () => { hide('settings'); show(prevOverlay); });
$('menuSettings').addEventListener('click', () => openSettings('menu'));
$('pauseSettings').addEventListener('click', () => openSettings('pause'));
$('menuAbout').addEventListener('click', () => { hide('menu'); show('about'); });
$('aboutClose').addEventListener('click', () => { hide('about'); show('menu'); requestAnimationFrame(placeNotches); });

// ---------- toast + interaction ----------
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 3800); }
player.onInteract = (it) => {
  if (it.action === 'movie') { toggleMovie(true); return; }
  if (it.action === 'sit') {
    const st = it.seat, go = () => { player.sitAt(st); toast('Enjoy the show! Press E to stand up.'); };
    if (!online) { go(); return; }
    if (remote.seatTaken(st.i)) { toast('That seat is taken.'); return; }
    net.sit(st.i).then((r) => { if (r.ok) go(); else toast(r.error || 'Could not sit there.'); }); return;
  }
  const msg = typeof it.message === 'function' ? it.message() : it.message;
  if (it.speaker) { chat.add(it.speaker, msg, 'npc'); toast(it.speaker + ': ' + msg); } else toast(msg);
};

// ---------- fullscreen, theatre view, hide UI ----------
let theatre = false, barTimer = 0, fsTipShown = false;
const FS_TIP = 'Your browser cannot go full screen. On iPhone: tap Share, then "Add to Home Screen", and open Cinemaverse from there for true full screen.';
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
async function enterFs() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); else return false;
    try { await screen.orientation.lock('landscape'); } catch { /* not supported on this device */ }
    return true;
  } catch { return false; }
}
function exitFs() { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch { /* ignore */ } if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.webkitFullscreenElement) document.webkitExitFullscreen(); }
async function toggleFs() { if (isFs()) { exitFs(); return; } if (!(await enterFs()) && !fsTipShown) { fsTipShown = true; toast(FS_TIP); } }
function showBar() { const b = $('theatreBar'); b.classList.remove('hidden', 'fade'); clearTimeout(barTimer); barTimer = setTimeout(() => b.classList.add('fade'), 3500); }
function setUiHidden(on) { document.body.classList.toggle('hideui', on); if (on) showBar(); else { $('theatreBar').classList.add('hidden'); clearTimeout(barTimer); } syncViewButtons(); }
function enterTheatre() {
  if (state !== 'playing' || theatre) return;
  theatre = true; chat.toggle(false); toggleMovie(false); togglePlayers(false); releaseLock(); player.setTheatre(true); setUiHidden(true);
  enterFs().then((ok) => { if (!ok && !fsTipShown) { fsTipShown = true; toast(FS_TIP); } });
}
function exitTheatre() { if (!theatre) return; theatre = false; player.setTheatre(false); player.enabled = state === 'playing'; setUiHidden(false); if (isFs()) exitFs(); relockIfNeeded(); }
function syncViewButtons() { $('tbTheatre').textContent = theatre ? 'Exit theatre view' : 'Theatre view'; $('tbFs').textContent = isFs() ? 'Exit fullscreen' : 'Fullscreen'; $('fsBtn').firstChild.textContent = isFs() ? 'Exit fullscreen ' : 'Fullscreen '; }
document.addEventListener('fullscreenchange', () => { if (!isFs() && theatre) exitTheatre(); syncViewButtons(); });
document.addEventListener('webkitfullscreenchange', () => { if (!isFs() && theatre) exitTheatre(); syncViewButtons(); });
$('theatreBtn').addEventListener('click', () => (theatre ? exitTheatre() : enterTheatre()));
$('fsBtn').addEventListener('click', toggleFs); $('hideBtn').addEventListener('click', () => setUiHidden(true));
$('tbUi').addEventListener('click', () => setUiHidden(false)); $('tbTheatre').addEventListener('click', () => (theatre ? exitTheatre() : enterTheatre())); $('tbFs').addEventListener('click', toggleFs);
$('tbVol').addEventListener('input', (e) => { $('volume').value = e.target.value; movie.setVolume(+e.target.value); });
$('volume').addEventListener('input', (e) => { $('tbVol').value = e.target.value; });
window.addEventListener('mousemove', () => { if (document.body.classList.contains('hideui')) showBar(); });

// ---------- main loop ----------
const clock = new THREE.Clock();
let netAcc = 0, shownPrompt = '', shownZone = '', fpsFrames = 0, fpsTime = 0, lowStreak = 0, uiAcc = 0;
function menuCamera(t) {
  camera.position.set(Math.sin(t * 0.08) * 7, 2.6 + Math.sin(t * 0.13) * 0.3, 14 + Math.cos(t * 0.08) * 2);
  camera.lookAt(0, 2.4, 3);
}
const MENU_POS = { x: 0, y: 0, z: 10 };
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  movie.update(dt);
  if (state === 'menu') { menuCamera(t); world.update(dt, t, MENU_POS); npcs.update(dt, t, { x: 0, y: 0, z: 40 }); }
  else {
    player.update(dt); world.update(dt, t, player.pos); npcs.update(dt, t, player.pos); voice.update(dt); if (avatar) avatar.setSpeaking(!!online && voice.localSpeaking);
    if (online) {
      remote.update(dt, camera, (id) => voice.isSpeaking(id)); netAcc += dt;
      if (netAcc > 0.066) { netAcc = 0; net.sendMove({ x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2), f: +player.face.toFixed(2), s: +player.hSpeed.toFixed(2), g: player.onGround, e: player.emote, q: player.seat ? player.seat.i : -1 }); }
    }
    movie.setZoneMul(player.pos.z < -0.3 || theatre ? 1 : 0.2); live.update(dt);
    const near = player.nearby, p = near ? (isTouch ? 'Tap Use: ' : '') + near.prompt : '';
    if (p !== shownPrompt) { shownPrompt = p; $('prompt').classList.toggle('hidden', !p); $('promptText').textContent = p; $('prompt').querySelector('kbd').classList.toggle('hidden', isTouch); $('tUse').classList.toggle('hidden', !near); }
    const z = world.zoneAt(player.pos); if (z !== shownZone) { shownZone = z; $('zone').textContent = z; }
    uiAcc += dt; if (uiAcc > 0.3 && moviePanelOpen) { uiAcc = 0; refreshMovieUI(); }
    if (state === 'playing') {
      fpsFrames++; fpsTime += dt;
      if (fpsTime >= 3) {
        const fps = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0; lowStreak = fps < 28 ? lowStreak + 1 : 0;
        if (lowStreak >= 2 && settings.quality !== 'low') { applyQuality(settings.quality === 'high' ? 'medium' : 'low'); toast('Graphics lowered automatically to keep the game smooth.'); lowStreak = 0; }
      }
    }
  }
  renderer.render(scene, camera);
}
renderer.toneMappingExposure = settings.exposure;
applyQuality(settings.quality in QUALITY ? settings.quality : 'low');
resize(); frame();
window.__cinemaverse = { scene, world, player, settings, movie, net, remote, live, voice };
