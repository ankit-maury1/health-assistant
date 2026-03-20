// export type PcmChunkHandler = (pcm16Chunk: Int16Array) => void;

// const DEFAULT_TARGET_SAMPLE_RATE = 44100; // align with backend REALTIME_DEFAULT_SAMPLE_RATE
// const DEFAULT_BUFFER_SIZE = 4096;
// const DEFAULT_CHUNK_DURATION_MS = 20;

// function downsampleBuffer(input: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
//   if (outputSampleRate >= inputSampleRate) {
//     return input;
//   }

//   const sampleRateRatio = inputSampleRate / outputSampleRate;
//   const outputLength = Math.round(input.length / sampleRateRatio);
//   const output = new Float32Array(outputLength);

//   let outputIndex = 0;
//   let inputIndex = 0;

//   while (outputIndex < output.length) {
//     const nextInputIndex = Math.round((outputIndex + 1) * sampleRateRatio);
//     let sum = 0;
//     let count = 0;

//     for (let i = inputIndex; i < nextInputIndex && i < input.length; i += 1) {
//       sum += input[i];
//       count += 1;
//     }

//     output[outputIndex] = count > 0 ? sum / count : 0;
//     outputIndex += 1;
//     inputIndex = nextInputIndex;
//   }

//   return output;
// }

// function floatToInt16(input: Float32Array): Int16Array {
//   const int16 = new Int16Array(input.length);

//   for (let i = 0; i < input.length; i += 1) {
//     const s = Math.max(-1, Math.min(1, input[i]));
//     int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
//   }

//   return int16;
// }

// export class PcmCapture {
//   private targetSampleRate: number;

//   private readonly bufferSize: number;

//   private audioContext: AudioContext | null = null;

//   private mediaStream: MediaStream | null = null;

//   private sourceNode: MediaStreamAudioSourceNode | null = null;

//   private processorNode: ScriptProcessorNode | null = null;

//   private workletNode: AudioWorkletNode | null = null;

//   private silentGain: GainNode | null = null;

//   private pending = new Float32Array(0);

//   private chunkHandler: PcmChunkHandler | null = null;

//   private samplesPerChunk: number;

//   private stopPromise: Promise<void> | null = null;

//   constructor(targetSampleRate = DEFAULT_TARGET_SAMPLE_RATE, bufferSize = DEFAULT_BUFFER_SIZE) {
//     this.targetSampleRate = targetSampleRate;
//     this.bufferSize = bufferSize;
//     this.samplesPerChunk = Math.max(1, Math.round((Math.max(this.targetSampleRate, 16000) * DEFAULT_CHUNK_DURATION_MS) / 1000));
//   }

//   private flushPendingChunks(force = false): void {
//     if (!this.chunkHandler) {
//       this.pending = new Float32Array(0);
//       return;
//     }

//     while (this.pending.length >= this.samplesPerChunk || (force && this.pending.length > 0)) {
//       const emitLength = this.pending.length >= this.samplesPerChunk ? this.samplesPerChunk : this.pending.length;
//       const emit = this.pending.slice(0, emitLength);
//       this.pending = this.pending.slice(emitLength);
//       const pcm16 = floatToInt16(emit);
//       this.chunkHandler(pcm16);
//     }
//   }

//   private appendSamples(samples: Float32Array): void {
//     const sampleCopy = new Float32Array(samples.length);
//     sampleCopy.set(samples);

//     if (this.pending.length === 0) {
//       this.pending = sampleCopy;
//     } else {
//       const merged = new Float32Array(this.pending.length + sampleCopy.length);
//       merged.set(this.pending, 0);
//       merged.set(sampleCopy, this.pending.length);
//       this.pending = merged;
//     }
//     this.flushPendingChunks();
//   }

//   get isActive(): boolean {
//     return Boolean(this.audioContext && this.mediaStream && (this.processorNode || this.workletNode));
//   }

