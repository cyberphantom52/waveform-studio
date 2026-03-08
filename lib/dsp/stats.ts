export interface WaveformStats {
  sampleCount: number;
  duration: number;
  peak: number;
  peakNormalized: number;
  rms: number;
  rmsNormalized: number;
  zeroCrossings: number;
  dominantFrequency: number;
  clippingCount: number;
  meanAmplitude: number;
  crestFactor: number;
}

export function computeStats(
  samples: Uint8Array,
  sampleRate: number = 8000
): WaveformStats {
  const n = samples.length;
  if (n === 0) {
    return {
      sampleCount: 0,
      duration: 0,
      peak: 0,
      peakNormalized: 0,
      rms: 0,
      rmsNormalized: 0,
      zeroCrossings: 0,
      dominantFrequency: 0,
      clippingCount: 0,
      meanAmplitude: 0,
      crestFactor: 0,
    };
  }

  let sumSquares = 0;
  let sumAbs = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let clipping = 0;

  for (let i = 0; i < n; i++) {
    const centered = samples[i] - 128;
    const abs = Math.abs(centered);

    sumSquares += centered * centered;
    sumAbs += abs;
    if (abs > peak) peak = abs;
    if (samples[i] === 0 || samples[i] === 255) clipping++;

    if (i > 0) {
      const prev = samples[i - 1] - 128;
      if ((prev >= 0 && centered < 0) || (prev < 0 && centered >= 0)) {
        zeroCrossings++;
      }
    }
  }

  const rms = Math.sqrt(sumSquares / n);
  const duration = n / sampleRate;
  const dominantFrequency =
    duration > 0 ? zeroCrossings / (2 * duration) : 0;
  const crestFactor = rms > 0 ? peak / rms : 0;

  return {
    sampleCount: n,
    duration,
    peak,
    peakNormalized: peak / 128,
    rms,
    rmsNormalized: rms / 128,
    zeroCrossings,
    dominantFrequency,
    clippingCount: clipping,
    meanAmplitude: sumAbs / n,
    crestFactor,
  };
}

export function computeDelta(
  original: Uint8Array,
  remastered: Uint8Array
): Float64Array {
  const len = Math.min(original.length, remastered.length);
  const delta = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    delta[i] = remastered[i] - original[i];
  }
  return delta;
}
