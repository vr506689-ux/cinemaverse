// Shows the cinema timetable and keeps the big screen, lights, audience and signs in step with it.
export function createLive({ getNet, movie, world, chip }) {
  let schedule = null, offset = 0, roomShow = null, active = false, isInstance = false, acc = 1, tSync = 0, tSched = 0, last = null;

  const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = (ts) => { const d = new Date(ts); return (d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })) + ' ' + clock(ts); };
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const now = () => Date.now() + offset;
  const byId = () => Object.fromEntries((schedule ? schedule.films : []).map((f) => [f.id, f]));

  async function sync() {
    let best = null;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now(), r = await getNet().time(); const rtt = performance.now() - t0; if (!r || !r.now) continue;
      if (!best || rtt < best.rtt) best = { rtt, offset: r.now + rtt / 2 - Date.now() };
    }
    if (best) offset = best.offset;
  }
  async function loadSchedule() { const r = await getNet().schedule(); if (r && r.ok) schedule = r; }

  function compute() {
    const t = now();
    if (!active) return { phase: 'off' };
    if (!isInstance) {
      const sh = roomShow; if (!sh) return { phase: 'idle', private: true };
      return { phase: 'playing', film: sh.film, paused: sh.paused, getPos: () => (sh.paused ? sh.pausePos : (Date.now() + offset - sh.startedAt) / 1000), private: true };
    }
    if (!schedule) return { phase: 'loading' };
    const films = byId(), cur = schedule.shows.find((s) => t >= s.startsAt && t < s.endsAt);
    if (cur && films[cur.filmId]) return { phase: 'playing', film: films[cur.filmId], startsAt: cur.startsAt, endsAt: cur.endsAt, paused: false, getPos: () => (Date.now() + offset - cur.startsAt) / 1000 };
    const nxt = schedule.shows.find((s) => s.startsAt > t);
    if (nxt && films[nxt.filmId] && nxt.startsAt - t <= schedule.preShowSec * 1000) return { phase: 'countdown', film: films[nxt.filmId], startsAt: nxt.startsAt };
    return { phase: 'idle', next: nxt ? { film: films[nxt.filmId], startsAt: nxt.startsAt } : null };
  }

  function apply(st) {
    last = st; const t = now(); let text = '';
    if (st.phase === 'playing') {
      movie.live(st.film, st.getPos, st.paused); world.setCinema(st.paused ? 0.45 : 1, true, true); world.setScreenInfo(null);
      world.setBannerInfo({ title: st.film.title, l1: st.paused ? 'Paused by the host' : 'Now showing', l2: st.endsAt ? `Ends at ${clock(st.endsAt)}` : 'Private screening', hue: st.film.hue });
      text = `Now showing: ${st.film.title}` + (st.endsAt ? ` - ends ${clock(st.endsAt)}` : '');
    } else if (st.phase === 'countdown') {
      movie.liveStop(); world.setCinema(0.25, false, true);
      world.setScreenInfo({ title: st.film.title, sub: `Starts in ${mmss(st.startsAt - t)}`, small: 'Take a seat - it starts on time for everyone' });
      world.setBannerInfo({ title: st.film.title, l1: 'Starting soon', l2: `In ${mmss(st.startsAt - t)}`, hue: st.film.hue });
      text = `${st.film.title} starts in ${mmss(st.startsAt - t)}`;
    } else if (st.phase === 'idle') {
      movie.liveStop(); world.setCinema(0, false, false);
      if (st.private) { world.setScreenInfo({ title: 'Private screening', sub: 'Waiting for the host to pick a film', small: 'The host presses M to choose' }); world.setBannerInfo({ title: 'Private screening', l1: 'Waiting for the host', l2: 'The host picks a film', hue: 28 }); text = 'No film yet - the host picks one (M)'; }
      else if (st.next) {
        world.setScreenInfo({ title: 'Next show', sub: st.next.film.title, small: `${day(st.next.startsAt)} - in ${mmss(st.next.startsAt - t)}` });
        world.setBannerInfo({ title: st.next.film.title, l1: 'Next show', l2: `${day(st.next.startsAt)}`, hue: st.next.film.hue });
        text = `Next: ${st.next.film.title} at ${clock(st.next.startsAt)}`;
      } else { world.setScreenInfo({ title: 'No shows yet', sub: 'Check back soon', small: '' }); text = 'No shows scheduled'; }
    } else { text = 'Loading showtimes...'; }
    if (chip) { chip.textContent = text; chip.classList.toggle('hidden', !text); }
  }

  const api = {
    get active() { return active; }, get isInstance() { return isInstance; },
    films: () => (schedule ? schedule.films : []), roomShow: () => roomShow, state: () => last,
    setRoomShow(s) { roomShow = s || null; acc = 1; },
    async enterRoom(room, show) { active = true; isInstance = !!room.instance; roomShow = show || null; acc = 1; await Promise.all([sync(), loadSchedule()]); },
    leave() { if (!active) return; active = false; roomShow = null; movie.liveStop(); world.setScreenInfo(null); world.setBannerInfo(null); world.setCinema(0, false, false); if (chip) chip.classList.add('hidden'); },
    duration() { const sh = roomShow; if (!sh) return 0; return sh.film.durationSec || movie.info().duration || 0; },
    position() { const sh = roomShow; if (!sh) return 0; return sh.paused ? sh.pausePos : (Date.now() + offset - sh.startedAt) / 1000; },
    status() {
      const st = last || compute();
      if (st.phase === 'playing') return `${st.paused ? 'Paused' : 'Now playing'}: ${st.film.title}`;
      if (st.phase === 'countdown') return `Starting soon: ${st.film.title}`;
      if (st.phase === 'idle') return st.private ? 'No film loaded yet.' : st.next ? `Next show: ${st.next.film.title}` : 'No shows scheduled.';
      return 'Loading showtimes...';
    },
    rows() { // timetable for the panel
      if (!schedule) return [];
      const films = byId(), t = now();
      return schedule.shows.filter((s) => s.endsAt > t && films[s.filmId]).slice(0, 8).map((s) => {
        const f = films[s.filmId], playing = t >= s.startsAt;
        return { title: f.title, year: f.year, desc: f.description, when: playing ? 'Playing now' : day(s.startsAt), ends: `ends ${clock(s.endsAt)}`, mins: Math.round(f.durationSec / 60), playing };
      });
    },
    update(dt) {
      if (!active) return;
      tSync += dt; tSched += dt; if (tSync > 300) { tSync = 0; sync(); } if (tSched > 1200) { tSched = 0; loadSchedule(); }
      acc += dt; if (acc < 0.25) return; acc = 0; apply(compute());
    }
  };
  return api;
}
