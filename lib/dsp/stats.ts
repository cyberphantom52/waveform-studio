export interface WaveformStats {
  sampleCount: number;
  duration: number;
  peak: number;
  peakNormalized: number;
  minSigned: number;
  maxSigned: number;
  rms: number;
  rmsNormalized: number;
  zeroCrossings: number;
  dominantFrequency: number;
  clippingCount: number;
  meanAmplitude: number;
  crestFactor: number;
  nonZeroSampleCount: number;
  firstNonZeroIndex: number;
  lastNonZeroIndex: number;
}

export function computeStats(
  samples: Int8Array,
  sampleRate: number = 8000
): WaveformStats {
  const n = samples.length;
  if (n === 0) {
    return {
      sampleCount: 0,
      duration: 0,
      peak: 0,
      peakNormalized: 0,
      minSigned: 0,
      maxSigned: 0,
      rms: 0,
      rmsNormalized: 0,
      zeroCrossings: 0,
      dominantFrequency: 0,
      clippingCount: 0,
      meanAmplitude: 0,
      crestFactor: 0,
      nonZeroSampleCount: 0,
      firstNonZeroIndex: -1,
      lastNonZeroIndex: -1,
    };
  }

  let sumSquares = 0;
  let sumAbs = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let clipping = 0;
  let minSigned = Number.POSITIVE_INFINITY;
  let maxSigned = Number.NEGATIVE_INFINITY;
  let nonZeroSampleCount = 0;
  let firstNonZeroIndex = -1;
  let lastNonZeroIndex = -1;

  for (let i = 0; i < n; i++) {
    const centered = samples[i];
    const abs = Math.abs(centered);

    sumSquares += centered * centered;
    sumAbs += abs;
    if (abs > peak) peak = abs;
    if (centered < minSigned) minSigned = centered;
    if (centered > maxSigned) maxSigned = centered;
    if (samples[i] === -128 || samples[i] === 127) clipping++;
    if (centered !== 0) {
      nonZeroSampleCount++;
      if (firstNonZeroIndex === -1) firstNonZeroIndex = i;
      lastNonZeroIndex = i;
    }

    if (i > 0) {
      const prev = samples[i - 1];
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
    minSigned,
    maxSigned,
    rms,
    rmsNormalized: rms / 128,
    zeroCrossings,
    dominantFrequency,
    clippingCount: clipping,
    meanAmplitude: sumAbs / n,
    crestFactor,
    nonZeroSampleCount,
    firstNonZeroIndex,
    lastNonZeroIndex,
  };
}

export function computeDelta(
  original: Int8Array,
  remastered: Int8Array
): Float64Array {
  const len = Math.min(original.length, remastered.length);
  const delta = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    delta[i] = remastered[i] - original[i];
  }
  return delta;
}
