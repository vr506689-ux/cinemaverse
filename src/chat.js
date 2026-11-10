// Chat window with open / close button. Phase 3 will connect onSend to the multiplayer server.
const BAD = /\b(fuck\w*|shit\w*|bitch\w*|asshole|cunt|nigg\w*)\b/gi;
export function createChat({ panel, log, input, send, btn, badge, closeBtn }) {
  let open = false, unread = 0, lastSent = 0;
  const api = {
    onSend: null, onToggle: null,
    get isOpen() { return open; },
    toggle(force) {
      open = force === undefined ? !open : force;
      panel.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', String(open));
      if (open) { unread = 0; badge.classList.add('hidden'); log.scrollTop = log.scrollHeight; }
      api.onToggle && api.onToggle(open);
    },
    focus() { if (!open) api.toggle(true); input.focus(); },
    add(name, text, kind = 'npc') {
      const row = document.createElement('div'); row.className = 'msg ' + kind;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const who = document.createElement('b'); who.textContent = name; const tm = document.createElement('time'); tm.textContent = time;
      const tx = document.createElement('span'); tx.textContent = text; // textContent: safe against HTML injection
      row.append(tm, who, tx); log.appendChild(row);
      while (log.children.length > 80) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
      if (!open && kind !== 'me') { unread++; badge.textContent = String(Math.min(unread, 9)); badge.classList.remove('hidden'); }
    },
    submit() {
      let text = input.value.trim(); if (!text) return;
      const now = Date.now();
      if (now - lastSent < 900) { api.add('System', 'Slow down a little - one message per second.', 'sys'); return; }
      lastSent = now; text = text.slice(0, 200).replace(BAD, '***'); input.value = '';
      api.onSend && api.onSend(text);
    }
  };
  btn.addEventListener('click', () => api.toggle());
  closeBtn.addEventListener('click', () => api.toggle(false));
  send.addEventListener('click', () => { api.submit(); input.focus(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); api.submit(); } });
  return api;
}
