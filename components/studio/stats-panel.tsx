"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { computeStats, type WaveformStats } from "@/lib/dsp/stats";
import { computeAutoFix } from "@/lib/dsp/auto-fix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

// Premium reference targets (from haptic_rtp.bin per-pulse analysis)
//
// The reference waveform has asymmetric half-periods by design ([71, 71, 35, 35, 71])
// which produces a CV of ~31% and symmetry of ~1.30. These are intentional structural
// features, not defects, so the thresholds are calibrated to accept them.
// DC offset of the significant signal content is ~10 (the positive plateaus are
// slightly longer than negative), so the threshold allows up to ±12.
const PREMIUM_TARGETS = {
  peak: { label: "±91" },
  crestFactor: { label: "~1.15" },
  dcOffset: { label: "<±12" },
  symmetryRatio: { label: "~1.0" },
  attackTimeMs: { label: "<1.5ms" },
  rangeUtilization: { label: "~72%" },
  halfPeriodCV: { label: "<35%" },
  clippingCount: { label: "0" },
  deadTailPercent: { label: "<5%" },
};

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

const GRADE_COLORS: Record<GradeLevel, string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
};

const GRADE_BG: Record<GradeLevel, string> = {
  good: "bg-emerald-500/10",
  warn: "bg-amber-500/10",
  bad: "bg-red-500/10",
};

const GRADE_ICONS: Record<GradeLevel, string> = {
  good: "✓",
  warn: "!",
  bad: "✗",
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs tabular-nums">{value}</span>
    </div>
  );
}

function QualityRow({
  label,
  value,
  grade,
  target,
}: {
  label: string;
  value: string;
  grade: GradeLevel;
  target: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-2 py-0.5 rounded-sm",
        GRADE_BG[grade],
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("text-[10px] font-bold", GRADE_COLORS[grade])}>
          {GRADE_ICONS[grade]}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs tabular-nums font-medium",
            GRADE_COLORS[grade],
          )}
        >
          {value}
        </span>
        <span className="text-[9px] tabular-nums text-muted-foreground/60">
          ({target})
        </span>
      </div>
    </div>
  );
}

