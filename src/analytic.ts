/** Closed-form vacuum (no-drag) ballistics used for prediction and verification. */

export interface AnalyticSummary {
  v0x: number;
  v0y: number;
  flightTime: number;
  apex: number;
  range: number;
}

/** T = 2·v0·sinθ/g · apex = (v0·sinθ)²/2g · range = v0²·sin2θ/g */
export function analyticNoDrag(v0: number, angleDeg: number, g: number): AnalyticSummary {
  const angle = (angleDeg * Math.PI) / 180;
  const v0x = v0 * Math.cos(angle);
  const v0y = v0 * Math.sin(angle);
  return {
    v0x,
    v0y,
    flightTime: (2 * v0y) / g,
    apex: (v0y * v0y) / (2 * g),
    range: (v0 * v0 * Math.sin(2 * angle)) / g,
  };
}

export interface Point {
  x: number;
  y: number;
}

/** Sampled vacuum parabola for the predicted-path overlay. */
export function parabolaPoints(v0: number, angleDeg: number, g: number, n = 60): Point[] {
  const { v0x, v0y, flightTime } = analyticNoDrag(v0, angleDeg, g);
  const points: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (flightTime * i) / n;
    points.push({ x: v0x * t, y: v0y * t - 0.5 * g * t * t });
  }
  return points;
}
