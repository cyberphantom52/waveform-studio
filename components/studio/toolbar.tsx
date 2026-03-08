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
  Upload,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileAudio,
  FileJson,
  Files,
} from "lucide-react";
import { useCallback, useRef } from "react";
import {
  buildManifest,
  downloadWaveformBin,
  exportManifestBlob,
  exportPresetsBlob,
  importStudioFiles,
  promptDownload,
} from "@/lib/studio-io";

export function Toolbar() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      const imported = await importStudioFiles(
        files,
        state.globalDefaultPlayRateHz,
      );

      if (imported.effects.length > 0) {
        dispatch({ type: "BATCH_ADD_EFFECTS", effects: imported.effects });
      }

      if (Object.keys(imported.metadata).length > 0) {
        dispatch({ type: "SET_METADATA", metadata: imported.metadata });
      }

      if (fileRef.current) fileRef.current.value = "";
    },
    [dispatch, state.globalDefaultPlayRateHz],
  );

  const handleExport = useCallback(() => {
    const effect = state.effects[state.activeEffectIndex];
    if (!effect) return;

    const data = effect.remastered ?? effect.waveform.samples;
    downloadWaveformBin(`${effect.waveform.name}_remastered.bin`, data);
  }, [state]);

  const handleBatchExport = useCallback(() => {
    for (const effect of state.effects) {
      const data = effect.remastered ?? effect.waveform.samples;
      downloadWaveformBin(`${effect.waveform.name}_remastered.bin`, data);
    }
  }, [state.effects]);

  const handleManifestExport = useCallback(async () => {
    const manifest = await buildManifest(state);
    promptDownload("waveform-manifest.json", exportManifestBlob(manifest));
  }, [state]);

  const handlePresetExport = useCallback(() => {
    promptDownload("family-presets.json", exportPresetsBlob(state.presets));
  }, [state.presets]);

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
            disabled={!activeEffect}
          >
            <Download data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export active .bin</TooltipContent>
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
        <TooltipContent>Batch export all .bin</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleManifestExport}
            disabled={state.effects.length === 0}
          >
            <FileJson data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export manifest JSON</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handlePresetExport}
            disabled={state.presets.length === 0}
          >
            <Files data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export presets JSON</TooltipContent>
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
