import { describe, expect, it } from 'vitest';
import { analyticNoDrag } from '../src/analytic';
import { simulate } from '../src/physics';

describe('RK4 integrator vs closed form (no drag)', () => {
  const cases = [
    { v0: 50, angleDeg: 45, g: 9.81 },
    { v0: 30, angleDeg: 20, g: 9.81 },
    { v0: 80, angleDeg: 70, g: 9.81 },
    { v0: 25, angleDeg: 45, g: 3.71 }, // Mars gravity
  ];

  for (const c of cases) {
    it(`matches range/apex/flight time at v0=${c.v0}, θ=${c.angleDeg}°, g=${c.g}`, () => {
      const sim = simulate({ ...c, beta: 0, dt: 0.005, maxT: 120 });
      const ideal = analyticNoDrag(c.v0, c.angleDeg, c.g);
      // RK4 at dt=5ms should track the parabola to well under 0.05%.
      expect(sim.summary.range).toBeCloseTo(ideal.range, 1);
      expect(Math.abs(sim.summary.range - ideal.range) / ideal.range).toBeLessThan(5e-4);
      expect(Math.abs(sim.summary.flightTime - ideal.flightTime) / ideal.flightTime).toBeLessThan(5e-4);
      // Apex is sampled per-step, so allow half a step of vertical motion as slack.
      expect(Math.abs(sim.summary.apex - ideal.apex)).toBeLessThan(0.05);
      expect(sim.truncated).toBe(false);
    });
  }

  it('halving dt reduces the range error (convergence)', () => {
    const ideal = analyticNoDrag(50, 45, 9.81);
    const coarse = simulate({ v0: 50, angleDeg: 45, g: 9.81, beta: 0, dt: 0.08, maxT: 60 });
    const fine = simulate({ v0: 50, angleDeg: 45, g: 9.81, beta: 0, dt: 0.04, maxT: 60 });
    const errCoarse = Math.abs(coarse.summary.range - ideal.range);
    const errFine = Math.abs(fine.summary.range - ideal.range);
    expect(errFine).toBeLessThanOrEqual(errCoarse);
  });
});

describe('drag behaviour (qualitative physics)', () => {
  it('drag strictly reduces range, apex, and flight speed at landing', () => {
    const base = { v0: 50, angleDeg: 40, g: 9.81, dt: 0.005, maxT: 60 };
    const vacuum = simulate({ ...base, beta: 0 });
    const dragged = simulate({ ...base, beta: 0.03 });
    expect(dragged.summary.range).toBeLessThan(vacuum.summary.range);
    expect(dragged.summary.apex).toBeLessThan(vacuum.summary.apex);
    const vLandVac = Math.hypot(
      vacuum.points[vacuum.points.length - 1]!.vx,
      vacuum.points[vacuum.points.length - 1]!.vy,
    );
    const vLandDrag = Math.hypot(
      dragged.points[dragged.points.length - 1]!.vx,
      dragged.points[dragged.points.length - 1]!.vy,
    );
    expect(vLandDrag).toBeLessThan(vLandVac);
  });

  it('more drag, less range (monotone in beta)', () => {
    const base = { v0: 60, angleDeg: 45, g: 9.81, dt: 0.005, maxT: 60 };
    const r = (beta: number): number => simulate({ ...base, beta }).summary.range;
    expect(r(0.01)).toBeGreaterThan(r(0.03));
    expect(r(0.03)).toBeGreaterThan(r(0.08));
  });

  it('with drag the arc is asymmetric: slower but shorter descent', () => {
    const sim = simulate({ v0: 50, angleDeg: 45, g: 9.81, beta: 0.05, dt: 0.005, maxT: 60 });
    const apexPoint = sim.points.reduce((best, p) => (p.y > best.y ? p : best), sim.points[0]!);
    const ascent = apexPoint.t;
    const descent = sim.summary.flightTime - apexPoint.t;
    // Going up, drag adds to gravity (fast deceleration); coming down it opposes
    // gravity — so the descent takes MORE time but covers LESS horizontal ground.
    expect(descent).toBeGreaterThan(ascent);
    expect(sim.summary.range - apexPoint.x).toBeLessThan(apexPoint.x);
  });
});
