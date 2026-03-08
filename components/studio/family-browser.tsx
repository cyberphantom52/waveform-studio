"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Folder, FileAudio, Trash2, Upload, CheckSquare, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { importStudioFiles } from "@/lib/studio-io";

export function FamilyBrowser() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const familyEntries = Object.entries(state.families).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const selectedCount = state.effects.filter((effect) => effect.selected).length;

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const imported = await importStudioFiles(files, state.globalDefaultPlayRateHz);
      if (imported.effects.length > 0) {
        dispatch({ type: "BATCH_ADD_EFFECTS", effects: imported.effects });
      }
      if (Object.keys(imported.metadata).length > 0) {
        dispatch({ type: "SET_METADATA", metadata: imported.metadata });
      }
    },
    [dispatch, state.globalDefaultPlayRateHz]
  );

  return (
    <div className="flex h-full flex-col">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".bin,.json"
        className="hidden"
        onChange={(event) => {
          if (!event.target.files) return;
          void importFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Effects
        </span>
        <Badge variant="outline" className="text-[10px]">
          {state.effects.length}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dispatch({ type: "CLEAR_EFFECT_SELECTIONS" })}
            disabled={selectedCount === 0}
          >
            <Square className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dispatch({ type: "REMOVE_SELECTED_EFFECTS" })}
            disabled={selectedCount === 0}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "border-b border-border px-2 py-2 transition-colors",
          isDragging ? "bg-accent/50" : "bg-card"
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void importFiles(event.dataTransfer.files);
        }}
      >
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Add files or drop `.bin` / `vibrator_effect.json`
        </button>
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
                        "flex cursor-pointer items-center gap-1.5 py-1 pr-2 pl-3 text-xs transition-colors",
                        idx === state.activeEffectIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                      onClick={() =>
                        dispatch({ type: "SET_ACTIVE_EFFECT", index: idx })
                      }
                    >
                      <button
                        type="button"
                        className="rounded-sm p-0.5"
                        onClick={(event) => {
                          event.stopPropagation();
                          dispatch({ type: "TOGGLE_EFFECT_SELECTION", index: idx });
                        }}
                      >
                        {effect.selected ? (
                          <CheckSquare className="size-3" />
                        ) : (
                          <Square className="size-3" />
                        )}
                      </button>
                      <FileAudio className="size-3" />
                      <span className="flex-1 truncate">
                        {effect.waveform.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {effect.playRateHz}Hz
                      </span>
                      <button
                        type="button"
                        className="rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          dispatch({ type: "REMOVE_EFFECT", index: idx });
                        }}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                })}
                <Separator />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
