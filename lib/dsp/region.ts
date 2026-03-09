import {
  type TransformParams,
  type TransformStep,
  applyTransformChain,
} from "./transforms";

export interface Region {
  id: string;
  name: string;
  timelineStart: number;
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
  result: Int8Array;
  clippedTotal: number;
}

function cloneRegionOverrides(region: Region): Region["overrides"] {
  return {
    gain: region.overrides.gain ? { ...region.overrides.gain } : null,
    smoothing: region.overrides.smoothing
      ? { ...region.overrides.smoothing }
      : null,
    deadzone: region.overrides.deadzone
      ? { ...region.overrides.deadzone }
      : null,
    envelope: region.overrides.envelope
      ? {
          points: region.overrides.envelope.points.map((point) => ({
            ...point,
          })),
        }
      : null,
  };
}

function clampRegionRange(region: Region, sampleCount: number): Region {
  const start = Math.max(0, Math.min(region.start, sampleCount - 1));
  const end = Math.max(start + 1, Math.min(region.end, sampleCount));
  return {
    ...region,
    start,
    end,
    crossfadeSamples: Math.max(
      0,
      Math.min(region.crossfadeSamples, Math.floor((end - start) / 2)),
    ),
    overrides: cloneRegionOverrides(region),
  };
}

function createRegionSegment(
  region: Region,
  start: number,
  end: number,
  suffix: string,
  preserveId = false,
): Region {
  return {
    ...region,
    id: preserveId ? region.id : crypto.randomUUID(),
    name: suffix ? `${region.name} ${suffix}` : region.name,
    start,
    end,
    crossfadeSamples: Math.max(
      0,
      Math.min(region.crossfadeSamples, Math.floor((end - start) / 2)),
    ),
    overrides: cloneRegionOverrides(region),
  };
}

export function upsertTimelineRegion(
  existingRegions: Region[],
  region: Region,
  sampleCount: number,
): Region[] {
  if (sampleCount <= 0) return [];

  const inserted = clampRegionRange(region, sampleCount);
  const nextRegions: Region[] = [];

  for (const existingRegion of existingRegions) {
    if (existingRegion.id === inserted.id) continue;

    const current = clampRegionRange(existingRegion, sampleCount);
    if (current.end <= inserted.start || current.start >= inserted.end) {
      nextRegions.push(current);
      continue;
    }

    const keepsLeft = current.start < inserted.start;
    const keepsRight = current.end > inserted.end;

    if (keepsLeft) {
      nextRegions.push(
        createRegionSegment(current, current.start, inserted.start, keepsRight ? "A" : "", true),
      );
    }

    if (keepsRight) {
      nextRegions.push(
        createRegionSegment(
          current,
          inserted.end,
          current.end,
          keepsLeft ? "B" : "",
          !keepsLeft,
        ),
      );
    }
  }

  nextRegions.push(inserted);
  return nextRegions.sort((left, right) => left.start - right.start);
}

export function getRegionLength(region: Region) {
  return Math.max(0, region.end - region.start);
}

export function getTimelineLength(regions: Region[], fallbackLength: number) {
  if (regions.length === 0) return fallbackLength;
  return regions.reduce(
    (max, region) => Math.max(max, region.timelineStart + getRegionLength(region)),
    0,
  );
}

function cloneRegion(region: Region): Region {
  return {
    ...region,
    overrides: cloneRegionOverrides(region),
  };
}

function createTimelineRegion(
  timelineStart: number,
  start: number,
  end: number,
  name: string,
  region?: Region,
): Region {
  if (region) {
    return {
      ...region,
      id: crypto.randomUUID(),
      name,
      timelineStart,
      start,
      end,
      crossfadeSamples: 0,
      overrides: cloneRegionOverrides(region),
    };
  }

  return {
    id: crypto.randomUUID(),
    name,
    timelineStart,
    start,
    end,
    crossfadeSamples: 0,
    overrides: {
      gain: null,
      smoothing: null,
      deadzone: null,
      envelope: null,
    },
  };
}

