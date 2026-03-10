import type { Region } from "./region";
import { renderTimelineRegions } from "./region";
import type { TransformStep } from "./transforms";
import { computeStats, type WaveformStats } from "./stats";

export interface RemasterResult {
  result: Int8Array;
  clippedSamples: number;
  originalStats: WaveformStats;
  remasteredStats: WaveformStats;
}

export function createDefaultRegion(
  sampleCount: number,
  existingRegions: Region[],
): Region {
  const index = existingRegions.length + 1;
  const start = 0;
  const end = sampleCount;
  return {
    id: crypto.randomUUID(),
    name: `Clip ${index}`,
    timelineStart: 0,
    timelineLength: sampleCount,
    start,
    end,
    crossfadeSamples: 0,
    chain: [],
  };
}

export function sanitizeRegion(region: Region, sampleCount: number): Region {
  const sourceSampleCount = region.sourceSamples?.length ?? sampleCount;
  const start = Math.max(0, Math.min(region.start, sourceSampleCount));
  const end = Math.max(start, Math.min(region.end, sourceSampleCount));
  const timelineLength = Math.max(1, region.timelineLength ?? end - start);
  return {
    ...region,
    start,
    end,
    timelineLength,
    sourceSamples: region.sourceSamples
      ? new Int8Array(region.sourceSamples)
      : undefined,
    crossfadeSamples: Math.max(
      0,
      Math.min(region.crossfadeSamples, Math.floor(timelineLength / 2)),
    ),
  };
}

export function computeRemasteredWaveform(
  original: Int8Array,
  sampleRate: number,
  _chain: TransformStep[],
  regions: Region[],
  cachedOriginalStats?: WaveformStats,
): RemasterResult {
  const originalStats =
    cachedOriginalStats ?? computeStats(original, sampleRate);
  const globalResult = new Int8Array(original);
  const globalClipped = 0;
  const sanitizedRegions = regions.map((region) =>
    sanitizeRegion(region, globalResult.length),
  );
  const { result, clippedTotal: regionClipped } = renderTimelineRegions(
    globalResult,
    sanitizedRegions,
    sampleRate,
  );
  return {
    result,
    clippedSamples: globalClipped + regionClipped,
    originalStats,
    remasteredStats: computeStats(result, sampleRate),
  };
}
