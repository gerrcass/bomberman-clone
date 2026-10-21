import type { StageEvent } from '../game';

type AudioContextLike = AudioContext;

export interface AudioSettings {
  readonly sound: boolean;
  readonly music: boolean;
}

export interface AudioController {
  unlock(): void;
  playEvents(events: readonly StageEvent[]): void;
  click(): void;
  setSettings(settings: AudioSettings): void;
  dispose(): void;
}

const MUSIC_STEP_MS = 260;
const MUSIC_NOTES = [220, 330, 392, 330, 247, 370, 440, 370];

/**
 * Small Web Audio synthesizer. All sound is generated from oscillators and
 * noise, so the game ships without sampled audio.
 */
export function createAudio(win: Window): AudioController {
  let context: AudioContextLike | null = null;
  let master: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let musicTimer: number | null = null;
  let musicStep = 0;
  let settings: AudioSettings = {
    sound: true,
    music: true,
  };
  let disposed = false;

  function ensureContext(): AudioContextLike | null {
    if (disposed) {
      return null;
    }
    if (context !== null) {
      return context;
    }
    const audioWindow = win as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Constructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (Constructor === undefined) {
      return null;
    }
    try {
      const created = new Constructor();
      context = created;
      master = created.createGain();
      master.gain.value = 0.55;
      master.connect(created.destination);
      musicGain = created.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return created;
    } catch {
      return null;
    }
  }

  function unlock(): void {
    const ctx = ensureContext();
    if (ctx === null) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (settings.music) {
      startMusic();
    }
  }

  function tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    slideTo?: number,
    output: GainNode | null = null,
  ): void {
    const ctx = ensureContext();
    if (ctx === null || master === null) {
      return;
    }
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(output ?? master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function noise(duration: number, gainValue: number, cutoff: number): void {
    const ctx = ensureContext();
    if (ctx === null || master === null) {
      return;
    }
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
  }

  function playEvents(events: readonly StageEvent[]): void {
    if (!settings.sound) {
      return;
    }
    for (const event of events) {
      switch (event.type) {
        case 'bomb-placed':
          tone(520, 0.08, 'square', 0.08, 380);
          break;
        case 'bomb-detonated':
          noise(0.32, 0.22, 900);
          tone(90, 0.28, 'sine', 0.18, 45);
          break;
        case 'brick-destroyed':
          noise(0.08, 0.07, 1800);
          break;
        case 'power-up-collected':
          tone(660, 0.08, 'square', 0.06, 880);
          win.setTimeout(() => tone(990, 0.12, 'square', 0.05, 1180), 70);
          break;
        case 'shield-absorbed':
        case 'rival-hit':
          tone(260, 0.2, 'triangle', 0.08, 180);
          break;
        case 'rival-defeated':
          tone(180, 0.35, 'sawtooth', 0.08, 70);
          noise(0.2, 0.08, 1200);
          break;
        case 'player-hit':
          tone(150, 0.45, 'sawtooth', 0.12, 55);
          break;
        case 'stage-cleared':
          [523, 659, 784, 1047].forEach((note, index) => {
            win.setTimeout(() => tone(note, 0.2, 'square', 0.07), index * 120);
          });
          break;
        case 'game-over':
          [392, 330, 262, 196].forEach((note, index) => {
            win.setTimeout(() => tone(note, 0.28, 'triangle', 0.1), index * 180);
          });
          break;
        default:
          break;
      }
    }
  }

  function startMusic(): void {
    if (musicTimer !== null || !settings.music) {
      return;
    }
    const ctx = ensureContext();
    if (ctx === null || musicGain === null) {
      return;
    }
    musicTimer = win.setInterval(() => {
      if (!settings.music) {
        stopMusic();
        return;
      }
      const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      if (note === undefined) {
        return;
      }
      tone(note, 0.2, 'triangle', 0.05, undefined, musicGain);
      if (musicStep % 2 === 0) {
        tone(note / 2, 0.42, 'sine', 0.04, undefined, musicGain);
      }
    }, MUSIC_STEP_MS);
  }

  function stopMusic(): void {
    if (musicTimer !== null) {
      win.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock,
    click(): void {
      if (!settings.sound) {
        return;
      }
      tone(880, 0.035, 'square', 0.025, 660);
    },
    playEvents,
    setSettings(next: AudioSettings): void {
      settings = next;
      if (context !== null && master !== null) {
        master.gain.value = next.sound ? 0.55 : 0.35;
      }
      if (next.music) {
        if (context !== null) {
          startMusic();
        }
      } else {
        stopMusic();
      }
    },
    dispose(): void {
      disposed = true;
      stopMusic();
      if (context !== null) {
        void context.close();
        context = null;
      }
    },
  };
}
