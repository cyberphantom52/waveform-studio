export interface ZoomWindow {
  start: number;
  end: number;
}

const DEFAULT_MIN_RANGE = 1 / 65536;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampZoomWindow(
  start: number,
  end: number,
  minRange = DEFAULT_MIN_RANGE,
): ZoomWindow {
  const safeMinRange = Math.min(1, Math.max(DEFAULT_MIN_RANGE, minRange));
  const requestedRange = Math.max(safeMinRange, Math.min(1, end - start));

  let nextStart = Number.isFinite(start) ? start : 0;
  let nextEnd = nextStart + requestedRange;

  if (nextStart < 0) {
    nextEnd -= nextStart;
    nextStart = 0;
  }

  if (nextEnd > 1) {
    nextStart -= nextEnd - 1;
    nextEnd = 1;
  }

  nextStart = clamp01(nextStart);
  nextEnd = clamp01(nextEnd);

  if (nextEnd - nextStart < requestedRange) {
    if (nextStart <= 0) {
      nextEnd = Math.min(1, requestedRange);
    } else {
      nextStart = Math.max(0, 1 - requestedRange);
      nextEnd = 1;
    }
  }

  return { start: nextStart, end: nextEnd };
}

export function scaleZoomWindow(
  zoom: ZoomWindow,
  factor: number,
  anchor = 0.5,
  minRange = DEFAULT_MIN_RANGE,
): ZoomWindow {
  const current = clampZoomWindow(zoom.start, zoom.end, minRange);
  const currentRange = current.end - current.start;
  const nextRange = Math.max(
    Math.min(1, factor * currentRange),
    Math.min(1, Math.max(DEFAULT_MIN_RANGE, minRange)),
  );
  const anchorRatio = clamp01(anchor);
  const focus = current.start + currentRange * anchorRatio;

  return clampZoomWindow(
    focus - nextRange * anchorRatio,
    focus + nextRange * (1 - anchorRatio),
    minRange,
  );
}
