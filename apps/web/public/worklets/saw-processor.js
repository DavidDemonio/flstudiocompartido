let wasmInstance = null;
let sampleRateHz = 48000;

class SawSynthProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'frequency',
        defaultValue: 220,
        minValue: 20,
        maxValue: 16000,
        automationRate: 'a-rate',
      },
    ];
  }

  constructor() {
    super();
    this.port.onmessage = (event) => {
      const { data } = event;
      if (data?.type === 'load-wasm' && data.wasm) {
        WebAssembly.instantiate(data.wasm, {})
          .then(({ instance }) => {
            wasmInstance = instance;
          })
          .catch((error) => {
            console.error('Failed to instantiate synth WASM', error);
          });
      }

      if (data?.type === 'configure' && typeof data.sampleRate === 'number') {
        sampleRateHz = data.sampleRate;
      }
    };
  }

  process(_inputs, outputs, parameters) {
    if (!wasmInstance) {
      return true;
    }

    const outputChannel = outputs[0][0];
    if (!outputChannel) {
      return true;
    }

    const freqParam = parameters.frequency;
    const processor = wasmInstance.exports.process;
    if (typeof processor !== 'function') {
      return true;
    }

    for (let i = 0; i < outputChannel.length; i += 1) {
      const frequency = freqParam.length === 1 ? freqParam[0] : freqParam[i];
      const increment = frequency / sampleRateHz;
      outputChannel[i] = processor(increment);
    }

    return true;
  }
}

registerProcessor('saw-synth-processor', SawSynthProcessor);
