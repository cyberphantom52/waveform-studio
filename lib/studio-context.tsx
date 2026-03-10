"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { WaveformData, EffectMetadata } from "./dsp/waveform";
import type { TransformStep, TransformType } from "./dsp/transforms";
import { getDefaultParams } from "./dsp/transforms";
import {
  getValidTimelineInsertion,
  type Region,
} from "./dsp/region";
import type { WaveformStats } from "./dsp/stats";
import { computeRemasteredWaveform, createDefaultRegion } from "./dsp/remaster";
import { clampZoomWindow } from "./zoom";

export interface EffectRemasterInfo {
  clippedSamples: number;
  originalStats: WaveformStats;
  remasteredStats: WaveformStats | null;
  updatedAt: number | null;
}

export interface FamilyPreset {
  id: string;
  name: string;
  familyTag: string;
  chain: TransformStep[];
  createdAt: number;
}

export interface CanvasConfig {
  height: number;
  density: number;
}

export interface StudioEffect {
  waveform: WaveformData;
  chain: TransformStep[];
  regions: Region[];
  remastered: Int8Array | null;
  metadata?: EffectMetadata;
  familyTag: string;
  playRateHz: number;
  notes: string;
  selected: boolean;
  remasterInfo: EffectRemasterInfo | null;
}

export interface StudioState {
  effects: StudioEffect[];
  activeEffectIndex: number;
  activeTransformIndex: number;
  compareWaveform: WaveformData | null;
  viewMode: "original" | "remastered" | "diff" | "overlay";
  zoom: { start: number; end: number };
  families: Record<string, string[]>;
  presets: FamilyPreset[];
  selectedRegionId: string | null;
  canvasConfig: CanvasConfig;
  globalDefaultPlayRateHz: number;
  undoStack: StudioSnapshot[];
  redoStack: StudioSnapshot[];
}

type StudioSnapshot = Omit<StudioState, "undoStack" | "redoStack">;

type Action =
  | { type: "ADD_EFFECT"; effect: StudioEffect }
  | { type: "REMOVE_EFFECT"; index: number }
  | { type: "REMOVE_SELECTED_EFFECTS" }
  | { type: "SET_ACTIVE_EFFECT"; index: number }
  | { type: "SET_ACTIVE_TRANSFORM"; index: number }
  | { type: "TOGGLE_EFFECT_SELECTION"; index: number }
  | { type: "CLEAR_EFFECT_SELECTIONS" }
  | {
      type: "UPDATE_EFFECT";
      index: number;
      patch: Partial<
        Pick<
          StudioEffect,
          "familyTag" | "playRateHz" | "notes" | "selected" | "metadata"
        >
      >;
    }
  | { type: "ADD_TRANSFORM"; transformType: TransformType }
  | { type: "REMOVE_TRANSFORM"; index: number }
  | { type: "TOGGLE_TRANSFORM"; index: number }
  | { type: "RESET_TRANSFORMS" }
  | { type: "SET_CHAIN"; chain: TransformStep[] }
  | {
      type: "UPDATE_TRANSFORM_PARAMS";
      index: number;
      params: TransformStep["params"];
    }
  | { type: "REORDER_TRANSFORMS"; fromIndex: number; toIndex: number }
  | {
      type: "SET_REMASTERED";
      index: number;
      data: Int8Array | null;
      remasterInfo: EffectRemasterInfo | null;
    }
  | { type: "SET_VIEW_MODE"; mode: StudioState["viewMode"] }
  | { type: "SET_COMPARE_WAVEFORM"; waveform: WaveformData | null }
  | { type: "SET_ZOOM"; start: number; end: number }
  | { type: "ADD_REGION"; region: Region }
  | { type: "SET_REGIONS"; regions: Region[] }
  | { type: "REMOVE_REGION"; id: string }
  | { type: "CLEAR_REGIONS" }
  | { type: "UPDATE_REGION"; region: Region }
  | { type: "SET_SELECTED_REGION"; id: string | null }
  | {
      type: "INSERT_EFFECT_CLIP";
      sourceEffectId: string;
      timelineStart: number;
    }
  | { type: "SET_METADATA"; metadata: Record<string, EffectMetadata> }
  | { type: "SET_CANVAS_CONFIG"; config: Partial<CanvasConfig> }
  | { type: "SET_GLOBAL_DEFAULT_PLAY_RATE"; playRateHz: number }
  | { type: "SAVE_PRESET"; preset: FamilyPreset }
  | { type: "DELETE_PRESET"; id: string }
  | { type: "APPLY_PRESET_TO_FAMILY"; presetId: string; familyTag: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "BATCH_ADD_EFFECTS"; effects: StudioEffect[] };

