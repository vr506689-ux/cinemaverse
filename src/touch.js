// Touch controls for phones and tablets: floating joystick (left), swipe to look (right), buttons.
export function createTouch({ canvas, joy, knob, player, isPlaying }) {
  let moveId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;
  const R = 55;
  const half = () => window.innerWidth * 0.45;
  canvas.addEventListener('touchstart', (e) => {
    if (!isPlaying()) return;
    for (const t of e.changedTouches) {
      if (t.clientX < half() && moveId === null) { moveId = t.identifier; ox = t.clientX; oy = t.clientY; joy.style.left = ox - 60 + 'px'; joy.style.top = oy - 60 + 'px'; joy.classList.remove('hidden'); knob.style.transform = 'translate(0,0)'; }
      else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) {
        let dx = t.clientX - ox, dy = t.clientY - oy; const d = Math.hypot(dx, dy), k = d > R ? R / d : 1; dx *= k; dy *= k;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        const m = Math.hypot(dx, dy) / R; player.axis.x = m < 0.12 ? 0 : dx / R; player.axis.y = m < 0.12 ? 0 : dy / R;
        player.runToggle = m > 0.97 ? true : player.runLatch || false;
      } else if (t.identifier === lookId) { player.mouseMove((t.clientX - lx) * 2.3, (t.clientY - ly) * 2.3); lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) { moveId = null; player.axis.x = player.axis.y = 0; joy.classList.add('hidden'); player.runToggle = player.runLatch || false; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
  return { reset() { moveId = lookId = null; player.axis.x = player.axis.y = 0; joy.classList.add('hidden'); } };
}
