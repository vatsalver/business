// AudioWorklet processor for streaming audio to AssemblyAI
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.silenceThreshold = 0.01; // Adjust this value to tune sensitivity
  }

  // Calculate RMS (Root Mean Square) to detect audio level
  calculateRMS(channelData) {
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    return Math.sqrt(sum / channelData.length);
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];

      // Calculate audio level to detect silence
      const rms = this.calculateRMS(inputChannel);
      const hasAudio = rms > this.silenceThreshold;

      // Notify main thread if audio is detected
      if (hasAudio) {
        this.port.postMessage({
          type: 'audioActivity',
        });
      }

      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;

        if (this.bufferIndex >= this.bufferSize) {
          // Convert Float32Array to Int16Array
          const int16Data = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            int16Data[j] = Math.max(
              -32768,
              Math.min(32767, this.buffer[j] * 32768)
            );
          }

          // Send to main thread
          this.port.postMessage({
            type: 'audioData',
            data: int16Data.buffer,
          }, [int16Data.buffer]);

          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
