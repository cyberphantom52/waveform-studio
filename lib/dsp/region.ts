import { type TransformStep, applyTransformChain } from "./transforms";

export interface Region {
  id: string;
  name: string;
  timelineStart: number;
  timelineLength: number;
  start: number;
  end: number;
  sourceSamples?: Int8Array;
  crossfadeSamples: number;
  chain: TransformStep[];
}

export interface RegionApplyResult {
  result: Int8Array;
  clippedTotal: number;
}

function cloneRegionChain(region: Region) {
  return region.chain.map((step) => ({
    type: step.type,
    enabled: step.enabled,
    params: structuredClone(step.params),
  }));
}

function getRegionSourceSampleCount(region: Region, fallbackCount: number) {
  return region.sourceSamples?.length ?? fallbackCount;
}

function getRegionSourceArray(region: Region, fallbackSamples: Int8Array) {
  return region.sourceSamples ?? fallbackSamples;
}

function resampleClip(samples: Int8Array, targetLength: number) {
  const safeTargetLength = Math.max(1, targetLength);
  if (samples.length === 0) return new Int8Array(safeTargetLength);
  if (safeTargetLength === samples.length) return new Int8Array(samples);
  if (safeTargetLength === 1) return new Int8Array([samples[0] ?? 0]);

  const out = new Int8Array(safeTargetLength);
  const lastSourceIndex = samples.length - 1;

  for (let index = 0; index < safeTargetLength; index++) {
    const srcIdx = (index / (safeTargetLength - 1)) * lastSourceIndex;
    const i0 = Math.floor(srcIdx);
    const frac = srcIdx - i0;

    const p0 = samples[Math.max(0, i0 - 1)] ?? samples[0] ?? 0;
    const p1 =
      samples[Math.min(i0, lastSourceIndex)] ?? samples[lastSourceIndex] ?? 0;
    const p2 =
      samples[Math.min(i0 + 1, lastSourceIndex)] ??
      samples[lastSourceIndex] ??
      0;
    const p3 =
      samples[Math.min(i0 + 2, lastSourceIndex)] ??
      samples[lastSourceIndex] ??
      0;

    const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c = -0.5 * p0 + 0.5 * p2;
    const d = p1;
    const value = a * frac * frac * frac + b * frac * frac + c * frac + d;

    out[index] = Math.max(-128, Math.min(127, Math.round(value)));
  }

  return out;
}

function clampRegionRange(region: Region, sampleCount: number): Region {
  const sourceSampleCount = getRegionSourceSampleCount(region, sampleCount);
  const start = Math.max(0, Math.min(region.start, sourceSampleCount - 1));
  const end = Math.max(start + 1, Math.min(region.end, sourceSampleCount));
  const timelineLength = Math.max(1, region.timelineLength ?? end - start);
  return {
    ...region,
    start,
    end,
    timelineLength,
    crossfadeSamples: Math.max(
      0,
      Math.min(region.crossfadeSamples, Math.floor(timelineLength / 2)),
    ),
    sourceSamples: region.sourceSamples
      ? new Int8Array(region.sourceSamples)
      : undefined,
    chain: cloneRegionChain(region),
  };
}

