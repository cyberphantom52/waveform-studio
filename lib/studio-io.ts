import { computeStats } from "@/lib/dsp/stats";
import type { EffectMetadata, WaveformData } from "@/lib/dsp/waveform";
import {
  cloneSamples,
  parseBinFile,
  parseEffectJson,
  waveformToArrayBuffer,
} from "@/lib/dsp/waveform";
import {
  computeRemasteredWaveform,
  createEmptyRegionOverrides,
} from "@/lib/dsp/remaster";
import type { FamilyPreset, StudioEffect, StudioState } from "@/lib/studio-context";

export function createStudioEffect(
  waveform: WaveformData,
  globalDefaultPlayRateHz: number,
  metadata?: EffectMetadata
): StudioEffect {
  return {
    waveform: {
      ...waveform,
      samples: cloneSamples(waveform.samples),
    },
    chain: [],
    regions: [],
    remastered: null,
    metadata,
    familyTag: metadata?.family ?? "ungrouped",
    playRateHz: metadata?.playRateHz ?? globalDefaultPlayRateHz,
    notes: "",
    selected: false,
    remasterInfo: null,
  };
}

export async function importStudioFiles(
  files: FileList | File[],
  globalDefaultPlayRateHz: number
): Promise<{
  effects: StudioEffect[];
  metadata: Record<string, EffectMetadata>;
}> {
  const fileList = Array.from(files);
  let metadata: Record<string, EffectMetadata> = {};
  const bins: WaveformData[] = [];

  for (const file of fileList) {
    if (file.name.endsWith(".json")) {
      metadata = {
        ...metadata,
        ...parseEffectJson(await file.text()),
      };
      continue;
    }

    if (file.name.endsWith(".bin")) {
      bins.push(parseBinFile(await file.arrayBuffer(), file.name));
    }
  }

  const effects = bins.map((waveform) => {
    const meta = metadata[`${waveform.name}.bin`] ?? metadata[waveform.name];
    return createStudioEffect(waveform, globalDefaultPlayRateHz, meta);
  });

  return { effects, metadata };
}

export function promptDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadWaveformBin(filename: string, samples: Uint8Array) {
  promptDownload(
    filename,
    new Blob([waveformToArrayBuffer(samples)], {
      type: "application/octet-stream",
    })
  );
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const normalized = new Uint8Array(data.length);
  normalized.set(data);
  const digest = await crypto.subtle.digest("SHA-256", normalized);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildManifest(state: StudioState) {
  const effects = await Promise.all(
    state.effects.map(async (effect) => {
      const remaster = computeRemasteredWaveform(
        effect.waveform.samples,
        effect.waveform.sampleRate,
        effect.chain,
        effect.regions
      );
      const beforeStats =
        effect.remasterInfo?.originalStats ??
        computeStats(effect.waveform.samples, effect.waveform.sampleRate);
      const afterSamples = remaster.result;
      const afterStats = remaster.remasteredStats;

      return {
        id: effect.waveform.id,
        name: effect.waveform.name,
        metadata: effect.metadata ?? null,
        familyTag: effect.familyTag,
        playRateHz: effect.playRateHz,
        notes: effect.notes,
        selected: effect.selected,
        params: effect.chain,
        regions: effect.regions,
        beforeStats,
        afterStats,
        clippedSamples: remaster.clippedSamples,
        checksums: {
          originalSha256: await sha256Hex(effect.waveform.samples),
          remasteredSha256: await sha256Hex(afterSamples),
        },
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    globalDefaultPlayRateHz: state.globalDefaultPlayRateHz,
    canvasConfig: state.canvasConfig,
    presetCount: state.presets.length,
    effectCount: effects.length,
    effects,
  };
}

export function exportManifestBlob(manifest: Awaited<ReturnType<typeof buildManifest>>) {
  return new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  });
}

export function exportPresetsBlob(presets: FamilyPreset[]) {
  return new Blob([JSON.stringify({ presets }, null, 2)], {
    type: "application/json",
  });
}

export function createRegionSelection(
  start: number,
  end: number,
  existingRegions: StudioEffect["regions"]
) {
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end, safeStart + 1);
  return {
    id: crypto.randomUUID(),
    name: `Region ${existingRegions.length + 1}`,
    start: safeStart,
    end: safeEnd,
    crossfadeSamples: 20,
    overrides: createEmptyRegionOverrides(),
  };
}
