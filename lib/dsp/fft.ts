/**
 * Pure-math FFT/DFT library for frequency analysis of haptic waveforms.
 *
 * Designed for signed 8-bit samples (-128..127) stored as Int8Array,
 * with typical sample rates of 8000 Hz and lengths of 100–8000 samples.
 *
 * No external dependencies — all computations use Float64Array internally.
 */

// ---------------------------------------------------------------------------
// Complex number type
// ---------------------------------------------------------------------------

/** A complex number with real and imaginary parts. */
export interface Complex {
  re: number;
  im: number;
}

// ---------------------------------------------------------------------------
// Window functions
// ---------------------------------------------------------------------------

/** Union of all supported window function names. */
export type WindowType =
  | "rectangular"
  | "hann"
  | "hamming"
  | "blackman"
  | "blackman-harris";

/**
 * Rectangular window (no windowing) — all coefficients are 1.
 * @param n - Number of samples in the window.
 */
export function rectangularWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 1.0;
  }
  return w;
}

/**
 * Hann window: `0.5 * (1 - cos(2π * i / (n - 1)))`.
 * @param n - Number of samples in the window.
 */
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1.0;
    return w;
  }
  const denom = n - 1;
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / denom));
  }
  return w;
}

/**
 * Hamming window: `0.54 - 0.46 * cos(2π * i / (n - 1))`.
 * @param n - Number of samples in the window.
 */
export function hammingWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1.0;
    return w;
  }
  const denom = n - 1;
  for (let i = 0; i < n; i++) {
    w[i] = 0.54 - 0.46 * Math.cos((2.0 * Math.PI * i) / denom);
  }
  return w;
}

/**
 * Blackman window: `0.42 - 0.5 * cos(2πi/(n-1)) + 0.08 * cos(4πi/(n-1))`.
 * @param n - Number of samples in the window.
 */
export function blackmanWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1.0;
    return w;
  }
  const denom = n - 1;
  for (let i = 0; i < n; i++) {
    w[i] =
      0.42 -
      0.5 * Math.cos((2.0 * Math.PI * i) / denom) +
      0.08 * Math.cos((4.0 * Math.PI * i) / denom);
  }
  return w;
}

/**
 * 4-term Blackman-Harris window.
 *
 * Coefficients: a0=0.35875, a1=0.48829, a2=0.14128, a3=0.01168
 * @param n - Number of samples in the window.
 */
export function blackmanHarrisWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1.0;
    return w;
  }
  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;
  const denom = n - 1;
  for (let i = 0; i < n; i++) {
    w[i] =
      a0 -
      a1 * Math.cos((2.0 * Math.PI * i) / denom) +
      a2 * Math.cos((4.0 * Math.PI * i) / denom) -
      a3 * Math.cos((6.0 * Math.PI * i) / denom);
  }
  return w;
}

/**
 * Returns the window coefficients for the given window type.
 * @param type - The window function to use.
 * @param n - Number of samples in the window.
 */
export function getWindow(type: WindowType, n: number): Float64Array {
  switch (type) {
    case "rectangular":
      return rectangularWindow(n);
    case "hann":
      return hannWindow(n);
    case "hamming":
      return hammingWindow(n);
    case "blackman":
      return blackmanWindow(n);
    case "blackman-harris":
      return blackmanHarrisWindow(n);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown window type: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// FFT utilities
// ---------------------------------------------------------------------------

/**
 * Returns the smallest power of 2 that is >= n.
 * @param n - The minimum size.
 */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) {
    p <<= 1;
  }
  return p;
}

/**
 * Zero-pads the input array to the specified target length.
 * If the input is already at least `targetLength`, returns a copy.
 * @param input - The source signal.
 * @param targetLength - Desired length after padding.
 */
export function zeroPad(
  input: Float64Array,
  targetLength: number
): Float64Array {
  if (targetLength <= input.length) {
    return new Float64Array(input);
  }
  const out = new Float64Array(targetLength);
  out.set(input);
  return out;
}

// ---------------------------------------------------------------------------
// DFT — naive O(n²) for arbitrary-length inputs
// ---------------------------------------------------------------------------

/**
 * Naive O(n²) Discrete Fourier Transform for arbitrary-length real inputs.
 *
 * Useful as a fallback when the signal length is not a power of 2
 * and zero-padding is undesirable.
 *
 * @param input - Real-valued signal samples.
 * @returns Array of N complex frequency-domain values.
 */
