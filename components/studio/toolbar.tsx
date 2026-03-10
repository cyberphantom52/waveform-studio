"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileAudio,
} from "lucide-react";
import { scaleZoomWindow } from "@/lib/zoom";

export function Toolbar() {
  const state = useStudio();
  const dispatch = useStudioDispatch();

  const activeEffect = state.effects[state.activeEffectIndex];

  return (
    <div className="flex h-9 items-center gap-1 border-b border-border bg-card px-2">
      <FileAudio className="size-4 text-muted-foreground" />
      <span className="text-xs font-medium tracking-wider text-foreground uppercase">
        WAVEFORM
      </span>
      <Separator orientation="vertical" className="mx-1 h-4 self-center" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dispatch({ type: "UNDO" })}
            disabled={state.undoStack.length === 0}
          >
            <Undo2 data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dispatch({ type: "REDO" })}
            disabled={state.redoStack.length === 0}
          >
            <Redo2 data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-4 self-center" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              const nextZoom = scaleZoomWindow(state.zoom, 0.5);
              dispatch({ type: "SET_ZOOM", ...nextZoom });
            }}
          >
            <ZoomIn data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom in</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              const nextZoom = scaleZoomWindow(state.zoom, 2);
              dispatch({ type: "SET_ZOOM", ...nextZoom });
            }}
          >
            <ZoomOut data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom out</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dispatch({ type: "SET_ZOOM", start: 0, end: 1 })}
          >
            <Maximize2 data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit to view</TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        {activeEffect && (
          <>
            <Badge variant="secondary" className="text-[10px]">
              {activeEffect.waveform.name}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {activeEffect.waveform.samples.length} samples
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {activeEffect.playRateHz}Hz play
            </Badge>
          </>
        )}
        <Badge variant="outline" className="text-[10px]">
          {state.effects.length} effects loaded
        </Badge>
      </div>
    </div>
  );
}
