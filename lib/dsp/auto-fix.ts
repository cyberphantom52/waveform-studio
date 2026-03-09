/**
 * Auto-fix engine for haptic waveform quality.
 *
 * Analyzes WaveformStats, grades each metric using the same thresholds as
 * stats-panel.tsx, and produces a TransformStep[] chain that corrects every
 * metric graded "warn" or "bad".
 *
 * The key insight from comparing premium haptics (haptic_rtp.bin) with cheap
 * effects (effect_111.bin etc.) is that premium pulses have a RECTANGULAR
 * envelope — instant attack, sustained amplitude, instant cutoff — while
 * cheap effects have a BELL-SHAPED envelope — slow ramp, brief peak, long
 * exponential decay. The most impactful fix is envelope reshaping, not just
 * amplitude scaling.
 *
 * The returned chain is ordered so that each transform receives clean input
 * from the previous one:
 *
 *   1. DC Offset Remove  — center the waveform first
 *   2. Envelope Reshape   — boost weak onset, sustain mid, cut tail sharply
 *   3. Normalize          — scale peak to target ±91
 *   4. Clamp              — soft-knee safety net for any remaining overs
 *   5. Smoothing          — tame frequency instability (halfPeriodCV)
 *   6. Tail Trim          — remove dead trailing samples
 */

import type { WaveformStats } from "./stats";
import type {
  TransformStep,
  TransformParams,
  EnvelopePoint,
} from "./transforms";

// ── Grading (mirrors stats-panel.tsx exactly) ──────────────────────────

type GradeLevel = "good" | "warn" | "bad";

function gradePeak(value: number): GradeLevel {
  if (value >= 80 && value <= 95) return "good";
  if (value >= 65 && value <= 110) return "warn";
  return "bad";
}

function gradeCrest(value: number): GradeLevel {
  if (value >= 1.0 && value <= 1.5) return "good";
  if (value >= 0.5 && value <= 2.0) return "warn";
  return "bad";
}

function gradeClipping(count: number): GradeLevel {
  if (count === 0) return "good";
  if (count <= 5) return "warn";
  return "bad";
}

function gradeDcOffset(value: number): GradeLevel {
  const abs = Math.abs(value);
  if (abs <= 12) return "good";
  if (abs <= 20) return "warn";
  return "bad";
}

function gradeSymmetry(value: number): GradeLevel {
  if (value >= 0.7 && value <= 1.35) return "good";
  if (value >= 0.5 && value <= 1.8) return "warn";
  return "bad";
}

function gradeHalfPeriodCV(value: number): GradeLevel {
  if (value <= 35) return "good";
  if (value <= 55) return "warn";
  return "bad";
}

function gradeDeadTail(value: number): GradeLevel {
  if (value <= 5) return "good";
  if (value <= 15) return "warn";
  return "bad";
}

function gradeAttackTime(value: number): GradeLevel {
  if (value >= 0.1 && value <= 1.5) return "good";
  if (value <= 4) return "warn";
  return "bad";
}

function gradeRange(value: number): GradeLevel {
  if (value >= 60 && value <= 80) return "good";
  if (value >= 45 && value <= 95) return "warn";
  return "bad";
}

// ── Diagnosis ──────────────────────────────────────────────────────────

export interface AutoFixDiagnosis {
  metric: string;
  label: string;
  grade: GradeLevel;
  currentValue: string;
  /** Which transform type will be applied to address this */
  fix: string | null;
}

export interface AutoFixResult {
  /** Every metric with its grade and proposed fix label */
  diagnoses: AutoFixDiagnosis[];
  /** The transform chain that corrects all warn/bad metrics */
  chain: TransformStep[];
  /** Number of metrics that need fixing */
  issueCount: number;
}

function isBad(g: GradeLevel): boolean {
  return g === "warn" || g === "bad";
}

// ── Envelope reshape logic ─────────────────────────────────────────────