export function dft(input: Float64Array): Complex[] {
  const N = input.length;
  const result: Complex[] = new Array(N);
  for (let k = 0; k < N; k++) {
    let re = 0.0;
    let im = 0.0;
    for (let n = 0; n < N; n++) {
      const angle = (2.0 * Math.PI * k * n) / N;
      re += input[n] * Math.cos(angle);
      im -= input[n] * Math.sin(angle);
    }
    result[k] = { re, im };
  }
  return result;
}

// ---------------------------------------------------------------------------
// FFT — iterative radix-2 Cooley-Tukey
// ---------------------------------------------------------------------------

/**
 * Computes the bit-reversal permutation index for a given value.
 * @param x - The index to reverse.
 * @param log2n - Number of bits (log2 of N).
 */
function bitReverse(x: number, log2n: number): number {
  let result = 0;
  for (let i = 0; i < log2n; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * Iterative radix-2 Cooley-Tukey FFT.
 *
 * The input **must** have a length that is a power of 2. If your signal
 * length is not a power of 2, use `zeroPad(input, nextPowerOf2(input.length))`
 * before calling this function.
 *
 * @param input - Real-valued signal samples (length must be a power of 2).
 * @returns Array of N complex frequency-domain values.
 * @throws If the input length is not a power of 2.
 */
export function fft(input: Float64Array): Complex[] {
  const N = input.length;

  if (N === 0) return [];
  if (N === 1) return [{ re: input[0], im: 0.0 }];

  // Verify power of 2
  if ((N & (N - 1)) !== 0) {
    throw new Error(
      `FFT input length must be a power of 2, got ${N}. ` +
        `Use zeroPad(input, nextPowerOf2(input.length)) first.`
    );
  }

  const log2n = Math.round(Math.log2(N));

  // Separate real/imag arrays for better cache behavior
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  // Bit-reversal permutation
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, log2n);
    re[j] = input[i];
    // im[j] = 0 already (Float64Array is zero-initialized)
  }

  // Iterative Cooley-Tukey butterfly stages
  for (let s = 1; s <= log2n; s++) {
    const m = 1 << s; // sub-DFT size
    const halfM = m >> 1;
    const wRe = Math.cos((2.0 * Math.PI) / m);
    const wIm = -Math.sin((2.0 * Math.PI) / m);

    for (let k = 0; k < N; k += m) {
      // Twiddle factor starts at 1 + 0i
      let twRe = 1.0;
      let twIm = 0.0;

      for (let j = 0; j < halfM; j++) {
        const evenIdx = k + j;
        const oddIdx = k + j + halfM;

        // Butterfly: multiply odd element by twiddle factor
        const tRe = twRe * re[oddIdx] - twIm * im[oddIdx];
        const tIm = twRe * im[oddIdx] + twIm * re[oddIdx];

        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] = re[evenIdx] + tRe;
        im[evenIdx] = im[evenIdx] + tIm;

        // Advance twiddle factor
        const nextTwRe = twRe * wRe - twIm * wIm;
        const nextTwIm = twRe * wIm + twIm * wRe;
        twRe = nextTwRe;
        twIm = nextTwIm;
      }
    }
  }

  // Pack into Complex[]
  const result: Complex[] = new Array(N);
  for (let i = 0; i < N; i++) {
    result[i] = { re: re[i], im: im[i] };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Spectrum computation
// ---------------------------------------------------------------------------

/** Full spectrum analysis result for a real-valued signal. */
export interface SpectrumResult {
  /** Frequency bins in Hz (length = N/2 + 1 for real input). */
  frequencies: Float64Array;
  /** Magnitude spectrum (linear scale). */
  magnitudes: Float64Array;
  /** Magnitude spectrum in dB (20 * log10(mag / maxMag)), floored at -120 dB. */
  magnitudesDb: Float64Array;
  /** Phase spectrum in radians. */
  phases: Float64Array;
  /** Power spectrum (magnitude²). */
  power: Float64Array;
  /** Number of FFT points used (after zero-padding). */
  fftSize: number;
  /** Frequency resolution in Hz per bin (sampleRate / fftSize). */
  frequencyResolution: number;
}

/**
 * Computes the single-sided frequency spectrum of a real-valued signal.
 *
 * Steps:
 * 1. Convert Int8Array to Float64Array if needed.
 * 2. Apply the chosen window function (default: Hann).
 * 3. Zero-pad to the next power of 2.
 * 4. Run the FFT.
 * 5. Extract magnitudes, phases, and power for the first N/2 + 1 bins.
 * 6. Compute frequency axis and dB scale.
 *
 * @param samples - Input signal (Int8Array or Float64Array).
 * @param sampleRate - Sample rate in Hz (typically 8000 for haptic waveforms).
 * @param windowType - Window function to apply (default: "hann").
 * @returns The full spectrum result.
 */
export function computeSpectrum(
  samples: Int8Array | Float64Array,
  sampleRate: number,
  windowType: WindowType = "hann"
): SpectrumResult {
  // Step 1: Convert to Float64Array
  let signal: Float64Array;
  if (samples instanceof Int8Array) {
    signal = new Float64Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      signal[i] = samples[i];
    }
  } else {
    signal = new Float64Array(samples);
  }

  const n = signal.length;
  if (n === 0) {
    return {
      frequencies: new Float64Array(1),
      magnitudes: new Float64Array(1),
      magnitudesDb: new Float64Array([-120]),
      phases: new Float64Array(1),
      power: new Float64Array(1),
      fftSize: 0,
      frequencyResolution: 0,
    };
  }

  // Step 2: Apply window
  const window = getWindow(windowType, n);
  const windowed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    windowed[i] = signal[i] * window[i];
  }

  // Step 3: Zero-pad to next power of 2
  const fftSize = nextPowerOf2(n);
  const padded = zeroPad(windowed, fftSize);

  // Step 4: Run FFT
  const spectrum = fft(padded);

  // Step 5: Single-sided spectrum (first N/2 + 1 bins)
  const numBins = (fftSize >> 1) + 1;
  const magnitudes = new Float64Array(numBins);
  const phases = new Float64Array(numBins);
  const power = new Float64Array(numBins);

  for (let i = 0; i < numBins; i++) {
    const re = spectrum[i].re;
    const im = spectrum[i].im;
    const mag = Math.sqrt(re * re + im * im);
    magnitudes[i] = mag;
    phases[i] = Math.atan2(im, re);
    power[i] = re * re + im * im;
  }

  // Step 6: Frequency axis
  const frequencyResolution = sampleRate / fftSize;
  const frequencies = new Float64Array(numBins);
  for (let i = 0; i < numBins; i++) {
    frequencies[i] = i * frequencyResolution;
  }

  // Step 7: dB scale — 20 * log10(mag / maxMag), floored at -120 dB
  let maxMag = 0.0;
  for (let i = 0; i < numBins; i++) {
    if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
  }

  const magnitudesDb = new Float64Array(numBins);
  if (maxMag > 0) {
    for (let i = 0; i < numBins; i++) {
      if (magnitudes[i] <= 0) {
        magnitudesDb[i] = -120.0;
      } else {
        const db = 20.0 * Math.log10(magnitudes[i] / maxMag);
        magnitudesDb[i] = db < -120.0 ? -120.0 : db;
      }
    }
  } else {
    for (let i = 0; i < numBins; i++) {
      magnitudesDb[i] = -120.0;
    }
  }

  return {
    frequencies,
    magnitudes,
    magnitudesDb,
    phases,
    power,
    fftSize,
    frequencyResolution,
  };
}

