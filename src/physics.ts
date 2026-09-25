/**
 * Projectile integration core.
 *
 * Model: point mass under gravity with quadratic air drag,
 *   a = (−β·|v|·vx, −g − β·|v|·vy)
 * where β is the drag coefficient divided by mass (1/m · ½ρC_dA), in 1/m units.
 * Integrated with classic RK4 at a fixed dt; the ground crossing is found by
 * linear interpolation of the final step.
 *
 * The formulation (operation order included) is mirrored exactly by
 * scripts/reference_trajectories.py, which generates the numpy ground-truth
 * fixtures the test suite compares against.
 */

export interface State {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SimParams {
  /** Launch speed, m/s. */
  v0: number;
  /** Launch angle above horizontal, degrees. */
  angleDeg: number;
  /** Gravity, m/s². */
  g: number;
  /** Quadratic drag coefficient per unit mass, 1/m. 0 = vacuum. */
  beta: number;
  /** Integrator timestep, s. */
  dt: number;
  /** Safety cap on simulated time, s. */
  maxT: number;
}

export interface SimPoint extends State {
  t: number;
}

export interface SimSummary {
  v0x: number;
  v0y: number;
  /** Horizontal distance at ground return, m. */
  range: number;
  /** Peak height, m. */
  apex: number;
  /** Time back to ground, s. */
  flightTime: number;
}

export interface SimResult {
  /** Sampled points (every `sampleEvery` steps) plus the interpolated landing. */
  points: SimPoint[];
  summary: SimSummary;
  /** True when the maxT cap stopped the run before landing. */
  truncated: boolean;
}

interface Deriv {
  dx: number;
  dy: number;
  dvx: number;
  dvy: number;
}

function derivative(s: State, g: number, beta: number): Deriv {
  const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  return {
    dx: s.vx,
    dy: s.vy,
    dvx: -beta * speed * s.vx,
    dvy: -g - beta * speed * s.vy,
  };
}

/** One classic RK4 step (kept in exact sync with the Python reference). */
export function rk4Step(s: State, dt: number, g: number, beta: number): State {
  const k1 = derivative(s, g, beta);
  const s2: State = {
    x: s.x + 0.5 * dt * k1.dx,
    y: s.y + 0.5 * dt * k1.dy,
    vx: s.vx + 0.5 * dt * k1.dvx,
    vy: s.vy + 0.5 * dt * k1.dvy,
  };
  const k2 = derivative(s2, g, beta);
  const s3: State = {
    x: s.x + 0.5 * dt * k2.dx,
    y: s.y + 0.5 * dt * k2.dy,
    vx: s.vx + 0.5 * dt * k2.dvx,
    vy: s.vy + 0.5 * dt * k2.dvy,
  };
  const k3 = derivative(s3, g, beta);
  const s4: State = {
    x: s.x + dt * k3.dx,
    y: s.y + dt * k3.dy,
    vx: s.vx + dt * k3.dvx,
    vy: s.vy + dt * k3.dvy,
  };
  const k4 = derivative(s4, g, beta);
  return {
    x: s.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    y: s.y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
    vx: s.vx + (dt / 6) * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
    vy: s.vy + (dt / 6) * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy),
  };
}

/** Integrate a full flight from the origin until ground return (y = 0). */
export function simulate(params: SimParams, sampleEvery = 10): SimResult {
  const angle = (params.angleDeg * Math.PI) / 180;
  const v0x = params.v0 * Math.cos(angle);
  const v0y = params.v0 * Math.sin(angle);

  let s: State = { x: 0, y: 0, vx: v0x, vy: v0y };
  let t = 0;
  let apex = 0;
  const points: SimPoint[] = [{ t, ...s }];
  const maxSteps = Math.ceil(params.maxT / params.dt);

  for (let step = 1; step <= maxSteps; step++) {
    const next = rk4Step(s, params.dt, params.g, params.beta);
    const tNext = step * params.dt;
    if (next.y > apex) apex = next.y;

    if (next.y < 0) {
      // Linear interpolation of the crossing inside this step.
      const frac = s.y / (s.y - next.y);
      const tCross = t + frac * params.dt;
      const landing: SimPoint = {
        t: tCross,
        x: s.x + frac * (next.x - s.x),
        y: 0,
        vx: s.vx + frac * (next.vx - s.vx),
        vy: s.vy + frac * (next.vy - s.vy),
      };
      points.push(landing);
      return {
        points,
        truncated: false,
        summary: { v0x, v0y, range: landing.x, apex, flightTime: tCross },
      };
    }

    s = next;
    t = tNext;
    if (step % sampleEvery === 0) points.push({ t, ...s });
  }

  return {
    points,
    truncated: true,
    summary: { v0x, v0y, range: s.x, apex, flightTime: t },
  };
}
