/**
 * Web Audio API synthesizer for incoming & outgoing call ringtones.
 * Completely standalone with zero external audio asset dependencies.
 */
class CallAudioRingtone {
  constructor() {
    this.audioCtx = null;
    this.timer = null;
    this.isPlaying = false;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play pleasant incoming chime pattern (repeats every 2.4s)
   */
  startIncoming() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const playChime = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const notes = [
          { freq: 523.25, time: 0.0, dur: 0.25 }, // C5
          { freq: 659.25, time: 0.2, dur: 0.25 }, // E5
          { freq: 783.99, time: 0.4, dur: 0.35 }  // G5
        ];

        notes.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0, now + time);
          gain.gain.linearRampToValueAtTime(0.18, now + time + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur);
        });
      } catch (err) {
        // Ignored if user hasn't interacted with document yet
      }
    };

    playChime();
    this.timer = setInterval(playChime, 2400);
  }

  /**
   * Play outgoing ringback tone (repeats every 3.5s)
   */
  startOutgoing() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const playRingback = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.3);
        osc2.stop(now + 1.3);
      } catch (err) {
        // Ignore
      }
    };

    playRingback();
    this.timer = setInterval(playRingback, 3500);
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const ringtone = new CallAudioRingtone();
