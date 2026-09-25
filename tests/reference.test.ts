import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { simulate, type SimPoint } from '../src/physics';

interface FixtureCase {
  name: string;
  v0: number;
  angleDeg: number;
  g: number;
  beta: number;
  points: SimPoint[];
  summary: { v0x: number; v0y: number; range: number; apex: number; flightTime: number };
}

interface Fixtures {
  dt: number;
  maxT: number;
  sampleEvery: number;
  cases: FixtureCase[];
}

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/reference.json', import.meta.url), 'utf-8'),
) as Fixtures;

/** |a-b| within max(abs, rel·|b|). */
function within(a: number, b: number, rel = 1e-6, abs = 1e-6): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(abs, rel * Math.abs(b)));
}

describe('TS integrator vs numpy reference (scripts/reference_trajectories.py)', () => {
  for (const c of fixtures.cases) {
    describe(c.name, () => {
      const sim = simulate(
        { v0: c.v0, angleDeg: c.angleDeg, g: c.g, beta: c.beta, dt: fixtures.dt, maxT: fixtures.maxT },
        fixtures.sampleEvery,
      );

      it('summary matches within tolerance', () => {
        within(sim.summary.v0x, c.summary.v0x);
        within(sim.summary.v0y, c.summary.v0y);
        within(sim.summary.range, c.summary.range, 1e-6, 1e-4);
        within(sim.summary.apex, c.summary.apex, 1e-6, 1e-4);
        within(sim.summary.flightTime, c.summary.flightTime, 1e-6, 1e-4);
      });

      it('emits the same number of sampled points', () => {
        expect(sim.points).toHaveLength(c.points.length);
      });

      it('every sampled point matches within tolerance', () => {
        sim.points.forEach((p, i) => {
          const ref = c.points[i]!;
          within(p.t, ref.t, 1e-9, 1e-9);
          within(p.x, ref.x, 1e-6, 1e-5);
          within(p.y, ref.y, 1e-6, 1e-5);
          within(p.vx, ref.vx, 1e-6, 1e-5);
          within(p.vy, ref.vy, 1e-6, 1e-5);
        });
      });
    });
  }

  it('fixture sanity: the vacuum case agrees with v0²·sin2θ/g', () => {
    const vac = fixtures.cases.find((c) => c.beta === 0)!;
    const expected = (vac.v0 * vac.v0 * Math.sin((2 * vac.angleDeg * Math.PI) / 180)) / vac.g;
    expect(Math.abs(vac.summary.range - expected) / expected).toBeLessThan(5e-4);
  });
});
