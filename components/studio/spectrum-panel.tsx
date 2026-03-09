"use client";

import { useStudio } from "@/lib/studio-context";
import {
  computeSpectrum,
  findSpectralPeaks,
  computeSpectralStats,
  computeRegionSpectrum,
  type WindowType,
  type SpectrumResult,
  type SpectralPeak,
  type SpectralStats,
} from "@/lib/dsp/fft";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type SpectrumSource = "original" | "remastered";
type FrequencyScale = "linear" | "log";
type MagnitudeScale = "db" | "linear";

interface TooltipInfo {
  x: number;
  y: number;
  frequency: number;
  magnitude: number;
  magnitudeDb: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const WINDOW_TYPES: { value: WindowType; label: string }[] = [
  { value: "hann", label: "Hann" },
  { value: "hamming", label: "Hamming" },
  { value: "blackman", label: "Blackman" },
  { value: "blackman-harris", label: "B-Harris" },
  { value: "rectangular", label: "Rect" },
];

const PEAK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--waveform-delta)",
  "var(--waveform-accent)",
  "var(--destructive)",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFrequency(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)}kHz`;
  return `${hz.toFixed(1)}Hz`;
}

function formatDb(db: number): string {
  if (db <= -120) return "-∞ dB";
  return `${db.toFixed(1)} dB`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs tabular-nums">{value}</span>
    </div>
  );
}

// ── Spectrum SVG Renderer ───────────────────────────────────────────────────

function SpectrumPlot({
  spectrum,
  peaks,
  frequencyScale,
  magnitudeScale,
  maxFrequency,
  dbFloor,
  showPeaks,
  showHarmonics,
  width,
  height,
}: {
  spectrum: SpectrumResult;
  peaks: SpectralPeak[];
  frequencyScale: FrequencyScale;
  magnitudeScale: MagnitudeScale;
  maxFrequency: number;
  dbFloor: number;
  showPeaks: boolean;
  showHarmonics: boolean;
  width: number;
  height: number;
}) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const margin = { top: 10, right: 12, bottom: 28, left: 40 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  // Frequency axis mapping
  const minLogFreq = Math.log10(Math.max(1, spectrum.frequencyResolution));
  const maxLogFreq = Math.log10(Math.max(2, maxFrequency));

  // Precompute max magnitude for linear scale
  const maxMagnitude = useMemo(() => {
    let m = 0;
    for (let i = 0; i < spectrum.magnitudes.length; i++) {
      if (spectrum.magnitudes[i] > m) m = spectrum.magnitudes[i];
    }
    return m;
  }, [spectrum.magnitudes]);

  const freqToX = useCallback(
    (freq: number): number => {
      if (frequencyScale === "log") {
        if (freq <= 0) return 0;
        const logFreq = Math.log10(
          Math.max(freq, spectrum.frequencyResolution),
        );
        return (
          ((logFreq - minLogFreq) / (maxLogFreq - minLogFreq)) * innerWidth
        );
      }
      return (freq / maxFrequency) * innerWidth;
    },
    [
      frequencyScale,
      spectrum.frequencyResolution,
      minLogFreq,
      maxLogFreq,
      innerWidth,
      maxFrequency,
    ],
  );

  const xToFreq = useCallback(
    (x: number): number => {
      if (frequencyScale === "log") {
        const logFreq =
          minLogFreq + (x / innerWidth) * (maxLogFreq - minLogFreq);
        return Math.pow(10, logFreq);
      }
      return (x / innerWidth) * maxFrequency;
    },
    [frequencyScale, minLogFreq, maxLogFreq, innerWidth, maxFrequency],
  );

  // Magnitude axis mapping
  const magToY = useCallback(
    (value: number, isDb: boolean): number => {
      if (isDb) {
        const clamped = Math.max(dbFloor, Math.min(0, value));
        return ((0 - clamped) / (0 - dbFloor)) * innerHeight;
      }
      if (maxMagnitude === 0) return innerHeight;
      return innerHeight - (value / maxMagnitude) * innerHeight;
    },
    [dbFloor, innerHeight, maxMagnitude],
  );

  // Build spectrum path
  const spectrumPath = useMemo(() => {
    const { frequencies, magnitudes, magnitudesDb } = spectrum;
    const numBins = frequencies.length;
    if (numBins === 0 || innerWidth <= 0 || innerHeight <= 0) return "";

    const isDb = magnitudeScale === "db";
    const values = isDb ? magnitudesDb : magnitudes;
    const points: string[] = [];

    for (let i = 0; i < numBins; i++) {
      const freq = frequencies[i];
      if (freq > maxFrequency) break;
      if (frequencyScale === "log" && freq <= 0) continue;

      const x = freqToX(freq);
      const y = magToY(values[i], isDb);

      if (x < 0 || x > innerWidth) continue;
      points.push(
        `${points.length === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`,
      );
    }

    return points.join(" ");
  }, [
    spectrum,
    frequencyScale,
    magnitudeScale,
    maxFrequency,
    innerWidth,
    innerHeight,
    freqToX,
    magToY,
  ]);

  // Frequency grid ticks
  const freqTicks = useMemo(() => {
    if (frequencyScale === "log") {
      const ticks: number[] = [];
      const decades = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 4000];
      for (const d of decades) {
        if (d >= spectrum.frequencyResolution && d <= maxFrequency) {
          ticks.push(d);
        }
      }
      return ticks;
    }
    // Linear: evenly spaced
    const step =
      maxFrequency <= 500
        ? 50
        : maxFrequency <= 2000
          ? 200
          : maxFrequency <= 5000
            ? 500
            : 1000;
    const ticks: number[] = [];
    for (let f = 0; f <= maxFrequency; f += step) {
      ticks.push(f);
    }
    return ticks;
  }, [frequencyScale, maxFrequency, spectrum.frequencyResolution]);

  // dB grid ticks
  const dbTicks = useMemo(() => {
    if (magnitudeScale === "db") {
      const step = Math.abs(dbFloor) <= 60 ? 10 : 20;
      const ticks: number[] = [];
      for (let d = 0; d >= dbFloor; d -= step) {
        ticks.push(d);
      }
      return ticks;
    }
    return [0, 0.25, 0.5, 0.75, 1.0];
  }, [magnitudeScale, dbFloor]);

  // Mouse move for tooltip
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - bounds.left;
      const mouseY = event.clientY - bounds.top;
      const freq = xToFreq(mouseX);

      // Find closest bin
      const binIdx =
        spectrum.frequencyResolution > 0
          ? Math.round(freq / spectrum.frequencyResolution)
          : 0;
      const clampedBin = Math.max(
        0,
        Math.min(spectrum.frequencies.length - 1, binIdx),
      );

      if (clampedBin >= 0 && clampedBin < spectrum.frequencies.length) {
        setTooltip({
          x: mouseX + margin.left,
          y: mouseY + margin.top,
          frequency: spectrum.frequencies[clampedBin],
          magnitude: spectrum.magnitudes[clampedBin],
          magnitudeDb: spectrum.magnitudesDb[clampedBin],
        });
      }
    },
    [
      xToFreq,
      spectrum.frequencyResolution,
      spectrum.frequencies,
      spectrum.magnitudes,
      spectrum.magnitudesDb,
      margin.left,
      margin.top,
    ],
  );

  // Harmonic markers for the fundamental peak
  const harmonicMarkers = useMemo(() => {
    if (!showHarmonics || peaks.length === 0) return [];
    const fundamental = peaks.find((p) => !p.isHarmonic);
    if (!fundamental) return [];

    const markers: { freq: number; harmonic: number }[] = [];
    for (let n = 2; n <= 8; n++) {
      const hFreq = fundamental.frequency * n;
      if (hFreq > maxFrequency) break;
      markers.push({ freq: hFreq, harmonic: n });
    }
    return markers;
  }, [peaks, showHarmonics, maxFrequency]);

  const isDb = magnitudeScale === "db";

  return (
    <svg
      width={width}
      height={height}
      className="block select-none"
      onMouseLeave={() => setTooltip(null)}
    >
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Grid lines — frequency */}
        {freqTicks.map((freq) => {
          const x = freqToX(freq);
          if (x < 0 || x > innerWidth) return null;
          return (
            <g key={`freq-${freq}`}>
              <line
                x1={x}
                x2={x}
                y1={0}
                y2={innerHeight}
                stroke="var(--waveform-grid)"
                strokeWidth={0.5}
              />
              <text
                x={x}
                y={innerHeight + 16}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize="8"
              >
                {freq >= 1000
                  ? `${(freq / 1000).toFixed(freq >= 1000 && freq % 1000 === 0 ? 0 : 1)}k`
                  : freq}
              </text>
            </g>
          );
        })}

        {/* Grid lines — magnitude */}
        {dbTicks.map((tick) => {
          const y = isDb
            ? magToY(tick, true)
            : innerHeight - tick * innerHeight;
          if (y < 0 || y > innerHeight) return null;
          return (
            <g key={`mag-${tick}`}>
              <line
                x1={0}
                x2={innerWidth}
                y1={y}
                y2={y}
                stroke="var(--waveform-grid)"
                strokeWidth={tick === 0 ? 1 : 0.5}
              />
              <text
                x={-6}
                y={y + 3}
                textAnchor="end"
                fill="var(--muted-foreground)"
                fontSize="8"
              >
                {isDb ? `${tick}` : tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Harmonic lines */}
        {harmonicMarkers.map(({ freq, harmonic }) => {
          const x = freqToX(freq);
          if (x < 0 || x > innerWidth) return null;
          return (
            <g key={`harmonic-${harmonic}`}>
              <line
                x1={x}
                x2={x}
                y1={0}
                y2={innerHeight}
                stroke="var(--waveform-delta)"
                strokeWidth={0.5}
                strokeDasharray="3,3"
                opacity={0.5}
              />
              <text
                x={x + 2}
                y={10}
                fill="var(--waveform-delta)"
                fontSize="8"
                opacity={0.7}
              >
                H{harmonic}
              </text>
            </g>
          );
        })}

        {/* Spectrum path */}
        {spectrumPath && (
          <path
            d={spectrumPath}
            fill="none"
            stroke="var(--waveform-remastered)"
            strokeWidth={1.25}
          />
        )}

        {/* Filled area under curve */}
        {spectrumPath && (
          <path
            d={`${spectrumPath} L${innerWidth.toFixed(2)},${innerHeight.toFixed(2)} L0,${innerHeight.toFixed(2)} Z`}
            fill="var(--waveform-remastered)"
            opacity={0.08}
          />
        )}

        {/* Peak markers */}
        {showPeaks &&
          peaks.map((peak, i) => {
            const x = freqToX(peak.frequency);
            if (x < 0 || x > innerWidth) return null;
            const y = magToY(isDb ? peak.magnitudeDb : peak.magnitude, isDb);
            const color = PEAK_COLORS[i % PEAK_COLORS.length];
            return (
              <g key={`peak-${peak.binIndex}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={y}
                  y2={innerHeight}
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.4}
                  strokeDasharray="2,2"
                />
                <circle cx={x} cy={y} r={3} fill={color} opacity={0.9} />
                {innerWidth > 200 && (
                  <text
                    x={x + 5}
                    y={y - 4}
                    fill={color}
                    fontSize="8"
                    fontWeight="500"
                  >
                    {formatFrequency(peak.frequency)}
                  </text>
                )}
              </g>
            );
          })}

        {/* Tooltip crosshair */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x - margin.left}
              x2={tooltip.x - margin.left}
              y1={0}
              y2={innerHeight}
              stroke="var(--foreground)"
              strokeWidth={0.5}
              opacity={0.3}
            />
            <line
              x1={0}
              x2={innerWidth}
              y1={tooltip.y - margin.top}
              y2={tooltip.y - margin.top}
              stroke="var(--foreground)"
              strokeWidth={0.5}
              opacity={0.3}
            />
          </>
        )}

        {/* Invisible rect for mouse events */}
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onMouseMove={handleMouseMove}
        />

        {/* Bottom axis line */}
        <line
          x1={0}
          x2={innerWidth}
          y1={innerHeight}
          y2={innerHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {/* Left axis line */}
        <line
          x1={0}
          x2={0}
          y1={0}
          y2={innerHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />
      </g>

      {/* Tooltip overlay */}
      {tooltip && (
        <g>
          <rect
            x={Math.min(tooltip.x + 8, width - 130)}
            y={Math.max(4, tooltip.y - 36)}
            width={120}
            height={30}
            rx={2}
            fill="var(--popover)"
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.95}
          />
          <text
            x={Math.min(tooltip.x + 14, width - 124)}
            y={Math.max(16, tooltip.y - 22)}
            fill="var(--foreground)"
            fontSize="9"
            fontFamily="monospace"
          >
            {formatFrequency(tooltip.frequency)}
          </text>
          <text
            x={Math.min(tooltip.x + 14, width - 124)}
            y={Math.max(28, tooltip.y - 10)}
            fill="var(--muted-foreground)"
            fontSize="9"
            fontFamily="monospace"
          >
            {formatDb(tooltip.magnitudeDb)} · {tooltip.magnitude.toFixed(1)}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SpectrumPanel() {
  const state = useStudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  const [source, setSource] = useState<SpectrumSource>("original");
  const [windowType, setWindowType] = useState<WindowType>("hann");
  const [frequencyScale, setFrequencyScale] = useState<FrequencyScale>("log");
  const [magnitudeScale, setMagnitudeScale] = useState<MagnitudeScale>("db");
  const [maxFrequency, setMaxFrequency] = useState(4000);
  const [dbFloor, setDbFloor] = useState(-80);
  const [showPeaks, setShowPeaks] = useState(true);
  const [showHarmonics, setShowHarmonics] = useState(true);
  const [maxPeaks, setMaxPeaks] = useState(6);

  const effect = state.effects[state.activeEffectIndex];

  // Responsive width tracking
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setPlotWidth(rect.width);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Compute spectrum
  const samples = useMemo(() => {
    if (!effect) return null;
    if (source === "remastered" && effect.remastered) {
      return effect.remastered;
    }
    return effect.waveform.samples;
  }, [effect, source]);

  const sampleRate = effect?.waveform.sampleRate ?? 24000;

  // If a region is selected, analyze just that region
  const selectedRegion = useMemo(() => {
    if (!state.selectedRegionId || !effect) return null;
    return effect.regions.find((r) => r.id === state.selectedRegionId) ?? null;
  }, [state.selectedRegionId, effect]);

  const spectrum = useMemo<SpectrumResult | null>(() => {
    if (!samples || samples.length === 0) return null;
    if (selectedRegion) {
      return computeRegionSpectrum(
        samples,
        selectedRegion.start,
        selectedRegion.end,
        sampleRate,
        windowType,
      );
    }
    return computeSpectrum(samples, sampleRate, windowType);
  }, [samples, sampleRate, windowType, selectedRegion]);

  const peaks = useMemo<SpectralPeak[]>(() => {
    if (!spectrum) return [];
    return findSpectralPeaks(spectrum, {
      maxPeaks,
      minDb: -60,
      minProminence: 3,
    });
  }, [spectrum, maxPeaks]);

  const stats = useMemo<SpectralStats | null>(() => {
    if (!spectrum) return null;
    return computeSpectralStats(spectrum);
  }, [spectrum]);

  // Auto-set max frequency to Nyquist
  const nyquist = sampleRate / 2;
  const effectiveMaxFreq = Math.min(maxFrequency, nyquist);

  const plotHeight = 220;

  if (!effect) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Spectrum
        </span>
        {selectedRegion && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            {selectedRegion.name}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 py-1">
          {/* Source toggle */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Source
            </span>
            <ToggleGroup
              type="single"
              value={source}
              onValueChange={(v) => {
                if (v) setSource(v as SpectrumSource);
              }}
              className="ml-auto gap-0"
            >
              <ToggleGroupItem
                value="original"
                className="h-5 px-1.5 text-[10px]"
              >
                OG
              </ToggleGroupItem>
              <ToggleGroupItem
                value="remastered"
                className="h-5 px-1.5 text-[10px]"
                disabled={!effect.remastered}
              >
                RM
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Window + scale controls */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Window
            </span>
            <Select
              value={windowType}
              onValueChange={(v) => setWindowType(v as WindowType)}
            >
              <SelectTrigger className="ml-auto h-5 w-24 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {WINDOW_TYPES.map((w) => (
                    <SelectItem
                      key={w.value}
                      value={w.value}
                      className="text-[10px]"
                    >
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Freq
            </span>
            <ToggleGroup
              type="single"
              value={frequencyScale}
              onValueChange={(v) => {
                if (v) setFrequencyScale(v as FrequencyScale);
              }}
              className="ml-auto gap-0"
            >
              <ToggleGroupItem
                value="linear"
                className="h-5 px-1.5 text-[10px]"
              >
                Lin
              </ToggleGroupItem>
              <ToggleGroupItem value="log" className="h-5 px-1.5 text-[10px]">
                Log
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mag
            </span>
            <ToggleGroup
              type="single"
              value={magnitudeScale}
              onValueChange={(v) => {
                if (v) setMagnitudeScale(v as MagnitudeScale);
              }}
              className="ml-auto gap-0"
            >
              <ToggleGroupItem value="db" className="h-5 px-1.5 text-[10px]">
                dB
              </ToggleGroupItem>
              <ToggleGroupItem
                value="linear"
                className="h-5 px-1.5 text-[10px]"
              >
                Lin
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Max frequency slider */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Max Hz
            </span>
            <Slider
              min={100}
              max={nyquist}
              step={50}
              value={[maxFrequency]}
              onValueChange={([v]) => setMaxFrequency(v)}
              className="flex-1"
            />
            <span className="w-12 text-right text-[10px] tabular-nums text-muted-foreground">
              {effectiveMaxFreq}
            </span>
          </div>

          {/* dB floor slider */}
          {magnitudeScale === "db" && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Floor
              </span>
              <Slider
                min={-120}
                max={-20}
                step={5}
                value={[dbFloor]}
                onValueChange={([v]) => setDbFloor(v)}
                className="flex-1"
              />
              <span className="w-12 text-right text-[10px] tabular-nums text-muted-foreground">
                {dbFloor}dB
              </span>
            </div>
          )}

          {/* Peaks toggle */}
          <div className="flex items-center gap-3 px-2">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showPeaks}
                onChange={(e) => setShowPeaks(e.target.checked)}
                className="accent-waveform-accent"
              />
              <span className="text-[10px] text-muted-foreground">Peaks</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showHarmonics}
                onChange={(e) => setShowHarmonics(e.target.checked)}
                className="accent-waveform-accent"
              />
              <span className="text-[10px] text-muted-foreground">
                Harmonics
              </span>
            </label>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Top</span>
              <Slider
                min={1}
                max={12}
                step={1}
                value={[maxPeaks]}
                onValueChange={([v]) => setMaxPeaks(v)}
                className="w-16"
              />
              <span className="w-4 text-right text-[10px] tabular-nums text-muted-foreground">
                {maxPeaks}
              </span>
            </div>
          </div>

          <Separator className="my-0.5" />

          {/* Spectrum plot */}
          <div
            ref={containerRef}
            className="w-full overflow-hidden bg-background px-0"
          >
            {spectrum ? (
              <SpectrumPlot
                spectrum={spectrum}
                peaks={peaks}
                frequencyScale={frequencyScale}
                magnitudeScale={magnitudeScale}
                maxFrequency={effectiveMaxFreq}
                dbFloor={dbFloor}
                showPeaks={showPeaks}
                showHarmonics={showHarmonics}
                width={plotWidth}
                height={plotHeight}
              />
            ) : (
              <div
                className="flex items-center justify-center"
                style={{ height: plotHeight }}
              >
                <p className="text-xs text-muted-foreground">
                  No spectrum data
                </p>
              </div>
            )}
          </div>

          <Separator className="my-0.5" />

          {/* Peak table */}
          {showPeaks && peaks.length > 0 && (
            <>
              <div className="px-2 py-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Detected Peaks
                </span>
              </div>
              <div className="px-2">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-0.5 text-left font-normal">#</th>
                      <th className="py-0.5 text-right font-normal">Freq</th>
                      <th className="py-0.5 text-right font-normal">dB</th>
                      <th className="py-0.5 text-right font-normal">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peaks.map((peak, i) => (
                      <tr
                        key={peak.binIndex}
                        className="border-t border-border/50"
                      >
                        <td className="py-0.5 tabular-nums">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                PEAK_COLORS[i % PEAK_COLORS.length],
                            }}
                          />
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {formatFrequency(peak.frequency)}
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {formatDb(peak.magnitudeDb)}
                        </td>
                        <td className="py-0.5 text-right">
                          {peak.isHarmonic ? (
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[8px]"
                            >
                              H{peak.harmonicNumber} of{" "}
                              {formatFrequency(peak.fundamentalHz ?? 0)}
                            </Badge>
                          ) : i === 0 ? (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1 text-[8px]"
                            >
                              Fund
                            </Badge>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator className="my-0.5" />
            </>
          )}

          {/* Spectral statistics */}
          {stats && (
            <>
              <div className="px-2 py-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Spectral Stats
                </span>
              </div>
              <StatRow
                label="Dominant"
                value={formatFrequency(stats.dominantFrequency)}
              />
              <StatRow
                label="Centroid"
                value={formatFrequency(stats.centroid)}
              />
              <StatRow label="Spread" value={formatFrequency(stats.spread)} />
              <StatRow
                label="Rolloff 85%"
                value={formatFrequency(stats.rolloff)}
              />
              <StatRow label="Flatness" value={stats.flatness.toFixed(4)} />
              <StatRow label="Energy" value={stats.totalEnergy.toFixed(1)} />

              <Separator className="my-0.5" />
            </>
          )}

          {/* FFT info */}
          {spectrum && (
            <>
              <div className="px-2 py-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  FFT Info
                </span>
              </div>
              <StatRow
                label="FFT Size"
                value={spectrum.fftSize.toLocaleString()}
              />
              <StatRow
                label="Bins"
                value={spectrum.magnitudes.length.toLocaleString()}
              />
              <StatRow
                label="Resolution"
                value={`${spectrum.frequencyResolution.toFixed(2)} Hz/bin`}
              />
              <StatRow label="Nyquist" value={formatFrequency(nyquist)} />
              <StatRow label="Sample Rate" value={`${sampleRate} Hz`} />
              <StatRow
                label="Input Samples"
                value={(samples?.length ?? 0).toLocaleString()}
              />
              <StatRow label="Window" value={windowType} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