/**
 * Compute envelope control points that reshape a bell-curved waveform into
 * a more rectangular pulse — matching the premium haptic profile.
 *
 * Premium haptics (haptic_rtp.bin) have:
 *   - Attack: 0.33ms (instant snap to peak)
 *   - Crest factor: 1.14 (sustained, not peaky)
 *   - Envelope: flat/rectangular — instant on, sustain, instant off
 *
 * Cheap effects (effect_111.bin) have:
 *   - Attack: 3.96ms (slow gradual ramp)
 *   - Crest factor: 1.66 (bell-shaped, peaky)
 *   - Envelope: bell — slow rise, brief peak, long exponential decay
 *
 * The fix: boost the weak early samples (compensate for slow attack),
 * sustain through the middle, and cut the tail sharply (kill the long decay).
 *
 * The boost factor and cutoff positions are derived from the actual stats
 * so this adapts to any waveform shape, not just effect_111.
 */
function computeReshapeEnvelope(stats: WaveformStats): EnvelopePoint[] {
  const durationMs = stats.duration * 1000;
  if (durationMs <= 0) {
    return [
      { position: 0, amplitude: 1, curve: "linear" },
      { position: 1, amplitude: 1, curve: "linear" },
    ];
  }

  // ── Attack region ──────────────────────────────────────────────────
  // How much of the waveform is spent ramping up to peak?
  // Premium reference: ~1.8% of duration (0.33ms / 18ms)
  // effect_111: ~21.5% of duration (3.96ms / 18.4ms)
  const attackFraction = Math.min(0.4, stats.attackTimeMs / durationMs);

  // ── Boost factor ───────────────────────────────────────────────────
  // Scale the onset boost with how peaky the waveform is.
  // Crest factor 1.5 → boost 1.6x, 2.0 → boost 2.2x, 2.5+ → boost 2.8x
  // The idea: a higher crest factor means the early samples are weaker
  // relative to the peak, so they need more boost.
  const boostFactor = Math.min(3.0, 1.0 + (stats.crestFactor - 1.0) * 1.2);

  // ── Tail region ────────────────────────────────────────────────────
  // Where does the useful signal end? Use dead tail percentage as a guide.
  // Also factor in the crest factor — a peaky waveform has energy
  // concentrated in a narrow region, so the tail starts earlier.
  const tailFraction = stats.deadTailPercent / 100;
  // Start cutting at 80% of the active region (before dead tail)
  const activeEnd = Math.max(0.5, 1.0 - tailFraction);
  const sustainEnd = Math.max(0.4, activeEnd - 0.15);
  const cutStart = activeEnd - 0.05;

  // ── Build envelope points ──────────────────────────────────────────
  //
  // Shape: boost → ramp down to 1.0 → sustain at 1.0 → sharp cut → zero
  //
  //  amp
  //   ^
  //   |  boost
  //   |  /\
  //   | /  \___________
  //   |/    sustain    \
  //   |                 \__ 0
  //   +--------------------> position
  //   0  attack  sustain  cut  1.0

  const points: EnvelopePoint[] = [];

  // Start: boost the onset to compensate for slow attack
  points.push({
    position: 0,
    amplitude: boostFactor,
    curve: "linear",
  });

  // Midpoint of attack region: still boosted but tapering
  if (attackFraction > 0.05) {
    points.push({
      position: attackFraction * 0.5,
      amplitude: boostFactor * 0.85,
      curve: "linear",
    });
  }

  // End of attack region: transition to natural level
  points.push({
    position: Math.min(attackFraction, sustainEnd - 0.05),
    amplitude: 1.0,
    curve: "linear",
  });

  // Sustain region: hold at natural amplitude
  points.push({
    position: sustainEnd,
    amplitude: 1.0,
    curve: "linear",
  });

  // Sharp cutoff: exponential drop to kill the long decay tail
  points.push({
    position: cutStart,
    amplitude: 0.3,
    curve: "exponential",
  });

  // End: clean zero
  points.push({
    position: 1.0,
    amplitude: 0.0,
    curve: "exponential",
  });

  return points;
}

