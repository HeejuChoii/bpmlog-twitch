export const $ = selector => document.querySelector(selector);
export function connect(update) {
  let delay = 500; let ws;
  const open = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => { delay = 500; document.body.dataset.connected = 'true'; };
    ws.onmessage = e => { try { update(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { document.body.dataset.connected = 'false'; const status = $('#connection'); if (status) status.textContent = 'RECONNECTING…'; setTimeout(open, delay); delay = Math.min(10000, delay * 2); };
    ws.onerror = () => ws.close();
  }; open();
}
export function graph(svg, state, { whole = false, viewer = null } = {}) {
  const W = 1000, H = 200, left = 32, right = 968, top = 20, bottom = 172;
  const end = Math.max(state.time, state.startedAt + 2000); const start = whole ? state.startedAt : Math.max(state.startedAt, end - 180000);
  const points = state.series.filter(p => p.time >= start);
  const x = time => left + (time - start) / (end - start) * (right - left); const y = bpm => bottom - (bpm - 60) / 120 * (bottom - top);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let markup = '<defs><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter></defs>';
  for (const bpm of [60, 100, 140, 180]) markup += `<line x1="32" x2="968" y1="${y(bpm)}" y2="${y(bpm)}" stroke="#263044" stroke-dasharray="3 7"/><text x="0" y="${y(bpm) + 4}" fill="#8896ac" font-size="10" font-family="sans-serif">${bpm}</text>`;
  for (const peak of state.peaks.filter(p => p.time >= start)) markup += `<line x1="${x(peak.time)}" x2="${x(peak.time)}" y1="17" y2="172" stroke="#f6c678" stroke-dasharray="3 5" opacity=".65"/><text x="${Math.min(940, x(peak.time) + 6)}" y="13" fill="#f6c678" font-size="11" font-family="sans-serif">#${peak.id}</text>`;
  for (const [key, color] of [['streamer', '#ff4aa2'], ['crowd', '#58f5e0']]) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
    markup += `<path d="${d}" fill="none" stroke="${color}" stroke-width="7" opacity=".2" filter="url(#glow)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (viewer) for (const time of viewer.timestamps) {
    const i = Math.min(points.length - 1, Math.max(0, Math.round((time - state.startedAt) / 2000))); const p = points[i]; if (!p) continue;
    markup += `<circle cx="${x(time)}" cy="${y(p.crowd)}" r="8" fill="#fff3b0" opacity=".45" filter="url(#glow)"/><circle cx="${x(time)}" cy="${y(p.crowd)}" r="3" fill="#fff3b0"/>`;
  }
  markup += `<text x="32" y="197" fill="#8896ac" font-size="10" font-family="sans-serif">${whole ? 'SHOW START' : 'LAST 3 MINUTES'}</text><text x="968" y="197" fill="#8896ac" text-anchor="end" font-size="10" font-family="sans-serif">LIVE</text>`;
  svg.innerHTML = markup;
}
export function stats(s) { for (const key of ['crowd', 'streamer', 'viewerCount', 'messageCount']) { const el = $('#' + key); if (el) el.textContent = s[key]; } const heart = $('.heart'); if (heart) heart.style.setProperty('--beat', (60 / s.streamer) + 's'); }
export function textElement(tag, value, className) { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; }
