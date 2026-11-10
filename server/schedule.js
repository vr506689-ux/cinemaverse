// The cinema timetable. Showtimes come from server/schedule.json and are worked out from the clock,
// so every viewer sees the same show at the same moment - nobody can pause or skip it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schedule.json');
const FALLBACK = { timezone: 'UTC', mode: 'loop', gapMinutes: 3, preShowSeconds: 120, daily: [], films: [{ id: 'demo', title: 'Cinemaverse Demo Reel', description: 'A 60-second reel made by the game itself.', year: 2026, url: null, durationSec: 60, hue: 28 }] };

function readConfig() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('[schedule] could not read schedule.json, using the demo reel:', e.message); return FALLBACK; }
}

function tzOffsetMs(epoch, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(epoch)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - epoch;
}
function zonedToEpoch(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const t = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(t, tz);
}
function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } }

export function cleanFilms(cfg) {
  const films = [];
  for (const f of Array.isArray(cfg.films) ? cfg.films : []) {
    if (!f || typeof f.id !== 'string' || typeof f.title !== 'string') continue;
    let url = null;
    if (typeof f.url === 'string' && f.url) { try { const u = new URL(f.url); if (u.protocol === 'https:' && !u.username && !u.password) url = u.href; } catch { /* ignore */ } if (!url) { console.error(`[schedule] film "${f.id}" has a link that is not a plain https link; skipped.`); continue; } }
    const dur = Number(f.durationSec); if (url && !(dur > 0)) { console.error(`[schedule] film "${f.id}" needs durationSec (length in seconds); skipped.`); continue; }
    films.push({ id: f.id.slice(0, 40), title: f.title.slice(0, 80), description: String(f.description || '').slice(0, 300), year: Number(f.year) || null, url, durationSec: url ? Math.floor(dur) : 60, hue: Number.isFinite(f.hue) ? f.hue : 28 });
  }
  return films.length ? films : FALLBACK.films;
}

export function buildSchedule(now = Date.now()) {
  const cfg = readConfig(), films = cleanFilms(cfg), byId = Object.fromEntries(films.map((f) => [f.id, f]));
  const tz = validTz(cfg.timezone) ? cfg.timezone : 'UTC';
  const gap = Math.max(1, Number(cfg.gapMinutes) || 3) * 60000;
  const pre = Math.min(600, Math.max(0, Number(cfg.preShowSeconds) || 120));
  const shows = [];
  const lo = now - 4 * 3600000, hi = now + 30 * 3600000;
  if (cfg.mode === 'daily' && Array.isArray(cfg.daily) && cfg.daily.length) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
    for (let off = -1; off <= 2; off++) {
      const base = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + off));
      for (const slot of cfg.daily) {
        const film = byId[slot.film]; const m = /^(\d{1,2}):(\d{2})$/.exec(String(slot.time || '')); if (!film || !m) continue;
        const start = zonedToEpoch(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), +m[1], +m[2], tz), end = start + film.durationSec * 1000;
        if (end > lo && start < hi) shows.push({ filmId: film.id, startsAt: start, endsAt: end });
      }
    }
  } else { // "loop": films play one after another all day, with a short break between
    const anchor = Date.UTC(2024, 0, 1), cycle = films.reduce((a, f) => a + f.durationSec * 1000 + gap, 0);
    const k0 = Math.floor((now - anchor) / cycle) - 1;
    for (let k = k0; k <= k0 + 40; k++) {
      let t = anchor + k * cycle;
      for (const f of films) { const start = t + gap, end = start + f.durationSec * 1000; if (end > lo && start < hi) shows.push({ filmId: f.id, startsAt: start, endsAt: end }); t = end; }
    }
  }
  shows.sort((a, b) => a.startsAt - b.startsAt);
  return { timezone: tz, preShowSec: pre, now, films, shows: shows.slice(0, 60) };
}
