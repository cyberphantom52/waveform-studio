"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { getRegionLength, getRegionSourceLength } from "@/lib/dsp/region";
import { createStudioEffectFromRegion } from "@/lib/studio-io";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Waves } from "lucide-react";

export function RegionEditor() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effect = state.effects[state.activeEffectIndex];

  if (!effect) return null;

  const selectedRegion =
    effect.regions.find((region) => region.id === state.selectedRegionId) ?? null;
  const selectedLength = selectedRegion
    ? getRegionLength(selectedRegion)
    : 0;
  const selectedSourceLength = selectedRegion
    ? getRegionSourceLength(selectedRegion)
    : 0;
  const selectedDurationMs = selectedRegion
    ? (selectedLength / effect.waveform.sampleRate) * 1000
    : 0;

  const bounceSelectedRegion = () => {
    if (!selectedRegion) return;
    dispatch({
      type: "ADD_EFFECT",
      effect: createStudioEffectFromRegion(effect, selectedRegion),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Selected Clip
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => dispatch({ type: "CLEAR_REGIONS" })}
          disabled={effect.regions.length === 0}
        >
          Reset Track
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {!selectedRegion ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-4 text-center">
            <Waves className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Select a clip on the timeline to inspect it. Place the cursor on the waveform and press `C` to split clips.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {selectedRegion.name}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {selectedLength} smp
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {selectedDurationMs.toFixed(selectedDurationMs >= 100 ? 0 : 2)} ms
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Timeline Start
                </div>
                <div className="tabular-nums">{selectedRegion.timelineStart}</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Source Range
                </div>
                <div className="tabular-nums">
                  {selectedRegion.start}–{selectedRegion.end}
                </div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Timeline Length
                </div>
                <div className="tabular-nums">{selectedLength}</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Source Length
                </div>
                <div className="tabular-nums">{selectedSourceLength}</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Transforms
                </div>
                <div className="tabular-nums">{selectedRegion.chain.length}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="xs" onClick={bounceSelectedRegion}>
                Create Waveform
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => dispatch({ type: "REMOVE_REGION", id: selectedRegion.id })}
              >
                <Trash2 data-icon="inline-start" />
                Delete Clip
              </Button>
            </div>

            <Separator />

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Track Clips
              </span>
              {effect.regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
                    region.id === selectedRegion.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => dispatch({ type: "SET_SELECTED_REGION", id: region.id })}
                >
                  <Badge variant="outline" className="text-[10px]">
                    {region.name}
                  </Badge>
                  <span className="tabular-nums text-muted-foreground">
                    @{region.timelineStart}
                  </span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {getRegionLength(region)} smp
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
