// Áudio 100% sintetizado com WebAudio (sem arquivos): efeitos e uma trilha ambiente simples.
export class Audio {
  constructor(settings) {
    this.s = settings; this.ctx = null; this.musicTimer = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.sfxG = this.ctx.createGain(); this.musG = this.ctx.createGain();
    this.sfxG.connect(this.master); this.musG.connect(this.master); this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply(); this.startMusic();
  }
  apply() { if (!this.ctx) return; this.master.gain.value = this.s.master; this.sfxG.gain.value = this.s.sfx; this.musG.gain.value = this.s.music * 0.5; }
  _env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  _noise(dur, freq, q, peak, sweepTo) {
    if (!this.ctx) return; const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
    const g = this.ctx.createGain(); this._env(g, t, 0.01, dur, peak); src.connect(f); f.connect(g); g.connect(this.sfxG); src.start(t); src.stop(t + dur + 0.1);
  }
  _tone(type, f0, f1, dur, peak) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); this._env(g, t, 0.005, dur, peak);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'punch': this._noise(0.12, 900, 1.2, 0.8, 300); this._tone('square', 150, 60, 0.1, 0.4); break;
      case 'kick': this._noise(0.18, 600, 1, 1.0, 200); this._tone('square', 110, 40, 0.16, 0.5); break;
      case 'swing': this._noise(0.14, 1200, 2, 0.35, 2600); break;
      case 'fire': this._noise(0.5, 400, 0.7, 0.9, 1800); this._tone('sawtooth', 220, 600, 0.35, 0.25); break;
      case 'boom': this._noise(0.4, 300, 0.6, 1.0, 80); this._tone('sine', 120, 30, 0.35, 0.7); break;
      case 'dash': this._noise(0.22, 2500, 1.5, 0.5, 700); break;
      case 'jump': this._tone('sine', 280, 520, 0.12, 0.25); break;
      case 'djump': this._tone('triangle', 420, 880, 0.16, 0.3); break;
      case 'hurt': this._tone('sawtooth', 300, 80, 0.2, 0.5); this._noise(0.12, 500, 1, 0.5, 200); break;
      case 'fear': this._tone('sine', 90, 400, 0.6, 0.4); this._tone('sine', 94, 410, 0.6, 0.4); break;
      case 'ui': this._tone('triangle', 660, 990, 0.09, 0.25); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone('triangle', f, f * 1.01, 0.3, 0.3), i * 120)); break;
      case 'eat': this._tone('sine', 400, 300, 0.1, 0.3); setTimeout(() => this._tone('sine', 420, 320, 0.1, 0.3), 140); break;
    }
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16]; let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.s.music <= 0.001) return; const t = this.ctx.currentTime;
      const note = 220 * Math.pow(2, scale[(step * 3 + (step >> 2)) % scale.length] / 12) * (step % 16 < 8 ? 1 : 0.75);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = note; this._env(g, t, 0.03, 0.9, 0.2);
      o.connect(g); g.connect(this.musG); o.start(t); o.stop(t + 1.1);
      if (step % 4 === 0) { const o2 = this.ctx.createOscillator(), g2 = this.ctx.createGain(); o2.type = 'sine'; o2.frequency.value = note / 2; this._env(g2, t, 0.05, 1.6, 0.25); o2.connect(g2); g2.connect(this.musG); o2.start(t); o2.stop(t + 1.8); }
      step++;
    }, 520);
  }
  dispose() { clearInterval(this.musicTimer); this.musicTimer = 0; if (this.ctx) { this.ctx.close(); this.ctx = null; } }
}
