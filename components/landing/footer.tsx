import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-neutral-800/50 bg-[oklch(0.06_0_0)] py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 text-center">
        <div className="flex items-center gap-3">
          <div className="h-px w-8 bg-neutral-700" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">
            Waveform Studio
          </span>
          <div className="h-px w-8 bg-neutral-700" />
        </div>

        <p className="text-xs text-neutral-600">
          Built for haptics engineers. Browser-based DSP workbench for Android
          vibration motor waveforms.
        </p>

        <Link
          href="/studio"
          className="text-[10px] uppercase tracking-[0.2em] text-[var(--waveform-remastered)] transition-opacity hover:opacity-70"
        >
          Launch Studio &rarr;
        </Link>

        <div className="mt-8 flex items-center gap-4 text-[10px] text-neutral-700">
          <span>v1.0.0</span>
          <span>&middot;</span>
          <span>Next.js + D3 + shadcn/ui</span>
          <span>&middot;</span>
          <span>OPlus Haptics</span>
        </div>
      </div>
    </footer>
  );
}
