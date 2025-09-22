/*
 * Utilities to load embedded WebAssembly DSP modules.
 */

const SAW_SYNTH_BASE64 =
  'AGFzbQEAAAABBgFgAX0BfQMCAQAGCQF9AUMAAAAACwcLAQdwcm9jZXNzAAAKNQEzAQF9IwAgAJIiAUMAAIA/XARAIAFDAACAP5MiASQABSABJAALIwBDAAAAQJRDAACAP5ML';

function decodeBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function loadSawSynthModule(): Promise<WebAssembly.Instance> {
  const binary = decodeBase64(SAW_SYNTH_BASE64);
  const { instance } = await WebAssembly.instantiate(binary.buffer, {});
  return instance;
}

export function createWorkletWasmMessage(): ArrayBuffer {
  return decodeBase64(SAW_SYNTH_BASE64).buffer;
}

export type SawSynthExports = {
  process(freqIncrement: number): number;
};
