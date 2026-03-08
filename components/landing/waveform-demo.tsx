"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import { generateWaveform } from "@/lib/dsp/generator";
import { toFloat, applyGain, applySmoothing, toUint8 } from "@/lib/dsp/transforms";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

export function WaveformDemo() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [gain, setGain] = useState(1.0);
  const [smoothing, setSmoothing] = useState(1);
  const [frequency, setFrequency] = useState(150);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = 200;
    svg.attr("width", w).attr("height", h);

    const original = generateWaveform({
      shape: "sine",
      frequency,
      amplitude: 0.6,
      duration: 400,
      sampleRate: 8000,
      phase: 0,
    });

    let processed = toFloat(original);
    processed = applyGain(processed, gain).result;
    if (smoothing > 1) processed = applySmoothing(processed, smoothing);
    const remastered = toUint8(processed);

    const margin = { top: 8, right: 8, bottom: 8, left: 8 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, original.length - 1]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 255]).range([innerH, 0]);

    // Center line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(128))
      .attr("y2", y(128))
      .attr("stroke", "var(--waveform-grid)")
      .attr("stroke-width", 0.5);

    const line = d3
      .line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    // Original
    g.append("path")
      .datum(Array.from(original))
      .attr("fill", "none")
      .attr("stroke", "var(--waveform-original)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.4)
      .attr("d", line);

    // Remastered
    g.append("path")
      .datum(Array.from(remastered))
      .attr("fill", "none")
      .attr("stroke", "var(--waveform-remastered)")
      .attr("stroke-width", 1.5)
      .attr("d", line);
  }, [gain, smoothing, frequency]);

  useEffect(() => {
    render();
    const observer = new ResizeObserver(render);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [render]);

  return (
    <section className="relative bg-[oklch(0.06_0_0)] py-32">
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />

      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-12 flex flex-col gap-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--waveform-remastered)]">
            Interactive Demo
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Transform in real-time
          </h2>
          <p className="max-w-md text-sm text-neutral-500">
            Drag the sliders to see gain, smoothing, and frequency transforms
            applied live.
          </p>
        </div>

        {/* Waveform display */}
        <div
          ref={containerRef}
          className="mb-8 border border-neutral-800 bg-[oklch(0.08_0_0)]"
        >
          <svg ref={svgRef} />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                Gain
              </span>
              <Badge variant="outline" className="text-[10px] tabular-nums text-neutral-400">
                {gain.toFixed(2)}x
              </Badge>
            </div>
            <Slider
              min={0}
              max={4}
              step={0.01}
              value={[gain]}
              onValueChange={([v]) => setGain(v)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                Smoothing
              </span>
              <Badge variant="outline" className="text-[10px] tabular-nums text-neutral-400">
                {smoothing}
              </Badge>
            </div>
            <Slider
              min={1}
              max={32}
              step={2}
              value={[smoothing]}
              onValueChange={([v]) => setSmoothing(v)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                Frequency
              </span>
              <Badge variant="outline" className="text-[10px] tabular-nums text-neutral-400">
                {frequency}Hz
              </Badge>
            </div>
            <Slider
              min={10}
              max={2000}
              step={10}
              value={[frequency]}
              onValueChange={([v]) => setFrequency(v)}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-px w-6 bg-[var(--waveform-original)] opacity-40" />
            <span className="text-[10px] text-neutral-600">Original</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px w-6 bg-[var(--waveform-remastered)]" />
            <span className="text-[10px] text-neutral-600">Remastered</span>
          </div>
        </div>
      </div>
    </section>
  );
}
