"use client";

import { useEffect, useState, useRef } from "react";

interface StatItemProps {
  label: string;
  value: number;
  suffix: string;
  decimals?: number;
}

function StatItem({ label, value, suffix, decimals = 0 }: StatItemProps) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (!ref.current || animated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const startTime = Date.now();
          const duration = 1200;

          const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayed(value * eased);

            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="flex flex-col gap-1 p-6">
      <span className="text-3xl font-bold tabular-nums text-white md:text-4xl">
        {displayed.toFixed(decimals)}
        <span className="ml-1 text-lg text-[var(--waveform-remastered)]">
          {suffix}
        </span>
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </span>
    </div>
  );
}

const STATS = [
  { label: "Max Sample Rate", value: 8, suffix: "kHz" },
  { label: "Bit Depth", value: 8, suffix: "bit" },
  { label: "Transform Types", value: 8, suffix: "DSP" },
  { label: "Wave Shapes", value: 6, suffix: "types" },
  { label: "Precision", value: 0.01, suffix: "ms", decimals: 2 },
  { label: "Crossfade Range", value: 200, suffix: "smp" },
];

export function Stats() {
  return (
    <section className="relative bg-[oklch(0.08_0_0)] py-24">
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 flex flex-col gap-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--waveform-remastered)]">
            By the Numbers
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Precision-engineered parameters
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-px bg-neutral-800/30 md:grid-cols-3">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="bg-[oklch(0.08_0_0)] transition-colors hover:bg-[oklch(0.10_0_0)]"
            >
              <StatItem {...stat} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
