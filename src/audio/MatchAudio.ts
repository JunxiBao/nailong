const COMBO_SCALE_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  698.46, // F5
  783.99, // G5
  880.0, // A5
  987.77, // B5
  1046.5, // C6
  1174.66, // D6
  1318.51, // E6
];

export interface NailongVoiceClipMeta {
  url: string;
  durationMs: number;
  subtitle: string;
}

export const NAILONG_VOICE_CLIPS: readonly NailongVoiceClipMeta[] = [
  {
    url: '/assets/audio/nailong_voice.mp3',
    durationMs: 1550,
    subtitle: '“我是奶龙，我才是奶龙！”',
  },
  {
    url: '/assets/audio/nailong_belly_voice.mp3',
    durationMs: 3950,
    subtitle: '“我的大肚肚，真的很酷酷~”',
  },
  {
    url: '/assets/audio/nailong_full_voice.mp3',
    durationMs: 5450,
    subtitle: '“奶龙又吃撑咯——肚肚没脾气！”',
  },
];

interface VoiceClipState {
  meta: NailongVoiceClipMeta;
  rawBytes: ArrayBuffer | null;
  buffer: AudioBuffer | null;
  isDecoding: boolean;
  fallbackEl: HTMLAudioElement | null;
}

export class MatchAudio {
  private ctx: AudioContext | null = null;
  public muted = false;
  public bgmEnabled = true;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  // Alternating Nailong voice clips ("我是奶龙，我才是奶龙" <-> "我的大肚肚 真的很酷酷")
  private voiceClips: VoiceClipState[];
  private nextVoiceIndex = 0;
  private activeVoiceSource: AudioBufferSourceNode | null = null;
  private voiceDuckUntil = 0;

  constructor() {
    this.voiceClips = NAILONG_VOICE_CLIPS.map((meta) => ({
      meta,
      rawBytes: null,
      buffer: null,
      isDecoding: false,
      fallbackEl: null,
    }));
    if (typeof window !== 'undefined') {
      this.preloadNailongVoices();
    }
  }

  private preloadNailongVoices(): void {
    for (const clip of this.voiceClips) {
      try {
        const el = new Audio(clip.meta.url);
        el.preload = 'auto';
        el.setAttribute('playsinline', 'true');
        clip.fallbackEl = el;
      } catch {
        // ignore in non-DOM test environments
      }

      if (typeof fetch !== 'undefined') {
        fetch(clip.meta.url)
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .then((buf) => {
            if (!buf) return;
            clip.rawBytes = buf;
            if (this.ctx) {
              this.decodeSingleVoice(this.ctx, clip);
            }
          })
          .catch(() => {
            // ignore network errors in headless tests
          });
      }
    }
  }

  private decodeSingleVoice(ctx: AudioContext, clip: VoiceClipState): void {
    if (clip.buffer || clip.isDecoding || !clip.rawBytes) return;
    clip.isDecoding = true;
    const copy = clip.rawBytes.slice(0);
    ctx
      .decodeAudioData(copy)
      .then((decoded) => {
        clip.buffer = decoded;
        clip.isDecoding = false;
      })
      .catch(() => {
        clip.isDecoding = false;
      });
  }

  private decodeAllVoices(ctx: AudioContext): void {
    for (const clip of this.voiceClips) {
      this.decodeSingleVoice(ctx, clip);
    }
  }

