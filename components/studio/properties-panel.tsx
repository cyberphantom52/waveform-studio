"use client";

import { useStudio } from "@/lib/studio-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function PropertiesPanel() {
  const state = useStudio();
  const effect = state.effects[state.activeEffectIndex];

  if (!effect) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No selection</p>
      </div>
    );
  }

  const meta = effect.metadata;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Properties
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 py-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </span>
            <span className="text-xs">{effect.waveform.name}</span>
          </div>
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Rate
            </span>
            <span className="text-xs">{effect.waveform.sampleRate}Hz</span>
          </div>
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Length
            </span>
            <span className="text-xs">
              {effect.waveform.samples.length} bytes
            </span>
          </div>

          {meta && (
            <>
              <Separator className="my-1" />
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Effect ID
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {meta.effectId}
                </Badge>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Family
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {meta.family}
                </Badge>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Style
                </span>
                <span className="text-xs">{meta.style}</span>
              </div>
            </>
          )}

          <Separator className="my-1" />
          <div className="px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Transform Chain
            </span>
          </div>
          <div className="px-2">
            {effect.chain.length === 0 ? (
              <span className="text-xs text-muted-foreground">Empty</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {effect.chain.map((step, i) => (
                  <Badge
                    key={i}
                    variant={step.enabled ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {step.type}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {effect.regions.length > 0 && (
            <>
              <Separator className="my-1" />
              <div className="px-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Regions ({effect.regions.length})
                </span>
              </div>
              {effect.regions.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-2">
                  <span className="text-xs tabular-nums">
                    [{r.start}-{r.end}]
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    xfade: {r.crossfadeSamples}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
