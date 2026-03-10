import type { WaveformStats } from "./stats";

export type GradeLevel = "good" | "warn" | "bad";

interface CenteredQualityTarget {
  label: string;
  target: number;
  goodMin: number;
  goodMax: number;
  warnMin: number;
  warnMax: number;
}

interface UpperBoundQualityTarget {
  label: string;
  target: number;
  goodMax: number;
  warnMax: number;
}

export interface QualityTargetProfile {
  peak: CenteredQualityTarget & {
    normalizeLevel: number;
    clampMin: number;
    clampMax: number;
  };
  crestFactor: CenteredQualityTarget;
  dcOffset: CenteredQualityTarget;
  symmetryRatio: CenteredQualityTarget;
  attackTimeMs: UpperBoundQualityTarget;
  rangeUtilization: CenteredQualityTarget;
  halfPeriodCV: UpperBoundQualityTarget;
  clippingCount: UpperBoundQualityTarget;
  deadTailPercent: UpperBoundQualityTarget;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function centeredTarget(
  target: number,
  goodDelta: number,
  warnDelta: number,
  label: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): CenteredQualityTarget {
  return {
    label,
    target,
    goodMin: clamp(target - goodDelta, min, max),
    goodMax: clamp(target + goodDelta, min, max),
    warnMin: clamp(target - warnDelta, min, max),
    warnMax: clamp(target + warnDelta, min, max),
  };
}

function upperBoundTarget(
  target: number,
  goodMax: number,
  warnMax: number,
  label: string,
): UpperBoundQualityTarget {
  return {
    label,
    target,
    goodMax,
    warnMax,
  };
}

function formatNumber(value: number, digits = 0) {
  return value.toFixed(digits);
}

const DEFAULT_QUALITY_TARGET_PROFILE: QualityTargetProfile = {
  peak: {
    ...centeredTarget(91, 11, 26, "±91", 0, 127),
    normalizeLevel: 91,
    clampMin: -91,
    clampMax: 91,
  },
  crestFactor: centeredTarget(1.15, 0.35, 0.85, "~1.15"),
  dcOffset: {
    label: "<±12",
    target: 0,
    goodMin: -12,
    goodMax: 12,
    warnMin: -20,
    warnMax: 20,
  },
  symmetryRatio: {
    label: "~1.0",
    target: 1,
    goodMin: 0.7,
    goodMax: 1.35,
    warnMin: 0.5,
    warnMax: 1.8,
  },
  attackTimeMs: upperBoundTarget(0.33, 1.5, 4, "<1.5ms"),
  rangeUtilization: {
    label: "~72%",
    target: 72,
    goodMin: 60,
    goodMax: 80,
    warnMin: 45,
    warnMax: 95,
  },
  halfPeriodCV: upperBoundTarget(31, 35, 55, "<35%"),
  clippingCount: upperBoundTarget(0, 0, 5, "0"),
  deadTailPercent: upperBoundTarget(2, 5, 15, "<5%"),
};

export function createQualityTargetProfile(
  referenceStats?: WaveformStats | null,
): QualityTargetProfile {
  if (!referenceStats) return DEFAULT_QUALITY_TARGET_PROFILE;

  const peakTarget = clamp(Math.round(referenceStats.peak), 1, 127);
  const rangeTarget = clamp(referenceStats.rangeUtilization, 0, 100);
  const crestTarget = Math.max(0.1, referenceStats.crestFactor);
  const dcTarget = referenceStats.dcOffset;
  const symmetryTarget = Math.max(0.1, referenceStats.symmetryRatio);
  const attackTarget = Math.max(0, referenceStats.attackTimeMs);
  const hpTarget = Math.max(0, referenceStats.halfPeriodCV);
  const clipTarget = Math.max(0, Math.round(referenceStats.clippingCount));
  const tailTarget = Math.max(0, referenceStats.deadTailPercent);

  return {
    peak: {
      ...centeredTarget(
        peakTarget,
        Math.max(8, peakTarget * 0.12),
        Math.max(18, peakTarget * 0.3),
        `±${peakTarget}`,
        0,
        127,
      ),
      normalizeLevel: peakTarget,
      clampMin: -peakTarget,
      clampMax: peakTarget,
    },
    crestFactor: centeredTarget(
      crestTarget,
      Math.max(0.25, crestTarget * 0.3),
      Math.max(0.6, crestTarget * 0.8),
      `~${formatNumber(crestTarget, 2)}`,
    ),
    dcOffset: centeredTarget(
      dcTarget,
      Math.max(6, Math.abs(dcTarget) * 0.5 + 2),
      Math.max(12, Math.abs(dcTarget) + 4),
      `~${formatNumber(dcTarget, 1)}`,
    ),
    symmetryRatio: centeredTarget(
      symmetryTarget,
      Math.max(0.2, symmetryTarget * 0.25),
      Math.max(0.5, symmetryTarget * 0.6),
      `~${formatNumber(symmetryTarget, 2)}`,
    ),
    attackTimeMs: upperBoundTarget(
      attackTarget,
      Math.max(0.5, attackTarget * 1.5 + 0.5),
      Math.max(2, attackTarget * 3 + 1),
      `~${formatNumber(attackTarget, 1)}ms`,
    ),
    rangeUtilization: centeredTarget(
      rangeTarget,
      Math.max(8, rangeTarget * 0.18),
      Math.max(18, rangeTarget * 0.4),
      `~${formatNumber(rangeTarget, 0)}%`,
      0,
      100,
    ),
    halfPeriodCV: upperBoundTarget(
      hpTarget,
      Math.max(10, hpTarget + Math.max(4, hpTarget * 0.25)),
      Math.max(25, hpTarget + Math.max(15, hpTarget * 0.8)),
      `~${formatNumber(hpTarget, 1)}%`,
    ),
    clippingCount: upperBoundTarget(
      clipTarget,
      clipTarget,
      Math.max(5, clipTarget + 5),
      clipTarget.toString(),
    ),
    deadTailPercent: upperBoundTarget(
      tailTarget,
      Math.max(5, tailTarget + 4),
      Math.max(15, tailTarget + 12),
      `~${formatNumber(tailTarget, 1)}%`,
    ),
  };
}

function gradeCenteredMetric(
  value: number,
  target: CenteredQualityTarget,
): GradeLevel {
  if (value >= target.goodMin && value <= target.goodMax) return "good";
  if (value >= target.warnMin && value <= target.warnMax) return "warn";
  return "bad";
}

function gradeUpperBoundMetric(
  value: number,
  target: UpperBoundQualityTarget,
): GradeLevel {
  if (value <= target.goodMax) return "good";
  if (value <= target.warnMax) return "warn";
  return "bad";
}

export function gradePeak(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeCenteredMetric(value, profile.peak);
}

export function gradeCrest(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeCenteredMetric(value, profile.crestFactor);
}

export function gradeClipping(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeUpperBoundMetric(value, profile.clippingCount);
}

export function gradeDcOffset(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeCenteredMetric(value, profile.dcOffset);
}

export function gradeSymmetry(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeCenteredMetric(value, profile.symmetryRatio);
}

export function gradeHalfPeriodCV(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeUpperBoundMetric(value, profile.halfPeriodCV);
}

export function gradeDeadTail(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeUpperBoundMetric(value, profile.deadTailPercent);
}

export function gradeAttackTime(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeUpperBoundMetric(value, profile.attackTimeMs);
}

export function gradeRange(
  value: number,
  profile: QualityTargetProfile,
): GradeLevel {
  return gradeCenteredMetric(value, profile.rangeUtilization);
}
