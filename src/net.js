// Talks to the multiplayer server. In development the server runs on port 3001 of the same computer.
import { io } from 'socket.io-client';

const url = import.meta.env.VITE_SERVER_URL || (location.port === '5173' ? `${location.protocol}//${location.hostname}:3001` : location.origin);

export function createNet(h) {
  const socket = io(url, { autoConnect: false, transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
  let session = null, everConnected = false;

  const call = (ev, data) => new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({ ok: false, error: 'The server did not answer. Is it running?' }); } }, 8000);
    socket.emit(ev, data, (r) => { if (!done) { done = true; clearTimeout(t); resolve(r || { ok: false }); } });
  });

  socket.on('connect', async () => {
    if (everConnected && session) {
      const r = await call('room:joinCode', { ...session.profile, code: session.code, password: session.password });
      h.onReconnect && h.onReconnect(r);
      if (r.ok) session.code = r.room.code;
    }
    everConnected = true;
  });
  socket.on('disconnect', () => h.onDisconnect && h.onDisconnect());
  socket.on('player:join', (p) => h.onPlayerJoin && h.onPlayerJoin(p));
  socket.on('player:leave', (id) => h.onPlayerLeave && h.onPlayerLeave(id));
  socket.on('snap', (list) => h.onSnap && h.onSnap(list));
  socket.on('chat', (m) => h.onChat && h.onChat(m));
  socket.on('system', (m) => h.onSystem && h.onSystem(m));
  socket.on('room:update', (u) => h.onRoomUpdate && h.onRoomUpdate(u));
  socket.on('kicked', (k) => { session = null; h.onKicked && h.onKicked(k); });
  socket.on('rtc:signal', (m) => h.onSignal && h.onSignal(m.from, m.data));
  socket.on('voice:state', (v) => h.onVoiceState && h.onVoiceState(v.id, v.on));
  socket.on('whisper', (m) => h.onWhisper && h.onWhisper(m));
  socket.on('show:update', (u) => h.onShow && h.onShow(u));
  socket.on('correct', (c) => h.onCorrect && h.onCorrect(c));

  const api = {
    get id() { return socket.id; },
    get connected() { return socket.connected; },
    connect() {
      if (socket.connected) return Promise.resolve({ ok: true });
      return new Promise((resolve) => {
        const t = setTimeout(() => { socket.off('connect', ok); socket.off('connect_error', bad); resolve({ ok: false, error: "Can't reach the game server. If you are testing on your computer, make sure you started it with npm run dev." }); }, 7000);
        const ok = () => { clearTimeout(t); socket.off('connect_error', bad); resolve({ ok: true }); };
        const bad = (e) => { if (e && /Too many/.test(e.message)) { clearTimeout(t); socket.off('connect', ok); socket.off('connect_error', bad); resolve({ ok: false, error: e.message }); } };
        socket.once('connect', ok); socket.on('connect_error', bad); socket.connect();
      });
    },
    async lobby() { return call('lobby:list'); },
    async joinPublic(profile) { const r = await call('room:joinPublic', profile); if (r.ok) session = { profile, code: r.room.code, password: '' }; return r; },
    async joinCode(profile, code, password) { const r = await call('room:joinCode', { ...profile, code, password }); if (r.ok) session = { profile, code: r.room.code, password }; return r; },
    async createRoom(profile, opts) { const r = await call('room:create', { ...profile, ...opts }); if (r.ok) session = { profile, code: r.room.code, password: opts.password || '' }; return r; },
    async leave() { session = null; if (socket.connected) await call('room:leave'); },
    sendMove(m) { if (socket.connected) socket.volatile.emit('move', m); },
    chat(text) { socket.emit('chat', { text }); },
    sit(i) { return call('sit', { i }); },
    stand() { socket.emit('stand'); },
    report(id, reason) { return call('report', { id, reason }); },
    kick(id) { return call('kick', { id }); },
    time() { return call('time:sync'); },
    rtcConfig() { return call('rtc:config'); },
    voiceJoin() { return call('voice:join'); },
    voiceLeave() { socket.emit('voice:leave'); },
    signal(to, data) { socket.emit('rtc:signal', { to, data }); },
    whisper(to, text) { socket.emit('whisper', { to, text }); },
    schedule() { return call('schedule:get'); },
    movieSet(o) { return call('movie:set', o); },
    moviePlay() { return call('movie:play'); },
    moviePause() { return call('movie:pause'); },
    movieSeek(pos) { return call('movie:seek', { pos }); },
    movieStop() { return call('movie:stop'); }
  };
  return api;
}
