"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  const animate = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    svg.attr("width", w).attr("height", h);

    const now = Date.now();

    const lineCount = 5;
    const lines = d3.range(lineCount).map((idx) => {
      const points = d3.range(0, w, 2).map((x) => {
        const t = now / 1000;
        const freq1 = 0.003 + idx * 0.001;
        const freq2 = 0.007 - idx * 0.0008;
        const amp = (h * 0.12) / (1 + idx * 0.3);
        const phase = idx * 0.8;
        const y =
          h / 2 +
          Math.sin(x * freq1 + t * (0.8 + idx * 0.2) + phase) * amp +
          Math.sin(x * freq2 + t * 1.2 + phase * 2) * amp * 0.5 +
          Math.cos(x * 0.001 + t * 0.3) * amp * 0.3;
        return [x, y] as [number, number];
      });
      return { points, idx };
    });

    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "wave-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");
    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "var(--waveform-remastered)")
      .attr("stop-opacity", 0);
    gradient
      .append("stop")
      .attr("offset", "30%")
      .attr("stop-color", "var(--waveform-remastered)")
      .attr("stop-opacity", 1);
    gradient
      .append("stop")
      .attr("offset", "70%")
      .attr("stop-color", "var(--waveform-remastered)")
      .attr("stop-opacity", 1);
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "var(--waveform-remastered)")
      .attr("stop-opacity", 0);

    const line = d3
      .line()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(d3.curveBasis);

    for (const { points, idx } of lines) {
      svg
        .append("path")
        .datum(points)
        .attr("fill", "none")
        .attr("stroke", "url(#wave-gradient)")
        .attr("stroke-width", 1.5 - idx * 0.15)
        .attr("opacity", 0.35 - idx * 0.06)
        .attr("d", line as never);
    }

    // Horizontal center grid line
    svg
      .append("line")
      .attr("x1", 0)
      .attr("x2", w)
      .attr("y1", h / 2)
      .attr("y2", h / 2)
      .attr("stroke", "var(--waveform-grid)")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.3);

    frameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [animate]);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.08_0_0)]">
      {/* Animated waveform background */}
      <div
        ref={containerRef}
        className="pointer-events-none absolute inset-0"
      >
        <svg ref={svgRef} className="h-full w-full" />
      </div>

      {/* Scanline texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex max-w-4xl flex-col items-center gap-8 px-6 text-center">
        {/* Overline */}
        <div className="flex items-center gap-3">
          <div className="h-px w-12 bg-[var(--waveform-remastered)]" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--waveform-remastered)]">
            Haptic DSP Workbench
          </span>
          <div className="h-px w-12 bg-[var(--waveform-remastered)]" />
        </div>

        {/* Title with staggered character animation */}
        <h1 className="flex flex-col items-center gap-2 leading-none">
          <span className="flex">
            {"WAVEFORM".split("").map((char, i) => (
              <span
                key={`w-${i}`}
                className="inline-block animate-in fade-in slide-in-from-bottom-4 fill-mode-both text-[clamp(3rem,10vw,7rem)] font-bold tracking-[-0.02em] text-white"
                style={{ animationDelay: `${i * 60}ms`, animationDuration: "600ms" }}
              >
                {char}
              </span>
            ))}
          </span>
          <span
            className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both text-[clamp(1.5rem,4vw,3rem)] font-light tracking-[0.2em] text-[var(--waveform-remastered)]"
            style={{ animationDelay: "500ms", animationDuration: "600ms" }}
          >
            STUDIO
          </span>
        </h1>

        {/* Description */}
        <p
          className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both max-w-lg text-sm leading-relaxed text-neutral-400"
          style={{ animationDelay: "600ms", animationDuration: "600ms" }}
        >
          Browser-based waveform remastering tool for tuning OPlus vibrator
          haptic effect .bin files. Import, visualize, transform, and export
          haptic waveforms with precision DSP tools.
        </p>

        {/* CTA */}
        <div
          className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both flex gap-4"
          style={{ animationDelay: "800ms", animationDuration: "600ms" }}
        >
          <Button
            asChild
            className="h-11 bg-[var(--waveform-remastered)] px-6 text-xs uppercase tracking-widest text-black hover:bg-[var(--waveform-remastered)]/80"
          >
            <Link href="/studio">
              Open Studio
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="h-11 border-neutral-700 px-6 text-xs uppercase tracking-widest text-neutral-300 hover:border-neutral-500 hover:text-white"
          >
            <a href="#features">Explore Features</a>
          </Button>
        </div>

        {/* Version badge */}
        <span
          className="animate-in fade-in fill-mode-both text-[10px] tracking-wider text-neutral-600"
          style={{ animationDelay: "1000ms", animationDuration: "600ms" }}
        >
          v1.0.0 // built for haptics engineers
        </span>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-32 bg-gradient-to-t from-[oklch(0.08_0_0)] to-transparent" />
    </section>
  );
}