// ---------------------------------------------------------------------------
// Peak detection
// ---------------------------------------------------------------------------

/** A detected spectral peak with harmonic analysis. */
export interface SpectralPeak {
  /** Frequency of the peak in Hz. */
  frequency: number;
  /** Magnitude (linear scale). */
  magnitude: number;
  /** Magnitude in dB (relative to maximum). */
  magnitudeDb: number;
  /** FFT bin index. */
  binIndex: number;
  /** Whether this peak might be a harmonic of a lower peak. */
  isHarmonic: boolean;
  /** If isHarmonic, the fundamental frequency it's a harmonic of (Hz). */
  fundamentalHz: number | null;
  /** Harmonic number (2 = 2nd harmonic, 3 = 3rd, etc.). */
  harmonicNumber: number | null;
}

/** Options for spectral peak detection. */
export interface PeakDetectionOptions {
  /** Maximum number of peaks to return (default: 8). */
  maxPeaks?: number;
  /** Minimum dB level for a peak (default: -40 dB). */
  minDb?: number;
  /**
   * Minimum prominence in dB — the peak must exceed the mean of its
   * local neighborhood by at least this amount (default: undefined = no filter).
   */
  minProminence?: number;
}

/**
 * Finds spectral peaks in a computed spectrum.
 *
 * Detects local maxima, filters by dB threshold and optional prominence,
 * sorts by magnitude descending, limits to `maxPeaks`, and performs
 * harmonic analysis.
 *
 * @param spectrum - A precomputed SpectrumResult.
 * @param options - Detection parameters.
 * @returns Array of spectral peaks sorted by magnitude (strongest first).
 */
