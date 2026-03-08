"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import type { TransformType, TransformParams } from "@/lib/dsp/transforms";
import { computeRemasteredWaveform } from "@/lib/dsp/remaster";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Play, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect } from "react";

function GainControls({
  params,
  onChange,
}: {
  params: TransformParams["gain"];
  onChange: (p: TransformParams["gain"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Gain
      </label>
      <Slider
        min={0}
        max={4}
        step={0.01}
        value={[params.value]}
        onValueChange={([v]) => onChange({ value: v })}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs tabular-nums">
        {params.value.toFixed(2)}x
      </span>
    </div>
  );
}

function PitchControls({
  params,
  onChange,
}: {
  params: TransformParams["pitch"];
  onChange: (p: TransformParams["pitch"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Semitones
      </label>
      <Slider
        min={-24}
        max={24}
        step={1}
        value={[params.semitones]}
        onValueChange={([v]) => onChange({ semitones: v })}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs tabular-nums">
        {params.semitones > 0 ? "+" : ""}
        {params.semitones}
      </span>
    </div>
  );
}

function AttackControls({
  params,
  onChange,
}: {
  params: TransformParams["attack"];
  onChange: (p: TransformParams["attack"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Attack
      </label>
      <Slider
        min={0}
        max={500}
        step={1}
        value={[params.durationMs]}
        onValueChange={([v]) => onChange({ durationMs: v })}
        className="flex-1"
      />
      <span className="w-16 text-right text-xs tabular-nums">
        {params.durationMs}ms
      </span>
    </div>
  );
}

function DecayControls({
  params,
  onChange,
}: {
  params: TransformParams["decay"];
  onChange: (p: TransformParams["decay"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Decay
      </label>
      <Slider
        min={0}
        max={500}
        step={1}
        value={[params.durationMs]}
        onValueChange={([v]) => onChange({ durationMs: v })}
        className="flex-1"
      />
      <span className="w-16 text-right text-xs tabular-nums">
        {params.durationMs}ms
      </span>
    </div>
  );
}

function TailTrimControls({
  params,
  onChange,
}: {
  params: TransformParams["tailTrim"];
  onChange: (p: TransformParams["tailTrim"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Thresh
      </label>
      <Slider
        min={0}
        max={64}
        step={1}
        value={[params.threshold]}
        onValueChange={([v]) => onChange({ threshold: v })}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs tabular-nums">
        {params.threshold}
      </span>
    </div>
  );
}

function SmoothingControls({
  params,
  onChange,
}: {
  params: TransformParams["smoothing"];
  onChange: (p: TransformParams["smoothing"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Window
      </label>
      <Slider
        min={1}
        max={64}
        step={2}
        value={[params.windowSize]}
        onValueChange={([v]) => onChange({ windowSize: v })}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs tabular-nums">
        {params.windowSize}
      </span>
    </div>
  );
}

function DeadzoneControls({
  params,
  onChange,
}: {
  params: TransformParams["deadzone"];
  onChange: (p: TransformParams["deadzone"]) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
        Thresh
      </label>
      <Slider
        min={0}
        max={64}
        step={1}
        value={[params.threshold]}
        onValueChange={([v]) => onChange({ threshold: v })}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs tabular-nums">
        {params.threshold}
      </span>
    </div>
  );
}

function EnvelopeControls({
  params,
  onChange,
}: {
  params: TransformParams["envelope"];
  onChange: (p: TransformParams["envelope"]) => void;
}) {
  const sortPoints = (points: TransformParams["envelope"]["points"]) =>
    [...points].sort((left, right) => left.position - right.position);

  return (
    <div className="flex flex-col gap-2">
      {params.points.map((pt, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-8 text-[10px] text-muted-foreground">P{i}</span>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[pt.position]}
            onValueChange={([v]) => {
              const pts = [...params.points];
              pts[i] = { ...pts[i], position: v };
              onChange({ points: sortPoints(pts) });
            }}
            className="flex-1"
          />
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={[pt.amplitude]}
            onValueChange={([v]) => {
              const pts = [...params.points];
              pts[i] = { ...pts[i], amplitude: v };
              onChange({ points: pts });
            }}
            className="flex-1"
          />
          <Select
            value={pt.curve}
            onValueChange={(v) => {
              const pts = [...params.points];
              pts[i] = { ...pts[i], curve: v as "linear" | "exponential" | "logarithmic" };
              onChange({ points: pts });
            }}
          >
            <SelectTrigger className="h-6 w-20 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="exponential">Exp</SelectItem>
                <SelectItem value="logarithmic">Log</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={params.points.length <= 2}
            onClick={() =>
              onChange({
                points: params.points.filter((_, pointIndex) => pointIndex !== i),
              })
            }
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          const pts = sortPoints([
            ...params.points,
            { position: 0.5, amplitude: 1, curve: "linear" as const },
          ]);
          onChange({ points: pts });
        }}
      >
        Add Point
      </Button>
    </div>
  );
}

const CONTROLS: Record<
  TransformType,
  React.ComponentType<{ params: never; onChange: (p: never) => void }>
> = {
  gain: GainControls as never,
  pitch: PitchControls as never,
  envelope: EnvelopeControls as never,
  attack: AttackControls as never,
  decay: DecayControls as never,
  tailTrim: TailTrimControls as never,
  smoothing: SmoothingControls as never,
  deadzone: DeadzoneControls as never,
};

export function TransformPanel() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effectIndex = state.activeEffectIndex;
  const effect = state.effects[effectIndex];
  const step = effect?.chain[state.activeTransformIndex];

  const applyChain = useCallback(() => {
    if (!effect || effectIndex < 0) return;
    const remaster = computeRemasteredWaveform(
      effect.waveform.samples,
      effect.waveform.sampleRate,
      effect.chain,
      effect.regions
    );
    dispatch({
      type: "SET_REMASTERED",
      index: effectIndex,
      data: remaster.result,
      remasterInfo: {
        clippedSamples: remaster.clippedSamples,
        originalStats: remaster.originalStats,
        remasteredStats: remaster.remasteredStats,
        updatedAt: Date.now(),
      },
    });
  }, [dispatch, effect, effectIndex]);

  useEffect(() => {
    if (effect && effectIndex >= 0) {
      const timer = setTimeout(applyChain, 100);
      return () => clearTimeout(timer);
    }
  }, [effect, effectIndex, applyChain]);

  if (!effect) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No effect selected</p>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex h-full items-center justify-center gap-3">
        <p className="text-xs text-muted-foreground">
          Select a transform from the chain
        </p>
        <Button variant="outline" size="xs" onClick={applyChain}>
          <Play data-icon="inline-start" />
          Preview
        </Button>
      </div>
    );
  }

  const Controls = CONTROLS[step.type];
  const clippedSamples = effect.remasterInfo?.clippedSamples ?? 0;

  return (
    <div className="flex h-full flex-col gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] uppercase">
          {step.type}
        </Badge>
        <Badge
          variant={step.enabled ? "default" : "outline"}
          className="text-[10px]"
        >
          {step.enabled ? "ON" : "OFF"}
        </Badge>
        <Badge
          variant={clippedSamples > 0 ? "default" : "outline"}
          className="text-[10px]"
        >
          Clip {clippedSamples}
        </Badge>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="xs"
            onClick={() => dispatch({ type: "RESET_TRANSFORMS" })}
            disabled={effect.chain.length === 0}
          >
            <RotateCcw data-icon="inline-start" />
            Reset All
          </Button>
        </div>
        <div>
          <Button variant="outline" size="xs" onClick={applyChain}>
            <Play data-icon="inline-start" />
            Preview
          </Button>
        </div>
      </div>
      <Controls
        params={step.params as never}
        onChange={(p: never) => {
          dispatch({
            type: "UPDATE_TRANSFORM_PARAMS",
            index: state.activeTransformIndex,
            params: p,
          });
        }}
      />
    </div>
  );
}
