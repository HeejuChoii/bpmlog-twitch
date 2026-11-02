import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
const BASE = 'wss://eventsub.wss.twitch.tv/ws';
export const BOT_REPLY_PREFIX = '[BPM Log] ';
export class Twitch {
  constructor(onChat) { this.onChat = onChat; this.user = null; this.connected = false; this.error = ''; this.states = new Map(); this.seen = new Set(); }
  status() { return { loggedIn: !!this.user, connected: this.connected, user: this.user, error: this.error }; }
  login(res) {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return res.status(400).send('Add your Twitch client ID and secret to .env, then restart. Demo mode works without credentials.');
    const state = randomBytes(24).toString('hex'); this.states.set(state, Date.now());
    for (const [key, time] of this.states) if (Date.now() - time > 600000) this.states.delete(key);
    res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600000 });
    res.redirect('https://id.twitch.tv/oauth2/authorize?' + new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, redirect_uri: 'http://localhost:3000/callback', response_type: 'code', scope: 'user:read:chat user:write:chat user:bot', state }));
  }
  async callback(req, res) {
    const { code, state } = req.query;
    const cookie = req.headers.cookie?.split('; ').find(x => x.startsWith('oauth_state='))?.slice(12);
    if (typeof state !== 'string' || state !== cookie || !this.states.has(state) || Date.now() - this.states.get(state) > 600000 || typeof code !== 'string') return res.status(400).send('Invalid or expired login. Start again at /login.');
    this.states.delete(state); res.clearCookie('oauth_state');
    await this.token({ grant_type: 'authorization_code', code, redirect_uri: 'http://localhost:3000/callback' });
    await this.start(); res.redirect('/');
  }
  async token(params) {
    const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET, ...params }), signal: AbortSignal.timeout(15000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Token exchange failed');
    this.tokens = { ...data, expires_at: Date.now() + data.expires_in * 1000 };
    await writeFile('.tokens.json', JSON.stringify(this.tokens, null, 2), { mode: 0o600 });
  }
  async refresh() { if (!this.refreshing) this.refreshing = this.token({ grant_type: 'refresh_token', refresh_token: this.tokens.refresh_token }).finally(() => { this.refreshing = null; }); await this.refreshing; }
  async api(path, options = {}, retry = true) {
    if (!this.tokens) throw new Error('Log in to Twitch first');
    if (Date.now() > this.tokens.expires_at - 60000) await this.refresh();
    const response = await fetch('https://api.twitch.tv/helix/' + path, { ...options, headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${this.tokens.access_token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (response.status === 401 && retry) { await this.refresh(); return this.api(path, options, false); }
    const data = await response.json(); if (!response.ok) throw new Error(data.message || `Twitch ${response.status}`); return data;
  }
  async restore() { try { this.tokens = JSON.parse(await readFile('.tokens.json', 'utf8')); await this.start(); } catch (e) { if (e.code !== 'ENOENT') this.error = e.message; } }
  async start() {
    const data = await this.api('users'); this.user = data.data[0]; this.error = '';
    this.connect();
    clearInterval(this.validation);
    this.validation = setInterval(async () => { try { const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${this.tokens.access_token}` }, signal: AbortSignal.timeout(15000) }); if (r.status === 401) await this.refresh(); } catch (e) { this.error = e.message; } }, 3600000);
  }
  connect(url = BASE, migrating = false) {
    clearTimeout(this.retry); const previous = this.socket; const ws = new WebSocket(url); if (!migrating) { this.socket = ws; previous?.close(); }
    let timer; let keepalive = 30;
    const watchdog = seconds => { clearTimeout(timer); timer = setTimeout(() => ws.terminate(), (seconds + 5) * 1000); };
    watchdog(20);
    ws.on('message', async raw => {
      try {
        const { metadata, payload } = JSON.parse(raw); if (payload.session?.keepalive_timeout_seconds) keepalive = payload.session.keepalive_timeout_seconds; watchdog(keepalive);
        if (metadata.message_type === 'session_welcome') {
          if (migrating) { this.socket = ws; previous?.close(); }
          if (!migrating) await this.api('eventsub/subscriptions', { method: 'POST', body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: this.user.id, user_id: this.user.id }, transport: { method: 'websocket', session_id: payload.session.id } }) });
          this.connected = true; this.error = '';
        } else if (metadata.message_type === 'session_reconnect') this.connect(payload.session.reconnect_url, true);
        else if (metadata.message_type === 'revocation') { this.error = `Subscription revoked: ${payload.subscription.status}`; this.connected = false; }
        else if (metadata.message_type === 'notification' && !this.seen.has(metadata.message_id)) {
          this.seen.add(metadata.message_id); if (this.seen.size > 5000) this.seen.delete(this.seen.values().next().value);
          this.receiveChat(payload.event);
        }
      } catch (e) { this.error = e.message; ws.close(); }
    });
    ws.on('error', e => { this.error = e.message; });
    ws.on('close', () => { clearTimeout(timer); if (this.socket === ws || (migrating && this.socket === previous)) { this.connected = false; this.retry = setTimeout(() => this.connect(), 3000); } });
  }
  receiveChat(event) {
    // The broadcaster is also the bot: allow their chat and commands, but exclude
    // marked API replies so they cannot inflate crowd energy or trigger commands.
    if (event.chatter_user_id === this.user?.id && event.message.text.startsWith(BOT_REPLY_PREFIX)) return;
    this.onChat(event);
  }
  async say(message) { message = BOT_REPLY_PREFIX + message; const data = await this.api('chat/messages', { method: 'POST', body: JSON.stringify({ broadcaster_id: this.user.id, sender_id: this.user.id, message }) }); if (!data.data?.[0]?.is_sent) throw new Error(data.data?.[0]?.drop_reason?.message || 'Chat message was not sent'); }
}
