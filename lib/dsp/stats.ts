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
  /** DC offset — mean value of all samples */
  dcOffset: number;
  /** Symmetry ratio — abs(sum of positive samples) / abs(sum of negative samples). 1.0 = perfect symmetry */
  symmetryRatio: number;
  /** Range utilization — peak / 127 as a percentage (0-100) */
  rangeUtilization: number;
  /** Attack time in milliseconds — time from first significant sample to reaching 90% of peak */
  attackTimeMs: number;
  /** Dead tail percentage — percentage of trailing samples below threshold 3 */
  deadTailPercent: number;
  /** Half-period coefficient of variation (%) — how regular the oscillation is. Lower = more regular */
  halfPeriodCV: number;
}

/**
 * Significance threshold for haptic quality metrics.
 *
 * Samples with abs(value) <= this threshold are treated as dither/silence
 * and excluded from crest factor, symmetry, attack time, DC offset, and
 * half-period CV calculations. This prevents long dither-filled RTP streams
 * (like haptic_rtp.bin with 77% dither at ±0/1) from producing misleading
 * quality metrics.
 *
 * The threshold is set to 2 because:
 * - Dither patterns in haptic RTP files are typically ±1 alternating with 0
 * - Real haptic signal always exceeds ±2 within a few samples of onset
 * - A threshold of 2 cleanly separates dither from signal in all known files
 */
const SIGNIFICANCE_THRESHOLD = 2;