function getSelectedClip(effect: StudioEffect | undefined, selectedRegionId: string | null) {
  if (!effect || !selectedRegionId) return null;
  return effect.regions.find((region) => region.id === selectedRegionId) ?? null;
}

function getChainTarget(effect: StudioEffect | undefined, selectedRegionId: string | null) {
  const clip = getSelectedClip(effect, selectedRegionId);
  return clip?.chain ?? [];
}

function updateSelectedClipChain(
  effect: StudioEffect,
  selectedRegionId: string | null,
  updater: (chain: TransformStep[]) => TransformStep[],
) {
  if (!selectedRegionId) return effect;
  const clip = getSelectedClip(effect, selectedRegionId);
  if (!clip) return effect;

  return {
    ...effect,
    regions: effect.regions.map((region) =>
      region.id === selectedRegionId
        ? { ...region, chain: updater(region.chain.map(cloneTransformStep)) }
        : region,
    ),
  };
}

function cloneWaveform(waveform: WaveformData): WaveformData {
  return {
    ...waveform,
    samples: new Int8Array(waveform.samples),
  };
}

function insertEffectClipIntoTimeline(
  effect: StudioEffect,
  sourceEffect: StudioEffect,
  timelineStart: number,
) {
  const sourceSamples =
    sourceEffect.remastered ?? sourceEffect.waveform.samples;
  if (sourceSamples.length === 0) {
    return { effect, insertedRegionId: null as string | null };
  }

  const insertion = getValidTimelineInsertion(
    effect.regions,
    timelineStart,
    sourceSamples.length,
    effect.waveform.samples.length,
  );
  if (!insertion) {
    return { effect, insertedRegionId: null as string | null };
  }
  const insertedRegion: Region = {
    id: crypto.randomUUID(),
    name: `Clip ${effect.regions.length + 1}`,
    timelineStart: insertion.start,
    timelineLength: sourceSamples.length,
    start: 0,
    end: sourceSamples.length,
    sourceSamples: new Int8Array(sourceSamples),
    crossfadeSamples: 0,
    chain: [],
  };
  const regions = [...effect.regions.map(cloneRegion), insertedRegion]
    .sort((left, right) => left.timelineStart - right.timelineStart)
    .map((region, index) => ({
      ...region,
      name: `Clip ${index + 1}`,
    }));

  return {
    effect: recomputeRemaster({
      ...effect,
      regions,
    }),
    insertedRegionId: insertedRegion.id,
  };
}

function cloneTransformStep(step: TransformStep): TransformStep {
  return {
    type: step.type,
    enabled: step.enabled,
    params: structuredClone(step.params),
  };
}

function cloneRegion(region: Region): Region {
  return {
    ...region,
    sourceSamples: region.sourceSamples
      ? new Int8Array(region.sourceSamples)
      : undefined,
    chain: region.chain.map(cloneTransformStep),
  };
}

