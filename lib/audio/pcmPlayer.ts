// const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;

// function base64ToInt16(base64: string): Int16Array {
//   const binary = atob(base64);
//   const bytes = new Uint8Array(binary.length);

//   for (let i = 0; i < binary.length; i += 1) {
//     bytes[i] = binary.charCodeAt(i);
//   }

//   return new Int16Array(bytes.buffer);
// }

// function int16ToFloat32(int16: Int16Array): Float32Array {
//   const float32 = new Float32Array(int16.length);
//   for (let i = 0; i < int16.length; i += 1) {
//     float32[i] = int16[i] / 0x8000;
//   }
//   return float32;
// }

// export class PcmPlayer {
//   private readonly sampleRate: number;

//   private audioContext: AudioContext | null = null;

//   private nextPlaybackTime = 0;

//   private activeSources = new Set<AudioBufferSourceNode>();

//   private closePromise: Promise<void> | null = null;

//   constructor(sampleRate = DEFAULT_OUTPUT_SAMPLE_RATE) {
//     this.sampleRate = sampleRate;
//   }

//   private async ensureContext(): Promise<AudioContext> {
//     if (!this.audioContext) {
//       this.audioContext = new AudioContext();
//       this.nextPlaybackTime = this.audioContext.currentTime;
//     }

//     if (this.audioContext.state === "suspended") {
//       await this.audioContext.resume();
//     }

//     return this.audioContext;
//   }

//   async playBase64Chunk(base64Pcm: string): Promise<void> {
//     if (typeof window === "undefined") {
//       return;
//     }

//     const context = await this.ensureContext();
//     const int16 = base64ToInt16(base64Pcm);
//     const float32 = int16ToFloat32(int16);

//     const buffer = context.createBuffer(1, float32.length, this.sampleRate);
//     buffer.getChannelData(0).set(float32);

//     const source = context.createBufferSource();
//     source.buffer = buffer;
//     source.connect(context.destination);
//     source.onended = () => {
//       this.activeSources.delete(source);
//     };
//     this.activeSources.add(source);

//     const startAt = Math.max(context.currentTime, this.nextPlaybackTime);
//     source.start(startAt);
//     this.nextPlaybackTime = startAt + buffer.duration;
//   }

//   interrupt(): void {
//     this.activeSources.forEach((source) => {
//       try {
//         source.stop();
//       } catch {
//         // no-op: source may already be stopped
//       }
//     });
//     this.activeSources.clear();

//     if (this.audioContext) {
//       this.nextPlaybackTime = this.audioContext.currentTime;
//     } else {
//       this.nextPlaybackTime = 0;
//     }
//   }

//   async close(): Promise<void> {
//     if (this.closePromise) {
//       return this.closePromise;
//     }

//     if (!this.audioContext) {
//       return;
//     }

//     const contextToClose = this.audioContext;
//     this.audioContext = null;
//     this.nextPlaybackTime = 0;

//     this.closePromise = (async () => {
//       try {
//         if (contextToClose.state !== "closed") {
//           await contextToClose.close();
//         }
//       } catch (error) {
//         if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
//           throw error;
//         }
//       } finally {
//         this.closePromise = null;
//       }
//     })();

//     return this.closePromise;
//   }
// }




/**
 * pcmPlayer.ts
 * ────────────
 * Plays PCM16 audio chunks received from the Gemini Live backend (24 kHz).
 *
 * BUG FIXES vs original:
 * ① AudioContext was created without a sampleRate, so the browser defaulted to
 *   44100 Hz. Playing 24000 Hz content into a 44100 Hz context caused the
 *   Web Audio resampler to pitch-shift the assistant voice up ~83%.
 *   Fix: `new AudioContext({ sampleRate: this.sampleRate })`.
 * ② nextPlaybackTime was not guarded against being far in the past after a
 *   long silence, causing the scheduler to stack chunks immediately rather
 *   than gaplessly. Added a staleness guard.
 */

const DEFAULT_OUTPUT_SAMPLE_RATE = 24_000; // Gemini Live always outputs 24 kHz

// ── Base64 / PCM helpers ──────────────────────────────────────────────────────

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    f32[i] = int16[i] / 0x8000;
  }
  return f32;
}

// ── PcmPlayer ─────────────────────────────────────────────────────────────────

export class PcmPlayer {
  private readonly sampleRate: number;

  private audioContext: AudioContext | null = null;
  private nextPlaybackTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private closePromise: Promise<void> | null = null;

  constructor(sampleRate = DEFAULT_OUTPUT_SAMPLE_RATE) {
    this.sampleRate = sampleRate;
  }

  // ── Context management ────────────────────────────────────────────────────

  private async ensureContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      // ── FIX ①: Create context at the model's output rate (24 kHz).
      // Without this, the browser uses 44100 Hz and pitch-shifts the audio.
      this.audioContext = new AudioContext({
        sampleRate: this.sampleRate,
        latencyHint: "interactive",
      });
      this.nextPlaybackTime = this.audioContext.currentTime;
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  async playBase64Chunk(base64Pcm: string): Promise<void> {
    if (typeof window === "undefined") return;

    const context = await this.ensureContext();
    const int16 = base64ToInt16(base64Pcm);
    const float32 = int16ToFloat32(int16);

    const buffer = context.createBuffer(1, float32.length, this.sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      this.activeSources.delete(source);
    };
    this.activeSources.add(source);

    // ── FIX ②: If nextPlaybackTime is stale (e.g., after a long silence or
    // after interrupt()), clamp to now so we don't schedule in the past.
    const now = context.currentTime;
    const startAt = Math.max(now, this.nextPlaybackTime);
    source.start(startAt);
    this.nextPlaybackTime = startAt + buffer.duration;
  }

  // ── Barge-in / interrupt ──────────────────────────────────────────────────

  interrupt(): void {
    this.activeSources.forEach((src) => {
      try { src.stop(); } catch { /* already stopped */ }
    });
    this.activeSources.clear();

    // Reset scheduler to now so the next chunk starts immediately.
    this.nextPlaybackTime = this.audioContext?.currentTime ?? 0;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    this.audioContext = null;
    this.nextPlaybackTime = 0;
    this.activeSources.clear();

    this.closePromise = (async () => {
      try {
        if (ctx.state !== "closed") await ctx.close();
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "InvalidStateError")) throw err;
      } finally {
        this.closePromise = null;
      }
    })();

    return this.closePromise;
  }
}