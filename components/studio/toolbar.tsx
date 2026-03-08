"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { parseBinFile, parseEffectJson } from "@/lib/dsp/waveform";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileAudio,
} from "lucide-react";
import { useCallback, useRef } from "react";

export function Toolbar() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newEffects = [];
      let metadataJson: Record<string, unknown> | null = null;

      for (const file of Array.from(files)) {
        if (file.name.endsWith(".json")) {
          const text = await file.text();
          metadataJson = parseEffectJson(text);
          continue;
        }

        if (file.name.endsWith(".bin")) {
          const buffer = await file.arrayBuffer();
          const waveform = parseBinFile(buffer, file.name);
          newEffects.push({
            waveform,
            chain: [],
            regions: [],
            remastered: null,
          });
        }
      }

      if (newEffects.length > 0) {
        dispatch({ type: "BATCH_ADD_EFFECTS", effects: newEffects });
      }

      if (metadataJson) {
        dispatch({
          type: "SET_METADATA",
          metadata: metadataJson as Parameters<
            typeof dispatch
          >[0] extends { type: "SET_METADATA"; metadata: infer M }
            ? M
            : never,
        });
      }

      if (fileRef.current) fileRef.current.value = "";
    },
    [dispatch]
  );

  const handleExport = useCallback(() => {
    const effect = state.effects[state.activeEffectIndex];
    if (!effect?.remastered) return;

    const blob = new Blob([effect.remastered.buffer as ArrayBuffer], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${effect.waveform.name}_remastered.bin`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const handleBatchExport = useCallback(() => {
    for (const effect of state.effects) {
      const data = effect.remastered ?? effect.waveform.samples;
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${effect.waveform.name}_remastered.bin`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [state.effects]);

  const activeEffect = state.effects[state.activeEffectIndex];

  return (
    <div className="flex h-9 items-center gap-1 border-b border-border bg-card px-2">
      <FileAudio className="size-4 text-muted-foreground" />
      <span className="text-xs font-medium tracking-wider text-foreground uppercase">
        WAVEFORM
      </span>
      <Separator orientation="vertical" className="mx-1 h-4" />

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".bin,.json"
        className="hidden"
        onChange={handleImport}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => fileRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import .bin / .json</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleExport}
            disabled={!activeEffect?.remastered}
          >
            <Download data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export active</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleBatchExport}
            disabled={state.effects.length === 0}
          >
            <Download data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Batch export all</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-4" />

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

      <Separator orientation="vertical" className="mx-1 h-4" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              const z = state.zoom;
              const range = z.end - z.start;
              const center = (z.start + z.end) / 2;
              const newRange = range * 0.5;
              dispatch({
                type: "SET_ZOOM",
                start: Math.max(0, center - newRange / 2),
                end: Math.min(1, center + newRange / 2),
              });
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
              const z = state.zoom;
              const range = z.end - z.start;
              const center = (z.start + z.end) / 2;
              const newRange = Math.min(1, range * 2);
              dispatch({
                type: "SET_ZOOM",
                start: Math.max(0, center - newRange / 2),
                end: Math.min(1, center + newRange / 2),
              });
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
            onClick={() =>
              dispatch({ type: "SET_ZOOM", start: 0, end: 1 })
            }
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
          </>
        )}
        <Badge variant="outline" className="text-[10px]">
          {state.effects.length} effects loaded
        </Badge>
      </div>
    </div>
  );
}
