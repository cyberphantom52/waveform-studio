export interface WaveformData {
  id: string;
  name: string;
  samples: Int8Array;
  sampleRate: number;
}

export interface EffectMetadata {
  filename: string;
  effectId: number;
  family: string;
  style: string;
  playRateHz?: number;
}

export function parseBinFile(buffer: ArrayBuffer, name: string): WaveformData {
  const samples = new Int8Array(buffer);
  return {
    id: crypto.randomUUID(),
    name: name.replace(/\.bin$/i, ""),
    samples,
    sampleRate: 8000,
  };
}

export function parseEffectJson(
  json: string
): Record<string, EffectMetadata> {
  const raw = JSON.parse(json);
  const map: Record<string, EffectMetadata> = {};

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      map[entry.filename] = {
        filename: entry.filename,
        effectId: entry.effectId ?? entry.effect_id ?? 0,
        family: entry.family ?? "default",
        style: entry.style ?? "default",
        playRateHz:
          entry.playRateHz ??
          entry.play_rate_hz ??
          entry.playRate ??
          entry.play_rate,
      };
    }
  } else if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      const v = value as Record<string, unknown>;
      map[key] = {
        filename: key,
        effectId: (v.effectId ?? v.effect_id ?? 0) as number,
        family: (v.family ?? "default") as string,
        style: (v.style ?? "default") as string,
        playRateHz: (v.playRateHz ??
          v.play_rate_hz ??
          v.playRate ??
          v.play_rate) as number | undefined,
      };
    }
  }

  return map;
}

export function waveformToArrayBuffer(samples: Int8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.byteLength);
  new Int8Array(buffer).set(samples);
  return buffer;
}

export function cloneSamples(samples: Int8Array): Int8Array {
  return new Int8Array(samples);
}