function createRegionSegment(
  region: Region,
  timelineLength: number,
  start: number,
  end: number,
  suffix: string,
  preserveId = false,
): Region {
  return {
    ...region,
    id: preserveId ? region.id : crypto.randomUUID(),
    name: suffix ? `${region.name} ${suffix}` : region.name,
    timelineLength: Math.max(1, timelineLength),
    start,
    end,
    crossfadeSamples: Math.max(
      0,
      Math.min(
        region.crossfadeSamples,
        Math.floor(Math.max(1, timelineLength) / 2),
      ),
    ),
    sourceSamples: region.sourceSamples
      ? new Int8Array(region.sourceSamples)
      : undefined,
    chain: cloneRegionChain(region),
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
        createRegionSegment(
          current,
          inserted.start - current.start,
          current.start,
          inserted.start,
          keepsRight ? "A" : "",
          true,
        ),
      );
    }

    if (keepsRight) {
      nextRegions.push(
        createRegionSegment(
          current,
          current.end - inserted.end,
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
  return Math.max(1, region.timelineLength);
}

export function getRegionSourceLength(region: Region) {
  return Math.max(1, region.end - region.start);
}

export function getTimelineLength(regions: Region[], fallbackLength: number) {
  if (regions.length === 0) return fallbackLength;
  return regions.reduce(
    (max, region) =>
      Math.max(max, region.timelineStart + getRegionLength(region)),
    0,
  );
}

export function getValidTimelineInsertion(
  regions: Region[],
  timelineStart: number,
  clipLength: number,
  fallbackLength: number,
) {
  if (clipLength <= 0 || fallbackLength <= 0) return null;

  const occupiedLength =
    regions.length === 0
      ? 0
      : regions.reduce(
          (max, region) =>
            Math.max(max, region.timelineStart + getRegionLength(region)),
          0,
        );
  const totalLength = Math.max(fallbackLength, occupiedLength);
  const safeStart = Math.max(0, Math.min(timelineStart, totalLength));
  const safeEnd = safeStart + clipLength;
  if (safeEnd > totalLength) return null;

  const sorted = [...regions].sort(
    (left, right) => left.timelineStart - right.timelineStart,
  );
  let gapStart = 0;

  for (const region of sorted) {
    const regionStart = region.timelineStart;
    const regionEnd = region.timelineStart + getRegionLength(region);

    if (safeStart < regionStart) {
      return safeStart >= gapStart && safeEnd <= regionStart
        ? { start: safeStart, end: safeEnd }
        : null;
    }

    if (safeStart >= regionStart && safeStart < regionEnd) {
      return null;
    }

    gapStart = Math.max(gapStart, regionEnd);
  }

  return safeStart >= gapStart && safeEnd <= totalLength
    ? { start: safeStart, end: safeEnd }
    : null;
}

function cloneRegion(region: Region): Region {
  return {
    ...region,
    sourceSamples: region.sourceSamples
      ? new Int8Array(region.sourceSamples)
      : undefined,
    chain: cloneRegionChain(region),
  };
}

function createTimelineRegion(
  timelineStart: number,
  timelineLength: number,
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
      timelineLength: Math.max(1, timelineLength),
      start,
      end,
      crossfadeSamples: 0,
      sourceSamples: region.sourceSamples
        ? new Int8Array(region.sourceSamples)
        : undefined,
      chain: cloneRegionChain(region),
    };
  }

  return {
    id: crypto.randomUUID(),
    name,
    timelineStart,
    timelineLength: Math.max(1, timelineLength),
    start,
    end,
    crossfadeSamples: 0,
    chain: [],
  };
}