//   async start(onChunk: PcmChunkHandler): Promise<void> {
//     if (typeof window === "undefined") {
//       throw new Error("Audio capture is only available in the browser.");
//     }

//     if (this.isActive) {
//       return;
//     }

//     const audioConstraints: MediaTrackConstraints = {
//       channelCount: 1,
//       sampleSize: 16,
//       echoCancellation: true,
//       noiseSuppression: true,
//     };

//     if (this.targetSampleRate > 0) {
//       audioConstraints.sampleRate = this.targetSampleRate;
//     }

//     this.mediaStream = await navigator.mediaDevices.getUserMedia({
//       audio: audioConstraints,
//     });

//     try {
//       if (this.targetSampleRate > 0) {
//         this.audioContext = new AudioContext({
//           sampleRate: this.targetSampleRate,
//           latencyHint: "interactive",
//         });
//       } else {
//         this.audioContext = new AudioContext({ latencyHint: "interactive" });
//       }
//     } catch {
//       this.audioContext = new AudioContext({ latencyHint: "interactive" });
//     }

//     if (this.audioContext) {
//       this.targetSampleRate = this.targetSampleRate > 0 ? this.targetSampleRate : this.audioContext.sampleRate;
//       this.samplesPerChunk = Math.max(1, Math.round((this.targetSampleRate * DEFAULT_CHUNK_DURATION_MS) / 1000));
//     }

//     this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
//     this.silentGain = this.audioContext.createGain();
//     this.silentGain.gain.value = 0;

//     this.pending = new Float32Array(0);
//     this.chunkHandler = onChunk;

//     const attachChunkHandler = (floatBuffer: Float32Array) => {
//       const inputSampleRate = this.audioContext?.sampleRate ?? this.targetSampleRate;
//       const downsampled = downsampleBuffer(floatBuffer, inputSampleRate, this.targetSampleRate);
//       this.appendSamples(downsampled);
//     };

//     const useAudioWorklet = typeof AudioWorkletNode !== "undefined";
//     if (useAudioWorklet) {
//       try {
//         const moduleUrl = "/audio/pcm-capture-worklet.js";
//         await this.audioContext.audioWorklet.addModule(moduleUrl);

//         this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-capture-processor", {
//           numberOfInputs: 1,
//           numberOfOutputs: 1,
//           channelCount: 1,
//         });

//         this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
//           attachChunkHandler(event.data);
//         };

//         this.sourceNode.connect(this.workletNode);
//         this.workletNode.connect(this.silentGain);
//       } catch {
//         this.workletNode = null;
//       }
//     }

//     if (!this.workletNode) {
//       this.processorNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
//       this.processorNode.onaudioprocess = (event) => {
//         const floatBuffer = event.inputBuffer.getChannelData(0);
//         attachChunkHandler(floatBuffer);
//       };
//       this.sourceNode.connect(this.processorNode);
//       this.processorNode.connect(this.silentGain);
//     }

//     this.silentGain.connect(this.audioContext.destination);

//     if (this.audioContext.state === "suspended") {
//       await this.audioContext.resume();
//     }
//   }

//   async stop(): Promise<void> {
//     if (this.stopPromise) {
//       return this.stopPromise;
//     }

//     this.stopPromise = (async () => {
//       this.flushPendingChunks(true);

//       if (this.workletNode) {
//         this.workletNode.port.onmessage = null;
//         this.workletNode.disconnect();
//         this.workletNode = null;
//       }

//       this.processorNode?.disconnect();
//       this.sourceNode?.disconnect();
//       this.silentGain?.disconnect();

//       this.processorNode = null;
//       this.sourceNode = null;
//       this.silentGain = null;

//       if (this.mediaStream) {
//         this.mediaStream.getTracks().forEach((track) => track.stop());
//         this.mediaStream = null;
//       }

//       const contextToClose = this.audioContext;
//       this.audioContext = null;
//       if (contextToClose) {
//         try {
//           if (contextToClose.state !== "closed") {
//             await contextToClose.close();
//           }
//         } catch (error) {
//           if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
//             throw error;
//           }
//         }
//       }

