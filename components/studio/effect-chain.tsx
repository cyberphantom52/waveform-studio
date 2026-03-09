"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import type { TransformType } from "@/lib/dsp/transforms";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  Volume2,
  Music,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Scissors,
  Waves,
  CircleDot,
  Filter,
  Maximize2,
  MinusCircle,
  RefreshCw,
  Minus,
  ArrowRightLeft,
  Grid3x3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TRANSFORM_ICONS: Record<TransformType, React.ElementType> = {
  gain: Volume2,
  pitch: Music,
  envelope: TrendingUp,
  attack: ArrowUpRight,
  decay: ArrowDownRight,
  tailTrim: Scissors,
  smoothing: Waves,
  deadzone: CircleDot,
  spectralFilter: Filter,
  normalize: Maximize2,
  dcOffset: MinusCircle,
  invert: RefreshCw,
  clamp: Minus,
  reverse: ArrowRightLeft,
  quantize: Grid3x3,
};

const TRANSFORM_LABELS: Record<TransformType, string> = {
  gain: "Gain",
  pitch: "Pitch Shift",
  envelope: "Envelope",
  attack: "Attack",
  decay: "Decay",
  tailTrim: "Tail Trim",
  smoothing: "Smoothing",
  deadzone: "Deadzone",
  spectralFilter: "Spectral Filter",
  normalize: "Normalize",
  dcOffset: "DC Offset Remove",
  invert: "Invert",
  clamp: "Clamp",
  reverse: "Reverse",
  quantize: "Quantize",
};

const ALL_TRANSFORMS: TransformType[] = [
  "gain",
  "pitch",
  "envelope",
  "attack",
  "decay",
  "tailTrim",
  "smoothing",
  "deadzone",
  "spectralFilter",
  "normalize",
  "dcOffset",
  "invert",
  "clamp",
  "reverse",
  "quantize",
];

export function EffectChain() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effect = state.effects[state.activeEffectIndex];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Effect Chain
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" disabled={!effect}>
              <Plus data-icon="inline-start" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {ALL_TRANSFORMS.map((t) => {
                const Icon = TRANSFORM_ICONS[t];
                return (
                  <DropdownMenuItem
                    key={t}
                    onClick={() =>
                      dispatch({ type: "ADD_TRANSFORM", transformType: t })
                    }
                  >
                    <Icon data-icon="inline-start" />
                    {TRANSFORM_LABELS[t]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        {!effect ? (
          <div className="flex h-32 items-center justify-center p-4">
            <p className="text-center text-xs text-muted-foreground">
              Import a .bin file to begin
            </p>
          </div>
        ) : effect.chain.length === 0 ? (
          <div className="flex h-32 items-center justify-center p-4">
            <p className="text-center text-xs text-muted-foreground">
              No transforms. Click + to add.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {effect.chain.map((step, i) => {
              const Icon = TRANSFORM_ICONS[step.type];
              const isActive = i === state.activeTransformIndex;
              return (
                <div key={i}>
                  <div
                    className={cn(
                      "group flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                    onClick={() =>
                      dispatch({ type: "SET_ACTIVE_TRANSFORM", index: i })
                    }
                  >
                    <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    <Icon className="size-3" />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        !step.enabled && "line-through opacity-50",
                      )}
                    >
                      {TRANSFORM_LABELS[step.type]}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "TOGGLE_TRANSFORM", index: i });
                      }}
                    >
                      {step.enabled ? (
                        <Eye className="size-3" />
                      ) : (
                        <EyeOff className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "REMOVE_TRANSFORM", index: i });
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  {i < effect.chain.length - 1 && <Separator />}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