export function buildTimelineSamples(samples: Int8Array, regions: Region[]) {
  if (regions.length === 0) return new Int8Array(samples);

  const result = new Int8Array(getTimelineLength(regions, samples.length));
  for (const region of regions) {
    const sourceSamples = getRegionSourceArray(region, samples);
    const safeStart = Math.max(0, Math.min(region.start, sourceSamples.length));
    const safeEnd = Math.max(safeStart, Math.min(region.end, sourceSamples.length));
    if (safeEnd <= safeStart) continue;
    result.set(
      resampleClip(sourceSamples.slice(safeStart, safeEnd), getRegionLength(region)),
      region.timelineStart,
    );
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
      : [createTimelineRegion(0, sampleCount, 0, sampleCount, "Clip 1")];
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
    const sourceLength = getRegionSourceLength(region);
    const timelineStart = region.timelineStart;
    const timelineEnd = timelineStart + length;

    if (safeEnd <= timelineStart || safeStart >= timelineEnd) {
      nextRegions.push(region);
      continue;
    }

    const localStart = Math.max(0, safeStart - timelineStart);
    const localEnd = Math.min(length, safeEnd - timelineStart);
    let sourceStart =
      region.start +
      Math.round((localStart / Math.max(1, length)) * sourceLength);
    let sourceEnd =
      region.start +
      Math.round((localEnd / Math.max(1, length)) * sourceLength);

    if (localStart > 0 && sourceStart <= region.start) {
      sourceStart = Math.min(region.end - 1, region.start + 1);
    }
    if (localEnd < length && sourceEnd >= region.end) {
      sourceEnd = Math.max(region.start + 1, region.end - 1);
    }
    if (sourceEnd <= sourceStart) {
      sourceEnd = Math.min(region.end, sourceStart + 1);
    }

    if (localStart > 0) {
      nextRegions.push(
        createTimelineRegion(
          timelineStart,
          localStart,
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
              localEnd - localStart,
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
          length - localEnd,
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

export function splitTimelineRegionsAtCursor(
  regions: Region[],
  cursorSample: number,
  sampleCount: number,
) {
  if (sampleCount <= 0) return { regions: [], selectedIds: [] as string[] };

  const baseRegions =
    regions.length > 0
      ? regions.map(cloneRegion)
      : [createTimelineRegion(0, sampleCount, 0, sampleCount, "Clip 1")];
  const totalLength = getTimelineLength(baseRegions, sampleCount);
  const safeCursor = Math.max(0, Math.min(cursorSample, totalLength));

  const nextRegions: Region[] = [];
  const selectedIds: string[] = [];
  let clipIndex = baseRegions.length;
  const nextName = () => {
    clipIndex += 1;
    return `Clip ${clipIndex}`;
  };

  for (const region of baseRegions) {
    const length = getRegionLength(region);
    const sourceLength = getRegionSourceLength(region);
    const timelineStart = region.timelineStart;
    const timelineEnd = timelineStart + length;

    if (safeCursor <= timelineStart || safeCursor >= timelineEnd) {
      nextRegions.push(region);
      continue;
    }

    const localCursor = safeCursor - timelineStart;
    if (localCursor <= 0 || localCursor >= length) {
      nextRegions.push(region);
      continue;
    }

    const leftSourceStart = region.start;
    let leftSourceEnd = region.end;
    let rightSourceStart = region.start;
    const rightSourceEnd = region.end;

    if (sourceLength > 1) {
      const sourceCursor = Math.max(
        region.start + 1,
        Math.min(
          region.start +
            Math.round((localCursor / Math.max(1, length)) * sourceLength),
          region.end - 1,
        ),
      );
      leftSourceEnd = sourceCursor;
      rightSourceStart = sourceCursor;
    }

    nextRegions.push(
      createTimelineRegion(
        timelineStart,
        localCursor,
        leftSourceStart,
        leftSourceEnd,
        region.name,
        region,
      ),
    );

    const rightRegion = createTimelineRegion(
      safeCursor,
      length - localCursor,
      rightSourceStart,
      rightSourceEnd,
      nextName(),
      region,
    );
    nextRegions.push(rightRegion);
    selectedIds.push(rightRegion.id);
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
  return cloneRegionChain(region);
}

function crossfadeBlend(
  base: Int8Array,
  regionResult: Int8Array,
  regionStart: number,
  regionEnd: number,
  crossfade: number,
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
    out[i] = Math.round(
      base[i] * (1 - blend) + regionResult[regionIdx] * blend,
    );
  }

  return out;
}

export function applyRegions(
  samples: Int8Array,
  regions: Region[],
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
    const { result: transformed, clippedTotal: regionClipped } =
      applyTransformChain(copy, chain);
    clippedTotal += regionClipped;

    result = crossfadeBlend(
      result,
      transformed,
      safeStart,
      safeEnd,
      region.crossfadeSamples,
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
    const sourceSamples = getRegionSourceArray(region, samples);
    const safeStart = Math.max(0, Math.min(region.start, sourceSamples.length));
    const safeEnd = Math.max(safeStart, Math.min(region.end, sourceSamples.length));
    if (safeEnd <= safeStart) continue;

    const source = sourceSamples.slice(safeStart, safeEnd);
    const chain = buildRegionChain(region);
    if (chain.length === 0) {
      rendered.set(
        resampleClip(source, getRegionLength(region)),
        region.timelineStart,
      );
      continue;
    }

    const { result, clippedTotal: clipClipped } = applyTransformChain(
      source,
      chain,
      sampleRate,
    );
    rendered.set(
      resampleClip(result, getRegionLength(region)),
      region.timelineStart,
    );
    clippedTotal += clipClipped;
  }

  return { result: rendered, clippedTotal };
}