export function buildTimelineSamples(samples: Int8Array, regions: Region[]) {
  if (regions.length === 0) return new Int8Array(samples);

  const result = new Int8Array(getTimelineLength(regions, samples.length));
  for (const region of regions) {
    const safeStart = Math.max(0, Math.min(region.start, samples.length));
    const safeEnd = Math.max(safeStart, Math.min(region.end, samples.length));
    if (safeEnd <= safeStart) continue;
    result.set(samples.slice(safeStart, safeEnd), region.timelineStart);
  }

  return result;
}

export function splitTimelineRegionsAtSelection(
  regions: Region[],
  selectionStart: number,
  selectionEnd: number,
  sampleCount: number,
) {
  if (sampleCount <= 0) return { regions: [], selectedIds: [] as string[] };

  const baseRegions =
    regions.length > 0
      ? regions.map(cloneRegion)
      : [createTimelineRegion(0, 0, sampleCount, "Clip 1")];
  const totalLength = getTimelineLength(baseRegions, sampleCount);
  const safeStart = Math.max(0, Math.min(selectionStart, totalLength - 1));
  const safeEnd = Math.max(safeStart + 1, Math.min(selectionEnd, totalLength));

  const nextRegions: Region[] = [];
  const selectedIds: string[] = [];
  let clipIndex = baseRegions.length;
  const nextName = () => {
    clipIndex += 1;
    return `Clip ${clipIndex}`;
  };

  for (const region of baseRegions) {
    const length = getRegionLength(region);
    const timelineStart = region.timelineStart;
    const timelineEnd = timelineStart + length;

    if (safeEnd <= timelineStart || safeStart >= timelineEnd) {
      nextRegions.push(region);
      continue;
    }

    const localStart = Math.max(0, safeStart - timelineStart);
    const localEnd = Math.min(length, safeEnd - timelineStart);
    const sourceStart = region.start + localStart;
    const sourceEnd = region.start + localEnd;

    if (localStart > 0) {
      nextRegions.push(
        createTimelineRegion(
          timelineStart,
          region.start,
          sourceStart,
          region.name,
          region,
        ),
      );
    }

    if (sourceEnd > sourceStart) {
      const selectedRegion =
        localStart === 0 && localEnd === length
          ? region
          : createTimelineRegion(
              timelineStart + localStart,
              sourceStart,
              sourceEnd,
              nextName(),
              region,
            );
      nextRegions.push(selectedRegion);
      selectedIds.push(selectedRegion.id);
    }

    if (localEnd < length) {
      nextRegions.push(
        createTimelineRegion(
          timelineStart + localEnd,
          sourceEnd,
          region.end,
          region.name,
          region,
        ),
      );
    }
  }

  const normalizedRegions = nextRegions
    .sort((left, right) => left.timelineStart - right.timelineStart)
    .map((region, index) => ({
      ...region,
      name: `Clip ${index + 1}`,
    }));

  return { regions: normalizedRegions, selectedIds };
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
  base: Int8Array,
  regionResult: Int8Array,
  regionStart: number,
  regionEnd: number,
  crossfade: number
) {
  const out = new Int8Array(base.length);
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
  samples: Int8Array,
  regions: Region[]
): RegionApplyResult {
  let result: Int8Array = Int8Array.from(samples);
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

export function renderTimelineRegions(
  samples: Int8Array,
  regions: Region[],
  sampleRate: number,
): RegionApplyResult {
  if (regions.length === 0) {
    return { result: new Int8Array(samples), clippedTotal: 0 };
  }

  const rendered = new Int8Array(getTimelineLength(regions, samples.length));
  let clippedTotal = 0;

  for (const region of regions) {
    const safeStart = Math.max(0, Math.min(region.start, samples.length));
    const safeEnd = Math.max(safeStart, Math.min(region.end, samples.length));
    if (safeEnd <= safeStart) continue;

    const source = samples.slice(safeStart, safeEnd);
    const chain = buildRegionChain(region);
    if (chain.length === 0) {
      rendered.set(source, region.timelineStart);
      continue;
    }

    const { result, clippedTotal: clipClipped } = applyTransformChain(
      source,
      chain,
      sampleRate,
    );
    rendered.set(result, region.timelineStart);
    clippedTotal += clipClipped;
  }

  return { result: rendered, clippedTotal };
}
