/**
 * All transform functions operate on Float64Array in signed 8-bit sample space
 * and clamp back into the int8 range on output.
 */

export function toFloat(samples: Int8Array): Float64Array {
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i];
  return out;
}

export function toInt8(samples: Float64Array): Int8Array {
  const out = new Int8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-128, Math.min(127, Math.round(samples[i])));
  }
  return out;
}

export function applyGain(
  samples: Float64Array,
  gain: number
): { result: Float64Array; clipped: number } {
  const out = new Float64Array(samples.length);
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const amplified = samples[i] * gain;
    if (amplified < -128 || amplified > 127) clipped++;
    out[i] = amplified;
  }
  return { result: out, clipped };
}

export function applyPitchShift(
  samples: Float64Array,
  semitones: number
): Float64Array {
  const ratio = Math.pow(2, semitones / 12);
  const newLength = Math.round(samples.length / ratio);
  if (newLength < 2) return new Float64Array([0]);

  const out = new Float64Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const frac = srcIdx - i0;

    const p0 = samples[Math.max(0, i0 - 1)] ?? samples[0];
    const p1 = samples[Math.min(i0, samples.length - 1)];
    const p2 = samples[Math.min(i0 + 1, samples.length - 1)];
    const p3 = samples[Math.min(i0 + 2, samples.length - 1)];

    // Cubic Hermite interpolation
    const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c = -0.5 * p0 + 0.5 * p2;
    const d = p1;

    out[i] = a * frac * frac * frac + b * frac * frac + c * frac + d;
  }

  return out;
}

export type CurveType = "linear" | "exponential" | "logarithmic";

export interface EnvelopePoint {
  position: number; // 0-1 normalized
  amplitude: number; // 0-1 multiplier
  curve: CurveType;
}

function interpolateEnvelope(
  points: EnvelopePoint[],
  position: number
): number {
  if (points.length === 0) return 1;
  if (points.length === 1) return points[0].amplitude;

  const sorted = [...points].sort((a, b) => a.position - b.position);

  if (position <= sorted[0].position) return sorted[0].amplitude;
  if (position >= sorted[sorted.length - 1].position)
    return sorted[sorted.length - 1].amplitude;

  let left = sorted[0];
  let right = sorted[1];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].position >= position) {
      left = sorted[i - 1];
      right = sorted[i];
      break;
    }
  }

  const t =
    right.position === left.position
      ? 0
      : (position - left.position) / (right.position - left.position);

  let curvedT = t;
  switch (left.curve) {
    case "exponential":
      curvedT = t * t;
      break;
    case "logarithmic":
      curvedT = Math.sqrt(t);
      break;
  }

  return left.amplitude + (right.amplitude - left.amplitude) * curvedT;
}

export function applyEnvelope(
  samples: Float64Array,
  points: EnvelopePoint[]
): Float64Array {
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const pos = i / (samples.length - 1 || 1);
    const env = interpolateEnvelope(points, pos);
    out[i] = samples[i] * env;
  }
  return out;
}

export function applyAttack(
  samples: Float64Array,
  attackSamples: number
): Float64Array {
  const out = new Float64Array(samples);
  const len = Math.min(attackSamples, samples.length);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    out[i] *= t;
  }
  return out;
}

export function applyDecay(
  samples: Float64Array,
  decaySamples: number
): Float64Array {
  const out = new Float64Array(samples);
  const len = Math.min(decaySamples, samples.length);
  const start = samples.length - len;
  for (let i = start; i < samples.length; i++) {
    const t = (samples.length - 1 - i) / len;
    out[i] *= t;
  }
  return out;
}

export function applyTailTrim(
  samples: Float64Array,
  threshold: number
): Float64Array {
  const out = new Float64Array(samples);
  let lastAbove = samples.length - 1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i]) > threshold) {
      lastAbove = i;
      break;
    }
  }
  for (let i = lastAbove + 1; i < out.length; i++) {
    out[i] = 0;
  }
  return out;
}

export function applySmoothing(
  samples: Float64Array,
  windowSize: number
): Float64Array {
  const out = new Float64Array(samples.length);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(samples.length - 1, i + half); j++) {
      sum += samples[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

export function applyDeadzone(
  samples: Float64Array,
  threshold: number
): Float64Array {
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.abs(samples[i]) < threshold ? 0 : samples[i];
  }
  return out;
}

export type TransformType =
  | "gain"
  | "pitch"
  | "envelope"
  | "attack"
  | "decay"
  | "tailTrim"
  | "smoothing"
  | "deadzone";

export interface TransformParams {
  gain: { value: number };
  pitch: { semitones: number };
  envelope: { points: EnvelopePoint[] };
  attack: { durationMs: number };
  decay: { durationMs: number };
  tailTrim: { threshold: number };
  smoothing: { windowSize: number };
  deadzone: { threshold: number };
}

export interface TransformStep {
  type: TransformType;
  enabled: boolean;
  params: TransformParams[TransformType];
}

export function applyTransformChain(
  input: Int8Array,
  chain: TransformStep[],
  sampleRate: number = 8000
): { result: Int8Array; clippedTotal: number } {
  let samples = toFloat(input);
  let clippedTotal = 0;

  for (const step of chain) {
    if (!step.enabled) continue;

    switch (step.type) {
      case "gain": {
        const p = step.params as TransformParams["gain"];
        const { result, clipped } = applyGain(samples, p.value);
        samples = result;
        clippedTotal += clipped;
        break;
      }
      case "pitch": {
        const p = step.params as TransformParams["pitch"];
        samples = applyPitchShift(samples, p.semitones);
        break;
      }
      case "envelope": {
        const p = step.params as TransformParams["envelope"];
        samples = applyEnvelope(samples, p.points);
        break;
      }
      case "attack": {
        const p = step.params as TransformParams["attack"];
        samples = applyAttack(
          samples,
          Math.round((p.durationMs / 1000) * sampleRate)
        );
        break;
      }
      case "decay": {
        const p = step.params as TransformParams["decay"];
        samples = applyDecay(
          samples,
          Math.round((p.durationMs / 1000) * sampleRate)
        );
        break;
      }
      case "tailTrim": {
        const p = step.params as TransformParams["tailTrim"];
        samples = applyTailTrim(samples, p.threshold);
        break;
      }
      case "smoothing": {
        const p = step.params as TransformParams["smoothing"];
        samples = applySmoothing(samples, p.windowSize);
        break;
      }
      case "deadzone": {
        const p = step.params as TransformParams["deadzone"];
        samples = applyDeadzone(samples, p.threshold);
        break;
      }
    }
  }

  return { result: toInt8(samples), clippedTotal };
}

export function getDefaultParams(type: TransformType): TransformParams[TransformType] {
  const defaults: TransformParams = {
    gain: { value: 1.0 },
    pitch: { semitones: 0 },
    envelope: {
      points: [
        { position: 0, amplitude: 1, curve: "linear" },
        { position: 1, amplitude: 1, curve: "linear" },
      ],
    },
    attack: { durationMs: 12 },
    decay: { durationMs: 12 },
    tailTrim: { threshold: 5 },
    smoothing: { windowSize: 3 },
    deadzone: { threshold: 10 },
  };
  return defaults[type];
}
