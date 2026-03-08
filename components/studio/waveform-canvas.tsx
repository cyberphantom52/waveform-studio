"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { computeDelta } from "@/lib/dsp/stats";
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function WaveformCanvas() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effect = state.effects[state.activeEffectIndex];

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    svg.attr("width", width).attr("height", height);

    if (!effect) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--muted-foreground)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", "11px")
        .text("Import .bin files to visualize waveforms");
      return;
    }

    const original = effect.waveform.samples;
    const remastered = effect.remastered ?? original;
    const totalSamples = original.length;

    const startSample = Math.floor(state.zoom.start * totalSamples);
    const endSample = Math.ceil(state.zoom.end * totalSamples);
    const visibleOriginal = original.slice(startSample, endSample);
    const visibleRemastered = remastered.slice(
      startSample,
      Math.min(endSample, remastered.length)
    );

    const margin = { top: 8, right: 8, bottom: 20, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleLinear()
      .domain([0, visibleOriginal.length - 1])
      .range([0, innerW]);

    const yScale = d3.scaleLinear().domain([0, 255]).range([innerH, 0]);

    // Grid lines
    const yTicks = [0, 64, 128, 192, 255];
    g.selectAll(".grid-line")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "var(--waveform-grid)")
      .attr("stroke-width", 0.5);

    // Center line (128)
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", yScale(128))
      .attr("y2", yScale(128))
      .attr("stroke", "var(--waveform-grid)")
      .attr("stroke-width", 1);

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(yScale)
          .tickValues(yTicks)
          .tickSize(-innerW)
          .tickFormat((d) => String(d))
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "none")
      )
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--muted-foreground)")
          .attr("font-size", "9px")
      );

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(Math.min(10, visibleOriginal.length))
          .tickFormat((d) => String(startSample + Number(d)))
      )
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--muted-foreground)")
          .attr("font-size", "9px")
      )
      .call((g) =>
        g.selectAll(".tick line").attr("stroke", "var(--border)")
      );

    const line = d3
      .line<number>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d))
      .curve(d3.curveMonotoneX);

    const showOriginal =
      state.viewMode === "original" || state.viewMode === "overlay";
    const showRemastered =
      state.viewMode === "remastered" || state.viewMode === "overlay";
    const showDiff = state.viewMode === "diff";

    if (showDiff) {
      const delta = computeDelta(
        visibleOriginal,
        new Uint8Array(visibleRemastered)
      );
      const deltaLine = d3
        .line<number>()
        .x((_, i) => xScale(i))
        .y((d) =>
          d3.scaleLinear().domain([-128, 128]).range([innerH, 0])(d)
        )
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(Array.from(delta))
        .attr("fill", "none")
        .attr("stroke", "var(--waveform-delta)")
        .attr("stroke-width", 1.2)
        .attr("d", deltaLine);
    } else {
      if (showOriginal) {
        g.append("path")
          .datum(Array.from(visibleOriginal))
          .attr("fill", "none")
          .attr("stroke", "var(--waveform-original)")
          .attr("stroke-width", 1)
          .attr("opacity", state.viewMode === "overlay" ? 0.6 : 1)
          .attr("d", line);
      }

      if (showRemastered && effect.remastered) {
        g.append("path")
          .datum(Array.from(visibleRemastered))
          .attr("fill", "none")
          .attr("stroke", "var(--waveform-remastered)")
          .attr("stroke-width", 1.2)
          .attr("d", line);
      }
    }

    // Regions overlay
    for (const region of effect.regions) {
      const regionStartVisible = Math.max(0, region.start - startSample);
      const regionEndVisible = Math.min(
        visibleOriginal.length,
        region.end - startSample
      );
      if (regionEndVisible <= 0 || regionStartVisible >= visibleOriginal.length)
        continue;

      g.append("rect")
        .attr("x", xScale(regionStartVisible))
        .attr("y", 0)
        .attr("width", xScale(regionEndVisible) - xScale(regionStartVisible))
        .attr("height", innerH)
        .attr("fill", "var(--waveform-accent)")
        .attr("opacity", 0.08);

      g.append("line")
        .attr("x1", xScale(regionStartVisible))
        .attr("x2", xScale(regionStartVisible))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "var(--waveform-accent)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.4);

      g.append("line")
        .attr("x1", xScale(regionEndVisible))
        .attr("x2", xScale(regionEndVisible))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "var(--waveform-accent)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.4);
    }
  }, [effect, state.viewMode, state.zoom]);

  useEffect(() => {
    render();
    const observer = new ResizeObserver(render);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Waveform
        </span>
        <div className="ml-auto">
          <ToggleGroup
            type="single"
            value={state.viewMode}
            onValueChange={(v) => {
              if (v) dispatch({ type: "SET_VIEW_MODE", mode: v as typeof state.viewMode });
            }}
            className="gap-0"
          >
            <ToggleGroupItem value="original" className="h-5 px-1.5 text-[10px]">
              OG
            </ToggleGroupItem>
            <ToggleGroupItem value="remastered" className="h-5 px-1.5 text-[10px]">
              RM
            </ToggleGroupItem>
            <ToggleGroupItem value="diff" className="h-5 px-1.5 text-[10px]">
              DF
            </ToggleGroupItem>
            <ToggleGroupItem value="overlay" className="h-5 px-1.5 text-[10px]">
              OV
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full"
          style={{ background: "var(--background)" }}
        />
      </div>
    </div>
  );
}
