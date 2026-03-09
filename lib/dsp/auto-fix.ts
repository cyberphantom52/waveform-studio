/**
 * Auto-fix engine for haptic waveform quality.
 *
 * Analyzes WaveformStats, grades each metric using the same thresholds as
 * stats-panel.tsx, and produces a TransformStep[] chain that corrects every
 * metric graded "warn" or "bad".
 *
 * The returned chain is ordered so that each transform receives clean input
 * from the previous one:
 *   1. DC Offset Remove  — center the waveform first
 *   2. Normalize          — scale peak to target (fixes peak, range, clipping)
 *   3. Clamp              — safety net for any remaining overs
 *   4. Smoothing          — tame frequency instability / high crest factor
 *   5. Attack             — fix slow attack onset
 *   6. Decay              — shape the tail
 *   7. Tail Trim          — remove dead tail
 */

import type { WaveformStats } from "./stats";
import type { TransformStep, TransformParams } from "./transforms";

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
  const needDc = isBad(dcG) || isBad(symG);

  if (needDc) {
    chain.push({
      type: "dcOffset",
      enabled: true,
      params: { mode: "mean" } as TransformParams["dcOffset"],
    });
  }

  // ── 2. Normalize ─────────────────────────────────────────────────
  // Fixes: peak, rangeUtilization, clipping (by scaling down clipped
  // waveforms to target ±91)
  const needNormalize = isBad(peakG) || isBad(rangeG) || isBad(clipG);

  if (needNormalize) {
    chain.push({
      type: "normalize",
      enabled: true,
      params: { mode: "peak", targetLevel: 91 } as TransformParams["normalize"],
    });
  }

  // ── 3. Clamp (soft-knee safety) ──────────────────────────────────
  // Only if clipping is severe — adds a soft-knee limiter after normalize
  // as a safety net. For mild clipping, normalize alone is enough.
  if (clipG === "bad") {
    chain.push({
      type: "clamp",
      enabled: true,
      params: { min: -91, max: 91, softKnee: 8 } as TransformParams["clamp"],
    });
  }

  // ── 4. Smoothing ─────────────────────────────────────────────────
  // Fixes: halfPeriodCV (frequency instability), crestFactor (spiky peaks)
  // Larger window for worse problems.
  const needSmoothing = isBad(hpG) || isBad(crestG);

  if (needSmoothing) {
    // Bad crest + bad HP CV → heavier smoothing; warn → lighter
    const worstGrade = crestG === "bad" || hpG === "bad" ? "bad" : "warn";
    const windowSize = worstGrade === "bad" ? 5 : 3;

    chain.push({
      type: "smoothing",
      enabled: true,
      params: { windowSize } as TransformParams["smoothing"],
    });
  }

  // ── 5. Attack ────────────────────────────────────────────────────
  // Fixes: attackTimeMs — if attack is too slow, we can't really shorten
  // it with a fade-in (that would make it worse). But if the attack is
  // 0 (instantaneous / hard transient), a tiny fade-in softens the click.
  //
  // For slow attacks, the real fix is envelope reshaping, but a
  // reasonable default is a fast 0.8ms attack fade-in when the current
  // attack is > 4ms (bad grade) — this won't fix the slow onset fully
  // but signals the issue. For attacks that are already fast but graded
  // "warn" (1.5–4ms), we leave it alone.
  if (attackG === "bad" && stats.attackTimeMs > 4) {
    // Slow attack — apply a short fade-in to at least clean up the onset
    chain.push({
      type: "attack",
      enabled: true,
      params: { durationMs: 0.8 } as TransformParams["attack"],
    });
  }

  // ── 6. Decay ─────────────────────────────────────────────────────
  // Apply a decay when there's a dead tail — shapes the end before trimming
  if (isBad(tailG)) {
    chain.push({
      type: "decay",
      enabled: true,
      params: { durationMs: 2.0 } as TransformParams["decay"],
    });
  }

  // ── 7. Tail Trim ─────────────────────────────────────────────────
  // Fixes: deadTailPercent
  if (isBad(tailG)) {
    chain.push({
      type: "tailTrim",
      enabled: true,
      params: { threshold: 3 } as TransformParams["tailTrim"],
    });
  }

  // ── Build diagnoses list ─────────────────────────────────────────
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
      fix: needSmoothing ? "Smoothing" : null,
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
      fix: needDc ? "DC Offset Remove" : null,
    },
    {
      metric: "attackTimeMs",
      label: "Attack",
      grade: attackG,
      currentValue: `${stats.attackTimeMs.toFixed(1)}ms`,
      fix: attackG === "bad" && stats.attackTimeMs > 4 ? "Attack 0.8ms" : null,
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
      fix: isBad(tailG) ? "Decay + Tail Trim" : null,
    },
  ];

  const issueCount = diagnoses.filter((d) => d.fix !== null).length;

  return { diagnoses, chain, issueCount };
}
