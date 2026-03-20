const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Int16Array(bytes.buffer);
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i += 1) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export class PcmPlayer {
  private readonly sampleRate: number;

  private audioContext: AudioContext | null = null;

  private nextPlaybackTime = 0;

  private activeSources = new Set<AudioBufferSourceNode>();

  private closePromise: Promise<void> | null = null;

  constructor(sampleRate = DEFAULT_OUTPUT_SAMPLE_RATE) {
    this.sampleRate = sampleRate;
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.nextPlaybackTime = this.audioContext.currentTime;
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  async playBase64Chunk(base64Pcm: string): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

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

    const startAt = Math.max(context.currentTime, this.nextPlaybackTime);
    source.start(startAt);
    this.nextPlaybackTime = startAt + buffer.duration;
  }

  interrupt(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // no-op: source may already be stopped
      }
    });
    this.activeSources.clear();

    if (this.audioContext) {
      this.nextPlaybackTime = this.audioContext.currentTime;
    } else {
      this.nextPlaybackTime = 0;
    }
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    if (!this.audioContext) {
      return;
    }

    const contextToClose = this.audioContext;
    this.audioContext = null;
    this.nextPlaybackTime = 0;

    this.closePromise = (async () => {
      try {
        if (contextToClose.state !== "closed") {
          await contextToClose.close();
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
          throw error;
        }
      } finally {
        this.closePromise = null;
      }
    })();

    return this.closePromise;
  }
}
