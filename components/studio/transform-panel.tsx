"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import type { TransformType, TransformParams } from "@/lib/dsp/transforms";
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
import { RotateCcw, Trash2 } from "lucide-react";

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
              pts[i] = {
                ...pts[i],
                curve: v as "linear" | "exponential" | "logarithmic",
              };
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
                points: params.points.filter(
                  (_, pointIndex) => pointIndex !== i,
                ),
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

function SpectralFilterControls({
  params,
  onChange,
}: {
  params: TransformParams["spectralFilter"];
  onChange: (p: TransformParams["spectralFilter"]) => void;
}) {
  const pts = [...params.points].sort((a, b) => a.frequency - b.frequency);
  return (
    <div className="space-y-3">
      <label className="text-xs font-medium">Filter Points</label>
      {pts.map((pt, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-xs w-12">Hz</label>
              <Slider
                min={0}
                max={8000}
                step={10}
                value={[pt.frequency]}
                onValueChange={([v]) => {
                  const next = [...pts];
                  next[i] = { ...next[i], frequency: v };
                  onChange({ points: next });
                }}
              />
              <span className="text-xs tabular-nums w-14 text-right">
                {pt.frequency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-12">Gain</label>
              <Slider
                min={0}
                max={2}
                step={0.01}
                value={[pt.gain]}
                onValueChange={([v]) => {
                  const next = [...pts];
                  next[i] = { ...next[i], gain: v };
                  onChange({ points: next });
                }}
              />
              <span className="text-xs tabular-nums w-14 text-right">
                {pt.gain.toFixed(2)}
              </span>
            </div>
          </div>
          {pts.length > 2 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                const next = pts.filter((_, j) => j !== i);
                onChange({ points: next });
              }}
            >
              ×
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const maxFreq = pts.length > 0 ? pts[pts.length - 1].frequency : 4000;
          const newFreq = Math.min(maxFreq + 500, 8000);
          onChange({ points: [...pts, { frequency: newFreq, gain: 1.0 }] });
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
  spectralFilter: SpectralFilterControls as never,
};

export function TransformPanel() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effect = state.effects[state.activeEffectIndex];
  const step = effect?.chain[state.activeTransformIndex];

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
