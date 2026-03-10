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
  insertMarkerX: number | null;
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
  insertMarkerX,
  xForSample,
  onClipClick,
}: ClipTrackProps) {
  return (
    <>
      <rect
        x={0}
        y={timelineTop}
        width={innerWidth}
        height={timelineHeight}
        rx={4}
        fill="var(--muted)"
        opacity={0.35}
      />

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
              <rect
                x={x}
                y={timelineBlockTop}
                width={regionWidth}
                height={timelineBlockHeight}
                rx={4}
                fill="var(--waveform-accent)"
                opacity={isSelected ? 0.9 : 0.65}
              />
              {regionWidth > 56 && (
                <text
                  x={x + 6}
                  y={timelineBlockTop + timelineBlockHeight / 2 + 3}
                  fill="var(--foreground)"
                  fontSize="10"
                >
                  {region.name}
                </text>
              )}

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
                </>
              )}
            </g>
          </g>
        );
      })}

      {cursorX !== null && (
        <line
          x1={cursorX}
          x2={cursorX}
          y1={timelineBlockTop - 2}
          y2={timelineBlockTop + timelineBlockHeight + 2}
          stroke="var(--waveform-accent)"
          strokeWidth={2}
          opacity={0.95}
        />
      )}

      {insertMarkerX !== null && (
        <>
          <rect
            x={insertMarkerX - 5}
            y={timelineTop + 2}
            width={10}
            height={timelineHeight - 4}
            rx={4}
            fill="var(--waveform-accent)"
            opacity={0.18}
          />
          <line
            x1={insertMarkerX}
            x2={insertMarkerX}
            y1={timelineTop + 2}
            y2={timelineTop + timelineHeight - 2}
            stroke="var(--waveform-accent)"
            strokeWidth={2}
            strokeDasharray="4 3"
            opacity={0.95}
          />
        </>
      )}
    </>
  );
}
