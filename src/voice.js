// Voice chat. Audio goes directly between players (WebRTC); the server only passes connection messages.
// Public halls: you hear people near you (louder when close). Private rooms: everyone in the room hears everyone.
export function createVoice({ getNet, getLocalPos, getRemotePos, onStatus, onNotice }) {
  let ctx = null, stream = null, track = null, joined = false, listenOnly = false, connecting = false;
  let micWanted = true, ptt = false, pttDown = false, proximity = true, ice = null, localSpeaking = false, localAn = null, acc = 0;
  const peers = new Map(), muted = new Set(), speaking = new Map();
  const MAX_DIST = 18, NEAR = 2;

  const secure = () => window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!window.RTCPeerConnection;
  const status = () => (!secure() ? 'unavailable' : connecting ? 'connecting' : !joined ? 'off' : listenOnly ? 'listening' : (micWanted && (!ptt || pttDown)) ? 'on' : 'muted');
  const notify = () => onStatus && onStatus(status());
  function applyMic() { if (track) track.enabled = micWanted && (!ptt || pttDown); notify(); }

  function rms(an, buf) { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / buf.length); }

  function attach(p, remoteStream) {
    if (!ctx) return;
    const a = new Audio(); a.srcObject = remoteStream; a.muted = true; a.play().catch(() => {}); // Chrome needs the stream attached to an element before Web Audio gets sound
    const src = ctx.createMediaStreamSource(remoteStream), gain = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 256;
    src.connect(an); src.connect(gain); gain.connect(ctx.destination);
    p.audio = a; p.src = src; p.gain = gain; p.an = an; p.buf = new Uint8Array(an.fftSize); gain.gain.value = 0;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function closePeer(id) {
    const p = peers.get(id); if (!p) return;
    try { p.pc.close(); } catch { /* already closed */ }
    try { p.src && p.src.disconnect(); p.gain && p.gain.disconnect(); } catch { /* ignore */ }
    if (p.audio) { p.audio.srcObject = null; }
    peers.delete(id); speaking.delete(id);
  }

  function makePeer(id, initiator) {
    const pc = new RTCPeerConnection({ iceServers: ice || [{ urls: 'stun:stun.l.google.com:19302' }] });
    const p = { pc, queue: [], haveRemote: false };
    peers.set(id, p);
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' }); if (track) tr.sender.replaceTrack(track).catch(() => {});
    pc.onicecandidate = (e) => { if (e.candidate) getNet().signal(id, { type: 'candidate', candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = (e) => attach(p, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { onNotice && onNotice('Could not connect voice with one player (their network may block direct audio).'); closePeer(id); } };
    if (initiator) (async () => { try { const o = await pc.createOffer(); await pc.setLocalDescription(o); getNet().signal(id, { type: 'offer', sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription }); } catch { closePeer(id); } })();
    return p;
  }

  const api = {
    get joined() { return joined; }, get listenOnly() { return listenOnly; }, get localSpeaking() { return localSpeaking; },
    status, secure,
    setProximity(on) { proximity = on; },
    setPtt(on) { ptt = on; applyMic(); },
    pttPress(down) { pttDown = down; applyMic(); },
    toggleMic() { if (!joined || listenOnly) return; micWanted = !micWanted; applyMic(); },
    setMuted(id, on) { on ? muted.add(id) : muted.delete(id); },
    isSpeaking(id) { return !!speaking.get(id); },

    async join() {
      if (joined || connecting) return;
      if (!secure()) { onNotice && onNotice('Voice needs a secure page (https). It works on localhost and once the game is online.'); notify(); return; }
      connecting = true; notify();
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') await ctx.resume(); } catch { /* ignore */ }
      listenOnly = false;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); track = stream.getAudioTracks()[0]; }
      catch (e) { listenOnly = true; onNotice && onNotice(e && e.name === 'NotFoundError' ? 'No microphone found. You can still listen to others.' : 'Microphone blocked. You can still listen. Allow the microphone in your browser (the padlock by the address) to talk.'); }
      const net = getNet(), cfg = await net.rtcConfig(); if (cfg && cfg.ok) ice = cfg.iceServers;
      const r = await net.voiceJoin();
      if (!r.ok) { connecting = false; if (stream) stream.getTracks().forEach((t) => t.stop()); stream = track = null; onNotice && onNotice(r.error || 'Could not join voice.'); notify(); return; }
      joined = true; connecting = false; micWanted = true;
      if (stream && ctx) { const s = ctx.createMediaStreamSource(stream); localAn = ctx.createAnalyser(); localAn.fftSize = 256; s.connect(localAn); localAn.buf = new Uint8Array(256); }
      applyMic();
      for (const id of r.peers) if (!peers.has(id)) makePeer(id, true);
    },
    leave() {
      const was = joined; joined = false; connecting = false;
      for (const id of [...peers.keys()]) closePeer(id);
      if (stream) stream.getTracks().forEach((t) => t.stop()); stream = track = localAn = null; localSpeaking = false;
      if (was) { try { getNet().voiceLeave(); } catch { /* disconnected */ } }
      notify();
    },
    // messages from the server
    onState(id, on) { if (!on) closePeer(id); },
    async onSignal(from, data) {
      if (!joined) return;
      let p = peers.get(from);
      try {
        if (data.type === 'offer') {
          if (p) closePeer(from);
          p = makePeer(from, false);
          await p.pc.setRemoteDescription(data.sdp); p.haveRemote = true;
          for (const c of p.queue) await p.pc.addIceCandidate(c).catch(() => {}); p.queue = [];
          const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a);
          getNet().signal(from, { type: 'answer', sdp: p.pc.localDescription.toJSON ? p.pc.localDescription.toJSON() : p.pc.localDescription });
        } else if (data.type === 'answer' && p) {
          await p.pc.setRemoteDescription(data.sdp); p.haveRemote = true;
          for (const c of p.queue) await p.pc.addIceCandidate(c).catch(() => {}); p.queue = [];
        } else if (data.type === 'candidate' && p && data.candidate) {
          if (p.haveRemote) await p.pc.addIceCandidate(data.candidate).catch(() => {}); else p.queue.push(data.candidate);
        }
      } catch { closePeer(from); }
    },
    update(dt) {
      if (!joined) return;
      acc += dt; if (acc < 0.1) return; acc = 0;
      const me = getLocalPos();
      for (const [id, p] of peers) {
        if (!p.gain) continue;
        let g = 1;
        if (muted.has(id)) g = 0;
        else if (proximity) {
          const rp = getRemotePos(id);
          if (rp) {
            const d = Math.hypot(rp.x - me.x, rp.z - me.z), t = Math.min(1, Math.max(0, (d - NEAR) / (MAX_DIST - NEAR)));
            g = (1 - t) * (1 - t);
            if ((rp.z < -0.3) !== (me.z < -0.3)) g *= 0.35; // a wall is in the way
          } else g = 0;
        }
        p.gain.gain.value += (g - p.gain.gain.value) * 0.5;
        speaking.set(id, !muted.has(id) && g > 0.02 && rms(p.an, p.buf) > 0.02);
      }
      if (localAn && track && track.enabled) { const lv = rms(localAn, localAn.buf) > 0.03; if (lv !== localSpeaking) { localSpeaking = lv; notify(); } }
      else if (localSpeaking) { localSpeaking = false; notify(); }
    }
  };
  return api;
}