//       this.pending = new Float32Array(0);
//       this.chunkHandler = null;
//     })();

//     try {
//       await this.stopPromise;
//     } finally {
//       this.stopPromise = null;
//     }
//   }
// }

/**
 * pcmCapture.ts
 * ─────────────
 * Captures microphone audio and emits PCM16 chunks at exactly 16 kHz.
 *
 * BUG FIXES vs original:
 * ① DEFAULT_TARGET_SAMPLE_RATE was 0 (browser default ≈44100/48000 Hz).
 *   Gemini Live requires 16000 Hz. Changed to 16000 as the hard default.
 * ② ScriptProcessor bufferSize was 4096. At 16 kHz that is 256 ms of latency
 *   before the first onaudioprocess fires. Reduced to 512 (32 ms).
 * ③ The AudioContext was not asked for 16 kHz when targetSampleRate was 0,
 *   so downsampleBuffer was silently a no-op and 44.1 kHz raw audio reached
 *   the server — now the AudioContext always requests the target rate.
 */

export type PcmChunkHandler = (pcm16Chunk: Int16Array) => void;

/** Gemini Live requires exactly 16 kHz PCM16 input. Do not change this. */
const GEMINI_INPUT_SAMPLE_RATE = 16_000;
const DEFAULT_TARGET_SAMPLE_RATE = GEMINI_INPUT_SAMPLE_RATE;

/**
 * At 16 kHz, 512-sample ScriptProcessor buffer = 32 ms per callback.
 * The AudioWorklet path ignores this (it always uses 128-sample blocks).
 */
const DEFAULT_BUFFER_SIZE = 512;

/** Each emitted PCM chunk covers 20 ms of audio (320 samples @ 16 kHz). */
const DEFAULT_CHUNK_DURATION_MS = 20;

// ── DSP helpers ──────────────────────────────────────────────────────────────

