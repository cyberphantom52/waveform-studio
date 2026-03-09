"use client";

import { useStudio, useStudioDispatch } from "@/lib/studio-context";
import { computeDelta } from "@/lib/dsp/stats";
import { createRegionSelection } from "@/lib/studio-io";
import { clampZoomWindow, scaleZoomWindow } from "@/lib/zoom";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScanSearch, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    const x = (index / Math.max(1, samples.length - 1)) * width;
    const normalized = (sample - minValue) / valueRange;
    const y = height - normalized * height;
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
  const suppressClickRef = useRef(false);
  const [width, setWidth] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [regionSelectMode, setRegionSelectMode] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
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

  const original = effect?.waveform.samples ?? new Int8Array();
  const remastered = effect?.remastered ?? original;
  const baseLength = Math.max(original.length, remastered.length, 1);
  const minZoomRange = 1 / baseLength;
  const zoomRange = state.zoom.end - state.zoom.start;
  const startSample = Math.floor(state.zoom.start * baseLength);
  const endSample = Math.max(
    startSample + 1,
    Math.ceil(state.zoom.end * baseLength),
  );
  const visibleOriginal = original.slice(
    Math.min(startSample, original.length),
    Math.min(endSample, original.length),
  );
  const visibleRemastered = remastered.slice(
    Math.min(startSample, remastered.length),
    Math.min(endSample, remastered.length),
  );
  const visibleDiff = computeDelta(visibleOriginal, visibleRemastered);

  const margin = { top: 12, right: 8, bottom: 26, left: 42 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, canvasHeight - margin.top - margin.bottom);
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

  const yForValue = (value: number, minValue: number, maxValue: number) => {
    const range = maxValue - minValue || 1;
    const normalized = (value - minValue) / range;
    return innerHeight - normalized * innerHeight;
  };

  const originalPath = useMemo(
    () =>
      pathFromSamples(
        visibleOriginal,
        innerWidth,
        innerHeight,
        -128,
        127,
        state.canvasConfig.density,
      ),
    [visibleOriginal, innerWidth, innerHeight, state.canvasConfig.density],
  );
  const remasteredPath = useMemo(
    () =>
      pathFromSamples(
        visibleRemastered,
        innerWidth,
        innerHeight,
        -128,
        127,
        state.canvasConfig.density,
      ),
    [visibleRemastered, innerWidth, innerHeight, state.canvasConfig.density],
  );
  const diffPath = useMemo(
    () =>
      pathFromSamples(
        visibleDiff,
        innerWidth,
        innerHeight,
        -255,
        255,
        state.canvasConfig.density,
      ),
    [visibleDiff, innerWidth, innerHeight, state.canvasConfig.density],
  );

  const selectionBounds =
    dragStartX !== null && dragCurrentX !== null
      ? {
          left: Math.min(dragStartX, dragCurrentX),
          right: Math.max(dragStartX, dragCurrentX),
        }
      : null;

  const createSelectionFromDrag = () => {
    if (!effect || !selectionBounds) return;
    const left = Math.max(0, selectionBounds.left);
    const right = Math.min(innerWidth, selectionBounds.right);
    if (right - left < 4) return;
    const span = Math.max(1, endSample - startSample);
    const selectionStart =
      startSample + Math.floor((left / Math.max(1, innerWidth)) * span);
    const selectionEnd =
      startSample + Math.ceil((right / Math.max(1, innerWidth)) * span);
    dispatch({
      type: "ADD_REGION",
      region: createRegionSelection(
        selectionStart,
        selectionEnd,
        effect.regions,
      ),
    });
  };

  const handlePanStart = (event: React.PointerEvent<SVGSVGElement>) => {
    if (
      regionSelectMode ||
      zoomRange >= 1 ||
      event.button !== 0 ||
      innerWidth <= 0
    ) {
      return;
    }

    panStateRef.current = {
      startClientX: event.clientX,
      startZoomStart: state.zoom.start,
    };
    suppressClickRef.current = false;
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePanMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const panState = panStateRef.current;
    if (!panState || innerWidth <= 0) return;

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
  };

  const handlePanEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!panStateRef.current) return;

    panStateRef.current = null;
    setIsPanning(false);
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
          type="single"
          value={state.viewMode}
          onValueChange={(value) => {
            if (value)
              dispatch({
                type: "SET_VIEW_MODE",
                mode: value as typeof state.viewMode,
              });
          }}
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
          <ToggleGroupItem value="overlay" className="h-5 px-1.5 text-[10px]">
            OV
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant={regionSelectMode ? "default" : "outline"}
          size="xs"
          onClick={() => setRegionSelectMode((current) => !current)}
          disabled={!effect}
        >
          <SquarePen data-icon="inline-start" />
          Region Mode
        </Button>
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
            className={isPanning ? "block cursor-grabbing" : zoomRange < 1 && !regionSelectMode ? "block cursor-grab" : "block"}
            onPointerDown={handlePanStart}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanEnd}
            onPointerCancel={handlePanEnd}
            onMouseLeave={() => {
              if (dragStartX !== null) {
                createSelectionFromDrag();
                setDragStartX(null);
                setDragCurrentX(null);
              }
            }}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {[-128, -64, 0, 64, 127].map((tick) => (
                <g key={tick}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yForValue(tick, -128, 127)}
                    y2={yForValue(tick, -128, 127)}
                    stroke="var(--waveform-grid)"
                    strokeWidth={tick === 0 ? 1 : 0.5}
                  />
                  <text
                    x={-8}
                    y={yForValue(tick, -128, 127) + 3}
                    textAnchor="end"
                    fill="var(--muted-foreground)"
                    fontSize="9"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {state.viewMode === "diff" && (
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={yForValue(0, -255, 255)}
                  y2={yForValue(0, -255, 255)}
                  stroke="var(--waveform-grid)"
                  strokeWidth={1}
                />
              )}

              {effect.regions.map((region) => {
                const regionStart = Math.max(startSample, region.start);
                const regionEnd = Math.min(endSample, region.end);
                if (regionEnd <= regionStart) return null;
                const x = xForSample(regionStart);
                const regionWidth = Math.max(1, xForSample(regionEnd) - x);
                const isSelected = region.id === state.selectedRegionId;
                return (
                  <g
                    key={region.id}
                    onClick={() => {
                      if (suppressClickRef.current) return;
                      dispatch({ type: "SET_SELECTED_REGION", id: region.id });
                    }}
                    style={{ cursor: regionSelectMode ? "crosshair" : "pointer" }}
                  >
                    <rect
                      x={x}
                      y={0}
                      width={regionWidth}
                      height={innerHeight}
                      fill="var(--waveform-accent)"
                      opacity={isSelected ? 0.22 : 0.1}
                    />
                    <line
                      x1={x}
                      x2={x}
                      y1={0}
                      y2={innerHeight}
                      stroke="var(--waveform-accent)"
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={0.6}
                    />
                    <line
                      x1={x + regionWidth}
                      x2={x + regionWidth}
                      y1={0}
                      y2={innerHeight}
                      stroke="var(--waveform-accent)"
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={0.6}
                    />
                    {regionWidth > 56 && (
                      <text
                        x={x + 6}
                        y={14}
                        fill="var(--foreground)"
                        fontSize="10"
                      >
                        {region.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {(state.viewMode === "original" ||
                state.viewMode === "overlay") &&
                originalPath && (
                  <path
                    d={originalPath}
                    fill="none"
                    stroke="var(--waveform-original)"
                    strokeWidth={1}
                    opacity={state.viewMode === "overlay" ? 0.45 : 1}
                  />
                )}

              {(state.viewMode === "remastered" ||
                state.viewMode === "overlay") &&
                remasteredPath && (
                  <path
                    d={remasteredPath}
                    fill="none"
                    stroke="var(--waveform-remastered)"
                    strokeWidth={1.25}
                  />
                )}

              {state.viewMode === "diff" && diffPath && (
                <path
                  d={diffPath}
                  fill="none"
                  stroke="var(--waveform-delta)"
                  strokeWidth={1.25}
                />
              )}

              {selectionBounds && (
                <rect
                  x={selectionBounds.left}
                  y={0}
                  width={selectionBounds.right - selectionBounds.left}
                  height={innerHeight}
                  fill="var(--waveform-accent)"
                  opacity={0.18}
                />
              )}

              <rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                pointerEvents={regionSelectMode ? "all" : "none"}
                onMouseDown={(event) => {
                  if (!regionSelectMode) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const relativeX = event.clientX - bounds.left;
                  setDragStartX(relativeX);
                  setDragCurrentX(relativeX);
                }}
                onMouseMove={(event) => {
                  if (dragStartX === null) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setDragCurrentX(event.clientX - bounds.left);
                }}
                onMouseUp={() => {
                  if (dragStartX === null) return;
                  createSelectionFromDrag();
                  setDragStartX(null);
                  setDragCurrentX(null);
                }}
              />

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
