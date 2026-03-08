export interface WaveformData {
  id: string;
  name: string;
  samples: Uint8Array;
  sampleRate: number;
  familyId?: string;
  effectId?: string;
  style?: string;
}

export interface EffectMetadata {
  filename: string;
  effectId: number;
  family: string;
  style: string;
}

export function parseBinFile(buffer: ArrayBuffer, name: string): WaveformData {
  const samples = new Uint8Array(buffer);
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
      };
    }
  }

  return map;
}

export function waveformToArrayBuffer(samples: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(samples.byteLength);
  new Uint8Array(buf).set(samples);
  return buf;
}

export function cloneSamples(samples: Uint8Array): Uint8Array {
  return new Uint8Array(samples);
}
