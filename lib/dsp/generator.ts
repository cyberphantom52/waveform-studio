export type WaveShape =
  | "sine"
  | "square"
  | "triangle"
  | "sawtooth"
  | "noise"
  | "impulse";

export interface GeneratorParams {
  shape: WaveShape;
  frequency: number;
  amplitude: number; // 0-1
  duration: number; // in samples
  sampleRate: number;
  phase: number; // 0-1
}

export function generateWaveform(params: GeneratorParams): Uint8Array {
  const { shape, frequency, amplitude, duration, sampleRate, phase } = params;
  const out = new Uint8Array(duration);

  for (let i = 0; i < duration; i++) {
    const t = i / sampleRate;
    const phaseOffset = phase * 2 * Math.PI;
    let value = 0;

    switch (shape) {
      case "sine":
        value = Math.sin(2 * Math.PI * frequency * t + phaseOffset);
        break;
      case "square":
        value =
          Math.sin(2 * Math.PI * frequency * t + phaseOffset) >= 0 ? 1 : -1;
        break;
      case "triangle": {
        const p = ((frequency * t + phase) % 1 + 1) % 1;
        value = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
        break;
      }
      case "sawtooth": {
        const p = ((frequency * t + phase) % 1 + 1) % 1;
        value = 2 * p - 1;
        break;
      }
      case "noise":
        value = Math.random() * 2 - 1;
        break;
      case "impulse":
        value = i === 0 ? 1 : 0;
        break;
    }

    out[i] = Math.max(
      0,
      Math.min(255, Math.round(value * amplitude * 127 + 128))
    );
  }

  return out;
}

export const defaultGeneratorParams: GeneratorParams = {
  shape: "sine",
  frequency: 150,
  amplitude: 0.8,
  duration: 800,
  sampleRate: 8000,
  phase: 0,
};
