import { randomUUID } from 'node:crypto';
export class Engine {
  constructor({ now = () => Date.now(), random = Math.random } = {}) { this.now = now; this.random = random; this.reset(); }
  reset() { this.showId = randomUUID(); this.startedAt = this.now(); this.series = []; this.messages = []; this.viewers = new Map(); this.peaks = []; this.crowd = 60; this.streamer = 80; this.resting = 80; this.candidate = null; this.activePeak = null; this.cooldownUntil = 0; this.spikeUntil = 0; this.tick(); }
  ingest(event) {
    const login = event.chatter_user_login.toLowerCase(); const time = this.now();
    const text = event.message.text.slice(0, 500);
    const message = { login, name: event.chatter_user_name || login, text, time, emotes: (event.message.fragments || []).filter(f => f.type === 'emote').length, hype: (/[A-Z]/.test(text) && text === text.toUpperCase() ? 1 : 0) + (text.includes('!!!') ? 1 : 0) + (text.match(/\b(?:W|POG|LUL|KEKW|LOL|omg|lets go|let's go)\b|ㅋㅋ/gi) || []).length, simulated: !!event.simulated };
    let viewer = this.viewers.get(login);
    if (!viewer) { viewer = { login, name: message.name, firstSeen: time, lastSeen: time, messageCount: 0, timestamps: [], peaks: [], simulated: message.simulated }; this.viewers.set(login, viewer); }
    viewer.lastSeen = time; viewer.messageCount++; viewer.timestamps.push(time); this.messages.push(message);
    if (this.activePeak) this.includeInPeak(this.activePeak, message);
    return message;
  }
  includeInPeak(peak, message) {
    const viewer = this.viewers.get(message.login); if (viewer && !viewer.peaks.includes(peak.id)) viewer.peaks.push(peak.id);
    peak.counts[message.login] = (peak.counts[message.login] || 0) + 1;
    peak.topChatters = Object.entries(peak.counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([login, count]) => ({ login, count }));
    if (peak.sampleMessages.length < 6) peak.sampleMessages.push({ login: message.login, text: message.text });
  }
  spike() { this.spikeUntil = this.now() + 12000; }
  tick() {
    const time = this.now(); const recent = this.messages.filter(m => m.time > time - 15000);
    const unique = new Set(recent.map(m => m.login)).size; const emotes = recent.reduce((sum, m) => sum + m.emotes, 0); const hype = recent.reduce((sum, m) => sum + m.hype, 0);
    const activity = recent.length * 4 * 0.35 + unique * 2 + emotes * 0.9 + hype * 1.8;
    const target = 60 + 120 * (1 - Math.exp(-activity / 65));
    this.crowd += (target - this.crowd) * 0.32;
    this.resting = Math.max(72, Math.min(90, this.resting + (this.random() - 0.5) * 3));
    if (this.random() < 0.008) this.spike();
    const heartTarget = time < this.spikeUntil ? 145 + this.random() * 15 : this.resting + Math.max(0, this.crowd - 85) * 0.48;
    this.streamer += (heartTarget - this.streamer) * 0.35;
    // REAL HEART-RATE SOURCE STUB: replace heartTarget/simulation with authenticated
    // HypeRate or Pulsoid readings here. The MVP deliberately simulates this signal.
    const history = this.series.filter(p => p.time >= time - 60000);
    const baseline = history.length ? history.reduce((s, p) => s + p.crowd, 0) / history.length : 60;
    if (this.activePeak) {
      this.activePeak.maxCrowdBpm = Math.max(this.activePeak.maxCrowdBpm, Math.round(this.crowd));
      this.activePeak.maxStreamerBpm = Math.max(this.activePeak.maxStreamerBpm, Math.round(this.streamer));
      this.activePeak.endTime = time;
      if (time - this.activePeak.time >= 12000) this.activePeak = null;
    }
    if (!this.activePeak && time >= this.cooldownUntil && this.crowd > baseline + 16 && this.crowd > 95) {
      if (!this.candidate) this.candidate = { time, baseline };
      if (time - this.candidate.time >= 4000) {
        const peak = { id: this.peaks.length + 1, time: this.candidate.time, detectedAt: time, endTime: time, maxCrowdBpm: Math.round(this.crowd), maxStreamerBpm: Math.round(this.streamer), topChatters: [], sampleMessages: [], counts: {} };
        for (const message of this.messages.filter(m => m.time >= peak.time)) this.includeInPeak(peak, message);
        this.peaks.push(peak); this.activePeak = peak; this.cooldownUntil = time + 30000; this.candidate = null;
      }
    } else this.candidate = null;
    this.metrics = { messagesPerMinute: recent.length * 4, uniqueChatters: unique, emotes, hype };
    const point = { time, crowd: Math.round(this.crowd), streamer: Math.round(this.streamer) }; this.series.push(point); return point;
  }
  snapshot(full = false) { return { showId: this.showId, startedAt: this.startedAt, time: this.now(), crowd: Math.round(this.crowd), streamer: Math.round(this.streamer), series: full ? this.series : this.series.slice(-91), peaks: this.peaks.map(({ counts, ...p }) => p), viewerCount: this.viewers.size, messageCount: this.messages.length, messages: this.messages.slice(-25), metrics: this.metrics, simulatedHeartRate: true }; }
  ticket(login) { const viewer = this.viewers.get(login.toLowerCase()); if (!viewer) return null; return { ...this.snapshot(true), viewer }; }
}
