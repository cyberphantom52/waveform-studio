"use client";

import {
  Upload,
  Eye,
  Sliders,
  MousePointerClick,
  Sparkles,
  FolderTree,
  Download,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "Import .bin Waveforms",
    description:
      "Drag-and-drop raw signed 8-bit .bin waveforms, one sample per byte. Optional vibrator_effect.json metadata for effect IDs, families, and styles.",
    span: "col-span-1",
  },
  {
    icon: Eye,
    title: "Triple Canvas Visualization",
    description:
      "Original, remastered, and difference views rendered side-by-side with D3-powered SVG. Zoom, pan, and inspect every sample.",
    span: "col-span-1 md:col-span-2",
  },
  {
    icon: Sliders,
    title: "DSP Transform Chain",
    description:
      "Pitch shift via cubic Hermite interpolation, gain with clipping detection, multi-point envelope shaping, attack/decay fades, tail trimming, moving-average smoothing, and deadzone filtering.",
    span: "col-span-1 md:col-span-2",
  },
  {
    icon: MousePointerClick,
    title: "Region-Based Editing",
    description:
      "Select sub-ranges and apply independent transform parameters with crossfade blending at boundaries.",
    span: "col-span-1",
  },
  {
    icon: Sparkles,
    title: "Synthetic Generator",
    description:
      "Create waveforms from parametric descriptions: sine, square, triangle, sawtooth, noise, and impulse shapes.",
    span: "col-span-1",
  },
  {
    icon: FolderTree,
    title: "Family Organization",
    description:
      "Tag effects by family. Save and apply presets across all effects in the same group for consistent haptic profiles.",
    span: "col-span-1",
  },
  {
    icon: Download,
    title: "Batch Export",
    description:
      "Download remastered .bin files individually or in batch. JSON manifest with before/after stats, checksums, and family presets.",
    span: "col-span-1",
  },
  {
    icon: BarChart3,
    title: "Detailed Statistics",
    description:
      "Peak, RMS, zero crossings, dominant frequency, sample counts, duration, clipping info, crest factor -- all at a glance.",
    span: "col-span-1 md:col-span-2",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="relative bg-[oklch(0.08_0_0)] py-32"
    >
      {/* Top border accent */}
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-[var(--waveform-remastered)]/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="mb-20 flex flex-col gap-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--waveform-remastered)]">
            Capabilities
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Everything you need to<br />
            master haptic waveforms.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-neutral-500">
            A complete DSP workbench purpose-built for vibration motor engineers
            working with Android haptic .bin files.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-px bg-neutral-800/50 md:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className={`${feature.span} group relative bg-[oklch(0.08_0_0)] p-8 transition-colors hover:bg-[oklch(0.10_0_0)]`}
              >
                {/* Corner accent on hover */}
                <div className="absolute top-0 left-0 h-4 w-px bg-[var(--waveform-remastered)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute top-0 left-0 h-px w-4 bg-[var(--waveform-remastered)] opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="flex flex-col gap-4">
                  <Icon className="size-5 text-neutral-500 transition-colors group-hover:text-[var(--waveform-remastered)]" />
                  <h3 className="text-sm font-medium tracking-tight text-neutral-200">
                    {feature.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
