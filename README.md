# Projectile Lab (slingshot-projectile-sim)

Projectile Lab strips the Angry-Birds framing off an old course sketch and rebuilds it as an honest projectile-physics simulator. A classic RK4 integrator advances a point mass under gravity and quadratic air drag, with the ground crossing found by linear interpolation; the canvas plots the integrated arc against the dashed vacuum parabola while sliders adjust launch speed, angle, gravity, and drag live. A data panel reports initial velocity components, apex, range, flight time, and percentage range lost to drag, plus an animated flight marker. The rigor is the point: a numpy script mirrors the TypeScript integrator operation-for-operation and emits ground-truth fixtures that Vitest replays, asserting every sampled point to 1e-6 tolerance; the no-drag case is also checked against the closed-form range, apex, and flight-time formulas, alongside convergence and drag-asymmetry tests. TypeScript + Canvas2D, Vite, ESLint, Prettier, GitHub Actions CI, Vercel-ready.

## The model

Point mass from the origin with

```
a = ( −β·|v|·vx ,  −g − β·|v|·vy )
```

where `β` is the quadratic drag coefficient per unit mass (1/m). Integration is
classic fixed-step **RK4** (`src/physics.ts`); the landing is located by linear
interpolation inside the crossing step, giving sub-step range and flight-time
accuracy. The vacuum prediction overlay uses the closed forms
`T = 2·v₀·sinθ/g`, `apex = (v₀·sinθ)²/2g`, `range = v₀²·sin2θ/g` (`src/analytic.ts`).

## Verification (the interesting part)

1. **Closed form** — with `β = 0`, the integrator's range/apex/flight time must land
   within 0.05% of the analytic formulas (four cases, including Mars gravity), and
   halving `dt` must not increase the error.
2. **numpy cross-check** — `scripts/reference_trajectories.py` implements the *same*
   RK4 in numpy (same operation order, same crossing interpolation) and writes
   `tests/fixtures/reference.json`: four cases, ~200 sampled states.
   `tests/reference.test.ts` re-runs the TS integrator and asserts **every** point and
   summary against the fixtures within 1e-6 relative tolerance.
3. **Physics sanity** — drag strictly reduces range/apex/landing speed, is monotone in
   `β`, and produces the classic asymmetric arc (slower but horizontally shorter descent).

Regenerate fixtures after changing the model:

```bash
pip install numpy
python scripts/reference_trajectories.py
npm test
```

## Using the lab

Sliders: launch speed (5–100 m/s), angle (5–85°), gravity (1–25 m/s²), drag β
(0–0.1 /m). The plot auto-scales with a 1-2-5 grid; **▶ Animate flight** runs a
marker along the integrated arc in real time. Dashed blue = vacuum prediction,
solid orange = integrated path, pink dot = apex.

## Tech stack

TypeScript (strict) · Vite · Canvas2D · Vitest · numpy (reference fixtures) ·
ESLint + Prettier · GitHub Actions

## Local development

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

## Deploy

```bash
npm i -g vercel   # once
vercel deploy
```

`vercel.json` is preconfigured for the Vite static build.

## Project history

The 2021 original was an early stage of a p5 + Matter.js Angry-Birds course series.
Rebuilt in 2026 as a standalone numerical simulator: RK4 with drag, analytic overlays,
a live data panel, and a numpy-verified test suite.