  private stopActiveVoice(): void {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
        this.activeVoiceSource.disconnect();
      } catch {
        // already stopped
      }
      this.activeVoiceSource = null;
    }
    for (const clip of this.voiceClips) {
      if (clip.fallbackEl && !clip.fallbackEl.paused) {
        try {
          clip.fallbackEl.pause();
          if (clip.fallbackEl.readyState > 0) {
            clip.fallbackEl.currentTime = 0;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.decodeAllVoices(this.ctx);
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
    if (this.bgmEnabled && this.bgmTimer === null) {
      this.startBgmLoop();
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopActiveVoice();
      this.stopBgmLoop();
    } else if (this.bgmEnabled) {
      this.startBgmLoop();
    }
    return this.muted;
  }

  public toggleBgm(): boolean {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled && !this.muted) {
      this.startBgmLoop();
    } else {
      this.stopBgmLoop();
    }
    return this.bgmEnabled;
  }

  /**
   * Alternates in round-robin order between the user's Nailong voice clips
   * ("我是奶龙，我才是奶龙" <-> "我的大肚肚 真的很酷酷") with zero latency!
   */
  public playNailongVoice(): NailongVoiceClipMeta {
    const clip = this.voiceClips[this.nextVoiceIndex % this.voiceClips.length];
    this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.voiceClips.length;

    if (this.muted) return clip.meta;
    const ctx = this.ensureContext();
    this.stopActiveVoice();
    this.voiceDuckUntil =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) + clip.meta.durationMs;

    if (ctx && clip.buffer && ctx.state === 'running') {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = clip.buffer;
      gain.gain.value = 1.15;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.onended = () => {
        if (this.activeVoiceSource === src) {
          this.activeVoiceSource = null;
        }
      };
      this.activeVoiceSource = src;
      src.start(0);
      return clip.meta;
    }

    if (clip.fallbackEl) {
      clip.fallbackEl.volume = 1.0;
      try {
        if (clip.fallbackEl.readyState > 0) {
          clip.fallbackEl.currentTime = 0;
        }
      } catch {
        // ignore if metadata not yet loaded
      }
      clip.fallbackEl.play().catch(() => {});
    }
    return clip.meta;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  public playSelect(): void {
    this.playTone(660, 0.07, 'square', 0.07, 0, 880);
  }

  public playSwap(): void {
    this.playTone(440, 0.09, 'triangle', 0.12, 0, 680);
  }

  public playInvalidSwap(): void {
    this.playTone(300, 0.11, 'sawtooth', 0.08, 0, 220);
    this.playTone(220, 0.14, 'sawtooth', 0.08, 0.1, 165);
  }

  public playComboMatch(comboIndex: number): void {
    const idx = Math.min(COMBO_SCALE_HZ.length - 1, Math.max(0, comboIndex - 1));
    const root = COMBO_SCALE_HZ[idx];
    this.playTone(root, 0.18, 'triangle', 0.16, 0, root * 1.02);
    this.playTone(root * 1.5, 0.22, 'sine', 0.1, 0.035);
    if (comboIndex >= 3) {
      this.playTone(root * 2, 0.25, 'square', 0.06, 0.07);
    }
  }

  public playEatChomp(): void {
    this.playTone(520, 0.06, 'sine', 0.09, 0, 760);
    this.playTone(620, 0.07, 'triangle', 0.08, 0.06, 920);
  }

  public playBellyBounce(): void {
    // Signature "DUANG~ DUANG~" bouncy belly wobble!
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175, t0);
    osc.frequency.exponentialRampToValueAtTime(340, t0 + 0.12);
    osc.frequency.exponentialRampToValueAtTime(210, t0 + 0.36);

    lfo.frequency.setValueAtTime(22, t0);
    lfoGain.gain.setValueAtTime(38, t0);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.22, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + 0.4);
    lfo.stop(t0 + 0.4);
  }

  public playSpecialBlast(kind: string): void {
    if (kind === 'rainbow_all' || kind === 'rainbow_rays') {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => {
        this.playTone(f, 0.16, 'square', 0.09, i * 0.045);
      });
    } else if (kind === 'belly_slam' || kind === 'bomb5' || kind === 'bomb3') {
      this.playBellyBounce();
      this.playTone(150, 0.32, 'sawtooth', 0.14, 0.04, 55);
      this.playTone(880, 0.18, 'square', 0.07, 0.08, 1320);
    } else {
      // Flame line sweep
      this.playTone(980, 0.2, 'sawtooth', 0.09, 0, 260);
      this.playTone(660, 0.16, 'square', 0.07, 0.03, 1240);
    }
  }

  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.11, 0.22, 0.34, 0.5, 0.64];
    notes.forEach((f, i) => {
      this.playTone(f, i === notes.length - 1 ? 0.42 : 0.14, 'square', 0.11, times[i]);
      this.playTone(f * 0.5, i === notes.length - 1 ? 0.42 : 0.14, 'triangle', 0.1, times[i]);
    });
  }

  public playOutOfMoves(): void {
    [440, 392, 349.23, 293.66].forEach((f, i) => {
      this.playTone(f, 0.22, 'triangle', 0.11, i * 0.16);
    });
  }

  private startBgmLoop(): void {
    this.stopBgmLoop();
    // Gentle cheerful 8-bit candy melody (ducks automatically while Nailong voice clip plays!)
    const melody = [
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33,
      523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 0,
    ];
    this.bgmTimer = window.setInterval(() => {
      if (this.muted || !this.bgmEnabled) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now < this.voiceDuckUntil) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const freq = melody[this.bgmStep % melody.length];
      this.bgmStep++;
      if (freq > 0) {
        this.playTone(freq, 0.16, 'triangle', 0.032, 0);
      }
    }, 240);
  }

  private stopBgmLoop(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
