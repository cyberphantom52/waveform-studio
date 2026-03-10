"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { computeDelta } from "@/lib/dsp/stats";
import {
  BROWSE_WAVEFORM_DRAG_TYPE,
  createStudioEffectFromRegion,
  getTimelineOriginalSamples,
} from "@/lib/studio-io";
import {
  getRegionLength,
  splitTimelineRegionsAtCursor,
  type Region,
} from "@/lib/dsp/region";
import { clampZoomWindow, scaleZoomWindow } from "@/lib/zoom";
import { ClipTrack } from "@/components/studio/clip-track";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WaveformTrack } from "@/components/studio/waveform-track";
import { Slider } from "@/components/ui/slider";
import { ScanSearch } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type WaveformTrackId = "main" | "diff";
type VisibleLayer = "original" | "remastered" | "diff" | "compare";

const DEFAULT_TRACK_ORDER: WaveformTrackId[] = [
  "main",
  "diff",
];

function normalizeTrackOrder(trackOrder: string[]): WaveformTrackId[] {
  const seen = new Set<WaveformTrackId>();
  const normalized: WaveformTrackId[] = [];

  for (const item of trackOrder) {
    const next =
      item === "diff"
        ? "diff"
        : item === "main" || item === "original" || item === "remastered"
          ? "main"
          : null;
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }

  for (const fallback of DEFAULT_TRACK_ORDER) {
    if (!seen.has(fallback)) normalized.push(fallback);
  }

  return normalized;
}

function pathFromSamples(
  samples: ArrayLike<number>,
  width: number,
  height: number,
  minValue: number,
  maxValue: number,
  density: number,
) {
  if (!samples.length || width <= 0 || height <= 0) return "";
  const maxPoints = Math.max(32, Math.floor(width * Math.max(1, density)));
  const step = Math.max(1, Math.ceil(samples.length / maxPoints));
  const points: string[] = [];
  const valueRange = maxValue - minValue || 1;
  const verticalPadding = Math.min(height * 0.08, 12);
  const drawableHeight = Math.max(0, height - verticalPadding * 2);

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    const x = (index / Math.max(1, samples.length - 1)) * width;
    const normalized = (sample - minValue) / valueRange;
    const y = verticalPadding + (1 - normalized) * drawableHeight;
    points.push(
      `${points.length === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`,
    );
  }

  return points.join(" ");
}

