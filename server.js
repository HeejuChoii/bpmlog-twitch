import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import { Twitch } from './twitch.js';
import { Engine } from './engine.js';
const app = express();
const root = fileURLToPath(new URL('./public/', import.meta.url));
const engine = new Engine();
const commandCooldown = new Map();
const twitch = new Twitch(event => ingest(event));
function ingest(event) {
  const message = engine.ingest(event);
  const command = message.text.trim().toLowerCase();
  if (!event.simulated && ['!bpm', '!ticket'].includes(command) && Date.now() - (commandCooldown.get(message.login) || 0) > 5000) {
    commandCooldown.set(message.login, Date.now());
    twitch.say(command === '!ticket' ? `@${message.login} your ticket: http://localhost:${process.env.PORT || 3000}/ticket/${message.login}` : `❤️ Streamer ${Math.round(engine.streamer)} BPM | 🔥 Chat ${Math.round(engine.crowd)} BPM`).catch(e => { twitch.error = e.message; });
  }
  return message;
}
app.use(express.json({ limit: '8kb' }));
app.get('/login', (req, res) => twitch.login(res));
app.get('/callback', (req, res, next) => twitch.callback(req, res).catch(next));
app.get('/api/status', (req, res) => res.json(twitch.status()));
app.get('/api/state', (req, res) => res.json(state()));
app.get('/api/ticket/:login', (req, res) => {
  const ticket = engine.ticket(req.params.login);
  if (!ticket) return res.status(404).json({ error: 'No messages from this viewer in the current show.' });
  res.set('Cache-Control', 'no-store').json({ ...ticket, channel: twitch.user?.display_name || 'TwitchCon Demo', demo: ticket.viewer.simulated });
});
app.get('/ticket/:login', (req, res) => res.sendFile(root + 'ticket.html'));
app.get('/overlay', (req, res) => res.sendFile(root + 'overlay.html'));
app.get('/dev', (req, res) => res.sendFile(root + 'dev.html'));
const bursts = new Set();
app.use('/api/dev', (req, res, next) => {
  // Local demo controls: reject cross-origin browser requests.
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return res.status(403).json({ error: 'Use the local demo studio.' });
  next();
});
app.post('/api/dev/:action', (req, res) => {
  const action = req.params.action;
  const username = String(req.body?.username || 'frontrow_fan').toLowerCase();
  if (!/^[a-z0-9_]{1,25}$/.test(username)) return res.status(400).json({ error: 'Invalid username.' });
  if (action === 'reset') { for (const timer of bursts) clearInterval(timer); bursts.clear(); engine.reset(); commandCooldown.clear(); broadcast(); return res.json({ message: 'New show started. All show data cleared.' }); }
  if (action === 'spike') { engine.spike(); return res.json({ message: 'Streamer heart spike started · 12 seconds.' }); }
  if (!['normal', 'hype', 'emotes'].includes(action)) return res.status(404).json({ error: 'Unknown demo action.' });
  if (bursts.size >= 3) return res.status(429).json({ error: 'Three bursts are running. Give the room a moment.' });
  const fans = [username, 'pixel_pilot', 'mooncat', 'neon_nori', 'chat_goblin', 'luna_live', 'cozyfox', 'w_key', 'twitchtraveler', 'synthwave'];
  const texts = { normal: ['love this stream', 'that was close', 'here for the vibes', 'nice play', 'hello chat'], hype: ['LETS GO!!! POG W', 'OMG THAT WAS INSANE!!!', 'W W W!!!', 'ㅋㅋ LOL KEKW!!!', 'POG!!! WE WERE HERE'], emotes: ['Kappa PogChamp PogChamp', 'PogChamp PogChamp Kappa', 'LUL LUL LUL'] };
  let batch = 0;
  const inject = () => {
    const count = action === 'normal' ? 2 : action === 'hype' ? 8 : 6;
    for (let i = 0; i < count; i++) {
      const login = i === 0 ? username : fans[(batch + i) % fans.length];
      const text = texts[action][(batch + i) % texts[action].length];
      ingest({ chatter_user_login: login, chatter_user_name: login, simulated: true, message: { text, fragments: action === 'emotes' ? text.split(' ').map(text => ({ type: 'emote', text, emote: { id: 'demo' } })) : [{ type: 'text', text }] } });
    }
    batch++; broadcast();
  };
  inject();
  const timer = setInterval(() => { inject(); if (batch >= 10) { clearInterval(timer); bursts.delete(timer); } }, 1000);
  bursts.add(timer);
  res.json({ message: `${action === 'hype' ? 'Hype burst' : action === 'emotes' ? 'Emote spam' : 'Normal chatter'} running · 10 seconds · @${username} is in the room.` });
});
app.use(express.static(root));
app.use((err, req, res, next) => { console.error(err.message); res.status(err.status || 500).json({ error: err.message }); });
const server = app.listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => console.log('BPM Log → http://localhost:' + (process.env.PORT || 3000)));
const wss = new WebSocketServer({ server, path: '/ws' });
function state() { return { ...engine.snapshot(), status: twitch.status() }; }
function broadcast() { const payload = JSON.stringify(state()); for (const client of wss.clients) if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 1000000) client.send(payload); }
wss.on('connection', ws => { ws.send(JSON.stringify(state())); ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
setInterval(() => { engine.tick(); broadcast(); }, 2000);
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 30000);
twitch.restore();