function WaveformSection({
  stats,
  label,
  variant,
  clippedOverride,
  children,
}: {
  stats: WaveformStats;
  label: string;
  variant: "secondary" | "default";
  clippedOverride?: number;
  children?: React.ReactNode;
}) {
  const peakGrade = gradePeak(stats.peak);
  const crestGrade = gradeCrest(stats.crestFactor);
  const dcGrade = gradeDcOffset(stats.dcOffset);
  const symGrade = gradeSymmetry(stats.symmetryRatio);
  const attackGrade = gradeAttackTime(stats.attackTimeMs);
  const rangeGrade = gradeRange(stats.rangeUtilization);
  const hpGrade = gradeHalfPeriodCV(stats.halfPeriodCV);
  const clipGrade = gradeClipping(clippedOverride ?? stats.clippingCount);
  const tailGrade = gradeDeadTail(stats.deadTailPercent);

  const grades = [
    peakGrade,
    crestGrade,
    dcGrade,
    symGrade,
    attackGrade,
    rangeGrade,
    hpGrade,
    clipGrade,
    tailGrade,
  ];
  const goodCount = grades.filter((g) => g === "good").length;
  const warnCount = grades.filter((g) => g === "warn").length;
  const badCount = grades.filter((g) => g === "bad").length;

  return (
    <div className="space-y-0.5">
      {/* Header with grade summary */}
      <div className="flex items-center justify-between px-2 py-1">
        <Badge variant={variant} className="text-[10px]">
          {label}
        </Badge>
        <div className="flex items-center gap-1.5">
          {goodCount > 0 && (
            <span className="text-[9px] font-medium text-emerald-500">
              {goodCount}✓
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[9px] font-medium text-amber-500">
              {warnCount}!
            </span>
          )}
          {badCount > 0 && (
            <span className="text-[9px] font-medium text-red-500">
              {badCount}✗
            </span>
          )}
        </div>
      </div>

      {/* Quality metrics with color grading */}
      <QualityRow
        label="Peak Amp"
        value={`±${stats.peak}`}
        grade={peakGrade}
        target={PREMIUM_TARGETS.peak.label}
      />
      <QualityRow
        label="Crest Factor"
        value={stats.crestFactor.toFixed(2)}
        grade={crestGrade}
        target={PREMIUM_TARGETS.crestFactor.label}
      />
      <QualityRow
        label="DC Offset"
        value={stats.dcOffset.toFixed(1)}
        grade={dcGrade}
        target={PREMIUM_TARGETS.dcOffset.label}
      />
      <QualityRow
        label="Symmetry"
        value={stats.symmetryRatio.toFixed(2)}
        grade={symGrade}
        target={PREMIUM_TARGETS.symmetryRatio.label}
      />
      <QualityRow
        label="Attack"
        value={`${stats.attackTimeMs.toFixed(1)}ms`}
        grade={attackGrade}
        target={PREMIUM_TARGETS.attackTimeMs.label}
      />
      <QualityRow
        label="Range Use"
        value={`${stats.rangeUtilization.toFixed(0)}%`}
        grade={rangeGrade}
        target={PREMIUM_TARGETS.rangeUtilization.label}
      />
      <QualityRow
        label="Freq Stab"
        value={`${stats.halfPeriodCV.toFixed(1)}%`}
        grade={hpGrade}
        target={PREMIUM_TARGETS.halfPeriodCV.label}
      />
      <QualityRow
        label="Clipping"
        value={(clippedOverride ?? stats.clippingCount).toString()}
        grade={clipGrade}
        target={PREMIUM_TARGETS.clippingCount.label}
      />
      <QualityRow
        label="Dead Tail"
        value={`${stats.deadTailPercent.toFixed(1)}%`}
        grade={tailGrade}
        target={PREMIUM_TARGETS.deadTailPercent.label}
      />

      {/* Slot for extra content (e.g. auto-fix button) */}
      {children}

      {/* Supplementary raw stats */}
      <div className="pt-1">
        <StatRow label="Samples" value={stats.sampleCount.toLocaleString()} />
        <StatRow
          label="Duration"
          value={`${(stats.duration * 1000).toFixed(1)}ms`}
        />
        <StatRow label="RMS" value={stats.rms.toFixed(2)} />
        <StatRow
          label="Min / Max"
          value={`${stats.minSigned} / ${stats.maxSigned}`}
        />
        <StatRow
          label="Dom Freq"
          value={`${stats.dominantFrequency.toFixed(0)}Hz`}
        />
        <StatRow label="Zero X" value={stats.zeroCrossings.toString()} />
        <StatRow label="Mean Amp" value={stats.meanAmplitude.toFixed(2)} />
        <StatRow label="Non-zero" value={stats.nonZeroSampleCount.toString()} />
      </div>
    </div>
  );
}

