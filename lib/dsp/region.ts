import { type TransformStep, applyTransformChain } from "./transforms";

export interface Region {
  id: string;
  start: number;
  end: number;
  chain: TransformStep[];
  crossfadeSamples: number;
}

function crossfadeBlend(
  base: Uint8Array<ArrayBuffer>,
  regionResult: Uint8Array<ArrayBuffer>,
  regionStart: number,
  regionEnd: number,
  crossfade: number
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(base);

  const fadeIn = Math.min(crossfade, Math.floor((regionEnd - regionStart) / 2));
  const fadeOut = fadeIn;

  for (let i = regionStart; i < regionEnd; i++) {
    const regionIdx = i - regionStart;
    let blend = 1;

    if (regionIdx < fadeIn) {
      blend = regionIdx / fadeIn;
    } else if (regionIdx >= regionEnd - regionStart - fadeOut) {
      blend = (regionEnd - regionStart - 1 - regionIdx) / fadeOut;
    }

    blend = Math.max(0, Math.min(1, blend));
    out[i] = Math.round(base[i] * (1 - blend) + regionResult[regionIdx] * blend);
  }

  return out;
}

export function applyRegions(
  samples: Uint8Array<ArrayBuffer>,
  regions: Region[]
): Uint8Array<ArrayBuffer> {
  let result = new Uint8Array(samples);

  const sorted = [...regions].sort((a, b) => a.start - b.start);

  for (const region of sorted) {
    const regionSamples = new Uint8Array(
      samples.buffer,
      samples.byteOffset + region.start,
      region.end - region.start
    );
    const copy = new Uint8Array(regionSamples);
    const { result: transformed } = applyTransformChain(copy, region.chain);

    result = crossfadeBlend(
      result,
      new Uint8Array(transformed) as Uint8Array<ArrayBuffer>,
      region.start,
      region.end,
      region.crossfadeSamples
    );
  }

  return result;
}
