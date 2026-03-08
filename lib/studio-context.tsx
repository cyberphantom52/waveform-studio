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
import type { Region } from "./dsp/region";
import type { WaveformStats } from "./dsp/stats";

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
  remastered: Uint8Array | null;
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
  | {
      type: "UPDATE_TRANSFORM_PARAMS";
      index: number;
      params: TransformStep["params"];
    }
  | { type: "REORDER_TRANSFORMS"; fromIndex: number; toIndex: number }
  | {
      type: "SET_REMASTERED";
      index: number;
      data: Uint8Array | null;
      remasterInfo: EffectRemasterInfo | null;
    }
  | { type: "SET_VIEW_MODE"; mode: StudioState["viewMode"] }
  | { type: "SET_ZOOM"; start: number; end: number }
  | { type: "ADD_REGION"; region: Region }
  | { type: "REMOVE_REGION"; id: string }
  | { type: "CLEAR_REGIONS" }
  | { type: "UPDATE_REGION"; region: Region }
  | { type: "SET_SELECTED_REGION"; id: string | null }
  | { type: "SET_METADATA"; metadata: Record<string, EffectMetadata> }
  | { type: "SET_CANVAS_CONFIG"; config: Partial<CanvasConfig> }
  | { type: "SET_GLOBAL_DEFAULT_PLAY_RATE"; playRateHz: number }
  | { type: "SAVE_PRESET"; preset: FamilyPreset }
  | { type: "DELETE_PRESET"; id: string }
  | { type: "APPLY_PRESET_TO_FAMILY"; presetId: string; familyTag: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "BATCH_ADD_EFFECTS"; effects: StudioEffect[] };

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
    overrides: {
      gain: region.overrides.gain ? { ...region.overrides.gain } : null,
      smoothing: region.overrides.smoothing ? { ...region.overrides.smoothing } : null,
      deadzone: region.overrides.deadzone ? { ...region.overrides.deadzone } : null,
      envelope: region.overrides.envelope
        ? {
            points: region.overrides.envelope.points.map((point) => ({ ...point })),
          }
        : null,
    },
  };
}

