import React from "react";

interface PlotProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
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
  onPointerDown?: (event: React.PointerEvent<SVGRectElement>) => void;
}

const PLOT_PADDING_Y = 8;
const SCALE_GUTTER_WIDTH = 32;
const PLOT_RIGHT_PADDING = 8;
const PLOT_CLIP_BLEED_Y = 2;

function yForValue(
  value: number,
  minValue: number,
  maxValue: number,
  height: number,
) {
  const range = maxValue - minValue || 1;
  const normalized = (value - minValue) / range;
  return height - normalized * height;
}

export function Plot({
  x = 0,
  y = 0,
  width,
  height,
  sourceWidth,
  sourceHeight,
  minValue,
  maxValue,
  path,
  stroke,
  strokeWidth = 1.2,
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
  backgroundFill = "var(--background)",
  backgroundOpacity = 1,
  separatorTop,
  separatorBottom,
  zeroLine,
  onPointerDown,
}: PlotProps) {
  const plotInnerX = SCALE_GUTTER_WIDTH;
  const plotInnerY = PLOT_PADDING_Y;
  const plotInnerWidth = Math.max(0, width - plotInnerX - PLOT_RIGHT_PADDING);
  const plotInnerHeight = Math.max(0, height - PLOT_PADDING_Y * 2);
  const scaleX = sourceWidth > 0 ? plotInnerWidth / sourceWidth : 1;
  const scaleY = sourceHeight > 0 ? plotInnerHeight / sourceHeight : 1;
  const clipId = `plot-clip-${x}-${y}-${width}-${height}-${minValue}-${maxValue}`;

  return (
    <g transform={`translate(${x},${y})`}>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={plotInnerX}
            y={plotInnerY - PLOT_CLIP_BLEED_Y}
            width={plotInnerWidth}
            height={plotInnerHeight + PLOT_CLIP_BLEED_Y * 2}
          />
        </clipPath>
      </defs>

      {/* Plot Background Area */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={backgroundFill}
        opacity={backgroundOpacity}
      />

      {/* Interactive Overlay Layer */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onPointerDown={onPointerDown}
        style={{ cursor: onPointerDown ? "crosshair" : undefined }}
      />

      {/* Separators */}
      {separatorTop && (
        <line
          x1={0}
          x2={width}
          y1={0}
          y2={0}
          stroke={separatorTop.stroke}
          strokeWidth={separatorTop.strokeWidth ?? 1}
          opacity={separatorTop.opacity ?? 1}
        />
      )}

      {separatorBottom && (
        <line
          x1={0}
          x2={width}
          y1={height}
          y2={height}
          stroke={separatorBottom.stroke}
          strokeWidth={separatorBottom.strokeWidth ?? 1}
          opacity={separatorBottom.opacity ?? 1}
        />
      )}

      {/* Ticks and Grid Lines */}
      {ticks?.map((tick) => {
        const yPos = plotInnerY + yForValue(tick, minValue, maxValue, plotInnerHeight);
        return (
          <g key={tick} className="opacity-80">
            {/* Dashed background grid lines to match Shadcn charting aesthetics */}
            <line
              x1={plotInnerX}
              x2={plotInnerX + plotInnerWidth}
              y1={yPos}
              y2={yPos}
              stroke="var(--border)"
              strokeWidth={tick === 0 ? 1 : 0.75}
              strokeDasharray={tick === 0 ? undefined : "3 3"}
              opacity={tick === 0 ? 0.8 : 0.4}
            />
            {/* Sleek, mono-spaced tick labels */}
            <text
              x={plotInnerX - 8}
              y={yPos + 3}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize="10"
              fontFamily="var(--font-mono)"
              fontWeight="500"
              className="tracking-wider"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Primary Zero Line Guide */}
      {zeroLine && (
        <line
          x1={plotInnerX}
          x2={plotInnerX + plotInnerWidth}
          y1={plotInnerY + yForValue(zeroLine.value, minValue, maxValue, plotInnerHeight)}
          y2={plotInnerY + yForValue(zeroLine.value, minValue, maxValue, plotInnerHeight)}
          stroke={zeroLine.stroke}
          strokeWidth={zeroLine.strokeWidth ?? 1}
          opacity={0.6}
        />
      )}

      {/* Waveform Paths */}
      {path && (
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(${plotInnerX},${plotInnerY}) scale(${scaleX}, ${scaleY})`}>
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        </g>
      )}

      {secondaryPath && secondaryStroke && (
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(${plotInnerX},${plotInnerY}) scale(${scaleX}, ${scaleY})`}>
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryStroke}
              strokeWidth={secondaryStrokeWidth}
              opacity={secondaryOpacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        </g>
      )}

      {tertiaryPath && tertiaryStroke && (
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(${plotInnerX},${plotInnerY}) scale(${scaleX}, ${scaleY})`}>
            <path
              d={tertiaryPath}
              fill="none"
              stroke={tertiaryStroke}
              strokeWidth={tertiaryStrokeWidth}
              opacity={tertiaryOpacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        </g>
      )}
    </g>
  );
}
