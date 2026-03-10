import type { Region } from "@/lib/dsp/region";

interface TimelineRegionEntry {
  region: Region;
  timelineStart: number;
  timelineEnd: number;
}

interface SelectionBounds {
  left: number;
  right: number;
}

interface ClipTrackProps {
  innerWidth: number;
  timelineTop: number;
  timelineHeight: number;
  timelineBlockTop: number;
  timelineBlockHeight: number;
  clipHandleWidth: number;
  selectionHandleWidth: number;
  timelineRegions: TimelineRegionEntry[];
  startSample: number;
  endSample: number;
  selectedRegionId: string | null;
  selectionBounds: SelectionBounds | null;
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
  selectionHandleWidth,
  timelineRegions,
  startSample,
  endSample,
  selectedRegionId,
  selectionBounds,
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
                  <line
                    x1={x}
                    x2={x}
                    y1={timelineBlockTop - 2}
                    y2={timelineBlockTop + timelineBlockHeight + 2}
                    stroke="var(--waveform-accent)"
                    strokeWidth={2}
                  />
                  <line
                    x1={x + regionWidth}
                    x2={x + regionWidth}
                    y1={timelineBlockTop - 2}
                    y2={timelineBlockTop + timelineBlockHeight + 2}
                    stroke="var(--waveform-accent)"
                    strokeWidth={2}
                  />
                </>
              )}
            </g>
          </g>
        );
      })}

      {selectionBounds && (
        <rect
          x={selectionBounds.left}
          y={timelineBlockTop}
          width={selectionBounds.right - selectionBounds.left}
          height={timelineBlockHeight}
          rx={4}
          fill="var(--waveform-accent)"
          opacity={0.25}
        />
      )}

      {selectionBounds && (
        <>
          <rect
            data-selection-body
            x={selectionBounds.left}
            y={timelineBlockTop}
            width={selectionBounds.right - selectionBounds.left}
            height={timelineBlockHeight}
            fill="transparent"
            style={{ cursor: "grab" }}
          />
          <rect
            data-selection-handle="start"
            x={selectionBounds.left - selectionHandleWidth / 2}
            y={timelineBlockTop - 2}
            width={selectionHandleWidth}
            height={timelineBlockHeight + 4}
            fill="transparent"
            style={{ cursor: "ew-resize" }}
          />
          <rect
            data-selection-handle="end"
            x={selectionBounds.right - selectionHandleWidth / 2}
            y={timelineBlockTop - 2}
            width={selectionHandleWidth}
            height={timelineBlockHeight + 4}
            fill="transparent"
            style={{ cursor: "ew-resize" }}
          />
          <line
            x1={selectionBounds.left}
            x2={selectionBounds.left}
            y1={timelineBlockTop - 2}
            y2={timelineBlockTop + timelineBlockHeight + 2}
            stroke="var(--waveform-accent)"
            strokeWidth={2}
          />
          <line
            x1={selectionBounds.right}
            x2={selectionBounds.right}
            y1={timelineBlockTop - 2}
            y2={timelineBlockTop + timelineBlockHeight + 2}
            stroke="var(--waveform-accent)"
            strokeWidth={2}
          />
        </>
      )}
    </>
  );
}
