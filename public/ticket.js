import { $, graph } from '/live.js';
const login = decodeURIComponent(location.pathname.split('/').filter(Boolean).at(-1)).toLowerCase();
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
let current;
function render(s) {
  const v = s.viewer;
  const minutes = Math.max(1, Math.ceil((v.lastSeen - v.firstSeen) / 60000));
  const date = new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
  let hash = 2166136261; for (const char of s.showId + v.login) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const serial = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); graph(chart, s, { whole: true, viewer: v });
  const peakText = v.peaks.length ? `YOU WERE THERE FOR ${v.peaks.slice(0, 6).map(n => `PEAK #${n}`).join(' · ')}${v.peaks.length > 6 ? ` +${v.peaks.length - 6}` : ''}` : 'EVERY MESSAGE IS PART OF THE MOMENT';
  const barcode = Array.from({ length: 45 }, (_, i) => `<rect x="${1002 + i * 3.15}" y="425" width="${(i * 7 + hash >>> 0) % 3 === 0 ? 2.6 : 1.2}" height="65" fill="#b3bdce"/>`).join('');
  $('#ticket-art').innerHTML = `
  <defs><linearGradient id="ticket-bg" x2="1" y2="1"><stop stop-color="#151c2c"/><stop offset="1" stop-color="#0c111d"/></linearGradient><linearGradient id="accent"><stop stop-color="#ff4aa2"/><stop offset="1" stop-color="#58f5e0"/></linearGradient><pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#ffffff" opacity=".09"/></pattern><mask id="ticket-mask"><rect width="1200" height="630" rx="24" fill="white"/><circle cx="956" cy="0" r="22" fill="black"/><circle cx="956" cy="630" r="22" fill="black"/></mask></defs>
  <g mask="url(#ticket-mask)" font-family="Arial, Helvetica, sans-serif">
  <rect width="1200" height="630" rx="24" fill="url(#ticket-bg)"/><rect width="1200" height="630" fill="url(#dots)"/><rect x="0" y="0" width="1200" height="5" fill="url(#accent)"/><rect x="977" width="223" height="630" fill="#58f5e0" opacity=".035"/>
  <rect x=".5" y=".5" width="1199" height="629" rx="24" fill="none" stroke="#354155"/><line x1="956" x2="956" y1="30" y2="600" stroke="#64718a" stroke-dasharray="4 7"/>
  <text x="48" y="58" font-size="24" font-weight="900" fill="#f4f7ff" letter-spacing="-1">bpm<tspan fill="#ff4aa2">log</tspan><tspan fill="#58f5e0">.</tspan></text><text x="184" y="55" font-size="10" letter-spacing="3" fill="#94a2ba">THE LIVE STREAM SOUVENIR</text>
  <rect x="778" y="33" width="129" height="29" rx="14" fill="#58f5e0" opacity=".12"/><text x="842" y="52" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="2" fill="#58f5e0">${s.demo ? 'DEMO EDITION' : 'LIVE EDITION'}</text>
  <text x="48" y="109" font-size="12" letter-spacing="3" fill="#58f5e0">${escape(s.channel.toUpperCase())} / ${date}</text>
  <text x="45" y="177" font-size="58" font-weight="900" letter-spacing="-2" fill="#f5f7ff">I WAS HERE.</text>
  <text x="48" y="216" font-size="24" font-weight="700" fill="#f5f7ff">@${escape(v.login)}</text>
  <text x="48" y="250" font-size="13" fill="#94a2ba">One stream. A thousand heartbeats. Yours is in here.</text>
  <text x="718" y="158" font-size="33" font-weight="800" fill="#f5f7ff">${minutes}</text><text x="718" y="182" font-size="9" letter-spacing="2" fill="#94a2ba">MIN PRESENT</text>
  <text x="832" y="158" font-size="33" font-weight="800" fill="#f5f7ff">${v.messageCount}</text><text x="832" y="182" font-size="9" letter-spacing="2" fill="#94a2ba">MESSAGES</text>
  <line x1="48" x2="906" y1="276" y2="276" stroke="#2b3548"/>
  <text x="48" y="304" font-size="10" letter-spacing="2" fill="#94a2ba">THE SHOW'S HEARTBEAT</text><circle cx="653" cy="300" r="3" fill="#ff4aa2"/><text x="664" y="304" font-size="10" fill="#94a2ba">STREAMER</text><circle cx="747" cy="300" r="3" fill="#58f5e0"/><text x="758" y="304" font-size="10" fill="#94a2ba">CROWD</text><circle cx="829" cy="300" r="3" fill="#fff3b0"/><text x="840" y="304" font-size="10" fill="#fff3b0">YOU</text>
  <svg x="43" y="326" width="871" height="183" viewBox="0 0 1000 200">${chart.innerHTML}</svg>
  <rect x="48" y="527" width="858" height="41" rx="8" fill="#58f5e0" opacity=".07"/><text x="66" y="553" font-size="${v.peaks.length > 3 ? 10 : 12}" font-weight="700" letter-spacing="1" fill="#58f5e0">${escape(peakText)}</text>
  <text x="48" y="600" font-size="9" letter-spacing="2" fill="#73829b">CODEX × TWITCHCON / HEART RATE SIMULATED / ${s.demo ? 'SIMULATED CHAT' : 'LIVE CHAT'}</text><text x="906" y="600" text-anchor="end" font-size="9" letter-spacing="1" fill="#73829b">NO. ${serial}</text>
  <text x="1078" y="67" text-anchor="middle" font-size="10" letter-spacing="4" fill="#58f5e0">BPM LOG</text><text x="1078" y="132" text-anchor="middle" font-size="27" font-weight="900" fill="#f5f7ff">ADMIT</text><text x="1078" y="167" text-anchor="middle" font-size="27" font-weight="900" fill="#f5f7ff">ONE</text><line x1="1004" x2="1151" y1="199" y2="199" stroke="#344056"/><text x="1078" y="234" text-anchor="middle" font-size="9" letter-spacing="2" fill="#94a2ba">FRONT ROW / CHAT</text><text x="1078" y="294" text-anchor="middle" font-size="45" font-weight="900" fill="#58f5e0">${String(v.peaks.length).padStart(2, '0')}</text><text x="1078" y="321" text-anchor="middle" font-size="10" letter-spacing="2" fill="#94a2ba">SHARED PEAKS</text><text x="1078" y="377" text-anchor="middle" font-size="12" fill="#f5f7ff">${escape(v.login)}</text>${barcode}<text x="1078" y="514" text-anchor="middle" font-size="10" letter-spacing="3" fill="#94a2ba">${serial}</text><text x="1078" y="584" text-anchor="middle" font-size="9" letter-spacing="2" fill="#58f5e0">KEEP THE MOMENT</text>
  </g>`;
  $('#download').disabled = false;
}
async function load() {
  try {
    const r = await fetch('/api/ticket/' + encodeURIComponent(login)); const s = await r.json();
    if (r.status === 404) { $('#empty').hidden = false; $('#art-wrap').hidden = true; $('#download').disabled = true; current = null; $('#error').textContent = ''; return; }
    if (!r.ok) throw new Error(s.error || 'Could not load ticket');
    $('#empty').hidden = true; $('#art-wrap').hidden = false; $('#error').textContent = ''; current = s; render(s);
  } catch (e) { $('#error').textContent = e.message; }
}
$('#download').onclick = async () => {
  if (!current) return;
  const button = $('#download'); button.disabled = true; button.textContent = 'Rendering…';
  let source, download;
  try {
    const svg = new XMLSerializer().serializeToString($('#ticket-art'));
    source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image(); img.src = source; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
    download = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = download; a.download = `bpmlog-${login}-${current.showId.slice(0, 8)}.png`; a.click();
  } catch (e) { $('#error').textContent = 'Download failed: ' + e.message; }
  finally { if(source) URL.revokeObjectURL(source); if(download) setTimeout(()=>URL.revokeObjectURL(download),10000); button.disabled = !current; button.textContent = '↓ Download PNG'; }
};
load(); setInterval(load, 4000);
