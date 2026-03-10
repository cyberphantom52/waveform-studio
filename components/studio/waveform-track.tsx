"use client";

import { GripVertical } from "lucide-react";
import { Plot } from "@/components/studio/plot";
import { useState } from "react";

const TRACK_GUTTER_WIDTH = 56;
const HANDLE_BAR_X = -12;
const HANDLE_HIT_X = -18;
const TRACK_RIGHT_PADDING = 8;
const TRACK_INNER_PADDING_X = 8;
const TRACK_INNER_PADDING_Y = 8;
const TRACK_METADATA_HEIGHT = 18;
const TRACK_METADATA_GAP = 6;

interface WaveformTrackProps {
  width: number;
  height: number;
  top?: number;
  trackId?: string;
  minValue: number;
  maxValue: number;
  path?: string;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  secondaryPath?: string;
  secondaryStroke?: string;
  secondaryStrokeWidth?: number;
  secondaryOpacity?: number;
  tertiaryPath?: string;
  tertiaryStroke?: string;
  tertiaryStrokeWidth?: number;
  tertiaryOpacity?: number;
  ticks?: number[];
  backgroundFill?: string;
  backgroundOpacity?: number;
  separatorTop?: { stroke: string; strokeWidth?: number; opacity?: number };
  separatorBottom?: { stroke: string; strokeWidth?: number; opacity?: number };
  zeroLine?: { value: number; stroke: string; strokeWidth?: number };
  label?: string;
  showHandle?: boolean;
  isDragging?: boolean;
  onHandlePointerDown?: (trackId: string, event: React.PointerEvent<SVGGElement>) => void;
  onPlotPointerDown?: (event: React.PointerEvent<SVGRectElement>) => void;
}

export function WaveformTrack({
  width,
  height,
  top = 0,
  trackId,
  minValue,
  maxValue,
  path,
  stroke,
  strokeWidth = 1,
  opacity = 1,
  secondaryPath,
  secondaryStroke,
  secondaryStrokeWidth = 1,
  secondaryOpacity = 1,
  tertiaryPath,
  tertiaryStroke,
  tertiaryStrokeWidth = 1,
  tertiaryOpacity = 1,
  ticks,
  backgroundFill,
  backgroundOpacity,
  separatorTop,
  separatorBottom,
  zeroLine,
  label,
  showHandle = false,
  isDragging = false,
  onHandlePointerDown,
  onPlotPointerDown,
}: WaveformTrackProps) {
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const showTrackHighlight = isDragging || isHandleHovered;
  const plotY = TRACK_INNER_PADDING_Y;
  const plotHeight = Math.max(0, height - plotY - TRACK_INNER_PADDING_Y);
  const labelWidth = label ? Math.max(34, label.length * 7 + 12) : 0;
  const metadataY = height - TRACK_INNER_PADDING_Y - TRACK_METADATA_HEIGHT;
  const metadataX = Math.max(
    TRACK_INNER_PADDING_X,
    width - labelWidth - TRACK_INNER_PADDING_X,
  );

  return (
    <g transform={`translate(0,${top})`}>
      <rect
        x={-TRACK_GUTTER_WIDTH}
        y={0}
        width={width + TRACK_GUTTER_WIDTH + TRACK_RIGHT_PADDING}
        height={height}
        fill="var(--card)"
        stroke="var(--border)"
      />

      <rect
        x={-TRACK_GUTTER_WIDTH}
        y={0}
        width={width + TRACK_GUTTER_WIDTH + TRACK_RIGHT_PADDING}
        height={height}
        fill="var(--muted)"
        opacity={showTrackHighlight ? 0.32 : 0}
      />

      {label && (
        <g transform={`translate(${metadataX},${metadataY})`}>
          <rect
            x={0}
            y={0}
            width={labelWidth}
            height={TRACK_METADATA_HEIGHT}
            fill="var(--muted)"
            stroke="var(--border)"
          />
          <text
            x={labelWidth / 2}
            y={TRACK_METADATA_HEIGHT / 2 + 3}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="9"
          >
            {label}
          </text>
        </g>
      )}

      <Plot
        x={0}
        y={plotY}
        width={width}
        height={Math.max(0, plotHeight - TRACK_METADATA_HEIGHT - TRACK_METADATA_GAP)}
        sourceWidth={width}
        sourceHeight={height}
        minValue={minValue}
        maxValue={maxValue}
        path={path}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        secondaryPath={secondaryPath}
        secondaryStroke={secondaryStroke}
        secondaryStrokeWidth={secondaryStrokeWidth}
        secondaryOpacity={secondaryOpacity}
        tertiaryPath={tertiaryPath}
        tertiaryStroke={tertiaryStroke}
        tertiaryStrokeWidth={tertiaryStrokeWidth}
        tertiaryOpacity={tertiaryOpacity}
        ticks={ticks}
        backgroundFill={backgroundFill}
        backgroundOpacity={backgroundOpacity}
        separatorTop={separatorTop}
        separatorBottom={separatorBottom}
        zeroLine={zeroLine}
        onPointerDown={onPlotPointerDown}
      />

      {showHandle && trackId && onHandlePointerDown && (
        <g
          data-track-handle={trackId}
          className="group"
          onPointerDown={(event) => onHandlePointerDown(trackId, event)}
          onPointerEnter={() => setIsHandleHovered(true)}
          onPointerLeave={() => setIsHandleHovered(false)}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          <rect
            x={HANDLE_HIT_X}
            y={0}
            width={14}
            height={height}
            fill="transparent"
          />
          <rect
            x={HANDLE_BAR_X}
            y={0}
            width={2}
            height={height}
            fill="var(--border)"
            opacity={showTrackHighlight ? 0.9 : 0.55}
          />
          <g transform={`translate(${HANDLE_BAR_X - 3},${Math.max(4, height / 2 - 6)})`}>
            <GripVertical
              className={`size-3 text-muted-foreground transition-opacity ${
                isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            />
          </g>
        </g>
      )}
    </g>
  );
}