/**
 * Whether this waveform needs envelope reshaping.
 *
 * The envelope reshape targets the core perceptual problem: a bell-shaped
 * waveform (slow attack + high crest factor) that feels mushy instead of
 * crisp. Both conditions should be present — a high crest factor alone
 * might be a deliberate sharp transient, and a slow attack alone might be
 * an intentional swell effect.
 */
function needsEnvelopeReshape(
  stats: WaveformStats,
  crestG: GradeLevel,
  attackG: GradeLevel,
): boolean {
  // Both crest factor AND attack must be problematic
  if (!isBad(crestG) && !isBad(attackG)) return false;

  // At least one must be bad/warn and the other at least warn
  // This catches: crest=warn+attack=warn, crest=bad+attack=warn, etc.
  const crestProblem = isBad(crestG);
  const attackProblem = isBad(attackG);

  if (!crestProblem && !attackProblem) return false;

  // Additional sanity: only reshape if the attack is actually slow
  // (not instantaneous — an instant attack with high crest is a different
  // problem, e.g. a single spike, which smoothing handles better)
  if (stats.attackTimeMs < 0.5) return false;

  return true;
}

// ── Main auto-fix function ─────────────────────────────────────────────

/**
 * Analyze stats and build a corrective transform chain.
 *
 * The function is pure — no side effects. The caller is responsible
 * for dispatching the chain into the reducer.
 */
