import { describe, expect, it } from 'vitest';
import { analyticNoDrag, parabolaPoints } from '../src/analytic';

describe('analyticNoDrag closed forms', () => {
  it('45° at 50 m/s under 9.81: the textbook case', () => {
    const s = analyticNoDrag(50, 45, 9.81);
    expect(s.range).toBeCloseTo(2500 / 9.81, 6); // v0² sin90 / g
    expect(s.apex).toBeCloseTo(1250 / (2 * 9.81) / 1, 4); // (v0 sin45)²/2g = 63.71
    expect(s.flightTime).toBeCloseTo((2 * 50 * Math.SQRT1_2) / 9.81, 6);
  });

  it('velocity components decompose correctly', () => {
    const s = analyticNoDrag(10, 30, 9.81);
    expect(s.v0x).toBeCloseTo(10 * Math.cos(Math.PI / 6));
    expect(s.v0y).toBeCloseTo(5);
  });

  it('range is symmetric about 45°', () => {
    const a = analyticNoDrag(40, 30, 9.81);
    const b = analyticNoDrag(40, 60, 9.81);
    expect(a.range).toBeCloseTo(b.range, 8);
  });

  it('heavier gravity shortens everything proportionally', () => {
    const earth = analyticNoDrag(30, 50, 9.81);
    const doubled = analyticNoDrag(30, 50, 19.62);
    expect(doubled.range).toBeCloseTo(earth.range / 2, 8);
    expect(doubled.apex).toBeCloseTo(earth.apex / 2, 8);
    expect(doubled.flightTime).toBeCloseTo(earth.flightTime / 2, 8);
  });
});

describe('parabolaPoints', () => {
  it('starts at the origin and returns to the ground at the analytic range', () => {
    const pts = parabolaPoints(50, 45, 9.81, 100);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    const last = pts[pts.length - 1]!;
    expect(last.y).toBeCloseTo(0, 6);
    expect(last.x).toBeCloseTo(analyticNoDrag(50, 45, 9.81).range, 6);
  });

  it('peaks at the analytic apex mid-flight', () => {
    const pts = parabolaPoints(50, 45, 9.81, 200);
    const maxY = Math.max(...pts.map((p) => p.y));
    expect(maxY).toBeCloseTo(analyticNoDrag(50, 45, 9.81).apex, 3);
  });
});
