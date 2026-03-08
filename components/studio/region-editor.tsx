"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

export function RegionEditor() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effect = state.effects[state.activeEffectIndex];

  if (!effect) return null;

  const sampleCount = effect.waveform.samples.length;

  const addRegion = () => {
    const start = Math.floor(sampleCount * 0.25);
    const end = Math.floor(sampleCount * 0.75);
    dispatch({
      type: "ADD_REGION",
      region: {
        id: crypto.randomUUID(),
        start,
        end,
        chain: [],
        crossfadeSamples: 20,
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Regions
        </span>
        <Button variant="ghost" size="icon-xs" onClick={addRegion}>
          <Plus data-icon="inline-start" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {effect.regions.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">No regions</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            {effect.regions.map((region) => (
              <div
                key={region.id}
                className="flex flex-col gap-1 border border-border p-2"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    [{region.start} - {region.end}]
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      dispatch({
                        type: "REMOVE_REGION",
                        id: region.id,
                      })
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Start
                  </span>
                  <Slider
                    min={0}
                    max={sampleCount}
                    step={1}
                    value={[region.start]}
                    onValueChange={([v]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: { ...region, start: v },
                      })
                    }
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    End
                  </span>
                  <Slider
                    min={0}
                    max={sampleCount}
                    step={1}
                    value={[region.end]}
                    onValueChange={([v]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: { ...region, end: v },
                      })
                    }
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Xfade
                  </span>
                  <Slider
                    min={0}
                    max={200}
                    step={1}
                    value={[region.crossfadeSamples]}
                    onValueChange={([v]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: { ...region, crossfadeSamples: v },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-[10px] tabular-nums">
                    {region.crossfadeSamples}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