export function computeAutoFix(stats: WaveformStats): AutoFixResult {
  // Grade every metric
  const peakG = gradePeak(stats.peak);
  const crestG = gradeCrest(stats.crestFactor);
  const clipG = gradeClipping(stats.clippingCount);
  const dcG = gradeDcOffset(stats.dcOffset);
  const symG = gradeSymmetry(stats.symmetryRatio);
  const hpG = gradeHalfPeriodCV(stats.halfPeriodCV);
  const tailG = gradeDeadTail(stats.deadTailPercent);
  const attackG = gradeAttackTime(stats.attackTimeMs);
  const rangeG = gradeRange(stats.rangeUtilization);

  const chain: TransformStep[] = [];

  // ── 1. DC Offset Remove ──────────────────────────────────────────
  // Fixes: dcOffset, symmetry (partially — asymmetry from DC bias)
  // Must come first so envelope multipliers act on centered data.
  const needDc = isBad(dcG) || isBad(symG);

  if (needDc) {
    chain.push({
      type: "dcOffset",
      enabled: true,
      params: { mode: "mean" } as TransformParams["dcOffset"],
    });
  }

  // ── 2. Envelope Reshape ──────────────────────────────────────────
  // Fixes: crestFactor (bell→rectangle), attackTimeMs (boost weak onset),
  //        deadTailPercent (sharp cutoff kills long decay)
  //
  // This is the CORE fix for "doesn't feel premium". Premium haptics
  // have rectangular envelopes (instant on, sustain, instant off).
  // Cheap effects have bell-shaped envelopes (slow ramp, brief peak,
  // long exponential decay). The envelope reshape boosts the early
  // samples to compensate for the slow attack, sustains through the
  // middle, and sharply cuts the tail.
  //
  // Must come BEFORE normalize so normalize scales the reshaped waveform.
  const needReshape = needsEnvelopeReshape(stats, crestG, attackG);

  if (needReshape) {
    const envelopePoints = computeReshapeEnvelope(stats);
    chain.push({
      type: "envelope",
      enabled: true,
      params: { points: envelopePoints } as TransformParams["envelope"],
    });
  }

  // ── 3. Normalize ─────────────────────────────────────────────────
  // Fixes: peak, rangeUtilization, clipping (by scaling to target ±91)
  // Comes after envelope reshape so it scales the corrected shape.
  const needNormalize = isBad(peakG) || isBad(rangeG) || isBad(clipG);

  if (needNormalize) {
    chain.push({
      type: "normalize",
      enabled: true,
      params: {
        mode: "peak",
        targetLevel: 91,
      } as TransformParams["normalize"],
    });
  }

  // ── 4. Clamp (soft-knee safety) ──────────────────────────────────
  // Only if clipping is severe — adds a soft-knee limiter after normalize
  // as a safety net. For mild clipping, normalize alone is enough.
  // Also apply when envelope reshape boosted samples that might clip.
  if (clipG === "bad" || (needReshape && isBad(clipG))) {
    chain.push({
      type: "clamp",
      enabled: true,
      params: { min: -91, max: 91, softKnee: 8 } as TransformParams["clamp"],
    });
  }

  // ── 5. Smoothing ─────────────────────────────────────────────────
  // Fixes: halfPeriodCV (frequency instability / irregular half-cycles)
  //
  // Only used for frequency instability now — crest factor issues are
  // handled by the envelope reshape above, which is a much better fix
  // than averaging out peaks.
  const needSmoothing = isBad(hpG);

  if (needSmoothing) {
    const windowSize = hpG === "bad" ? 5 : 3;
    chain.push({
      type: "smoothing",
      enabled: true,
      params: { windowSize } as TransformParams["smoothing"],
    });
  }

  // ── 6. Tail Trim ─────────────────────────────────────────────────
  // Fixes: deadTailPercent
  // When envelope reshape is active, the tail is already cut by the
  // envelope — but tail trim still cleans up any residual sub-threshold
  // samples that the envelope left behind.
  if (isBad(tailG)) {
    chain.push({
      type: "tailTrim",
      enabled: true,
      params: { threshold: 3 } as TransformParams["tailTrim"],
    });
  }

  // ── Build diagnoses list ─────────────────────────────────────────

  // Determine fix labels based on what transforms were actually added
  const crestFixLabel = needReshape
    ? "Envelope Reshape"
    : isBad(crestG) && needSmoothing
      ? "Smoothing"
      : null;
  const attackFixLabel = needReshape ? "Envelope Reshape" : null;
  const tailFixLabel = isBad(tailG)
    ? needReshape
      ? "Envelope + Tail Trim"
      : "Tail Trim"
    : null;

  const diagnoses: AutoFixDiagnosis[] = [
    {
      metric: "peak",
      label: "Peak Amp",
      grade: peakG,
      currentValue: `±${stats.peak}`,
      fix: needNormalize ? "Normalize → ±91" : null,
    },
    {
      metric: "crestFactor",
      label: "Crest Factor",
      grade: crestG,
      currentValue: stats.crestFactor.toFixed(2),
      fix: isBad(crestG) ? crestFixLabel : null,
    },
    {
      metric: "dcOffset",
      label: "DC Offset",
      grade: dcG,
      currentValue: stats.dcOffset.toFixed(1),
      fix: needDc ? "DC Offset Remove" : null,
    },
    {
      metric: "symmetryRatio",
      label: "Symmetry",
      grade: symG,
      currentValue: stats.symmetryRatio.toFixed(2),
      fix: isBad(symG) && needDc ? "DC Offset Remove" : null,
    },
    {
      metric: "attackTimeMs",
      label: "Attack",
      grade: attackG,
      currentValue: `${stats.attackTimeMs.toFixed(1)}ms`,
      fix: isBad(attackG) ? attackFixLabel : null,
    },
    {
      metric: "rangeUtilization",
      label: "Range Use",
      grade: rangeG,
      currentValue: `${stats.rangeUtilization.toFixed(0)}%`,
      fix: needNormalize ? "Normalize → 72%" : null,
    },
    {
      metric: "halfPeriodCV",
      label: "Freq Stability",
      grade: hpG,
      currentValue: `${stats.halfPeriodCV.toFixed(1)}%`,
      fix: needSmoothing ? "Smoothing" : null,
    },
    {
      metric: "clippingCount",
      label: "Clipping",
      grade: clipG,
      currentValue: stats.clippingCount.toString(),
      fix: isBad(clipG)
        ? clipG === "bad"
          ? "Normalize + Clamp"
          : "Normalize"
        : null,
    },
    {
      metric: "deadTailPercent",
      label: "Dead Tail",
      grade: tailG,
      currentValue: `${stats.deadTailPercent.toFixed(1)}%`,
      fix: tailFixLabel,
    },
  ];

  const issueCount = diagnoses.filter((d) => d.fix !== null).length;

  return { diagnoses, chain, issueCount };
}
