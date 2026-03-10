"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { computeStats, type WaveformStats } from "@/lib/dsp/stats";
import { computeAutoFix } from "@/lib/dsp/auto-fix";
import {
  createQualityTargetProfile,
  gradeAttackTime,
  gradeClipping,
  gradeCrest,
  gradeDcOffset,
  gradeDeadTail,
  gradeHalfPeriodCV,
  gradePeak,
  gradeRange,
  gradeSymmetry,
  type GradeLevel,
  type QualityTargetProfile,
} from "@/lib/dsp/quality-targets";
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
import { Upload, Wand2, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  BROWSE_WAVEFORM_DRAG_TYPE,
  importCompareWaveform,
} from "@/lib/studio-io";

// Quality targets come from the imported compare waveform when available.

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
  qualityTargets,
  children,
}: {
  stats: WaveformStats;
  label: string;
  variant: "secondary" | "default";
  clippedOverride?: number;
  qualityTargets: QualityTargetProfile | null;
  children?: React.ReactNode;
}) {
  const hasQualityTargets = qualityTargets !== null;
  const peakGrade = qualityTargets ? gradePeak(stats.peak, qualityTargets) : null;
  const crestGrade = qualityTargets ? gradeCrest(stats.crestFactor, qualityTargets) : null;
  const dcGrade = qualityTargets ? gradeDcOffset(stats.dcOffset, qualityTargets) : null;
  const symGrade = qualityTargets ? gradeSymmetry(stats.symmetryRatio, qualityTargets) : null;
  const attackGrade = qualityTargets ? gradeAttackTime(stats.attackTimeMs, qualityTargets) : null;
  const rangeGrade = qualityTargets ? gradeRange(stats.rangeUtilization, qualityTargets) : null;
  const hpGrade = qualityTargets ? gradeHalfPeriodCV(stats.halfPeriodCV, qualityTargets) : null;
  const clipGrade = qualityTargets ? gradeClipping(clippedOverride ?? stats.clippingCount, qualityTargets) : null;
  const tailGrade = qualityTargets ? gradeDeadTail(stats.deadTailPercent, qualityTargets) : null;

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
  ].filter((grade): grade is GradeLevel => grade !== null);
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
          {!hasQualityTargets && (
            <span className="text-[9px] text-muted-foreground">No target</span>
          )}
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
      {qualityTargets && (
        <>
          <QualityRow
            label="Peak Amp"
            value={`±${stats.peak}`}
            grade={peakGrade!}
            target={qualityTargets.peak.label}
          />
          <QualityRow
            label="Crest Factor"
            value={stats.crestFactor.toFixed(2)}
            grade={crestGrade!}
            target={qualityTargets.crestFactor.label}
          />
          <QualityRow
            label="DC Offset"
            value={stats.dcOffset.toFixed(1)}
            grade={dcGrade!}
            target={qualityTargets.dcOffset.label}
          />
          <QualityRow
            label="Symmetry"
            value={stats.symmetryRatio.toFixed(2)}
            grade={symGrade!}
            target={qualityTargets.symmetryRatio.label}
          />
          <QualityRow
            label="Attack"
            value={`${stats.attackTimeMs.toFixed(1)}ms`}
            grade={attackGrade!}
            target={qualityTargets.attackTimeMs.label}
          />
          <QualityRow
            label="Range Use"
            value={`${stats.rangeUtilization.toFixed(0)}%`}
            grade={rangeGrade!}
            target={qualityTargets.rangeUtilization.label}
          />
          <QualityRow
            label="Freq Stab"
            value={`${stats.halfPeriodCV.toFixed(1)}%`}
            grade={hpGrade!}
            target={qualityTargets.halfPeriodCV.label}
          />
          <QualityRow
            label="Clipping"
            value={(clippedOverride ?? stats.clippingCount).toString()}
            grade={clipGrade!}
            target={qualityTargets.clippingCount.label}
          />
          <QualityRow
            label="Dead Tail"
            value={`${stats.deadTailPercent.toFixed(1)}%`}
            grade={tailGrade!}
            target={qualityTargets.deadTailPercent.label}
          />
        </>
      )}

      {/* Slot for extra content (e.g. auto-fix button) */}
      {children}

      {!qualityTargets && (
        <div className="px-2 py-1 text-[10px] text-muted-foreground">
          Load a compare target to enable quality grading and Auto Fix.
        </div>
      )}

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

