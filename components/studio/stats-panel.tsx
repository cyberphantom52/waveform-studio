"use client";

import { useStudio } from "@/lib/studio-context";
import { computeStats } from "@/lib/dsp/stats";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export function StatsPanel() {
  const state = useStudio();
  const effect = state.effects[state.activeEffectIndex];

  const originalStats =
    effect?.remasterInfo?.originalStats ??
    (effect ? computeStats(effect.waveform.samples, effect.waveform.sampleRate) : null);

  const remasteredStats =
    effect?.remasterInfo?.remasteredStats ??
    (effect?.remastered ? computeStats(effect.remastered, effect.waveform.sampleRate) : null);

  if (!effect || !originalStats) {
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
          <div className="px-2 py-1">
            <Badge variant="secondary" className="text-[10px]">
              Original
            </Badge>
          </div>
          <StatRow
            label="Samples"
            value={originalStats.sampleCount.toLocaleString()}
          />
          <StatRow
            label="Duration"
            value={`${(originalStats.duration * 1000).toFixed(1)}ms`}
          />
          <StatRow label="Peak" value={originalStats.peak.toString()} />
          <StatRow
            label="Peak Norm"
            value={originalStats.peakNormalized.toFixed(3)}
          />
          <StatRow
            label="Min Signed"
            value={originalStats.minSigned.toString()}
          />
          <StatRow
            label="Max Signed"
            value={originalStats.maxSigned.toString()}
          />
          <StatRow label="RMS" value={originalStats.rms.toFixed(2)} />
          <StatRow
            label="RMS Norm"
            value={originalStats.rmsNormalized.toFixed(3)}
          />
          <StatRow
            label="Zero X"
            value={originalStats.zeroCrossings.toString()}
          />
          <StatRow
            label="Dom Freq"
            value={`${originalStats.dominantFrequency.toFixed(0)}Hz`}
          />
          <StatRow
            label="Clipping"
            value={originalStats.clippingCount.toString()}
          />
          <StatRow
            label="Non-zero"
            value={originalStats.nonZeroSampleCount.toString()}
          />
          <StatRow
            label="First NZ"
            value={originalStats.firstNonZeroIndex.toString()}
          />
          <StatRow
            label="Last NZ"
            value={originalStats.lastNonZeroIndex.toString()}
          />
          <StatRow
            label="Mean Amp"
            value={originalStats.meanAmplitude.toFixed(2)}
          />
          <StatRow
            label="Crest"
            value={originalStats.crestFactor.toFixed(2)}
          />

          {remasteredStats && (
            <>
              <Separator className="my-1" />
              <div className="px-2 py-1">
                <Badge
                  variant="default"
                  className="text-[10px]"
                >
                  Remastered
                </Badge>
              </div>
              <StatRow
                label="Samples"
                value={remasteredStats.sampleCount.toLocaleString()}
              />
              <StatRow
                label="Duration"
                value={`${(remasteredStats.duration * 1000).toFixed(1)}ms`}
              />
              <StatRow label="Peak" value={remasteredStats.peak.toString()} />
              <StatRow
                label="Min Signed"
                value={remasteredStats.minSigned.toString()}
              />
              <StatRow
                label="Max Signed"
                value={remasteredStats.maxSigned.toString()}
              />
              <StatRow
                label="RMS"
                value={remasteredStats.rms.toFixed(2)}
              />
              <StatRow
                label="Zero X"
                value={remasteredStats.zeroCrossings.toString()}
              />
              <StatRow
                label="Dom Freq"
                value={`${remasteredStats.dominantFrequency.toFixed(0)}Hz`}
              />
              <StatRow
                label="Clipping"
                value={(effect.remasterInfo?.clippedSamples ?? remasteredStats.clippingCount).toString()}
              />
              <StatRow
                label="Non-zero"
                value={remasteredStats.nonZeroSampleCount.toString()}
              />
              <StatRow
                label="First NZ"
                value={remasteredStats.firstNonZeroIndex.toString()}
              />
              <StatRow
                label="Last NZ"
                value={remasteredStats.lastNonZeroIndex.toString()}
              />
              <StatRow
                label="Crest"
                value={remasteredStats.crestFactor.toFixed(2)}
              />
              <Separator className="my-1" />
              <div className="px-2 py-1">
                <Badge variant="outline" className="text-[10px]">
                  Delta
                </Badge>
              </div>
              <StatRow
                label="Peak Delta"
                value={(remasteredStats.peak - originalStats.peak).toString()}
              />
              <StatRow
                label="RMS Delta"
                value={(remasteredStats.rms - originalStats.rms).toFixed(2)}
              />
              <StatRow
                label="Zero X Delta"
                value={(remasteredStats.zeroCrossings - originalStats.zeroCrossings).toString()}
              />
              <StatRow
                label="Duration Delta"
                value={`${((remasteredStats.duration - originalStats.duration) * 1000).toFixed(1)}ms`}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
