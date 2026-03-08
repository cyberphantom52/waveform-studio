"use client";

import { useStudio } from "@/lib/studio-context";
import { useStudioDispatch } from "@/lib/studio-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

export function PropertiesPanel() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effect = state.effects[state.activeEffectIndex];
  const [presetName, setPresetName] = useState("");
  const currentFamilyTag = effect?.familyTag.trim() || "ungrouped";
  const familyPresets = useMemo(
    () =>
      state.presets.filter((preset) => preset.familyTag === currentFamilyTag),
    [currentFamilyTag, state.presets]
  );

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
          <div className="px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </span>
            <p className="mt-1 text-xs">{effect.waveform.name}</p>
          </div>

          <div className="px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Family Tag
            </span>
            <Input
              className="mt-1 h-8"
              value={effect.familyTag}
              onChange={(event) =>
                dispatch({
                  type: "UPDATE_EFFECT",
                  index: state.activeEffectIndex,
                  patch: { familyTag: event.target.value },
                })
              }
            />
          </div>

          <div className="px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Play Rate
            </span>
            <Input
              className="mt-1 h-8"
              type="number"
              min={1}
              value={effect.playRateHz}
              onChange={(event) =>
                dispatch({
                  type: "UPDATE_EFFECT",
                  index: state.activeEffectIndex,
                  patch: {
                    playRateHz: Number(event.target.value) || state.globalDefaultPlayRateHz,
                  },
                })
              }
            />
          </div>

          <div className="px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Global Default Play Rate
            </span>
            <Input
              className="mt-1 h-8"
              type="number"
              min={1}
              value={state.globalDefaultPlayRateHz}
              onChange={(event) =>
                dispatch({
                  type: "SET_GLOBAL_DEFAULT_PLAY_RATE",
                  playRateHz: Number(event.target.value) || 8000,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Source Rate
            </span>
            <span className="text-xs">{effect.waveform.sampleRate}Hz</span>
          </div>

          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Length
            </span>
            <span className="text-xs">{effect.waveform.samples.length} bytes</span>
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
                  {currentFamilyTag}
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
              Notes
            </span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none"
              placeholder="Add free-text notes for this effect."
              value={effect.notes}
              onChange={(event) =>
                dispatch({
                  type: "UPDATE_EFFECT",
                  index: state.activeEffectIndex,
                  patch: { notes: event.target.value },
                })
              }
            />
          </div>

          <Separator className="my-1" />
          <div className="px-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Family Presets
            </span>
            <div className="mt-2 flex gap-2">
              <Input
                className="h-8"
                value={presetName}
                placeholder="Preset name"
                onChange={(event) => setPresetName(event.target.value)}
              />
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  const trimmed = presetName.trim();
                  if (!trimmed) return;
                  dispatch({
                    type: "SAVE_PRESET",
                    preset: {
                      id: crypto.randomUUID(),
                      name: trimmed,
                      familyTag: currentFamilyTag,
                      chain: effect.chain,
                      createdAt: Date.now(),
                    },
                  });
                  setPresetName("");
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-2">
            {familyPresets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No presets saved for this family.</p>
            ) : (
              familyPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-md border border-border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {preset.name}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {preset.chain.length} steps
                    </span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          dispatch({
                            type: "APPLY_PRESET_TO_FAMILY",
                            presetId: preset.id,
                            familyTag: currentFamilyTag,
                          })
                        }
                      >
                        Apply to Family
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          dispatch({ type: "DELETE_PRESET", id: preset.id })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

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
                    {r.name} [{r.start}-{r.end}]
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
