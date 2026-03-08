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

export interface StudioEffect {
  waveform: WaveformData;
  chain: TransformStep[];
  regions: Region[];
  remastered: Uint8Array | null;
  metadata?: EffectMetadata;
}

export interface StudioState {
  effects: StudioEffect[];
  activeEffectIndex: number;
  activeTransformIndex: number;
  viewMode: "original" | "remastered" | "diff" | "overlay";
  zoom: { start: number; end: number };
  families: Record<string, string[]>;
  undoStack: StudioState[];
  redoStack: StudioState[];
}

type Action =
  | { type: "ADD_EFFECT"; effect: StudioEffect }
  | { type: "REMOVE_EFFECT"; index: number }
  | { type: "SET_ACTIVE_EFFECT"; index: number }
  | { type: "SET_ACTIVE_TRANSFORM"; index: number }
  | { type: "ADD_TRANSFORM"; transformType: TransformType }
  | { type: "REMOVE_TRANSFORM"; index: number }
  | { type: "TOGGLE_TRANSFORM"; index: number }
  | {
      type: "UPDATE_TRANSFORM_PARAMS";
      index: number;
      params: TransformStep["params"];
    }
  | { type: "REORDER_TRANSFORMS"; fromIndex: number; toIndex: number }
  | { type: "SET_REMASTERED"; data: Uint8Array }
  | { type: "SET_VIEW_MODE"; mode: StudioState["viewMode"] }
  | { type: "SET_ZOOM"; start: number; end: number }
  | { type: "ADD_REGION"; region: Region }
  | { type: "REMOVE_REGION"; id: string }
  | { type: "UPDATE_REGION"; region: Region }
  | { type: "SET_METADATA"; metadata: Record<string, EffectMetadata> }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "BATCH_ADD_EFFECTS"; effects: StudioEffect[] };

function pushUndo(state: StudioState): StudioState {
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-30), { ...state, undoStack: [], redoStack: [] }],
    redoStack: [],
  };
}

function studioReducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "ADD_EFFECT": {
      const s = pushUndo(state);
      return {
        ...s,
        effects: [...s.effects, action.effect],
        activeEffectIndex: s.effects.length,
      };
    }
    case "BATCH_ADD_EFFECTS": {
      const s = pushUndo(state);
      return {
        ...s,
        effects: [...s.effects, ...action.effects],
        activeEffectIndex: s.effects.length,
      };
    }
    case "REMOVE_EFFECT": {
      const s = pushUndo(state);
      const effects = s.effects.filter((_, i) => i !== action.index);
      return {
        ...s,
        effects,
        activeEffectIndex: Math.min(s.activeEffectIndex, effects.length - 1),
      };
    }
    case "SET_ACTIVE_EFFECT":
      return { ...state, activeEffectIndex: action.index, activeTransformIndex: 0 };
    case "SET_ACTIVE_TRANSFORM":
      return { ...state, activeTransformIndex: action.index };
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
      const effect = state.effects[state.activeEffectIndex];
      if (!effect) return state;
      const updated = { ...effect, remastered: action.data };
      const effects = state.effects.map((e, i) =>
        i === state.activeEffectIndex ? updated : e
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
      return { ...s, effects };
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
      return { ...s, effects };
    }
    case "UPDATE_REGION": {
      const s = pushUndo(state);
      const effect = s.effects[s.activeEffectIndex];
      if (!effect) return s;
      const updated = {
        ...effect,
        regions: effect.regions.map((r) =>
          r.id === action.region.id ? action.region : r
        ),
      };
      const effects = s.effects.map((e, i) =>
        i === s.activeEffectIndex ? updated : e
      );
      return { ...s, effects };
    }
    case "SET_METADATA": {
      const effects = state.effects.map((e) => {
        const meta = action.metadata[e.waveform.name + ".bin"] ?? action.metadata[e.waveform.name];
        if (meta) {
          return {
            ...e,
            metadata: meta,
            waveform: { ...e.waveform, familyId: meta.family, effectId: String(meta.effectId), style: meta.style },
          };
        }
        return e;
      });
      const families: Record<string, string[]> = {};
      for (const e of effects) {
        const fam = e.waveform.familyId ?? "default";
        if (!families[fam]) families[fam] = [];
        families[fam].push(e.waveform.id);
      }
      return { ...state, effects, families };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [
          ...state.redoStack,
          { ...state, undoStack: [], redoStack: [] },
        ],
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [
          ...state.undoStack,
          { ...state, undoStack: [], redoStack: [] },
        ],
      };
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
