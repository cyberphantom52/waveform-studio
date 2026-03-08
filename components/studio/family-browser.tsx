"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Folder, FileAudio } from "lucide-react";

export function FamilyBrowser() {
  const state = useStudio();
  const dispatch = useStudioDispatch();

  const familyEntries = Object.entries(state.families);
  const ungrouped = state.effects.filter((e) => !e.waveform.familyId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Browser
        </span>
      </div>

      <ScrollArea className="flex-1">
        {state.effects.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">No effects</p>
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {familyEntries.map(([family, ids]) => (
              <div key={family}>
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                  <Folder className="size-3" />
                  <span className="uppercase tracking-wider">{family}</span>
                </div>
                {ids.map((id) => {
                  const idx = state.effects.findIndex(
                    (e) => e.waveform.id === id
                  );
                  const effect = state.effects[idx];
                  if (!effect) return null;
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 py-1 pr-2 pl-5 text-xs transition-colors",
                        idx === state.activeEffectIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                      onClick={() =>
                        dispatch({ type: "SET_ACTIVE_EFFECT", index: idx })
                      }
                    >
                      <FileAudio className="size-3" />
                      <span className="truncate">
                        {effect.waveform.name}
                      </span>
                    </div>
                  );
                })}
                <Separator />
              </div>
            ))}
            {ungrouped.length > 0 && familyEntries.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                <Folder className="size-3" />
                <span className="uppercase tracking-wider">Ungrouped</span>
              </div>
            )}
            {ungrouped.map((effect) => {
              const idx = state.effects.indexOf(effect);
              return (
                <div
                  key={effect.waveform.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 py-1 pr-2 pl-5 text-xs transition-colors",
                    idx === state.activeEffectIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                  onClick={() =>
                    dispatch({ type: "SET_ACTIVE_EFFECT", index: idx })
                  }
                >
                  <FileAudio className="size-3" />
                  <span className="truncate">{effect.waveform.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
