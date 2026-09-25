import type { Point } from './analytic';
import type { SimPoint } from './physics';

export interface PlotTheme {
  bg: string;
  grid: string;
  axis: string;
  predicted: string;
  actual: string;
  apex: string;
  text: string;
}

export interface PlotExtents {
  maxX: number;
  maxY: number;
}

export interface Mapper {
  sx: (x: number) => number;
  sy: (y: number) => number;
  /** Inverse: screen px → world meters. */
  wx: (px: number) => number;
  wy: (py: number) => number;
  scale: number;
}

/** Fit both paths into the canvas with margins; returns world↔screen mappers. */
export function makeMapper(
  extents: PlotExtents,
  width: number,
  height: number,
  margin = 46,
): Mapper {
  const scale = Math.min(
    (width - margin * 2) / Math.max(1e-6, extents.maxX),
    (height - margin * 2) / Math.max(1e-6, extents.maxY),
  );
  return {
    sx: (x) => margin + x * scale,
    sy: (y) => height - margin - y * scale,
    wx: (px) => (px - margin) / scale,
    wy: (py) => (height - margin - py) / scale,
    scale,
  };
}

/** Pick a grid step that lands near 8 lines for the given span (1/2/5 ladder). */
export function gridStep(span: number): number {
  const raw = span / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, raw))));
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * pow) return m * pow;
  }
  return 10 * pow;
}

export function drawPlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  predicted: Point[],
  actual: SimPoint[],
  markerT: number | null,
  theme: PlotTheme,
  angleDeg: number,
): Mapper {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  const maxX = Math.max(...predicted.map((p) => p.x), ...actual.map((p) => p.x), 1);
  const maxY = Math.max(...predicted.map((p) => p.y), ...actual.map((p) => p.y), 1);
  const mapper = makeMapper({ maxX, maxY }, width, height);
  const { sx, sy } = mapper;

  // Grid + labels.
  const step = gridStep(Math.max(maxX, maxY));
  ctx.strokeStyle = theme.grid;
  ctx.fillStyle = theme.text;
  ctx.lineWidth = 1;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  for (let x = 0; x <= maxX + step * 0.5; x += step) {
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(0));
    ctx.lineTo(sx(x), sy(maxY));
    ctx.stroke();
    ctx.fillText(`${round1(x)}m`, sx(x) + 2, sy(0) + 14);
  }
  for (let y = 0; y <= maxY + step * 0.5; y += step) {
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(y));
    ctx.lineTo(sx(maxX), sy(y));
    ctx.stroke();
    if (y > 0) ctx.fillText(`${round1(y)}m`, sx(0) - 38, sy(y) + 4);
  }

  // Ground axis.
  ctx.strokeStyle = theme.axis;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0));
  ctx.lineTo(sx(maxX), sy(0));
  ctx.stroke();

  // Predicted (vacuum) path — dashed.
  ctx.strokeStyle = theme.predicted;
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  predicted.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
  ctx.stroke();
  ctx.setLineDash([]);

  // Actual (integrated, with drag) path — solid.
  ctx.strokeStyle = theme.actual;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  actual.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
  ctx.stroke();

  // Apex marker on the actual path.
  const apexPoint = actual.reduce((best, p) => (p.y > best.y ? p : best), actual[0] ?? { x: 0, y: 0 });
  if (apexPoint) {
    ctx.fillStyle = theme.apex;
    ctx.beginPath();
    ctx.arc(sx(apexPoint.x), sy(apexPoint.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Animated flight marker.
  if (markerT !== null && actual.length > 1) {
    const p = pointAtTime(actual, markerT);
    ctx.fillStyle = theme.actual;
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Launch-angle indicator: arrow + degree arc at the origin (drag on the chart to aim).
  const rad = (angleDeg * Math.PI) / 180;
  const len = Math.min(width, height) * 0.16;
  const ox = sx(0);
  const oy = sy(0);
  const tipX = ox + Math.cos(rad) * len;
  const tipY = oy - Math.sin(rad) * len;
  ctx.strokeStyle = theme.actual;
  ctx.fillStyle = theme.actual;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  // Arrowhead.
  const head = 9;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - head * Math.cos(rad - 0.45), tipY + head * Math.sin(rad - 0.45));
  ctx.lineTo(tipX - head * Math.cos(rad + 0.45), tipY + head * Math.sin(rad + 0.45));
  ctx.closePath();
  ctx.fill();
  // Degree arc + label.
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ox, oy, len * 0.45, -rad, 0);
  ctx.stroke();
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.round(angleDeg)}°`, ox + len * 0.5 + 6, oy - 8);
  ctx.fillStyle = theme.text;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('drag on the chart to aim', ox + 4, oy + 26);

  return mapper;
}

/** Linear interpolation along the sampled path at time t. */
export function pointAtTime(points: SimPoint[], t: number): SimPoint {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return { t: 0, x: 0, y: 0, vx: 0, vy: 0 };
  if (t <= first.t) return first;
  if (t >= last.t) return last;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return {
        t,
        x: a.x + f * (b.x - a.x),
        y: a.y + f * (b.y - a.y),
        vx: a.vx + f * (b.vx - a.vx),
        vy: a.vy + f * (b.vy - a.vy),
      };
    }
  }
  return last;
}

function round1(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}
