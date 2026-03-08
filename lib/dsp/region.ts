import {
  type TransformParams,
  type TransformStep,
  applyTransformChain,
} from "./transforms";

export interface Region {
  id: string;
  name: string;
  start: number;
  end: number;
  crossfadeSamples: number;
  overrides: {
    gain: TransformParams["gain"] | null;
    smoothing: TransformParams["smoothing"] | null;
    deadzone: TransformParams["deadzone"] | null;
    envelope: TransformParams["envelope"] | null;
  };
}

export interface RegionApplyResult {
  result: Uint8Array<ArrayBufferLike>;
  clippedTotal: number;
}

function buildRegionChain(region: Region): TransformStep[] {
  const steps: TransformStep[] = [];
  if (region.overrides.gain) {
    steps.push({
      type: "gain",
      enabled: true,
      params: region.overrides.gain,
    });
  }
  if (region.overrides.envelope) {
    steps.push({
      type: "envelope",
      enabled: true,
      params: region.overrides.envelope,
    });
  }
  if (region.overrides.smoothing) {
    steps.push({
      type: "smoothing",
      enabled: true,
      params: region.overrides.smoothing,
    });
  }
  if (region.overrides.deadzone) {
    steps.push({
      type: "deadzone",
      enabled: true,
      params: region.overrides.deadzone,
    });
  }
  return steps;
}

function crossfadeBlend(
  base: Uint8Array<ArrayBufferLike>,
  regionResult: Uint8Array<ArrayBufferLike>,
  regionStart: number,
  regionEnd: number,
  crossfade: number
) {
  const out = new Uint8Array(base.length);
  out.set(base);
  const regionLength = regionEnd - regionStart;
  if (regionLength <= 0) return out;

  const fadeIn = Math.min(crossfade, Math.floor(regionLength / 2));
  const fadeOut = fadeIn;

  for (let i = regionStart; i < regionEnd; i++) {
    const regionIdx = i - regionStart;
    let blend = 1;

    if (fadeIn > 0 && regionIdx < fadeIn) {
      blend = regionIdx / fadeIn;
    } else if (fadeOut > 0 && regionIdx >= regionLength - fadeOut) {
      blend = (regionLength - 1 - regionIdx) / fadeOut;
    }

    blend = Math.max(0, Math.min(1, blend));
    out[i] = Math.round(base[i] * (1 - blend) + regionResult[regionIdx] * blend);
  }

  return out;
}

export function applyRegions(
  samples: Uint8Array<ArrayBufferLike>,
  regions: Region[]
): RegionApplyResult {
  let result: Uint8Array<ArrayBufferLike> = Uint8Array.from(samples);
  let clippedTotal = 0;

  const sorted = [...regions].sort((a, b) => a.start - b.start);

  for (const region of sorted) {
    const safeStart = Math.max(0, Math.min(region.start, result.length));
    const safeEnd = Math.max(safeStart, Math.min(region.end, result.length));
    const chain = buildRegionChain(region);
    if (chain.length === 0 || safeEnd <= safeStart) continue;

    const copy = result.slice(safeStart, safeEnd);
    const { result: transformed, clippedTotal: regionClipped } = applyTransformChain(copy, chain);
    clippedTotal += regionClipped;

    result = crossfadeBlend(
      result,
      transformed,
      safeStart,
      safeEnd,
      region.crossfadeSamples
    );
  }

  return { result, clippedTotal };
}