export function computeStats(
  samples: Int8Array,
  sampleRate: number = 24000,
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
      dcOffset: 0,
      symmetryRatio: 0,
      rangeUtilization: 0,
      attackTimeMs: 0,
      deadTailPercent: 0,
      halfPeriodCV: 0,
    };
  }

  // ── Pass 1: basic stats (whole-file, unchanged) ──────────────────────
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

  // Significant-only accumulators (|sample| > SIGNIFICANCE_THRESHOLD)
  let sigSum = 0;
  let sigSumSquares = 0;
  let sigPosSum = 0;
  let sigNegSum = 0;
  let sigCount = 0;
  let firstSigIndex = -1;

  // Zero crossings that occur between significant samples only.
  // We track these by recording crossings where at least one side
  // has a significant amplitude, filtering out dither-noise crossings.
  const sigZeroCrossingIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    const v = samples[i];
    const abs = Math.abs(v);

    sumSquares += v * v;
    sumAbs += abs;
    if (abs > peak) peak = abs;
    if (v < minSigned) minSigned = v;
    if (v > maxSigned) maxSigned = v;
    if (v === -128 || v === 127) clipping++;
    if (v !== 0) {
      nonZeroSampleCount++;
      if (firstNonZeroIndex === -1) firstNonZeroIndex = i;
      lastNonZeroIndex = i;
    }

    // Significant sample tracking
    if (abs > SIGNIFICANCE_THRESHOLD) {
      sigSum += v;
      sigSumSquares += v * v;
      if (v > 0) sigPosSum += v;
      else sigNegSum += v;
      sigCount++;
      if (firstSigIndex === -1) firstSigIndex = i;
    }

    // Zero crossing detection — only count crossings where at least
    // one of the two samples flanking the crossing is significant.
    // This filters out the constant dither crossings (e.g. -1,0,-1,0)
    // while preserving real oscillation crossings.
    if (i > 0) {
      const prev = samples[i - 1];
      if ((prev >= 0 && v < 0) || (prev < 0 && v >= 0)) {
        zeroCrossings++;
        if (
          Math.abs(prev) > SIGNIFICANCE_THRESHOLD ||
          abs > SIGNIFICANCE_THRESHOLD
        ) {
          sigZeroCrossingIndices.push(i);
        }
      }
    }
  }

  const rms = Math.sqrt(sumSquares / n);
  const duration = n / sampleRate;
  const dominantFrequency = duration > 0 ? zeroCrossings / (2 * duration) : 0;

  // ── Crest factor: use significant-sample RMS ─────────────────────────
  // For files with large dither/silence regions, whole-file RMS is
  // diluted and produces an artificially high crest factor. Using only
  // significant samples gives the crest factor of the actual haptic
  // content.
  let crestFactor = 0;
  if (sigCount > 0) {
    const sigRms = Math.sqrt(sigSumSquares / sigCount);
    crestFactor = sigRms > 0 ? peak / sigRms : 0;
  } else if (rms > 0) {
    // Fallback: no significant samples, use whole-file
    crestFactor = peak / rms;
  }

  // ── DC offset: significant samples only ──────────────────────────────
  // Dither patterns (e.g. -1,0,-1,0) have their own DC bias that
  // doesn't reflect the actual signal's centering.
  const dcOffset = sigCount > 0 ? sigSum / sigCount : 0;

  // ── Symmetry ratio: significant samples only ─────────────────────────
  let symmetryRatio: number;
  if (sigPosSum === 0 && sigNegSum === 0) {
    symmetryRatio = 1;
  } else if (sigNegSum === 0) {
    symmetryRatio = 999;
  } else if (sigPosSum === 0) {
    symmetryRatio = 0;
  } else {
    symmetryRatio = Math.abs(sigPosSum) / Math.abs(sigNegSum);
  }

  // ── Range utilization ────────────────────────────────────────────────
  const rangeUtilization = (peak / 127) * 100;

  // ── Attack time: from first significant sample to 90% of peak ───────
  // Using firstSigIndex instead of firstNonZeroIndex skips over any
  // leading dither preamble (e.g. the ~393ms dither in haptic_rtp.bin).
  let attackTimeMs = 0;
  if (firstSigIndex >= 0 && peak > 0) {
    const threshold90 = 0.9 * peak;
    for (let i = firstSigIndex; i < n; i++) {
      if (Math.abs(samples[i]) >= threshold90) {
        attackTimeMs = ((i - firstSigIndex) / sampleRate) * 1000;
        break;
      }
    }
  }

  // ── Dead tail percentage ─────────────────────────────────────────────
  let deadTailCount = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(samples[i]) <= 3) {
      deadTailCount++;
    } else {
      break;
    }
  }
  const deadTailPercent = (deadTailCount / n) * 100;

  // ── Half-period CV: significant crossings only, gaps filtered ────────
  // Using only zero crossings where at least one flanking sample is
  // significant filters out the thousands of dither-noise crossings
  // (half-periods of 1-2 samples) that would dominate the CV.
  //
  // Additionally, for multi-pulse files (like haptic_rtp.bin with 360
  // pulses separated by long dither gaps), the distance between the last
  // crossing of one pulse and the first crossing of the next pulse
  // creates huge outlier half-periods (e.g. 42,000 samples). These
  // inter-pulse gaps are not oscillation half-periods and must be
  // excluded.
  //
  // Strategy: compute all half-periods, find the median, then keep only
  // those within 4× the median. The median is robust to the gap outliers
  // because real oscillation half-periods vastly outnumber gaps. The 4×
  // factor is generous enough to keep legitimate half-period variation
  // while excluding inter-pulse gaps that are 100-1000× the median.
  let halfPeriodCV = 0;
  if (sigZeroCrossingIndices.length >= 2) {
    const allHalfPeriods: number[] = [];
    for (let i = 1; i < sigZeroCrossingIndices.length; i++) {
      allHalfPeriods.push(
        sigZeroCrossingIndices[i] - sigZeroCrossingIndices[i - 1],
      );
    }
    if (allHalfPeriods.length >= 2) {
      // Find median half-period (robust to outlier gaps)
      const sorted = [...allHalfPeriods].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;

      // Keep only half-periods within 4× the median — this filters out
      // inter-pulse gaps while preserving real oscillation variation
      const maxPlausible = median * 4;
      const halfPeriods = allHalfPeriods.filter((hp) => hp <= maxPlausible);

      if (halfPeriods.length >= 2) {
        const hpMean =
          halfPeriods.reduce((a, b) => a + b, 0) / halfPeriods.length;
        if (hpMean > 0) {
          const hpVariance =
            halfPeriods.reduce(
              (acc, v) => acc + (v - hpMean) * (v - hpMean),
              0,
            ) / halfPeriods.length;
          const hpStddev = Math.sqrt(hpVariance);
          halfPeriodCV = (hpStddev / hpMean) * 100;
        }
      }
    }
  }

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
    dcOffset,
    symmetryRatio,
    rangeUtilization,
    attackTimeMs,
    deadTailPercent,
    halfPeriodCV,
  };
}

export function computeDelta(
  original: Int8Array,
  remastered: Int8Array,
): Float64Array {
  const len = Math.max(original.length, remastered.length);
  const delta = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    delta[i] = (remastered[i] ?? 0) - (original[i] ?? 0);
  }
  return delta;
}
