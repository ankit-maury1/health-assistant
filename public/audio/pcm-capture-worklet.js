class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];
    const copied = new Float32Array(channelData.length);
    copied.set(channelData);
    this.port.postMessage(copied, [copied.buffer]);
    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