export function findSpectralPeaks(
  spectrum: SpectrumResult,
  options?: PeakDetectionOptions
): SpectralPeak[] {
  const maxPeaks = options?.maxPeaks ?? 8;
  const minDb = options?.minDb ?? -40.0;
  const minProminence = options?.minProminence;

  const { magnitudes, magnitudesDb, frequencies } = spectrum;
  const numBins = magnitudes.length;

  if (numBins < 3) return [];

  // Step 1: Find local maxima (bin is higher than both neighbors)
  const candidates: Array<{
    binIndex: number;
    magnitude: number;
    magnitudeDb: number;
    frequency: number;
  }> = [];

  for (let i = 1; i < numBins - 1; i++) {
    if (
      magnitudes[i] > magnitudes[i - 1] &&
      magnitudes[i] > magnitudes[i + 1]
    ) {
      candidates.push({
        binIndex: i,
        magnitude: magnitudes[i],
        magnitudeDb: magnitudesDb[i],
        frequency: frequencies[i],
      });
    }
  }

  // Step 2: Filter by minimum dB
  let filtered = candidates.filter((c) => c.magnitudeDb >= minDb);

  // Step 3: Filter by prominence if requested
  if (minProminence !== undefined) {
    const prominenceRadius = 5; // bins on each side for neighborhood average
    filtered = filtered.filter((peak) => {
      let sum = 0.0;
      let count = 0;
      for (
        let j = Math.max(0, peak.binIndex - prominenceRadius);
        j <= Math.min(numBins - 1, peak.binIndex + prominenceRadius);
        j++
      ) {
        if (j !== peak.binIndex) {
          sum += magnitudesDb[j];
          count++;
        }
      }
      if (count === 0) return true;
      const neighborMeanDb = sum / count;
      return peak.magnitudeDb - neighborMeanDb >= minProminence;
    });
  }

  // Step 4: Sort by magnitude descending
  filtered.sort((a, b) => b.magnitude - a.magnitude);

  // Step 5: Take top maxPeaks
  const top = filtered.slice(0, maxPeaks);

  // Step 6: Harmonic analysis
  const harmonicTolerance = 0.05; // 5%

  const peaks: SpectralPeak[] = top.map((p) => ({
    frequency: p.frequency,
    magnitude: p.magnitude,
    magnitudeDb: p.magnitudeDb,
    binIndex: p.binIndex,
    isHarmonic: false,
    fundamentalHz: null,
    harmonicNumber: null,
  }));

  // For each peak, check if it's a harmonic of a stronger (lower-index) peak
  for (let i = 1; i < peaks.length; i++) {
    for (let j = 0; j < i; j++) {
      // The peak at j is stronger than i (sorted by magnitude)
      const fundamental = peaks[j].frequency;
      if (fundamental <= 0) continue;

      const ratio = peaks[i].frequency / fundamental;
      const nearestHarmonic = Math.round(ratio);

      if (nearestHarmonic >= 2 && nearestHarmonic <= 16) {
        const expected = nearestHarmonic * fundamental;
        const deviation = Math.abs(peaks[i].frequency - expected) / expected;
        if (deviation <= harmonicTolerance) {
          peaks[i].isHarmonic = true;
          peaks[i].fundamentalHz = fundamental;
          peaks[i].harmonicNumber = nearestHarmonic;
          break; // assign to the first (strongest) matching fundamental
        }
      }
    }
  }

  return peaks;
}

// ---------------------------------------------------------------------------
// Spectral statistics
// ---------------------------------------------------------------------------

/** Summary statistics describing the spectral shape of a signal. */
export interface SpectralStats {
  /** Spectral centroid (weighted average frequency) in Hz. */
  centroid: number;
  /** Spectral spread (standard deviation of frequency distribution) in Hz. */
  spread: number;
  /** Spectral rolloff frequency (frequency below which 85% of energy lies) in Hz. */
  rolloff: number;
  /** Spectral flatness (geometric mean / arithmetic mean of power, 0..1; 1 = white noise). */
  flatness: number;
  /** Dominant frequency (frequency of the highest magnitude bin) in Hz. */
  dominantFrequency: number;
  /** Total spectral energy (sum of power spectrum). */
  totalEnergy: number;
}