function AutoFixButton({ stats }: { stats: WaveformStats }) {
  const dispatch = useStudioDispatch();
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(() => computeAutoFix(stats), [stats]);

  // Hide when all metrics are already good — nothing to fix
  if (result.issueCount === 0) return null;

  const handleApply = () => {
    dispatch({ type: "SET_CHAIN", chain: result.chain });
    setShowDetails(false);
  };

  return (
    <div className="space-y-1 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="h-6 gap-1.5 text-[10px] flex-1"
              onClick={handleApply}
            >
              <Wand2 className="size-3" />
              Auto Fix {result.issueCount} issue
              {result.issueCount > 1 ? "s" : ""}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[240px]">
            <p className="text-xs font-medium mb-1">
              Replaces current chain with corrective transforms
            </p>
            <p className="text-[10px] text-muted-foreground">
              Applies: {result.chain.map((s) => s.type).join(" → ")}
            </p>
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide" : "Details"}
        </Button>
      </div>

      {showDetails && (
        <div className="space-y-0.5 rounded-md border border-border bg-muted/30 p-1.5">
          {result.diagnoses
            .filter((d) => d.fix !== null)
            .map((d) => (
              <div
                key={d.metric}
                className="flex items-center justify-between text-[10px]"
              >
                <div className="flex items-center gap-1">
                  <span className={cn("font-bold", GRADE_COLORS[d.grade])}>
                    {GRADE_ICONS[d.grade]}
                  </span>
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className={cn("tabular-nums", GRADE_COLORS[d.grade])}>
                    {d.currentValue}
                  </span>
                </div>
                <span className="text-emerald-500/80 font-medium">
                  → {d.fix}
                </span>
              </div>
            ))}

          <Separator className="my-1" />

          <div className="text-[9px] text-muted-foreground/70">
            Chain: {result.chain.map((s) => s.type).join(" → ")}
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaSection({
  originalStats,
  remasteredStats,
}: {
  originalStats: WaveformStats;
  remasteredStats: WaveformStats;
}) {
  return (
    <>
      <div className="px-2 py-1">
        <Badge variant="outline" className="text-[10px]">
          Delta
        </Badge>
      </div>
      <StatRow
        label="Peak Δ"
        value={(remasteredStats.peak - originalStats.peak).toString()}
      />
      <StatRow
        label="Crest Δ"
        value={(
          remasteredStats.crestFactor - originalStats.crestFactor
        ).toFixed(2)}
      />
      <StatRow
        label="DC Offset Δ"
        value={(remasteredStats.dcOffset - originalStats.dcOffset).toFixed(2)}
      />
      <StatRow
        label="Symmetry Δ"
        value={(
          remasteredStats.symmetryRatio - originalStats.symmetryRatio
        ).toFixed(2)}
      />
      <StatRow
        label="Attack Δ"
        value={`${(
          remasteredStats.attackTimeMs - originalStats.attackTimeMs
        ).toFixed(2)}ms`}
      />
      <StatRow
        label="RMS Δ"
        value={(remasteredStats.rms - originalStats.rms).toFixed(2)}
      />
      <StatRow
        label="Duration Δ"
        value={`${(
          (remasteredStats.duration - originalStats.duration) *
          1000
        ).toFixed(1)}ms`}
      />
      <StatRow
        label="Dead Tail Δ"
        value={`${(
          remasteredStats.deadTailPercent - originalStats.deadTailPercent
        ).toFixed(1)}%`}
      />
      <StatRow
        label="HP CV Δ"
        value={`${(
          remasteredStats.halfPeriodCV - originalStats.halfPeriodCV
        ).toFixed(1)}%`}
      />
    </>
  );
}

export function StatsPanel() {
  const state = useStudio();
  const effect = state.effects[state.activeEffectIndex];

  const originalStats =
    effect?.remasterInfo?.originalStats ??
    (effect
      ? computeStats(effect.waveform.samples, effect.waveform.sampleRate)
      : null);

  // Always compute remastered stats — fall back to original when no chain
  // has been applied yet so the Remastered section is always visible.
  const remasteredStats =
    effect?.remasterInfo?.remasteredStats ??
    (effect?.remastered
      ? computeStats(effect.remastered, effect.waveform.sampleRate)
      : originalStats);

  if (!effect || !originalStats || !remasteredStats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Statistics
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* ── Original ── */}
          <WaveformSection
            stats={originalStats}
            label="Original"
            variant="secondary"
          />

          {/* ── Remastered (always visible) ── */}
          <Separator className="my-1" />
          <WaveformSection
            stats={remasteredStats}
            label="Remastered"
            variant="default"
            clippedOverride={effect.remasterInfo?.clippedSamples}
          >
            {/* Auto Fix lives inside the Remastered section —
                it diagnoses the remastered stats so once all metrics
                are good after applying fixes, the button disappears. */}
            <AutoFixButton stats={remasteredStats} />
          </WaveformSection>

          {/* ── Delta (always visible) ── */}
          <Separator className="my-1" />
          <DeltaSection
            originalStats={originalStats}
            remasteredStats={remasteredStats}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
