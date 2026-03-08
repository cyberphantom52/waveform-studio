"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import type { TransformType, TransformParams } from "@/lib/dsp/transforms";
import { applyTransformChain } from "@/lib/dsp/transforms";
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
import { Play } from "lucide-react";
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
        max={2000}
        step={10}
        value={[params.samples]}
        onValueChange={([v]) => onChange({ samples: v })}
        className="flex-1"
      />
      <span className="w-16 text-right text-xs tabular-nums">
        {params.samples} smp
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
        max={2000}
        step={10}
        value={[params.samples]}
        onValueChange={([v]) => onChange({ samples: v })}
        className="flex-1"
      />
      <span className="w-16 text-right text-xs tabular-nums">
        {params.samples} smp
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
              onChange({ points: pts });
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
        </div>
      ))}
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          const pts = [
            ...params.points,
            { position: 0.5, amplitude: 1, curve: "linear" as const },
          ];
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
  const effect = state.effects[state.activeEffectIndex];
  const step = effect?.chain[state.activeTransformIndex];

  const applyChain = useCallback(() => {
    if (!effect) return;
    const { result } = applyTransformChain(
      effect.waveform.samples,
      effect.chain
    );
    dispatch({ type: "SET_REMASTERED", data: result });
  }, [effect, dispatch]);

  useEffect(() => {
    if (effect && effect.chain.length > 0) {
      const timer = setTimeout(applyChain, 100);
      return () => clearTimeout(timer);
    }
  }, [effect?.chain, applyChain]);

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
          Apply Chain
        </Button>
      </div>
    );
  }

  const Controls = CONTROLS[step.type];

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
        <div className="ml-auto">
          <Button variant="outline" size="xs" onClick={applyChain}>
            <Play data-icon="inline-start" />
            Apply
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
