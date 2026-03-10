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
  ticks?: number[];
  backgroundFill?: string;
  backgroundOpacity?: number;
  separatorTop?: { stroke: string; strokeWidth?: number; opacity?: number };
  separatorBottom?: { stroke: string; strokeWidth?: number; opacity?: number };
  zeroLine?: { value: number; stroke: string; strokeWidth?: number };
  onPointerDown?: (event: React.PointerEvent<SVGRectElement>) => void;
}

const PLOT_PADDING_Y = 6;
const SCALE_GUTTER_WIDTH = 24;
const PLOT_RIGHT_PADDING = 6;
const PLOT_CLIP_BLEED_Y = 1000;

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
  strokeWidth = 1,
  opacity = 1,
  secondaryPath,
  secondaryStroke,
  secondaryStrokeWidth = 1,
  secondaryOpacity = 1,
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

      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={backgroundFill}
        opacity={backgroundOpacity}
        stroke="var(--border)"
      />

      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onPointerDown={onPointerDown}
        style={{ cursor: onPointerDown ? "crosshair" : undefined }}
      />

      {separatorTop && (
        <line
          x1={0}
          x2={width}
          y1={0}
          y2={0}
          stroke={separatorTop.stroke}
          strokeWidth={separatorTop.strokeWidth ?? 1}
          opacity={separatorTop.opacity}
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
          opacity={separatorBottom.opacity}
        />
      )}

      {ticks?.map((tick) => {
        const yPos = plotInnerY + yForValue(tick, minValue, maxValue, plotInnerHeight);
        return (
          <g key={tick}>
            <line
              x1={plotInnerX}
              x2={plotInnerX + plotInnerWidth}
              y1={yPos}
              y2={yPos}
              stroke="var(--waveform-grid)"
              strokeWidth={tick === 0 ? 1 : 0.5}
            />
            <text
              x={plotInnerX - 4}
              y={yPos + 3}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize="9"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {zeroLine && (
        <line
          x1={plotInnerX}
          x2={plotInnerX + plotInnerWidth}
          y1={plotInnerY + yForValue(zeroLine.value, minValue, maxValue, plotInnerHeight)}
          y2={plotInnerY + yForValue(zeroLine.value, minValue, maxValue, plotInnerHeight)}
          stroke={zeroLine.stroke}
          strokeWidth={zeroLine.strokeWidth ?? 1}
        />
      )}

      {path && (
        <g
          clipPath={`url(#${clipId})`}
          transform={`translate(${plotInnerX},${plotInnerY}) scale(${scaleX}, ${scaleY})`}
        >
          <path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        </g>
      )}

      {secondaryPath && secondaryStroke && (
        <g
          clipPath={`url(#${clipId})`}
          transform={`translate(${plotInnerX},${plotInnerY}) scale(${scaleX}, ${scaleY})`}
        >
          <path
            d={secondaryPath}
            fill="none"
            stroke={secondaryStroke}
            strokeWidth={secondaryStrokeWidth}
            opacity={secondaryOpacity}
          />
        </g>
      )}
    </g>
  );
}
