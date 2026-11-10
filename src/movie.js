// The movie player. Three ways to use it:
//  - local: the built-in demo reel, a file from your computer, or a link (practice alone)
//  - live:  a show that everyone watches at the same moment (public halls follow a timetable; private rooms follow their host)
// Films are streamed, never fully downloaded, so a 3-hour film works like a short one.
import * as THREE from 'three';

const DEMO_LEN = 60;

export function createMovie({ screenMesh, idleTexture, overlayEl, onChange, onError, onNotice }) {
  const video = document.createElement('video');
  video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto';
  let vtex = null, mode = 'none', state = 'idle', loading = false, title = '', objUrl = null; // mode: none | demo | video | live-demo | live-video
  let volume = 0.8, zoneMul = 1, demoT = 0, demoRun = false, drawAcc = 1;
  let liveKey = null, liveGet = null, livePaused = false, ready = false, driftAcc = 0, overlayOn = false, triedPlain = false, curSrc = '', needGesture = false;

  const dc = document.createElement('canvas'); dc.width = 1280; dc.height = 720;
  const dg = dc.getContext('2d'), dTex = new THREE.CanvasTexture(dc); dTex.colorSpace = THREE.SRGBColorSpace;
  const stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.9 + 0.1 }));

  function drawDemo(t) {
    const W = 1280, H = 720, g = dg; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (t < 5) {
      g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, W, H); g.strokeStyle = '#222'; g.lineWidth = 6;
      g.beginPath(); g.arc(W / 2, H / 2, 250, 0, 7); g.stroke(); g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      g.fillStyle = '#222'; g.font = '300px Georgia, serif'; g.fillText(String(5 - Math.floor(t)), W / 2, H / 2 + 10);
    } else if (t < 25) {
      g.fillStyle = '#05060f'; g.fillRect(0, 0, W, H);
      for (const s of stars) { const z = (s.z - t * 0.12) % 1, zz = z < 0 ? z + 1 : z; const x = W / 2 + (s.x - 0.5) * W * (1.6 - zz) * 1.6, y = H / 2 + (s.y - 0.5) * H * (1.6 - zz) * 1.6; g.fillStyle = `rgba(255,255,255,${0.3 + (1 - zz) * 0.7})`; g.beginPath(); g.arc(x, y, (1 - zz) * 3.2 + 0.4, 0, 7); g.fill(); }
      g.globalAlpha = Math.max(0, Math.min(1, (t - 6) / 2, (24 - t) / 2)); g.fillStyle = '#fff3dc'; g.font = '90px Limelight, Georgia, serif'; g.fillText('A Cinemaverse Short', W / 2, H / 2); g.font = '34px Arial'; g.fillText('Demo reel - made by your browser', W / 2, H / 2 + 80); g.globalAlpha = 1;
    } else if (t < 45) {
      const k = (t - 25) / 20, grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `hsl(${230 - k * 190},60%,${14 + k * 30}%)`); grad.addColorStop(1, `hsl(${20 + k * 10},90%,${30 + k * 30}%)`); g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(W * 0.7, H * (0.9 - k * 0.45), 70, 0, 7); g.fill();
      g.fillStyle = '#12090f'; for (let i = 0; i < 22; i++) { const bh = 120 + ((i * 97) % 210); g.fillRect(i * 62 - ((t * 20) % 62), H - bh, 70, bh); }
      g.fillStyle = '#fff'; g.font = '56px Georgia, serif'; g.fillText('Every night has a morning.', W / 2, 120);
    } else {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#f6ecd9'; g.font = '48px Georgia, serif';
      ['CINEMAVERSE', '', 'Demo reel', 'Directed by your browser', 'Starring you', '', 'Thanks for watching'].forEach((l, i) => g.fillText(l, W / 2, H + 40 + i * 90 - (t - 45) * 70));
    }
  }

  const setMap = (tex) => { screenMesh.material.map = tex; screenMesh.material.needsUpdate = true; };
  const emit = () => onChange && onChange(info());
  const applyVol = () => { video.volume = Math.max(0, Math.min(1, volume * zoneMul)); };
  function info() {
    const dur = mode === 'demo' || mode === 'live-demo' ? DEMO_LEN : (isFinite(video.duration) ? video.duration : 0);
    return { state, title, loading, duration: dur, time: mode === 'demo' || mode === 'live-demo' ? demoT : video.currentTime || 0, mode };
  }
  const ensureTex = () => { if (!vtex) { vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace; vtex.minFilter = THREE.LinearFilter; vtex.generateMipmaps = false; } return vtex; };

  function showOverlay() { overlayOn = true; if (overlayEl) { overlayEl.appendChild(video); overlayEl.classList.remove('hidden'); } setMap(idleTexture); }
  function hideOverlay() { if (overlayOn) { overlayOn = false; if (overlayEl) { overlayEl.classList.add('hidden'); if (video.parentNode === overlayEl) overlayEl.removeChild(video); } } }
  function cleanup() {
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    video.pause(); video.removeAttribute('src'); video.removeAttribute('crossorigin'); video.load();
    demoRun = false; ready = false; triedPlain = false; needGesture = false; hideOverlay(); video.playbackRate = 1;
  }
  function loadSrc(src, plain) { curSrc = src; if (plain) video.removeAttribute('crossorigin'); else video.crossOrigin = 'anonymous'; video.src = src; video.load(); }
  function tryPlay() { const p = video.play(); if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') { needGesture = true; onNotice && onNotice('Click or tap anywhere to start the film (your browser blocks automatic sound).'); } }); }

  video.addEventListener('loadedmetadata', () => {
    ready = true; loading = false;
    if (mode === 'live-video') { try { video.currentTime = Math.max(0, liveGet()); } catch { /* not seekable yet */ } if (!livePaused) tryPlay(); }
    else if (mode === 'video') tryPlay();
    emit();
  });
  video.addEventListener('playing', () => { loading = false; if (mode === 'video') { state = 'playing'; emit(); } });
  video.addEventListener('pause', () => { if (mode === 'video' && !video.ended) { state = 'paused'; emit(); } });
  video.addEventListener('waiting', () => { loading = true; if (mode === 'video') emit(); });
  video.addEventListener('canplay', () => { loading = false; if (mode === 'video') emit(); });
  video.addEventListener('ended', () => { if (mode === 'video') stop(); });
  video.addEventListener('error', () => {
    if (!video.getAttribute('src')) return;
    if ((mode === 'video' || mode === 'live-video') && !triedPlain) { // the website may not allow the 3D screen: show the film in a small window instead
      triedPlain = true; showOverlay(); onNotice && onNotice('This film plays in a small window, because its website does not allow the 3D screen.'); loadSrc(curSrc, true); return;
    }
    const wasLive = mode === 'live-video'; const msg = "This video can't be played. Check the link points straight to a .mp4 or .webm file.";
    if (wasLive) { onError && onError(msg); liveKey = null; mode = 'none'; hideOverlay(); setMap(idleTexture); return; }
    stop(); onError && onError(msg);
  });

  function stop() { cleanup(); mode = 'none'; state = 'idle'; loading = false; title = ''; demoT = 0; liveKey = null; setMap(idleTexture); emit(); }
  function startVideo(src, name) {
    cleanup(); mode = 'video'; title = name; loading = true; state = 'paused'; applyVol(); setMap(ensureTex()); loadSrc(src, false); emit();
  }

  const api = {
    // ----- local use (practice alone) -----
    playDemo() { cleanup(); mode = 'demo'; title = 'Demo reel'; demoT = 0; demoRun = true; state = 'playing'; setMap(dTex); drawDemo(0); dTex.needsUpdate = true; emit(); },
    playFile(file) { if (!file) return; objUrl = URL.createObjectURL(file); startVideo(objUrl, file.name.replace(/\.[^.]+$/, '')); },
    playUrl(url) { try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; startVideo(u.href, u.hostname + u.pathname.split('/').pop()); } catch { onError && onError('That is not a valid web link. It should start with https://'); } },
    toggle() {
      if (state === 'playing') { if (mode === 'demo') { demoRun = false; state = 'paused'; emit(); } else video.pause(); }
      else if (state === 'paused') { if (mode === 'demo') { demoRun = true; state = 'playing'; emit(); } else tryPlay(); }
    },
    stop, info,
    seek(frac) { if (mode === 'demo') { demoT = frac * DEMO_LEN; drawDemo(demoT); dTex.needsUpdate = true; } else if (mode === 'video' && isFinite(video.duration)) video.currentTime = frac * video.duration; },
    // ----- live shows (same moment for everyone) -----
    get isLive() { return mode === 'live-demo' || mode === 'live-video'; },
    live(film, getPos, paused) {
      liveGet = getPos; livePaused = paused;
      const key = film.id + '|' + (film.url || 'demo');
      if (liveKey !== key) {
        cleanup(); liveKey = key; title = film.title; loading = true; state = paused ? 'paused' : 'playing';
        if (film.url) { mode = 'live-video'; applyVol(); setMap(ensureTex()); loadSrc(film.url, false); }
        else { mode = 'live-demo'; setMap(dTex); }
      }
    },
    liveStop() { if (liveKey) { cleanup(); mode = 'none'; state = 'idle'; liveKey = null; loading = false; setMap(idleTexture); } },
    retry() { if (needGesture) { needGesture = false; tryPlay(); } },
    setVolume(v) { volume = v; applyVol(); },
    setZoneMul(m) { if (m !== zoneMul) { zoneMul = m; applyVol(); } },
    update(dt) {
      if (mode === 'demo' && demoRun) {
        demoT += dt; if (demoT >= DEMO_LEN) { stop(); return; }
        drawAcc += dt; if (drawAcc > 1 / 15) { drawAcc = 0; drawDemo(demoT); dTex.needsUpdate = true; }
      } else if (mode === 'live-demo') {
        demoT = Math.min(Math.max(liveGet(), 0), DEMO_LEN); drawAcc += dt;
        if (drawAcc > 1 / 12) { drawAcc = 0; drawDemo(livePaused ? demoT : demoT); dTex.needsUpdate = true; }
      } else if (mode === 'live-video' && ready) {
        driftAcc += dt; if (driftAcc < 1) return; driftAcc = 0;
        const p = liveGet();
        if (livePaused) { if (!video.paused) video.pause(); if (Math.abs(video.currentTime - p) > 0.3) video.currentTime = p; return; }
        if (video.paused && !video.ended && !needGesture) tryPlay();
        const diff = video.currentTime - p;
        if (Math.abs(diff) > 1.5) video.currentTime = Math.max(0, p);        // fell behind (or ahead): jump to the live moment
        else if (Math.abs(diff) > 0.3) video.playbackRate = diff > 0 ? 0.94 : 1.06; // small drift: ease back gently
        else if (video.playbackRate !== 1) video.playbackRate = 1;
      }
    }
  };
  return api;
}