function cloneEffect(effect: StudioEffect): StudioEffect {
  return {
    waveform: {
      ...effect.waveform,
      samples: new Uint8Array(effect.waveform.samples),
    },
    chain: effect.chain.map(cloneTransformStep),
    regions: effect.regions.map(cloneRegion),
    remastered: effect.remastered ? new Uint8Array(effect.remastered) : null,
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
  redoStack: StudioSnapshot[]
): StudioState {
  return {
    effects: snapshot.effects.map(cloneEffect),
    activeEffectIndex: snapshot.activeEffectIndex,
    activeTransformIndex: snapshot.activeTransformIndex,
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
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length - 1,
        activeTransformIndex: 0,
        selectedRegionId: null,
      };
    }
    case "BATCH_ADD_EFFECTS": {
      const s = pushUndo(state);
      const effects = [...s.effects, ...action.effects.map(cloneEffect)];
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length - 1,
        activeTransformIndex: 0,
        selectedRegionId: null,
      };
    }
    case "REMOVE_EFFECT": {
      const s = pushUndo(state);
      const effects = s.effects.filter((_, i) => i !== action.index);
      const activeEffectIndex = Math.min(
        Math.max(0, effects.length - 1),
        s.activeEffectIndex >= action.index ? s.activeEffectIndex - 1 : s.activeEffectIndex
      );
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length === 0 ? -1 : activeEffectIndex,
        activeTransformIndex: effects.length === 0 ? -1 : s.activeTransformIndex,
        selectedRegionId: null,
      };
    }
    case "REMOVE_SELECTED_EFFECTS": {
      const selectedCount = state.effects.filter((effect) => effect.selected).length;
      if (selectedCount === 0) return state;
      const s = pushUndo(state);
      const effects = s.effects.filter((effect) => !effect.selected);
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeEffectIndex: effects.length === 0 ? -1 : Math.min(s.activeEffectIndex, effects.length - 1),
        activeTransformIndex: effects.length === 0 ? -1 : s.activeTransformIndex,
        selectedRegionId: null,
      };
    }
    case "SET_ACTIVE_EFFECT":
      return {
        ...state,
        activeEffectIndex: action.index,
        activeTransformIndex: 0,
        selectedRegionId: null,
      };
    case "SET_ACTIVE_TRANSFORM":
      return { ...state, activeTransformIndex: action.index };
    case "TOGGLE_EFFECT_SELECTION": {
      const effects = state.effects.map((effect, index) =>
        index === action.index ? { ...effect, selected: !effect.selected } : effect
      );
      return { ...state, effects };
    }
    case "CLEAR_EFFECT_SELECTIONS": {
      const effects = state.effects.map((effect) => ({ ...effect, selected: false }));
      return { ...state, effects };
    }
    case "UPDATE_EFFECT": {
      const effects = state.effects.map((effect, index) =>
        index === action.index ? { ...effect, ...action.patch } : effect
      );
      return { ...state, effects, families: buildFamilies(effects) };
    }
    case "ADD_TRANSFORM": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const newStep: TransformStep = {
        type: action.transformType,
        enabled: true,
        params: getDefaultParams(action.transformType),
      };
      const updated = { ...effect, chain: [...effect.chain, newStep] };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return {
        ...s,
        effects,
        families: buildFamilies(effects),
        activeTransformIndex: updated.chain.length - 1,
      };
    }
    case "REMOVE_TRANSFORM": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const chain = effect.chain.filter((_, i) => i !== action.index);
      const updated = { ...effect, chain };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects };
    }
    case "RESET_TRANSFORMS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const chain = effect.chain.map((step) => ({
        ...step,
        enabled: true,
        params: getDefaultParams(step.type),
      }));
      const updated = { ...effect, chain };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects };
    }
    case "TOGGLE_TRANSFORM": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const chain = effect.chain.map((step, i) =>
        i === action.index ? { ...step, enabled: !step.enabled } : step
      );
      const updated = { ...effect, chain };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects };
    }
    case "UPDATE_TRANSFORM_PARAMS": {
      const effect = state.effects[state.activeEffectIndex];
      if (!effect) return state;
      const chain = effect.chain.map((step, i) =>
        i === action.index ? { ...step, params: action.params } : step
      );
      const updated = { ...effect, chain };
      const effects = state.effects.map((e, i) =>
        i === state.activeEffectIndex ? updated : e
      );
      return { ...state, effects };
    }
    case "REORDER_TRANSFORMS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const chain = [...effect.chain];
      const [removed] = chain.splice(action.fromIndex, 1);
      chain.splice(action.toIndex, 0, removed);
      const updated = { ...effect, chain };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects };
    }
    case "SET_REMASTERED": {
      const effect = state.effects[action.index];
      if (!effect) return state;
      const updated = {
        ...effect,
        remastered: action.data ? new Uint8Array(action.data) : null,
        remasterInfo: action.remasterInfo,
      };
      const effects = state.effects.map((e, i) =>
        i === action.index ? updated : e
      );
      return { ...state, effects };
    }
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_ZOOM":
      return { ...state, zoom: { start: action.start, end: action.end } };
    case "ADD_REGION": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = { ...effect, regions: [...effect.regions, action.region] };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects, selectedRegionId: action.region.id };
    }
    case "REMOVE_REGION": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = {
        ...effect,
        regions: effect.regions.filter((r) => r.id !== action.id),
      };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return {
        ...s,
        effects,
        selectedRegionId: s.selectedRegionId === action.id ? null : s.selectedRegionId,
      };
    }
    case "CLEAR_REGIONS": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = { ...effect, regions: [] };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects, selectedRegionId: null };
    }
    case "UPDATE_REGION": {
      const effect = state.effects[state.activeEffectIndex];
      if (!effect) return state;
      const updated = {
        ...effect,
        regions: effect.regions.map((r) =>
          r.id === action.region.id ? action.region : r
        ),
      };
      const effects = state.effects.map((e, i) =>
        i === state.activeEffectIndex ? updated : e
      );
      return { ...state, effects };
    }
    case "SET_SELECTED_REGION":
      return { ...state, selectedRegionId: action.id };
    case "SET_METADATA": {
      const effects = state.effects.map((e) => {
        const meta = action.metadata[e.waveform.name + ".bin"] ?? action.metadata[e.waveform.name];
        if (meta) {
          return {
            ...e,
            metadata: meta,
            familyTag: meta.family,
            playRateHz: meta.playRateHz ?? e.playRateHz ?? state.globalDefaultPlayRateHz,
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
      const presets = [...state.presets.filter((preset) => preset.id !== action.preset.id), clonePreset(action.preset)];
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
          : effect
      );
      return { ...state, effects, activeTransformIndex: 0 };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return fromSnapshot(
        prev,
        state.undoStack.slice(0, -1),
        [...state.redoStack, createSnapshot(state)]
      );
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return fromSnapshot(
        next,
        [...state.undoStack, createSnapshot(state)],
        state.redoStack.slice(0, -1)
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
  viewMode: "overlay",
  zoom: { start: 0, end: 1 },
  families: {},
  presets: [],
  selectedRegionId: null,
  canvasConfig: {
    height: 320,
    density: 1,
  },
  globalDefaultPlayRateHz: 8000,
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