function cloneEffect(effect: StudioEffect): StudioEffect {
  return {
    waveform: cloneWaveform(effect.waveform),
    chain: effect.chain.map(cloneTransformStep),
    regions: effect.regions.map(cloneRegion),
    remastered: effect.remastered ? new Int8Array(effect.remastered) : null,
    metadata: effect.metadata ? { ...effect.metadata } : undefined,
    familyTag: effect.familyTag,
    playRateHz: effect.playRateHz,
    notes: effect.notes,
    selected: effect.selected,
    remasterInfo: effect.remasterInfo
      ? {
          ...effect.remasterInfo,
          originalStats: { ...effect.remasterInfo.originalStats },
          remasteredStats: effect.remasterInfo.remasteredStats
            ? { ...effect.remasterInfo.remasteredStats }
            : null,
        }
      : null,
  };
}

function clonePreset(preset: FamilyPreset): FamilyPreset {
  return {
    ...preset,
    chain: preset.chain.map(cloneTransformStep),
  };
}

function buildFamilies(effects: StudioEffect[]): Record<string, string[]> {
  const families: Record<string, string[]> = {};
  for (const effect of effects) {
    const family = effect.familyTag.trim() || "ungrouped";
    if (!families[family]) families[family] = [];
    families[family].push(effect.waveform.id);
  }
  return families;
}

function createSnapshot(state: StudioState): StudioSnapshot {
  return {
    effects: state.effects.map(cloneEffect),
    activeEffectIndex: state.activeEffectIndex,
    activeTransformIndex: state.activeTransformIndex,
    compareWaveform: state.compareWaveform
      ? cloneWaveform(state.compareWaveform)
      : null,
    viewMode: state.viewMode,
    zoom: { ...state.zoom },
    families: buildFamilies(state.effects),
    presets: state.presets.map(clonePreset),
    selectedRegionId: state.selectedRegionId,
    canvasConfig: { ...state.canvasConfig },
    globalDefaultPlayRateHz: state.globalDefaultPlayRateHz,
  };
}

function fromSnapshot(
  snapshot: StudioSnapshot,
  undoStack: StudioSnapshot[],
  redoStack: StudioSnapshot[],
): StudioState {
  return {
    effects: snapshot.effects.map(cloneEffect),
    activeEffectIndex: snapshot.activeEffectIndex,
    activeTransformIndex: snapshot.activeTransformIndex,
    compareWaveform: snapshot.compareWaveform
      ? cloneWaveform(snapshot.compareWaveform)
      : null,
    viewMode: snapshot.viewMode,
    zoom: { ...snapshot.zoom },
    families: buildFamilies(snapshot.effects),
    presets: snapshot.presets.map(clonePreset),
    selectedRegionId: snapshot.selectedRegionId,
    canvasConfig: { ...snapshot.canvasConfig },
    globalDefaultPlayRateHz: snapshot.globalDefaultPlayRateHz,
    undoStack,
    redoStack,
  };
}

/**
 * Recompute the remastered waveform inline — call this inside the reducer
 * whenever chain or regions change so the result is part of the same state
 * update (one render instead of two).
 */
function recomputeRemaster(effect: StudioEffect): StudioEffect {
  if (!effect.waveform.samples.length) return effect;

  const remaster = computeRemasteredWaveform(
    effect.waveform.samples,
    effect.waveform.sampleRate,
    effect.chain,
    effect.regions,
    effect.remasterInfo?.originalStats ?? undefined,
  );

  return {
    ...effect,
    remastered: remaster.result,
    remasterInfo: {
      clippedSamples: remaster.clippedSamples,
      originalStats: remaster.originalStats,
      remasteredStats: remaster.remasteredStats,
      updatedAt: Date.now(),
    },
  };
}

function pushUndo(state: StudioState): StudioState {
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-30), createSnapshot(state)],
    redoStack: [],
  };
}

function studioReducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "ADD_EFFECT": {
      const s = pushUndo(state);
      const effects = [...s.effects, cloneEffect(action.effect)];
      const selectedRegionId = effects.at(-1)?.regions[0]?.id ?? null;
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length - 1,
        activeTransformIndex: -1,
        zoom: { start: 0, end: 1 },
        selectedRegionId,
      };
    }
    case "BATCH_ADD_EFFECTS": {
      const s = pushUndo(state);
      const effects = [...s.effects, ...action.effects.map(cloneEffect)];
      const selectedRegionId = effects.at(-1)?.regions[0]?.id ?? null;
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length - 1,
        activeTransformIndex: -1,
        zoom: { start: 0, end: 1 },
        selectedRegionId,
      };
    }
    case "REMOVE_EFFECT": {
      const s = pushUndo(state);
      const effects = s.effects.filter((_, i) => i !== action.index);
      const activeEffectIndex = Math.min(
        Math.max(0, effects.length - 1),
        s.activeEffectIndex >= action.index
          ? s.activeEffectIndex - 1
          : s.activeEffectIndex,
      );
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length === 0 ? -1 : activeEffectIndex,
        activeTransformIndex:
          effects.length === 0 ? -1 : s.activeTransformIndex,
        selectedRegionId: null,
      };
    }
    case "REMOVE_SELECTED_EFFECTS": {
      const selectedCount = state.effects.filter(
        (effect) => effect.selected,
      ).length;
      if (selectedCount === 0) return state;
      const s = pushUndo(state);
      const effects = s.effects.filter((effect) => !effect.selected);
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex:
          effects.length === 0
            ? -1
            : Math.min(s.activeEffectIndex, effects.length - 1),
        activeTransformIndex:
          effects.length === 0 ? -1 : s.activeTransformIndex,
        selectedRegionId: null,
      };
    }
    case "SET_ACTIVE_EFFECT":
      {
        const effect = state.effects[action.index];
        const selectedRegionId = effect?.regions[0]?.id ?? null;
        const chain = getChainTarget(effect, selectedRegionId);
        return {
          ...state,
          activeEffectIndex: action.index,
          activeTransformIndex: chain.length > 0 ? 0 : -1,
          selectedRegionId,
        };
      }
    case "SET_ACTIVE_TRANSFORM":
      return { ...state, activeTransformIndex: action.index };
    case "TOGGLE_EFFECT_SELECTION": {
      const effects = state.effects.map((effect, index) =>
        index === action.index
          ? { ...effect, selected: !effect.selected }
          : effect,
      );
      return { ...state, effects };
    }
    case "CLEAR_EFFECT_SELECTIONS": {
      const effects = state.effects.map((effect) => ({
        ...effect,
        selected: false,
      }));
      return { ...state, effects };
    }
    case "UPDATE_EFFECT": {
      const effects = state.effects.map((effect, index) =>
        index === action.index ? { ...effect, ...action.patch } : effect,
      );
      return { ...state, effects, families: buildFamilies(effects) };
    }
    case "ADD_TRANSFORM": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const newStep: TransformStep = {
        type: action.transformType,
        enabled: true,
        params: getDefaultParams(action.transformType),
      };
      const updated = recomputeRemaster(
        updateSelectedClipChain(effect, s.selectedRegionId, (chain) => [
          ...chain,
          newStep,
        ]),
      );
      const updatedClip = getSelectedClip(updated, s.selectedRegionId);
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeTransformIndex: (updatedClip?.chain.length ?? 1) - 1,
      };
    }
    case "REMOVE_TRANSFORM": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const updated = recomputeRemaster(
        updateSelectedClipChain(
          effect,
          s.selectedRegionId,
          (chain) => chain.filter((_, i) => i !== action.index),
        ),
      );
      const updatedClip = getSelectedClip(updated, s.selectedRegionId);
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return {
        ...s,
        effects,
        activeTransformIndex:
          updatedClip && updatedClip.chain.length > 0
            ? Math.min(action.index, updatedClip.chain.length - 1)
            : -1,
      };
    }
    case "RESET_TRANSFORMS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const updated = recomputeRemaster(
        updateSelectedClipChain(
          effect,
          s.selectedRegionId,
          (chain) =>
            chain.map((step) => ({
              ...step,
              enabled: true,
              params: getDefaultParams(step.type),
            })),
        ),
      );
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return { ...s, effects };
    }
    case "SET_CHAIN": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const nextChain = action.chain.map(cloneTransformStep);
      const updated = recomputeRemaster(
        updateSelectedClipChain(effect, s.selectedRegionId, () => nextChain),
      );
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeTransformIndex: nextChain.length > 0 ? 0 : -1,
      };
    }
    case "TOGGLE_TRANSFORM": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const updated = recomputeRemaster(
        updateSelectedClipChain(
          effect,
          s.selectedRegionId,
          (chain) =>
            chain.map((step, i) =>
              i === action.index ? { ...step, enabled: !step.enabled } : step,
            ),
        ),
      );
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return { ...s, effects };
    }
    case "UPDATE_TRANSFORM_PARAMS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const updated = recomputeRemaster(
        updateSelectedClipChain(
          effect,
          s.selectedRegionId,
          (chain) =>
            chain.map((step, i) =>
              i === action.index ? { ...step, params: action.params } : step,
            ),
        ),
      );
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return { ...s, effects };
    }
    case "REORDER_TRANSFORMS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect || !s.selectedRegionId) return s;
      const updated = recomputeRemaster(
        updateSelectedClipChain(effect, s.selectedRegionId, (chain) => {
          const nextChain = [...chain];
          const [removed] = nextChain.splice(action.fromIndex, 1);
          nextChain.splice(action.toIndex, 0, removed);
          return nextChain;
        }),
      );
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return { ...s, effects };
    }
    case "SET_REMASTERED": {
      const effect = state.effects[action.index];
      if (!effect) return state;
      const updated = {
        ...effect,
        remastered: action.data ? new Int8Array(action.data) : null,
        remasterInfo: action.remasterInfo,
      };
      const effects = state.effects.map((e, i) =>
        i === action.index ? updated : e,
      );
      return { ...state, effects };
    }
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_COMPARE_WAVEFORM": {
      const s = pushUndo(state);
      return {
        ...s,
        compareWaveform: action.waveform ? cloneWaveform(action.waveform) : null,
      };
    }
    case "INSERT_EFFECT_CLIP": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      const sourceEffect = s.effects.find(
        (entry) => entry.waveform.id === action.sourceEffectId,
      );
      if (!effect || !sourceEffect) return s;
      const { effect: updated, insertedRegionId } = insertEffectClipIntoTimeline(
        effect,
        sourceEffect,
        action.timelineStart,
      );
      if (!insertedRegionId) return s;
      const effects = s.effects.map((entry, index) =>
        index === s.activeEffectIndex ? updated : entry,
      );
      return {
        ...s,
        effects,
        selectedRegionId: insertedRegionId,
        activeTransformIndex: -1,
      };
    }
    case "SET_ZOOM":
      return { ...state, zoom: clampZoomWindow(action.start, action.end) };
    case "ADD_REGION": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = recomputeRemaster({
        ...effect,
        regions: [...effect.regions, action.region],
      });
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return {
        ...s,
        effects,
        selectedRegionId: action.region.id,
        activeTransformIndex: action.region.chain.length > 0 ? 0 : -1,
      };
    }
    case "SET_REGIONS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = recomputeRemaster({
        ...effect,
        regions: action.regions.map(cloneRegion),
      });
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return { ...s, effects };
    }
    case "REMOVE_REGION": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = recomputeRemaster({
        ...effect,
        regions: effect.regions.filter((r) => r.id !== action.id),
      });
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return {
        ...s,
        effects,
        selectedRegionId:
          s.selectedRegionId === action.id ? null : s.selectedRegionId,
        activeTransformIndex:
          s.selectedRegionId === action.id ? -1 : s.activeTransformIndex,
      };
    }
    case "CLEAR_REGIONS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = recomputeRemaster({
        ...effect,
        regions: [createDefaultRegion(effect.waveform.samples.length, [])],
      });
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return {
        ...s,
        effects,
        selectedRegionId: updated.regions[0]?.id ?? null,
        activeTransformIndex: updated.regions[0]?.chain.length ? 0 : -1,
      };
    }
    case "UPDATE_REGION": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = recomputeRemaster({
        ...effect,
        regions: effect.regions.map((region) =>
          region.id === action.region.id ? cloneRegion(action.region) : region,
        ),
      });
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e,
      );
      return { ...s, effects };
    }
    case "SET_SELECTED_REGION":
      {
        const effect = state.effects[state.activeEffectIndex];
        const chain = getChainTarget(effect, action.id);
        return {
          ...state,
          selectedRegionId: action.id,
          activeTransformIndex: chain.length > 0 ? 0 : -1,
        };
      }
    case "SET_METADATA": {
      const effects = state.effects.map((e) => {
        const meta =
          action.metadata[e.waveform.name + ".bin"] ??
          action.metadata[e.waveform.name];
        if (meta) {
          return {
            ...e,
            metadata: meta,
            familyTag: meta.family,
            playRateHz:
              meta.playRateHz ?? e.playRateHz ?? state.globalDefaultPlayRateHz,
          };
        }
        return e;
      });
      return { ...state, effects, families: buildFamilies(effects) };
    }
    case "SET_CANVAS_CONFIG":
      return {
        ...state,
        canvasConfig: { ...state.canvasConfig, ...action.config },
      };
    case "SET_GLOBAL_DEFAULT_PLAY_RATE":
      return { ...state, globalDefaultPlayRateHz: action.playRateHz };
    case "SAVE_PRESET": {
      const presets = [
        ...state.presets.filter((preset) => preset.id !== action.preset.id),
        clonePreset(action.preset),
      ];
      return { ...state, presets };
    }
    case "DELETE_PRESET":
      return {
        ...state,
        presets: state.presets.filter((preset) => preset.id !== action.id),
      };
    case "APPLY_PRESET_TO_FAMILY": {
      const preset = state.presets.find((item) => item.id === action.presetId);
      if (!preset) return state;
      const effects = state.effects.map((effect) =>
        effect.familyTag === action.familyTag
          ? { ...effect, chain: preset.chain.map(cloneTransformStep) }
          : effect,
      );
      return { ...state, effects, activeTransformIndex: 0 };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return fromSnapshot(prev, state.undoStack.slice(0, -1), [
        ...state.redoStack,
        createSnapshot(state),
      ]);
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return fromSnapshot(
        next,
        [...state.undoStack, createSnapshot(state)],
        state.redoStack.slice(0, -1),
      );
    }
    default:
      return state;
  }
}

const initialState: StudioState = {
  effects: [],
  activeEffectIndex: -1,
  activeTransformIndex: -1,
  compareWaveform: null,
  viewMode: "overlay",
  zoom: { start: 0, end: 1 },
  families: {},
  presets: [],
  selectedRegionId: null,
  canvasConfig: {
    height: 320,
    density: 1,
  },
  globalDefaultPlayRateHz: 24000,
  undoStack: [],
  redoStack: [],
};

const StudioContext = createContext<StudioState>(initialState);
const StudioDispatchContext = createContext<Dispatch<Action>>(() => {});

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  return (
    <StudioContext.Provider value={state}>
      <StudioDispatchContext.Provider value={dispatch}>
        {children}
      </StudioDispatchContext.Provider>
    </StudioContext.Provider>
  );
}

export function useStudio() {
  return useContext(StudioContext);
}

export function useStudioDispatch() {
  return useContext(StudioDispatchContext);
}
