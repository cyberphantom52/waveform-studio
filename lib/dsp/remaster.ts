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
    start,
    end,
    crossfadeSamples: 0,
    chain: [],
  };
}

export function sanitizeRegion(region: Region, sampleCount: number): Region {
  const start = Math.max(0, Math.min(region.start, sampleCount));
  const end = Math.max(start, Math.min(region.end, sampleCount));
  return {
    ...region,
    start,
    end,
    crossfadeSamples: Math.max(
      0,
      Math.min(region.crossfadeSamples, Math.floor((end - start) / 2)),
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
