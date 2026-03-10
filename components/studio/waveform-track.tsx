import { GripVertical } from "lucide-react";
import { Plot } from "@/components/studio/plot";
import { useState } from "react";

const TRACK_GUTTER_WIDTH = 56;
const HANDLE_BAR_X = -12;
const HANDLE_HIT_X = -18;
const TRACK_RIGHT_PADDING = 8;
const TRACK_INNER_PADDING_X = 8;
const TRACK_INNER_PADDING_Y = 8;
const TRACK_METADATA_HEIGHT = 20; // Increased slightly for better badge fit
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

// Emulates a Shadcn <Badge> purely via SVG
function TrackBadge({ label, x, y, width }: { label: string; x: number; y: number; width: number }) {
  const badgeWidth = Math.max(32, label.length * 8 + 12);
  const badgeHeight = 18;

  return (
    <g transform={`translate(${x - badgeWidth},${y})`}>
      <rect
        x={0}
        y={0}
        width={badgeWidth}
        height={badgeHeight}
        rx={4} // Consistent Shadcn radius
        fill="var(--secondary)" // Shadcn's neutral 'secondary' background
        stroke="var(--border)"
        strokeWidth={1}
      />
      <text
        x={badgeWidth / 2}
        y={badgeHeight / 2 + 3}
        textAnchor="middle"
        fill="var(--secondary-foreground)"
        fontSize="10"
        fontFamily="var(--font-mono)" // Code-like mono font
        fontWeight="bold"
        className="tracking-wider uppercase"
      >
        {label}
      </text>
    </g>
  );
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
  backgroundFill = "var(--card)", // Default to Shadcn Card background
  backgroundOpacity = 1,
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
  const metadataY = height - TRACK_INNER_PADDING_Y - TRACK_METADATA_HEIGHT + 2;
  const metadataX = width - TRACK_INNER_PADDING_X;

  return (
    <g transform={`translate(0,${top})`}>
      {/* 
        Track Background: Muted / Card Shadcn emulation
      */}
      <rect
        x={-TRACK_GUTTER_WIDTH}
        y={0}
        width={width + TRACK_GUTTER_WIDTH + TRACK_RIGHT_PADDING}
        height={height}
        fill={backgroundFill}
        opacity={backgroundOpacity}
        stroke={showTrackHighlight ? "var(--ring)" : "transparent"} // Highlighting uses the focus ring color
        strokeWidth={showTrackHighlight ? 1 : 0}
        rx={8} // Card border radius effect
        className="transition-colors duration-200"
      />

      {/* Dragging Overlay Tint */}
      {showTrackHighlight && (
        <rect
          x={-TRACK_GUTTER_WIDTH}
          y={0}
          width={width + TRACK_GUTTER_WIDTH + TRACK_RIGHT_PADDING}
          height={height}
          fill="var(--accent)"
          opacity={0.15}
          rx={8}
          pointerEvents="none"
        />
      )}

      {/* Track Label Badge */}
      {label && <TrackBadge label={label} x={metadataX} y={metadataY} width={width} />}

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
        backgroundFill="transparent" // Let the track background shine through
        separatorTop={separatorTop}
        separatorBottom={separatorBottom}
        zeroLine={zeroLine}
        onPointerDown={onPlotPointerDown}
      />

      {/* Custom Grip Handle matching Shadcn patterns */}
      {showHandle && trackId && onHandlePointerDown && (
        <g
          data-track-handle={trackId}
          className="group"
          onPointerDown={(event) => onHandlePointerDown(trackId, event)}
          onPointerEnter={() => setIsHandleHovered(true)}
          onPointerLeave={() => setIsHandleHovered(false)}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          {/* Transparent hit area for mouse interaction */}
          <rect
            x={HANDLE_HIT_X - 10}
            y={0}
            width={24}
            height={height}
            fill="transparent"
          />
          
          <g transform={`translate(${HANDLE_BAR_X - 6},${Math.max(4, height / 2 - 8)})`}>
            {/* 
              Lucide GripVertical rendered directly in SVG via wrapping <svg> element.
              We control opacity purely via classes.
            */}
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={`text-muted-foreground transition-opacity ${
                isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-75"
              }`}
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </g>
        </g>
      )}
    </g>
  );
}