function downsampleBuffer(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outLen = Math.round(input.length / ratio);
  const output = new Float32Array(outLen);

  let outIdx = 0;
  let inIdx = 0;

  while (outIdx < outLen) {
    const nextInIdx = Math.round((outIdx + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let i = inIdx; i < nextInIdx && i < input.length; i++) {
      sum += input[i];
      count++;
    }
    output[outIdx] = count > 0 ? sum / count : 0;
    outIdx++;
    inIdx = nextInIdx;
  }

  return output;
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// ── PcmCapture class ─────────────────────────────────────────────────────────

export class PcmCapture {
  private targetSampleRate: number;
  private readonly bufferSize: number;

  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;

  private pending = new Float32Array(0);
  private chunkHandler: PcmChunkHandler | null = null;
  private samplesPerChunk: number;
  private stopPromise: Promise<void> | null = null;

  constructor(
    targetSampleRate = DEFAULT_TARGET_SAMPLE_RATE,
    bufferSize = DEFAULT_BUFFER_SIZE,
  ) {
    // Always clamp to 16 kHz — passing a higher rate is silently corrected.
    this.targetSampleRate =
      targetSampleRate > 0 && targetSampleRate <= GEMINI_INPUT_SAMPLE_RATE
        ? targetSampleRate
        : GEMINI_INPUT_SAMPLE_RATE;
    this.bufferSize = bufferSize;
    this.samplesPerChunk = Math.max(
      1,
      Math.round((this.targetSampleRate * DEFAULT_CHUNK_DURATION_MS) / 1000),
    );
  }

  // ── PCM chunk emission ──────────────────────────────────────────────────

  private flushPendingChunks(force = false): void {
    if (!this.chunkHandler) {
      this.pending = new Float32Array(0);
      return;
    }
    while (
      this.pending.length >= this.samplesPerChunk ||
      (force && this.pending.length > 0)
    ) {
      const len =
        this.pending.length >= this.samplesPerChunk
          ? this.samplesPerChunk
          : this.pending.length;
      const slice = this.pending.slice(0, len);
      this.pending = this.pending.slice(len);
      this.chunkHandler(floatToInt16(slice));
    }
  }

  private appendSamples(samples: Float32Array): void {
    const copy = new Float32Array(samples.length);
    copy.set(samples);

    if (this.pending.length === 0) {
      this.pending = copy;
    } else {
      const merged = new Float32Array(this.pending.length + copy.length);
      merged.set(this.pending);
      merged.set(copy, this.pending.length);
      this.pending = merged;
    }
    this.flushPendingChunks();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get isActive(): boolean {
    return Boolean(
      this.audioContext && this.mediaStream && (this.processorNode || this.workletNode),
    );
  }

  async start(onChunk: PcmChunkHandler): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("Audio capture is only available in the browser.");
    }
    if (this.isActive) return;

    // Request mono audio with common constraints; sampleRate hint is best-effort.
    const constraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleSize: 16,
      echoCancellation: true,
      noiseSuppression: true,
      // Don't constrain sampleRate on the MediaStream — let the browser choose
      // its native rate and we'll downsample in the AudioContext graph.
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });

    // ── FIX ③: Always create AudioContext at targetSampleRate.
    // If the browser can't honor it (e.g., iOS), it falls back gracefully and
    // the downsampleBuffer call below will still do the correct conversion.
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.targetSampleRate,
        latencyHint: "interactive",
      });
    } catch {
      try {
        this.audioContext = new AudioContext({ latencyHint: "interactive" });
      } catch (fallbackError) {
        throw new Error(`Failed to create AudioContext: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }

    if (!this.audioContext) {
      throw new Error("AudioContext is null after initialization");
    }

    const ctxRate = this.audioContext.sampleRate;
    // Recalculate samples-per-chunk based on the actual context sample rate.
    this.samplesPerChunk = Math.max(
      1,
      Math.round((this.targetSampleRate * DEFAULT_CHUNK_DURATION_MS) / 1000),
    );

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;

    this.pending = new Float32Array(0);
    this.chunkHandler = onChunk;

    // Downsamples from the AudioContext's actual rate to targetSampleRate (16 kHz).
    const processFloat = (buf: Float32Array) => {
      const downsampled = downsampleBuffer(buf, ctxRate, this.targetSampleRate);
      this.appendSamples(downsampled);
    };

    // Prefer AudioWorklet (zero jank, runs off main thread).
    let workletLoaded = false;
    if (typeof AudioWorkletNode !== "undefined") {
      try {
        await this.audioContext.audioWorklet.addModule("/audio/pcm-capture-worklet.js");
        this.workletNode = new AudioWorkletNode(
          this.audioContext,
          "pcm-capture-processor",
          { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 },
        );
        this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
          processFloat(e.data);
        };
        this.sourceNode.connect(this.workletNode);
        this.workletNode.connect(this.silentGain);
        workletLoaded = true;
      } catch {
        this.workletNode = null;
      }
    }

    // Fallback: ScriptProcessor (deprecated but universal).
    if (!workletLoaded) {
      if (!this.audioContext) {
        throw new Error("AudioContext is required but is null");
      }
      this.processorNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
      this.processorNode.onaudioprocess = (e) => {
        processFloat(e.inputBuffer.getChannelData(0));
      };
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.silentGain);
    }

    this.silentGain.connect(this.audioContext.destination);

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = (async () => {
      this.flushPendingChunks(true);

      if (this.workletNode) {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
        this.workletNode = null;
      }

      this.processorNode?.disconnect();
      this.sourceNode?.disconnect();
      this.silentGain?.disconnect();
      this.processorNode = null;
      this.sourceNode = null;
      this.silentGain = null;

      this.mediaStream?.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;

      const ctx = this.audioContext;
      this.audioContext = null;
      if (ctx) {
        try {
          if (ctx.state !== "closed") await ctx.close();
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "InvalidStateError")) throw err;
        }
      }

      this.pending = new Float32Array(0);
      this.chunkHandler = null;
    })();

    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }
}