import type { Region } from "@/lib/dsp/region";

interface TimelineRegionEntry {
  region: Region;
  timelineStart: number;
  timelineEnd: number;
}

interface ClipTrackProps {
  innerWidth: number;
  timelineTop: number;
  timelineHeight: number;
  timelineBlockTop: number;
  timelineBlockHeight: number;
  clipHandleWidth: number;
  timelineRegions: TimelineRegionEntry[];
  startSample: number;
  endSample: number;
  selectedRegionId: string | null;
  cursorX: number | null;
  insertPreviewBounds: { left: number; width: number; valid: boolean } | null;
  xForSample: (sample: number) => number;
  onClipClick: (regionId: string) => void;
}

export function ClipTrack({
  innerWidth,
  timelineTop,
  timelineHeight,
  timelineBlockTop,
  timelineBlockHeight,
  clipHandleWidth,
  timelineRegions,
  startSample,
  endSample,
  selectedRegionId,
  cursorX,
  insertPreviewBounds,
  xForSample,
  onClipClick,
}: ClipTrackProps) {
  return (
    <>
      {/* Lane background — subtle tint to separate from waveform */}
      <rect
        x={0}
        y={timelineTop}
        width={innerWidth}
        height={timelineHeight}
        fill="var(--muted)"
        opacity={0.5}
      />

      {/* Top separator — same style as the sample-axis line above */}
      <line
        x1={0} x2={innerWidth}
        y1={timelineTop} y2={timelineTop}
        stroke="var(--border)"
        strokeWidth={1}
      />

      {/* Clip blocks */}
      {timelineRegions.map(({ region, timelineStart, timelineEnd }) => {
        const regionStart = Math.max(startSample, timelineStart);
        const regionEnd = Math.min(endSample, timelineEnd);
        if (regionEnd <= regionStart) return null;
        const x = xForSample(regionStart);
        const regionWidth = Math.max(1, xForSample(regionEnd) - x);
        const isSelected = region.id === selectedRegionId;

        return (
          <g key={region.id}>
            <g
              data-clip-lane-hit
              data-clip-id={region.id}
              onClick={() => onClipClick(region.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Clip body — outlined style, filled subtly */}
              <rect
                x={x}
                y={timelineBlockTop}
                width={regionWidth}
                height={timelineBlockHeight}
                fill={isSelected ? "var(--accent)" : "var(--muted)"}
                stroke={isSelected ? "var(--foreground)" : "var(--border)"}
                strokeWidth={isSelected ? 1.5 : 1}
              />

              {/* Clip name */}
              {regionWidth > 40 && (
                <text
                  x={x + 8}
                  y={timelineBlockTop + timelineBlockHeight / 2 + 4}
                  fill={isSelected ? "var(--accent-foreground)" : "var(--muted-foreground)"}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                  className="pointer-events-none"
                >
                  {regionWidth > 60 ? region.name : "…"}
                </text>
              )}

              {/* Resize handles (only when selected) */}
              {isSelected && (
                <>
                  <rect
                    data-clip-handle="start"
                    data-clip-id={region.id}
                    x={x - clipHandleWidth / 2}
                    y={timelineBlockTop - 2}
                    width={clipHandleWidth}
                    height={timelineBlockHeight + 4}
                    fill="transparent"
                    style={{ cursor: "ew-resize" }}
                  />
                  {/* Visual left edge indicator */}
                  <rect
                    x={x}
                    y={timelineBlockTop + 6}
                    width={2}
                    height={timelineBlockHeight - 12}
                    fill="var(--foreground)"
                    opacity={0.35}
                    pointerEvents="none"
                  />

                  <rect
                    data-clip-handle="end"
                    data-clip-id={region.id}
                    x={x + regionWidth - clipHandleWidth / 2}
                    y={timelineBlockTop - 2}
                    width={clipHandleWidth}
                    height={timelineBlockHeight + 4}
                    fill="transparent"
                    style={{ cursor: "ew-resize" }}
                  />
                  {/* Visual right edge indicator */}
                  <rect
                    x={x + regionWidth - 2}
                    y={timelineBlockTop + 6}
                    width={2}
                    height={timelineBlockHeight - 12}
                    fill="var(--foreground)"
                    opacity={0.35}
                    pointerEvents="none"
                  />
                </>
              )}
            </g>
          </g>
        );
      })}

      {/* Cursor */}
      {cursorX !== null && (
        <line
          x1={cursorX} x2={cursorX}
          y1={timelineBlockTop - 2}
          y2={timelineBlockTop + timelineBlockHeight + 2}
          stroke="var(--waveform-accent)"
          strokeWidth={1.5}
          opacity={0.9}
        />
      )}

      {/* Insert Preview */}
      {insertPreviewBounds && (
        <>
          <rect
            x={insertPreviewBounds.left}
            y={timelineBlockTop}
            width={insertPreviewBounds.width}
            height={timelineBlockHeight}
            fill={insertPreviewBounds.valid ? "var(--waveform-accent)" : "var(--destructive)"}
            opacity={0.15}
          />
          <line
            x1={insertPreviewBounds.left} x2={insertPreviewBounds.left}
            y1={timelineBlockTop} y2={timelineBlockTop + timelineBlockHeight}
            stroke={insertPreviewBounds.valid ? "var(--waveform-accent)" : "var(--destructive)"}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            opacity={0.8}
          />
          <line
            x1={insertPreviewBounds.left + insertPreviewBounds.width}
            x2={insertPreviewBounds.left + insertPreviewBounds.width}
            y1={timelineBlockTop} y2={timelineBlockTop + timelineBlockHeight}
            stroke={insertPreviewBounds.valid ? "var(--waveform-accent)" : "var(--destructive)"}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            opacity={0.8}
          />
        </>
      )}
    </>
  );
}