function AutoFixButton({
  stats,
  qualityTargets,
}: {
  stats: WaveformStats;
  qualityTargets: QualityTargetProfile;
}) {
  const dispatch = useStudioDispatch();
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(
    () => computeAutoFix(stats, qualityTargets),
    [qualityTargets, stats],
  );

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
  const dispatch = useStudioDispatch();
  const compareFileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const effect = state.effects[state.activeEffectIndex];
  const importCompareFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files).find((entry) => entry.name.endsWith(".bin"));
      if (!file) return;
      const waveform = await importCompareWaveform(file);
      if (!waveform) return;
      dispatch({ type: "SET_COMPARE_WAVEFORM", waveform });
    },
    [dispatch],
  );
  const setCompareFromEffectId = useCallback(
    (effectId: string) => {
      const sourceEffect = state.effects.find(
        (entry) => entry.waveform.id === effectId,
      );
      if (!sourceEffect) return false;
      dispatch({ type: "SET_COMPARE_WAVEFORM", waveform: sourceEffect.waveform });
      return true;
    },
    [dispatch, state.effects],
  );
  const compareStats = useMemo(
    () =>
      state.compareWaveform
        ? computeStats(
            state.compareWaveform.samples,
            state.compareWaveform.sampleRate,
          )
        : null,
    [state.compareWaveform],
  );
  const qualityTargets = useMemo(
    () => (compareStats ? createQualityTargetProfile(compareStats) : null),
    [compareStats],
  );

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

  return (
    <div className="flex h-full flex-col">
      <input
        ref={compareFileRef}
        type="file"
        accept=".bin"
        className="hidden"
        onChange={(event) => {
          if (!event.target.files) return;
          void importCompareFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex items-center border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Statistics
        </span>
        {state.compareWaveform && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            Target {state.compareWaveform.name}
          </Badge>
        )}
      </div>

      <div
        className={cn(
          "border-b border-border px-2 py-2 transition-colors",
          isDragging ? "bg-accent/50" : "bg-card",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void importCompareFiles(event.dataTransfer.files);
        }}
      >
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          onClick={() => compareFileRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {state.compareWaveform
            ? `Replace target or drop .bin · ${state.compareWaveform.name}`
            : "Add target or drop .bin to enable compare + Auto Fix"}
        </button>
        {state.compareWaveform && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5 px-2 text-[10px]"
              onClick={() => dispatch({ type: "SET_COMPARE_WAVEFORM", waveform: null })}
            >
              <X className="size-3" />
              Clear target
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {!effect || !originalStats || !remasteredStats ? (
          <div className="flex h-24 items-center justify-center">
            <p className="text-xs text-muted-foreground">No data</p>
          </div>
        ) : (
          <div className="py-1">
            {/* ── Original ── */}
            <WaveformSection
              stats={originalStats}
              label="Original"
              variant="secondary"
              qualityTargets={qualityTargets}
            />

            {/* ── Remastered (always visible) ── */}
            <Separator className="my-1" />
            <WaveformSection
              stats={remasteredStats}
              label="Remastered"
              variant="default"
              clippedOverride={effect.remasterInfo?.clippedSamples}
              qualityTargets={qualityTargets}
            >
              {qualityTargets && (
                <AutoFixButton
                  stats={remasteredStats}
                  qualityTargets={qualityTargets}
                />
              )}
            </WaveformSection>

            {/* ── Delta (always visible) ── */}
            <Separator className="my-1" />
            <DeltaSection
              originalStats={originalStats}
              remasteredStats={remasteredStats}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
