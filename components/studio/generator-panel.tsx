"use client";

import { useState } from "react";
import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { createStudioEffect } from "@/lib/studio-io";
import {
  generateWaveform,
  defaultGeneratorParams,
  type WaveShape,
  type GeneratorParams,
} from "@/lib/dsp/generator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

const SHAPES: WaveShape[] = [
  "sine",
  "square",
  "triangle",
  "sawtooth",
  "noise",
  "impulse",
];

export function GeneratorPanel() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const [params, setParams] = useState<GeneratorParams>(defaultGeneratorParams);
  const [open, setOpen] = useState(false);

  const handleGenerate = () => {
    const samples = generateWaveform(params);
    dispatch({
      type: "ADD_EFFECT",
      effect: {
        ...createStudioEffect(
          {
            id: crypto.randomUUID(),
            name: `gen_${params.shape}_${params.frequency}Hz`,
            samples,
            sampleRate: params.sampleRate,
          },
          state.globalDefaultPlayRateHz,
        ),
        familyTag: "generated",
      },
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs">
          <Sparkles data-icon="inline-start" />
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Waveform</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="w-20 text-[10px] uppercase tracking-wider text-muted-foreground">
              Shape
            </label>
            <Select
              value={params.shape}
              onValueChange={(v) =>
                setParams((p) => ({ ...p, shape: v as WaveShape }))
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SHAPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-20 text-[10px] uppercase tracking-wider text-muted-foreground">
              Freq
            </label>
            <Slider
              min={1}
              max={4000}
              step={1}
              value={[params.frequency]}
              onValueChange={([v]) =>
                setParams((p) => ({ ...p, frequency: v }))
              }
              className="flex-1"
            />
            <span className="w-16 text-right text-xs tabular-nums">
              {params.frequency}Hz
            </span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-20 text-[10px] uppercase tracking-wider text-muted-foreground">
              Amplitude
            </label>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[params.amplitude]}
              onValueChange={([v]) =>
                setParams((p) => ({ ...p, amplitude: v }))
              }
              className="flex-1"
            />
            <span className="w-12 text-right text-xs tabular-nums">
              {params.amplitude.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-20 text-[10px] uppercase tracking-wider text-muted-foreground">
              Duration
            </label>
            <Slider
              min={10}
              max={24000}
              step={10}
              value={[params.duration]}
              onValueChange={([v]) => setParams((p) => ({ ...p, duration: v }))}
              className="flex-1"
            />
            <span className="w-16 text-right text-xs tabular-nums">
              {params.duration} smp
            </span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-20 text-[10px] uppercase tracking-wider text-muted-foreground">
              Phase
            </label>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[params.phase]}
              onValueChange={([v]) => setParams((p) => ({ ...p, phase: v }))}
              className="flex-1"
            />
            <span className="w-12 text-right text-xs tabular-nums">
              {params.phase.toFixed(2)}
            </span>
          </div>

          <Button onClick={handleGenerate}>
            <Sparkles data-icon="inline-start" />
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