export function WaveformCanvas() {
  const state = useStudio();
  const dispatch = useStudioDispatch();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const panStateRef = useRef<{ startClientX: number; startZoomStart: number } | null>(null);
  const trackDragRef = useRef<{
    trackId: WaveformTrackId;
  } | null>(null);
  const clipStretchRef = useRef<
    | {
        mode: "start" | "end";
        region: Region;
        startClientX: number;
        minStart?: number;
        maxStart?: number;
        fixedStart?: number;
        minEnd?: number;
        maxEnd?: number;
      }
    | null
  >(null);
  const clipDragRef = useRef<
    | {
        region: Region;
        startClientX: number;
        minStart: number;
        maxStart: number;
      }
    | null
  >(null);
  const cursorDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [width, setWidth] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isCursorDragging, setIsCursorDragging] = useState(false);
  const [draggedTrackId, setDraggedTrackId] = useState<WaveformTrackId | null>(null);
  const [draftClipPlacement, setDraftClipPlacement] = useState<
    { start: number; length: number } | null
  >(null);
  const [trackOrder, setTrackOrder] = useState<WaveformTrackId[]>(DEFAULT_TRACK_ORDER);
  const [visibleLayers, setVisibleLayers] = useState<VisibleLayer[]>([
    "original",
    "remastered",
  ]);
  const [cursorSample, setCursorSample] = useState<number | null>(null);
  const [insertMarkerSample, setInsertMarkerSample] = useState<number | null>(null);
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number } | null>(null);
  const effect = state.effects[state.activeEffectIndex];
  const canvasHeight = state.canvasConfig.height;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setWidth(rect.width);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selectedClip =
    effect?.regions.find((region) => region.id === state.selectedRegionId) ?? null;
  const timelineOriginal = effect ? getTimelineOriginalSamples(effect) : new Int8Array();
  const original = effect ? effect.waveform.samples : new Int8Array();
  const compare = state.compareWaveform?.samples ?? new Int8Array();
  const remastered = effect?.remastered ?? timelineOriginal;
  const baseLength = Math.max(
    timelineOriginal.length,
    original.length,
    compare.length,
    remastered.length,
    1,
  );
  const minZoomRange = 1 / baseLength;
  const zoomRange = state.zoom.end - state.zoom.start;
  const startSample = Math.floor(state.zoom.start * baseLength);
  const endSample = Math.max(
    startSample + 1,
    Math.ceil(state.zoom.end * baseLength),
  );
  const sliceSamplesWithSilence = (
    samples: Int8Array,
    rangeStart: number,
    rangeEnd: number,
  ) => {
    const length = Math.max(0, rangeEnd - rangeStart);
    const out = new Int8Array(length);
    if (length === 0) return out;

    const safeStart = Math.max(0, Math.min(rangeStart, samples.length));
    const safeEnd = Math.max(safeStart, Math.min(rangeEnd, samples.length));
    if (safeEnd <= safeStart) return out;

    out.set(samples.slice(safeStart, safeEnd), safeStart - rangeStart);
    return out;
  };

  const visibleOriginal = sliceSamplesWithSilence(original, startSample, endSample);
  const visibleCompare = sliceSamplesWithSilence(compare, startSample, endSample);
  const visibleRemastered = sliceSamplesWithSilence(
    remastered,
    startSample,
    endSample,
  );
  const visibleDiff = computeDelta(visibleOriginal, visibleRemastered);

  const axisHeight = 26;
  const timelineHeight = 38;
  const margin = {
    top: 12,
    right: 8,
    bottom: axisHeight + timelineHeight + 8,
    left: 28,
  };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, canvasHeight - margin.top - margin.bottom);
  const effectiveVisibleLayers = useMemo(
    () =>
      state.compareWaveform
        ? visibleLayers
        : visibleLayers.filter((layer) => layer !== "compare"),
    [state.compareWaveform, visibleLayers],
  );
  const effectiveTrackOrder = normalizeTrackOrder(trackOrder as string[]);
  const activeTrackIds = effectiveTrackOrder.filter((trackId) =>
    trackId === "main"
      ? effectiveVisibleLayers.includes("original") ||
        effectiveVisibleLayers.includes("remastered") ||
        effectiveVisibleLayers.includes("compare")
      : effectiveVisibleLayers.includes("diff"),
  );
  const trackGap = activeTrackIds.length > 1 ? 12 : 0;
  const perTrackHeight =
    activeTrackIds.length > 0
      ? Math.max(
          56,
          Math.floor((innerHeight - trackGap * (activeTrackIds.length - 1)) / activeTrackIds.length),
        )
      : innerHeight;
  const timelineTop = innerHeight + axisHeight;
  const timelineBlockTop = timelineTop + 16;
  const timelineBlockHeight = Math.max(8, timelineHeight - 20);
  const clipHandleWidth = 10;
  const scrollContentWidth =
    width > 0 ? Math.max(width + 1, Math.round(width / zoomRange)) : 0;
  const maxScrollLeft = Math.max(0, scrollContentWidth - width);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (!effect || innerWidth <= 0) return;

      const dominantDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        const bounds = element.getBoundingClientRect();
        const relativeX = Math.min(
          Math.max(event.clientX - bounds.left - margin.left, 0),
          innerWidth,
        );
        const anchor = innerWidth > 0 ? relativeX / innerWidth : 0.5;
        const zoomFactor = Math.exp(event.deltaY * 0.0025);
        const nextZoom = scaleZoomWindow(
          state.zoom,
          zoomFactor,
          anchor,
          minZoomRange,
        );
        dispatch({ type: "SET_ZOOM", ...nextZoom });
        return;
      }

      if (dominantDelta === 0) return;
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [dispatch, effect, innerWidth, margin.left, minZoomRange, state.zoom, zoomRange]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (cursorSample === null) return;
        event.preventDefault();
        setCursorSample(null);
        dispatch({ type: "SET_SELECTED_REGION", id: null });
        return;
      }

      if (!effect) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedClip) return;
        event.preventDefault();
        dispatch({ type: "REMOVE_REGION", id: selectedClip.id });
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (cursorSample === null) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const delta = event.key === "ArrowLeft" ? -step : step;
        const nextCursorSample = Math.max(0, Math.min(cursorSample + delta, baseLength));
        setCursorSample(nextCursorSample);
        dispatch({ type: "SET_SELECTED_REGION", id: null });
        return;
      }

      if (event.key === "c" || event.key === "C") {
        if (cursorSample === null) return;
        event.preventDefault();
        const nextTimeline = splitTimelineRegionsAtCursor(
          effect.regions,
          cursorSample,
          effect.waveform.samples.length,
        );
        dispatch({ type: "SET_REGIONS", regions: nextTimeline.regions });
        dispatch({
          type: "SET_SELECTED_REGION",
          id: nextTimeline.selectedIds[0] ?? null,
        });
        setDragTooltip(null);
        return;
      }

      if (event.key === "n" || event.key === "N") {
        if (!selectedClip) return;
        event.preventDefault();
        dispatch({
          type: "ADD_EFFECT",
          effect: createStudioEffectFromRegion(effect, selectedClip),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [baseLength, cursorSample, dispatch, effect, selectedClip]);


  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDraftClipPlacement(null);
      setCursorSample(null);
      setDragTooltip(null);
      setIsCursorDragging(false);
      cursorDragRef.current = false;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [effect?.waveform.id]);

  useEffect(() => {
    const element = scrollbarRef.current;
    if (!element) return;

    const maxStart = Math.max(0, 1 - zoomRange);
    const targetScrollLeft =
      maxScrollLeft > 0 && maxStart > 0
        ? (state.zoom.start / maxStart) * maxScrollLeft
        : 0;

    if (Math.abs(element.scrollLeft - targetScrollLeft) < 1) return;

    syncingScrollRef.current = true;
    element.scrollLeft = targetScrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [maxScrollLeft, state.zoom.start, zoomRange]);

  const xForSample = (sample: number) => {
    const span = Math.max(1, endSample - startSample);
    return ((sample - startSample) / span) * innerWidth;
  };

  const cursorFromPoint = (x: number) => {
    const clampedX = Math.max(0, Math.min(innerWidth, x));
    const span = Math.max(1, endSample - startSample);
    const sample =
      startSample + Math.round((clampedX / Math.max(1, innerWidth)) * span);
    return Math.max(0, Math.min(sample, baseLength));
  };

  const originalPath = useMemo(
    () =>
      pathFromSamples(
        visibleOriginal,
        innerWidth,
        perTrackHeight,
        -128,
        127,
        state.canvasConfig.density,
      ),
    [visibleOriginal, innerWidth, perTrackHeight, state.canvasConfig.density],
  );
  const comparePath = useMemo(
    () =>
      pathFromSamples(
        visibleCompare,
        innerWidth,
        perTrackHeight,
        -128,
        127,
        state.canvasConfig.density,
      ),
    [visibleCompare, innerWidth, perTrackHeight, state.canvasConfig.density],
  );
  const remasteredPath = useMemo(
    () =>
      pathFromSamples(
        visibleRemastered,
        innerWidth,
        perTrackHeight,
        -128,
        127,
        state.canvasConfig.density,
      ),
    [visibleRemastered, innerWidth, perTrackHeight, state.canvasConfig.density],
  );
  const diffPath = useMemo(
    () =>
      pathFromSamples(
        visibleDiff,
        innerWidth,
        perTrackHeight,
        -255,
        255,
        state.canvasConfig.density,
      ),
    [visibleDiff, innerWidth, perTrackHeight, state.canvasConfig.density],
  );

  const timelineRegions = useMemo(() => {
    if (!effect) return [] as Array<{
      region: Region;
      timelineStart: number;
      timelineEnd: number;
    }>;

    return effect.regions
      .map((region) => {
        const isDraft = draftClipPlacement !== null && selectedClip?.id === region.id;
        const timelineStart = isDraft
          ? draftClipPlacement.start
          : region.timelineStart;
        const timelineEnd = timelineStart + (isDraft ? draftClipPlacement.length : getRegionLength(region));
        return { region, timelineStart, timelineEnd };
      })
      .sort((left, right) => left.timelineStart - right.timelineStart);
  }, [draftClipPlacement, effect, selectedClip?.id]);

  const waveformTracks = useMemo(() => {
    return activeTrackIds.map((trackId, index) => {
      const top = index * (perTrackHeight + trackGap);

      if (trackId === "main") {
        const showOriginal = effectiveVisibleLayers.includes("original");
        const showRemastered = effectiveVisibleLayers.includes("remastered");
        const showCompare =
          effectiveVisibleLayers.includes("compare") && compare.length > 0;
        const lineLayers = [
          showRemastered
            ? {
                path: remasteredPath,
                stroke: "var(--waveform-remastered)",
                strokeWidth: 1.25,
                opacity: 1,
              }
            : null,
          showOriginal
            ? {
                path: originalPath,
                stroke: "var(--waveform-original)",
                strokeWidth: showRemastered ? 1 : 1.1,
                opacity: showRemastered ? 0.45 : 1,
              }
            : null,
          showCompare
            ? {
                path: comparePath,
                stroke: "var(--chart-3)",
                strokeWidth: 1.1,
                opacity: 0.9,
              }
            : null,
        ].filter((layer) => layer !== null);
        const [primary, secondary, tertiary] = lineLayers;
        return {
          id: trackId,
          label: [showOriginal ? "OG" : null, showRemastered ? "RM" : null, showCompare ? "CMP" : null]
            .filter((item): item is string => item !== null)
            .join("/"),
          minValue: -128,
          maxValue: 127,
          path: primary?.path,
          stroke: primary?.stroke ?? "var(--waveform-original)",
          strokeWidth: primary?.strokeWidth ?? 1,
          opacity: primary?.opacity ?? 1,
          secondaryPath: secondary?.path,
          secondaryStroke: secondary?.stroke,
          secondaryStrokeWidth: secondary?.strokeWidth,
          secondaryOpacity: secondary?.opacity,
          tertiaryPath: tertiary?.path,
          tertiaryStroke: tertiary?.stroke,
          tertiaryStrokeWidth: tertiary?.strokeWidth,
          tertiaryOpacity: tertiary?.opacity,
          ticks: [-128, -64, 0, 64, 127],
          top,
        };
      }

      return {
        id: trackId,
        label: "DF",
        minValue: -255,
        maxValue: 255,
        path: diffPath,
        stroke: "var(--waveform-delta)",
        strokeWidth: 1.25,
        opacity: 1,
        ticks: undefined,
        top,
        backgroundFill: "var(--muted)",
        backgroundOpacity: 0.18,
        backgroundRadius: 6,
        separatorTop: { stroke: "var(--border)", strokeWidth: 1.5, opacity: 0.9 },
        separatorBottom: { stroke: "var(--border)", strokeWidth: 1, opacity: 0.5 },
        zeroLine: { value: 0, stroke: "var(--waveform-grid)", strokeWidth: 1 },
      };
    });
  }, [
    activeTrackIds,
    compare.length,
    comparePath,
    diffPath,
    originalPath,
    perTrackHeight,
    remasteredPath,
    trackGap,
    effectiveVisibleLayers,
  ]);

  const selectedClipEntry =
    timelineRegions.find((region) => region.region.id === state.selectedRegionId) ?? null;

  const visibleCursorX =
    cursorSample !== null && cursorSample >= startSample && cursorSample <= endSample
      ? xForSample(cursorSample)
      : null;
  const visibleInsertMarkerX =
    insertMarkerSample !== null &&
    insertMarkerSample >= startSample &&
    insertMarkerSample <= endSample
      ? xForSample(insertMarkerSample)
      : null;
  const cursorPositionMs =
    effect && cursorSample !== null
      ? (cursorSample / effect.waveform.sampleRate) * 1000
      : 0;

  const formatDurationMs = (durationMs: number) => {
    if (durationMs >= 100) return `${durationMs.toFixed(0)} ms`;
    if (durationMs >= 10) return `${durationMs.toFixed(1)} ms`;
    return `${durationMs.toFixed(2)} ms`;
  };

  const updateDragTooltip = (event: {
    currentTarget: { getBoundingClientRect: () => DOMRect };
    clientX: number;
    clientY: number;
  }) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setDragTooltip({
      x: Math.max(8, Math.min(width - 8, event.clientX - bounds.left + 14)),
      y: Math.max(8, event.clientY - bounds.top - 14),
    });
  };

  const handleTimelineDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!effect) return;
    const dragTypes = Array.from(event.dataTransfer.types);
    if (!dragTypes.includes(BROWSE_WAVEFORM_DRAG_TYPE)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - bounds.top - margin.top;
    const isOverTimeline =
      relativeY >= timelineTop && relativeY <= timelineTop + timelineHeight;
    if (!isOverTimeline) {
      if (insertMarkerSample !== null) setInsertMarkerSample(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const relativeX = Math.min(
      Math.max(event.clientX - bounds.left - margin.left, 0),
      innerWidth,
    );
    setInsertMarkerSample(cursorFromPoint(relativeX));
  };

  const handleTimelineDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setInsertMarkerSample(null);
  };

  const handleTimelineDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!effect || innerWidth <= 0) return;
    const sourceEffectId = event.dataTransfer.getData(BROWSE_WAVEFORM_DRAG_TYPE);
    if (!sourceEffectId) {
      setInsertMarkerSample(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - bounds.top - margin.top;
    const isOverTimeline =
      relativeY >= timelineTop && relativeY <= timelineTop + timelineHeight;
    if (!isOverTimeline) {
      setInsertMarkerSample(null);
      return;
    }

    event.preventDefault();
    const relativeX = Math.min(
      Math.max(event.clientX - bounds.left - margin.left, 0),
      innerWidth,
    );
    setInsertMarkerSample(null);
    dispatch({
      type: "INSERT_EFFECT_CLIP",
      sourceEffectId,
      timelineStart: cursorFromPoint(relativeX),
    });
  };

  const handleTrackHandlePointerDown = (
    trackId: string,
    event: React.PointerEvent<SVGGElement>,
  ) => {
    const nextTrackId: WaveformTrackId = trackId === "diff" ? "diff" : "main";
    trackDragRef.current = { trackId: nextTrackId };
    setDraggedTrackId(nextTrackId);
    suppressClickRef.current = false;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
  };

  const handlePlotPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    if (innerWidth <= 0 || event.button !== 0) return;

    const svgElement = event.currentTarget.ownerSVGElement;
    if (!svgElement) return;

    const svgBounds = svgElement.getBoundingClientRect();
    const relativeX = Math.min(
      Math.max(event.clientX - svgBounds.left - margin.left, 0),
      innerWidth,
    );

    cursorDragRef.current = true;
    setIsCursorDragging(true);
    setCursorSample(cursorFromPoint(relativeX));
    suppressClickRef.current = false;
    dispatch({ type: "SET_SELECTED_REGION", id: null });
    updateDragTooltip(event);
    svgElement.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (innerWidth <= 0) return;

    const target = event.target as Element | null;
    const clipHandle = target?.closest("[data-clip-handle][data-clip-id]");
    const clipTarget = target?.closest("[data-clip-lane-hit][data-clip-id]");

    if (
      event.button === 0 &&
      clipHandle &&
      selectedClipEntry &&
      clipHandle.getAttribute("data-clip-id") === selectedClipEntry.region.id
    ) {
      const mode = clipHandle.getAttribute("data-clip-handle");
      const index = timelineRegions.findIndex(
        (timelineRegion) => timelineRegion.region.id === selectedClipEntry.region.id,
      );
      const previousRegion = index > 0 ? timelineRegions[index - 1] : null;
      const nextRegion =
        index >= 0 && index < timelineRegions.length - 1
          ? timelineRegions[index + 1]
          : null;
      const clipLength = getRegionLength(selectedClipEntry.region);
      const fixedStart = selectedClipEntry.timelineStart;
      const fixedEnd = fixedStart + clipLength;

      if (mode === "start") {
        clipStretchRef.current = {
          mode: "start",
          region: selectedClipEntry.region,
          startClientX: event.clientX,
          minStart: previousRegion ? previousRegion.timelineEnd : 0,
          maxStart: fixedEnd - 1,
        };
      } else if (mode === "end") {
        clipStretchRef.current = {
          mode: "end",
          region: selectedClipEntry.region,
          startClientX: event.clientX,
          fixedStart,
          minEnd: fixedStart + 1,
          maxEnd: nextRegion
            ? nextRegion.timelineStart
            : effect.waveform.samples.length,
        };
      }

      setDraftClipPlacement({ start: fixedStart, length: clipLength });
      suppressClickRef.current = false;
      setCursorSample(null);
      setDragTooltip(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (
      event.button === 0 &&
      clipTarget &&
      selectedClipEntry &&
      clipTarget.getAttribute("data-clip-id") === selectedClipEntry.region.id
    ) {
      const index = timelineRegions.findIndex(
        (timelineRegion) => timelineRegion.region.id === selectedClipEntry.region.id,
      );
      const previousRegion = index > 0 ? timelineRegions[index - 1] : null;
      const nextRegion =
        index >= 0 && index < timelineRegions.length - 1
          ? timelineRegions[index + 1]
          : null;
      const clipLength = getRegionLength(selectedClipEntry.region);

      clipDragRef.current = {
        region: selectedClipEntry.region,
        startClientX: event.clientX,
        minStart: previousRegion ? previousRegion.timelineEnd : 0,
        maxStart: nextRegion
          ? nextRegion.timelineStart - clipLength
          : Math.max(0, effect.waveform.samples.length - clipLength),
      };
      setDraftClipPlacement({
        start: selectedClipEntry.timelineStart,
        length: clipLength,
      });
      suppressClickRef.current = false;
      setCursorSample(null);
      setDragTooltip(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (event.button === 2) {
      if (zoomRange >= 1) return;
      panStateRef.current = {
        startClientX: event.clientX,
        startZoomStart: state.zoom.start,
      };
      suppressClickRef.current = false;
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (innerWidth <= 0) return;

    const panState = panStateRef.current;
    if (panState) {
      const deltaX = event.clientX - panState.startClientX;
      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
      }

      const panDelta = (-deltaX / innerWidth) * zoomRange;
      const nextZoom = clampZoomWindow(
        panState.startZoomStart + panDelta,
        panState.startZoomStart + zoomRange + panDelta,
        minZoomRange,
      );
      dispatch({ type: "SET_ZOOM", ...nextZoom });
      return;
    }

    const trackDrag = trackDragRef.current;
    if (trackDrag) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const relativeY = event.clientY - bounds.top - margin.top;
      const targetIndex = activeTrackIds.findIndex((trackId, index) => {
        const top = index * (perTrackHeight + trackGap);
        return relativeY >= top && relativeY <= top + perTrackHeight;
      });

      if (targetIndex >= 0) {
        const currentVisibleOrder = effectiveTrackOrder.filter((trackId) =>
          trackId === "main"
            ? effectiveVisibleLayers.includes("original") ||
              effectiveVisibleLayers.includes("remastered") ||
              effectiveVisibleLayers.includes("compare")
            : effectiveVisibleLayers.includes("diff"),
        );
        const currentIndex = currentVisibleOrder.indexOf(trackDrag.trackId);
        if (currentIndex !== targetIndex) {
          const nextVisibleOrder = [...currentVisibleOrder];
          const [moved] = nextVisibleOrder.splice(currentIndex, 1);
          nextVisibleOrder.splice(targetIndex, 0, moved);
          const hiddenOrder = effectiveTrackOrder.filter(
            (trackId) =>
              trackId === "main"
                ? !effectiveVisibleLayers.includes("original") &&
                  !effectiveVisibleLayers.includes("remastered") &&
                  !effectiveVisibleLayers.includes("compare")
                : !effectiveVisibleLayers.includes("diff"),
          );
          setTrackOrder([...nextVisibleOrder, ...hiddenOrder]);
        }
      }
      return;
    }

    const clipStretch = clipStretchRef.current;
    if (clipStretch) {
      const visibleSpan = Math.max(1, endSample - startSample);
      const deltaX = event.clientX - clipStretch.startClientX;
      const deltaSamples = Math.round(
        (deltaX / Math.max(1, innerWidth)) * visibleSpan,
      );

      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
      }

      if (clipStretch.mode === "start") {
        const nextStart = Math.max(
          clipStretch.minStart ?? 0,
          Math.min(
            clipStretch.region.timelineStart + deltaSamples,
            clipStretch.maxStart ?? clipStretch.region.timelineStart,
          ),
        );
        const fixedEnd =
          clipStretch.region.timelineStart + getRegionLength(clipStretch.region);
        setDraftClipPlacement({
          start: nextStart,
          length: fixedEnd - nextStart,
        });
        return;
      }

      const nextEnd = Math.max(
        clipStretch.minEnd ?? 1,
        Math.min(
          clipStretch.region.timelineStart + getRegionLength(clipStretch.region) + deltaSamples,
          clipStretch.maxEnd ?? effect.waveform.samples.length,
        ),
      );
      const fixedStart = clipStretch.fixedStart ?? clipStretch.region.timelineStart;
      setDraftClipPlacement({
        start: fixedStart,
        length: nextEnd - fixedStart,
      });
      return;
    }

    const clipDrag = clipDragRef.current;
    if (clipDrag) {
      const visibleSpan = Math.max(1, endSample - startSample);
      const deltaX = event.clientX - clipDrag.startClientX;
      const deltaSamples = Math.round(
        (deltaX / Math.max(1, innerWidth)) * visibleSpan,
      );

      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
      }

      const nextStart = Math.max(
        clipDrag.minStart,
        Math.min(clipDrag.region.timelineStart + deltaSamples, clipDrag.maxStart),
      );
      setDraftClipPlacement({
        start: nextStart,
        length: getRegionLength(clipDrag.region),
      });
      return;
    }

    if (!cursorDragRef.current) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(
      Math.max(event.clientX - bounds.left - margin.left, 0),
      innerWidth,
    );
    setCursorSample(cursorFromPoint(relativeX));
    updateDragTooltip(event);
  };

  const handlePointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panStateRef.current) {
      panStateRef.current = null;
      setIsPanning(false);
    }

    if (cursorDragRef.current) {
      cursorDragRef.current = false;
      setIsCursorDragging(false);
    }

    if (clipStretchRef.current) {
      if (
        draftClipPlacement !== null &&
        (draftClipPlacement.start !== clipStretchRef.current.region.timelineStart ||
          draftClipPlacement.length !== getRegionLength(clipStretchRef.current.region))
      ) {
        dispatch({
          type: "UPDATE_REGION",
          region: {
            ...clipStretchRef.current.region,
            timelineStart: draftClipPlacement.start,
            timelineLength: draftClipPlacement.length,
          },
        });
      }
      clipStretchRef.current = null;
      setDraftClipPlacement(null);
    }

    if (clipDragRef.current) {
      if (
        draftClipPlacement !== null &&
        draftClipPlacement.start !== clipDragRef.current.region.timelineStart
      ) {
        dispatch({
          type: "UPDATE_REGION",
          region: {
            ...clipDragRef.current.region,
            timelineStart: draftClipPlacement.start,
            timelineLength: draftClipPlacement.length,
          },
        });
      }
      clipDragRef.current = null;
      setDraftClipPlacement(null);
    }

    if (trackDragRef.current) {
      trackDragRef.current = null;
      setDraggedTrackId(null);
    }


    setDragTooltip(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const handleScrollbarScroll = () => {
    const element = scrollbarRef.current;
    if (!element || syncingScrollRef.current || maxScrollLeft <= 0) return;

    const maxStart = Math.max(0, 1 - zoomRange);
    if (maxStart <= 0) return;

    const nextStart = (element.scrollLeft / maxScrollLeft) * maxStart;
    dispatch({
      type: "SET_ZOOM",
      start: nextStart,
      end: nextStart + zoomRange,
    });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Waveform
        </span>
        <ToggleGroup
          type="multiple"
          value={effectiveVisibleLayers}
          onValueChange={(value) =>
            setVisibleLayers((Array.isArray(value) ? value : []) as VisibleLayer[])
          }
          className="gap-0"
        >
          <ToggleGroupItem value="original" className="h-5 px-1.5 text-[10px]">
            OG
          </ToggleGroupItem>
          <ToggleGroupItem
            value="remastered"
            className="h-5 px-1.5 text-[10px]"
          >
            RM
          </ToggleGroupItem>
          <ToggleGroupItem value="diff" className="h-5 px-1.5 text-[10px]">
            DF
          </ToggleGroupItem>
          {state.compareWaveform && (
            <ToggleGroupItem value="compare" className="h-5 px-1.5 text-[10px]">
              CMP
            </ToggleGroupItem>
          )}
        </ToggleGroup>
        <span className="text-[10px] text-muted-foreground">
          {cursorSample !== null
            ? `Cursor ${cursorSample} · ${formatDurationMs(cursorPositionMs)}`
            : state.compareWaveform
              ? `Compare ${state.compareWaveform.name} · Left-click/drag cursor · Right-drag pan · C split · Click clip to select · N waveform · Del delete clip`
              : "Left-click/drag cursor · Right-drag pan · C split · Click clip to select · N waveform · Del delete clip"}
        </span>
        <div className="ml-auto flex min-w-48 items-center gap-2">
          <ScanSearch className="size-3.5 text-muted-foreground" />
          <Slider
            min={220}
            max={520}
            step={10}
            value={[state.canvasConfig.height]}
            onValueChange={([value]) =>
              dispatch({ type: "SET_CANVAS_CONFIG", config: { height: value } })
            }
            className="flex-1"
          />
          <span className="w-10 text-right text-[10px] text-muted-foreground">
            {state.canvasConfig.height}
          </span>
          <Slider
            min={1}
            max={4}
            step={0.5}
            value={[state.canvasConfig.density]}
            onValueChange={([value]) =>
              dispatch({
                type: "SET_CANVAS_CONFIG",
                config: { density: value },
              })
            }
            className="w-20"
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-background"
        onDragOver={handleTimelineDragOver}
        onDragLeave={handleTimelineDragLeave}
        onDrop={handleTimelineDrop}
      >
        {!effect ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Import .bin files to visualize waveforms
            </p>
          </div>
        ) : (
          <svg
            width={width}
            height={canvasHeight}
            className={isPanning ? "block cursor-grabbing" : isCursorDragging ? "block cursor-crosshair" : "block"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onContextMenu={(event) => event.preventDefault()}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {waveformTracks.map((track) => (
                <WaveformTrack
                  key={track.id}
                  trackId={track.id}
                  width={innerWidth}
                  height={perTrackHeight}
                  top={track.top}
                  minValue={track.minValue}
                  maxValue={track.maxValue}
                  path={track.path}
                  stroke={track.stroke}
                  strokeWidth={track.strokeWidth}
                  opacity={track.opacity}
                  secondaryPath={track.secondaryPath}
                  secondaryStroke={track.secondaryStroke}
                  secondaryStrokeWidth={track.secondaryStrokeWidth}
                  secondaryOpacity={track.secondaryOpacity}
                  tertiaryPath={track.tertiaryPath}
                  tertiaryStroke={track.tertiaryStroke}
                  tertiaryStrokeWidth={track.tertiaryStrokeWidth}
                  tertiaryOpacity={track.tertiaryOpacity}
                  ticks={track.ticks}
                  backgroundFill={track.backgroundFill}
                  backgroundOpacity={track.backgroundOpacity}
                  separatorTop={track.separatorTop}
                  separatorBottom={track.separatorBottom}
                  zeroLine={track.zeroLine}
                  label={track.label}
                  showHandle={true}
                  isDragging={draggedTrackId === track.id}
                  onHandlePointerDown={handleTrackHandlePointerDown}
                  onPlotPointerDown={handlePlotPointerDown}
                />
              ))}

              <ClipTrack
                innerWidth={innerWidth}
                timelineTop={timelineTop}
                timelineHeight={timelineHeight}
                timelineBlockTop={timelineBlockTop}
                timelineBlockHeight={timelineBlockHeight}
                clipHandleWidth={clipHandleWidth}
                timelineRegions={timelineRegions}
                startSample={startSample}
                endSample={endSample}
                selectedRegionId={state.selectedRegionId}
                cursorX={visibleCursorX}
                insertMarkerX={visibleInsertMarkerX}
                xForSample={xForSample}
                onClipClick={(regionId) => {
                  if (suppressClickRef.current) return;
                  setCursorSample(null);
                  setDragTooltip(null);
                  dispatch({ type: "SET_SELECTED_REGION", id: regionId });
                }}
              />

              <text
                x={6}
                y={timelineTop + 10}
                fill="var(--muted-foreground)"
                fontSize="9"
              >
                CLIPS
              </text>

              {visibleCursorX !== null && (
                <line
                  x1={visibleCursorX}
                  x2={visibleCursorX}
                  y1={0}
                  y2={innerHeight}
                  stroke="var(--waveform-accent)"
                  strokeWidth={1.5}
                  opacity={0.9}
                />
              )}

              <line
                x1={0}
                x2={innerWidth}
                y1={innerHeight}
                y2={innerHeight}
                stroke="var(--border)"
                strokeWidth={1}
              />

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const sample = Math.round(
                  startSample + (endSample - startSample) * ratio,
                );
                const x = innerWidth * ratio;
                return (
                  <g key={ratio}>
                    <line
                      x1={x}
                      x2={x}
                      y1={innerHeight}
                      y2={innerHeight + 4}
                      stroke="var(--border)"
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={innerHeight + 16}
                      textAnchor={
                        ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"
                      }
                      fill="var(--muted-foreground)"
                      fontSize="9"
                    >
                      {sample}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {dragTooltip && cursorSample !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-card/95 px-2 py-1 text-[10px] shadow-sm"
            style={{
              left: dragTooltip.x,
              top: dragTooltip.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            Cursor {cursorSample} · {formatDurationMs(cursorPositionMs)}
          </div>
        )}
      </div>

      {effect && zoomRange < 1 && (
        <div
          ref={scrollbarRef}
          className="h-4 overflow-x-auto overflow-y-hidden border-t border-border bg-background"
          onScroll={handleScrollbarScroll}
        >
          <div style={{ width: scrollContentWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
