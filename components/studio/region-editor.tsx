"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDefaultRegion, createEmptyRegionOverrides } from "@/lib/dsp/remaster";
import {
  createStudioEffectFromRegion,
} from "@/lib/studio-io";
import type { Region } from "@/lib/dsp/region";
import { Plus, Trash2, X, Waves } from "lucide-react";

function RegionEnvelopeEditor({
  region,
  onChange,
}: {
  region: Region;
  onChange: (region: Region) => void;
}) {
  const points =
    region.overrides.envelope?.points ?? [
      { position: 0, amplitude: 1, curve: "linear" as const },
      { position: 1, amplitude: 1, curve: "linear" as const },
    ];

  return (
    <div className="flex flex-col gap-2">
      {points.map((point, index) => (
        <div key={index} className="flex items-center gap-2">
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[point.position]}
            onValueChange={([value]) => {
              const nextPoints = [...points];
              nextPoints[index] = { ...point, position: value };
              onChange({
                ...region,
                overrides: {
                  ...region.overrides,
                  envelope: {
                    points: nextPoints.sort((left, right) => left.position - right.position),
                  },
                },
              });
            }}
            className="flex-1"
          />
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={[point.amplitude]}
            onValueChange={([value]) => {
              const nextPoints = [...points];
              nextPoints[index] = { ...point, amplitude: value };
              onChange({
                ...region,
                overrides: {
                  ...region.overrides,
                  envelope: { points: nextPoints },
                },
              });
            }}
            className="flex-1"
          />
          <Select
            value={point.curve}
            onValueChange={(value) => {
              const nextPoints = [...points];
              nextPoints[index] = {
                ...point,
                curve: value as "linear" | "exponential" | "logarithmic",
              };
              onChange({
                ...region,
                overrides: {
                  ...region.overrides,
                  envelope: { points: nextPoints },
                },
              });
            }}
          >
            <SelectTrigger className="h-7 w-20 text-[10px]">
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
            disabled={points.length <= 2}
            onClick={() => {
              const nextPoints = points.filter((_, pointIndex) => pointIndex !== index);
              onChange({
                ...region,
                overrides: {
                  ...region.overrides,
                  envelope: { points: nextPoints },
                },
              });
            }}
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="xs"
        onClick={() =>
          onChange({
            ...region,
            overrides: {
              ...region.overrides,
              envelope: {
                points: [
                  ...points,
                  { position: 0.5, amplitude: 1, curve: "linear" as const },
                ].sort((left, right) => left.position - right.position),
              },
            },
          })
        }
      >
        Add Point
      </Button>
    </div>
  );
}

function OverrideSection({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Badge variant={enabled ? "default" : "outline"} className="text-[10px]">
          {enabled ? "Override" : "Inherit"}
        </Badge>
        <div className="ml-auto">
          <Button variant="ghost" size="xs" onClick={onToggle}>
            {enabled ? "Inherit" : "Override"}
          </Button>
        </div>
      </div>
      {enabled ? children : <p className="text-xs text-muted-foreground">Uses global transform values.</p>}
    </div>
  );
}

export function RegionEditor() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const effect = state.effects[state.activeEffectIndex];

  if (!effect) return null;

  const sampleCount = effect.remastered?.length ?? effect.waveform.samples.length;
  const selectedRegion =
    effect.regions.find((region) => region.id === state.selectedRegionId) ??
    effect.regions[0] ??
    null;

  const addRegion = () => {
    dispatch({
      type: "ADD_REGION",
      region: createDefaultRegion(sampleCount, effect.regions),
    });
  };

  const bounceSelectedRegion = () => {
    if (!selectedRegion) return;
    dispatch({
      type: "ADD_EFFECT",
      effect: createStudioEffectFromRegion(effect, selectedRegion),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Clips
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => dispatch({ type: "CLEAR_REGIONS" })}
            disabled={effect.regions.length === 0}
          >
            Clear
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={addRegion}>
            <Plus data-icon="inline-start" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {effect.regions.length === 0 ? (
          <div className="flex h-28 flex-col items-center justify-center gap-2 px-4 text-center">
            <Waves className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No clips yet. Left-drag to make a selection, then press `C` to turn it into a clip.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-2">
            <div className="flex flex-col gap-1">
              {effect.regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
                    region.id === selectedRegion?.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() =>
                    dispatch({ type: "SET_SELECTED_REGION", id: region.id })
                  }
                >
                  <Badge variant="outline" className="text-[10px]">
                    {region.name}
                  </Badge>
                  <span className="truncate text-muted-foreground">
                    [{region.start} - {region.end}]
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    xfade {region.crossfadeSamples}
                  </span>
                  <span
                    className="rounded-sm p-0.5"
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatch({ type: "REMOVE_REGION", id: region.id });
                    }}
                  >
                    <Trash2 className="size-3" />
                  </span>
                </button>
              ))}
            </div>

            {selectedRegion && (
              <div className="flex flex-col gap-3 rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={selectedRegion.name}
                    onChange={(event) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: { ...selectedRegion, name: event.target.value },
                      })
                    }
                    className="h-8"
                    placeholder="Clip name"
                  />
                  <Badge variant="outline" className="text-[10px]">
                    {selectedRegion.end - selectedRegion.start} smp
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedRegion.id.slice(0, 8)}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="xs" onClick={bounceSelectedRegion}>
                    Create Waveform
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    Or select on the canvas and press `N`
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Start
                  </span>
                  <Slider
                    min={0}
                    max={sampleCount}
                    step={1}
                    value={[selectedRegion.start]}
                    onValueChange={([value]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: {
                          ...selectedRegion,
                          start: Math.min(value, selectedRegion.end - 1),
                        },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-xs tabular-nums">
                    {selectedRegion.start}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">
                    End
                  </span>
                  <Slider
                    min={0}
                    max={sampleCount}
                    step={1}
                    value={[selectedRegion.end]}
                    onValueChange={([value]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: {
                          ...selectedRegion,
                          end: Math.max(value, selectedRegion.start + 1),
                        },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-xs tabular-nums">
                    {selectedRegion.end}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Fade
                  </span>
                  <Slider
                    min={0}
                    max={Math.max(1, Math.floor((selectedRegion.end - selectedRegion.start) / 2))}
                    step={1}
                    value={[selectedRegion.crossfadeSamples]}
                    onValueChange={([value]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: { ...selectedRegion, crossfadeSamples: value },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-xs tabular-nums">
                    {selectedRegion.crossfadeSamples}
                  </span>
                </div>

                <OverrideSection
                  label="Gain"
                  enabled={selectedRegion.overrides.gain !== null}
                  onToggle={() =>
                    dispatch({
                      type: "UPDATE_REGION",
                      region: {
                        ...selectedRegion,
                        overrides: {
                          ...selectedRegion.overrides,
                          gain: selectedRegion.overrides.gain ? null : { value: 1 },
                        },
                      },
                    })
                  }
                >
                  <Slider
                    min={0}
                    max={4}
                    step={0.01}
                    value={[selectedRegion.overrides.gain?.value ?? 1]}
                    onValueChange={([value]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: {
                          ...selectedRegion,
                          overrides: {
                            ...selectedRegion.overrides,
                            gain: { value },
                          },
                        },
                      })
                    }
                  />
                </OverrideSection>

                <OverrideSection
                  label="Smoothing"
                  enabled={selectedRegion.overrides.smoothing !== null}
                  onToggle={() =>
                    dispatch({
                      type: "UPDATE_REGION",
                      region: {
                        ...selectedRegion,
                        overrides: {
                          ...selectedRegion.overrides,
                          smoothing: selectedRegion.overrides.smoothing
                            ? null
                            : { windowSize: 3 },
                        },
                      },
                    })
                  }
                >
                  <Slider
                    min={1}
                    max={64}
                    step={2}
                    value={[selectedRegion.overrides.smoothing?.windowSize ?? 3]}
                    onValueChange={([value]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: {
                          ...selectedRegion,
                          overrides: {
                            ...selectedRegion.overrides,
                            smoothing: { windowSize: value },
                          },
                        },
                      })
                    }
                  />
                </OverrideSection>

                <OverrideSection
                  label="Deadzone"
                  enabled={selectedRegion.overrides.deadzone !== null}
                  onToggle={() =>
                    dispatch({
                      type: "UPDATE_REGION",
                      region: {
                        ...selectedRegion,
                        overrides: {
                          ...selectedRegion.overrides,
                          deadzone: selectedRegion.overrides.deadzone
                            ? null
                            : { threshold: 10 },
                        },
                      },
                    })
                  }
                >
                  <Slider
                    min={0}
                    max={64}
                    step={1}
                    value={[selectedRegion.overrides.deadzone?.threshold ?? 10]}
                    onValueChange={([value]) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region: {
                          ...selectedRegion,
                          overrides: {
                            ...selectedRegion.overrides,
                            deadzone: { threshold: value },
                          },
                        },
                      })
                    }
                  />
                </OverrideSection>

                <OverrideSection
                  label="Envelope"
                  enabled={selectedRegion.overrides.envelope !== null}
                  onToggle={() =>
                    dispatch({
                      type: "UPDATE_REGION",
                      region: {
                        ...selectedRegion,
                        overrides: {
                          ...selectedRegion.overrides,
                          envelope: selectedRegion.overrides.envelope
                            ? null
                            : createEmptyRegionOverrides().envelope ?? {
                                points: [
                                  { position: 0, amplitude: 1, curve: "linear" as const },
                                  { position: 1, amplitude: 1, curve: "linear" as const },
                                ],
                              },
                        },
                      },
                    })
                  }
                >
                  <RegionEnvelopeEditor
                    region={{
                      ...selectedRegion,
                      overrides: {
                        ...selectedRegion.overrides,
                        envelope:
                          selectedRegion.overrides.envelope ?? {
                            points: [
                              { position: 0, amplitude: 1, curve: "linear" as const },
                              { position: 1, amplitude: 1, curve: "linear" as const },
                            ],
                          },
                      },
                    }}
                    onChange={(region) =>
                      dispatch({
                        type: "UPDATE_REGION",
                        region,
                      })
                    }
                  />
                </OverrideSection>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
