import type { Region } from "./region";
import { applyRegions } from "./region";
import type { TransformStep } from "./transforms";
import { applyTransformChain } from "./transforms";
import { computeStats, type WaveformStats } from "./stats";

export interface RemasterResult {
  result: Uint8Array;
  clippedSamples: number;
  originalStats: WaveformStats;
  remasteredStats: WaveformStats;
}

export function createEmptyRegionOverrides(): Region["overrides"] {
  return {
    gain: null,
    smoothing: null,
    deadzone: null,
    envelope: null,
  };
}

export function createDefaultRegion(
  sampleCount: number,
  existingRegions: Region[]
): Region {
  const index = existingRegions.length + 1;
  const start = Math.floor(sampleCount * 0.25);
  const end = Math.floor(sampleCount * 0.75);
  return {
    id: crypto.randomUUID(),
    name: `Region ${index}`,
    start,
    end,
    crossfadeSamples: 20,
    overrides: createEmptyRegionOverrides(),
  };
}

export function sanitizeRegion(region: Region, sampleCount: number): Region {
  const start = Math.max(0, Math.min(region.start, sampleCount));
  const end = Math.max(start, Math.min(region.end, sampleCount));
  return {
    ...region,
    start,
    end,
    crossfadeSamples: Math.max(0, Math.min(region.crossfadeSamples, Math.floor((end - start) / 2))),
  };
}

export function computeRemasteredWaveform(
  original: Uint8Array,
  sampleRate: number,
  chain: TransformStep[],
  regions: Region[]
): RemasterResult {
  const originalStats = computeStats(original, sampleRate);
  const { result: globalResult, clippedTotal: globalClipped } = applyTransformChain(
    original,
    chain,
    sampleRate
  );
  const sanitizedRegions = regions.map((region) =>
    sanitizeRegion(region, globalResult.length)
  );
  const { result, clippedTotal: regionClipped } = applyRegions(globalResult, sanitizedRegions);
  return {
    result,
    clippedSamples: globalClipped + regionClipped,
    originalStats,
    remasteredStats: computeStats(result, sampleRate),
  };
}
