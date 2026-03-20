export type PcmChunkHandler = (pcm16Chunk: Int16Array) => void;

const DEFAULT_TARGET_SAMPLE_RATE = 44100; // align with backend REALTIME_DEFAULT_SAMPLE_RATE
const DEFAULT_BUFFER_SIZE = 4096;
const DEFAULT_CHUNK_DURATION_MS = 20;

function downsampleBuffer(input: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return input;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / sampleRateRatio);
  const output = new Float32Array(outputLength);

  let outputIndex = 0;
  let inputIndex = 0;

  while (outputIndex < output.length) {
    const nextInputIndex = Math.round((outputIndex + 1) * sampleRateRatio);
    let sum = 0;
    let count = 0;

    for (let i = inputIndex; i < nextInputIndex && i < input.length; i += 1) {
      sum += input[i];
      count += 1;
    }

    output[outputIndex] = count > 0 ? sum / count : 0;
    outputIndex += 1;
    inputIndex = nextInputIndex;
  }

  return output;
}

function floatToInt16(input: Float32Array): Int16Array {
  const int16 = new Int16Array(input.length);

  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return int16;
}

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

  constructor(targetSampleRate = DEFAULT_TARGET_SAMPLE_RATE, bufferSize = DEFAULT_BUFFER_SIZE) {
    this.targetSampleRate = targetSampleRate;
    this.bufferSize = bufferSize;
    this.samplesPerChunk = Math.max(1, Math.round((Math.max(this.targetSampleRate, 16000) * DEFAULT_CHUNK_DURATION_MS) / 1000));
  }

  private flushPendingChunks(force = false): void {
    if (!this.chunkHandler) {
      this.pending = new Float32Array(0);
      return;
    }

    while (this.pending.length >= this.samplesPerChunk || (force && this.pending.length > 0)) {
      const emitLength = this.pending.length >= this.samplesPerChunk ? this.samplesPerChunk : this.pending.length;
      const emit = this.pending.slice(0, emitLength);
      this.pending = this.pending.slice(emitLength);
      const pcm16 = floatToInt16(emit);
      this.chunkHandler(pcm16);
    }
  }

  private appendSamples(samples: Float32Array): void {
    const sampleCopy = new Float32Array(samples.length);
    sampleCopy.set(samples);

    if (this.pending.length === 0) {
      this.pending = sampleCopy;
    } else {
      const merged = new Float32Array(this.pending.length + sampleCopy.length);
      merged.set(this.pending, 0);
      merged.set(sampleCopy, this.pending.length);
      this.pending = merged;
    }
    this.flushPendingChunks();
  }

  get isActive(): boolean {
    return Boolean(this.audioContext && this.mediaStream && (this.processorNode || this.workletNode));
  }

  async start(onChunk: PcmChunkHandler): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("Audio capture is only available in the browser.");
    }

    if (this.isActive) {
      return;
    }

    const audioConstraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleSize: 16,
      echoCancellation: true,
      noiseSuppression: true,
    };

    if (this.targetSampleRate > 0) {
      audioConstraints.sampleRate = this.targetSampleRate;
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    try {
      if (this.targetSampleRate > 0) {
        this.audioContext = new AudioContext({
          sampleRate: this.targetSampleRate,
          latencyHint: "interactive",
        });
      } else {
        this.audioContext = new AudioContext({ latencyHint: "interactive" });
      }
    } catch {
      this.audioContext = new AudioContext({ latencyHint: "interactive" });
    }

    if (this.audioContext) {
      this.targetSampleRate = this.targetSampleRate > 0 ? this.targetSampleRate : this.audioContext.sampleRate;
      this.samplesPerChunk = Math.max(1, Math.round((this.targetSampleRate * DEFAULT_CHUNK_DURATION_MS) / 1000));
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;

    this.pending = new Float32Array(0);
    this.chunkHandler = onChunk;

    const attachChunkHandler = (floatBuffer: Float32Array) => {
      const inputSampleRate = this.audioContext?.sampleRate ?? this.targetSampleRate;
      const downsampled = downsampleBuffer(floatBuffer, inputSampleRate, this.targetSampleRate);
      this.appendSamples(downsampled);
    };

    const useAudioWorklet = typeof AudioWorkletNode !== "undefined";
    if (useAudioWorklet) {
      try {
        const moduleUrl = "/audio/pcm-capture-worklet.js";
        await this.audioContext.audioWorklet.addModule(moduleUrl);

        this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-capture-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
        });

        this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
          attachChunkHandler(event.data);
        };

        this.sourceNode.connect(this.workletNode);
        this.workletNode.connect(this.silentGain);
      } catch {
        this.workletNode = null;
      }
    }

    if (!this.workletNode) {
      this.processorNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
      this.processorNode.onaudioprocess = (event) => {
        const floatBuffer = event.inputBuffer.getChannelData(0);
        attachChunkHandler(floatBuffer);
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
    if (this.stopPromise) {
      return this.stopPromise;
    }

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

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }

      const contextToClose = this.audioContext;
      this.audioContext = null;
      if (contextToClose) {
        try {
          if (contextToClose.state !== "closed") {
            await contextToClose.close();
          }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
            throw error;
          }
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