/**
 * Computes summary statistics that describe the spectral shape of a signal.
 *
 * @param spectrum - A precomputed SpectrumResult.
 * @returns Spectral statistics including centroid, spread, rolloff, flatness, etc.
 */
export function computeSpectralStats(spectrum: SpectrumResult): SpectralStats {
  const { frequencies, magnitudes, power } = spectrum;
  const numBins = frequencies.length;

  if (numBins === 0) {
    return {
      centroid: 0,
      spread: 0,
      rolloff: 0,
      flatness: 0,
      dominantFrequency: 0,
      totalEnergy: 0,
    };
  }

  // Total energy
  let totalEnergy = 0.0;
  for (let i = 0; i < numBins; i++) {
    totalEnergy += power[i];
  }

  // Dominant frequency
  let maxMag = 0.0;
  let dominantBin = 0;
  for (let i = 0; i < numBins; i++) {
    if (magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      dominantBin = i;
    }
  }
  const dominantFrequency = frequencies[dominantBin];

  // Spectral centroid: weighted average frequency
  let centroid = 0.0;
  if (totalEnergy > 0) {
    let weightedSum = 0.0;
    for (let i = 0; i < numBins; i++) {
      weightedSum += frequencies[i] * power[i];
    }
    centroid = weightedSum / totalEnergy;
  }

  // Spectral spread: standard deviation around centroid
  let spread = 0.0;
  if (totalEnergy > 0) {
    let varianceSum = 0.0;
    for (let i = 0; i < numBins; i++) {
      const diff = frequencies[i] - centroid;
      varianceSum += diff * diff * power[i];
    }
    spread = Math.sqrt(varianceSum / totalEnergy);
  }

  // Spectral rolloff: frequency below which 85% of energy lies
  let rolloff = 0.0;
  if (totalEnergy > 0) {
    const threshold = 0.85 * totalEnergy;
    let cumulative = 0.0;
    for (let i = 0; i < numBins; i++) {
      cumulative += power[i];
      if (cumulative >= threshold) {
        rolloff = frequencies[i];
        break;
      }
    }
  }

  // Spectral flatness: geometric mean / arithmetic mean of power
  let flatness = 0.0;
  if (totalEnergy > 0 && numBins > 0) {
    const arithmeticMean = totalEnergy / numBins;

    // Compute geometric mean via log to avoid overflow/underflow
    let logSum = 0.0;
    let nonZeroCount = 0;
    for (let i = 0; i < numBins; i++) {
      if (power[i] > 0) {
        logSum += Math.log(power[i]);
        nonZeroCount++;
      }
    }

    if (nonZeroCount === numBins && arithmeticMean > 0) {
      const geometricMean = Math.exp(logSum / numBins);
      flatness = geometricMean / arithmeticMean;
      // Clamp to [0, 1] for numerical safety
      if (flatness > 1.0) flatness = 1.0;
      if (flatness < 0.0) flatness = 0.0;
    } else {
      // If any bin has zero power, geometric mean is 0 → flatness = 0
      flatness = 0.0;
    }
  }

  return {
    centroid,
    spread,
    rolloff,
    flatness,
    dominantFrequency,
    totalEnergy,
  };
}

// ---------------------------------------------------------------------------
// Region spectrum helper
// ---------------------------------------------------------------------------

/**
 * Computes the frequency spectrum for a sub-region of an Int8Array waveform.
 *
 * Extracts `samples[start..end]` (exclusive end) and runs `computeSpectrum`
 * on the slice.
 *
 * @param samples - Full waveform data as Int8Array.
 * @param start - Start index (inclusive).
 * @param end - End index (exclusive).
 * @param sampleRate - Sample rate in Hz.
 * @param windowType - Window function to apply (default: "hann").
 * @returns Spectrum result for the specified region.
 */
export function computeRegionSpectrum(
  samples: Int8Array,
  start: number,
  end: number,
  sampleRate: number,
  windowType: WindowType = "hann"
): SpectrumResult {
  const clampedStart = Math.max(0, Math.min(start, samples.length));
  const clampedEnd = Math.max(clampedStart, Math.min(end, samples.length));
  const region = samples.slice(clampedStart, clampedEnd);
  return computeSpectrum(region, sampleRate, windowType);
}
