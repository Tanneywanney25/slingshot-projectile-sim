#!/usr/bin/env python3
"""Generate numpy ground-truth trajectories for the TypeScript simulator.

Mirrors src/physics.ts exactly — same RK4 formulation, same operation order,
same linear ground-crossing interpolation — so the Vitest suite can assert the
TS integrator against these fixtures to tight tolerances.

Usage:
    python scripts/reference_trajectories.py [--out tests/fixtures/reference.json]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

CASES = [
    {"name": "vacuum-45", "v0": 50.0, "angleDeg": 45.0, "g": 9.81, "beta": 0.0},
    {"name": "light-drag-30", "v0": 50.0, "angleDeg": 30.0, "g": 9.81, "beta": 0.02},
    {"name": "heavy-drag-60", "v0": 70.0, "angleDeg": 60.0, "g": 9.81, "beta": 0.05},
    {"name": "steep-75", "v0": 30.0, "angleDeg": 75.0, "g": 9.81, "beta": 0.01},
]
DT = 0.005
MAX_T = 60.0
SAMPLE_EVERY = 20  # every 0.1 s


def derivative(s: np.ndarray, g: float, beta: float) -> np.ndarray:
    x, y, vx, vy = s
    speed = np.sqrt(vx * vx + vy * vy)
    return np.array([vx, vy, -beta * speed * vx, -g - beta * speed * vy])


def rk4_step(s: np.ndarray, dt: float, g: float, beta: float) -> np.ndarray:
    k1 = derivative(s, g, beta)
    k2 = derivative(s + 0.5 * dt * k1, g, beta)
    k3 = derivative(s + 0.5 * dt * k2, g, beta)
    k4 = derivative(s + dt * k3, g, beta)
    return s + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


def simulate(v0: float, angle_deg: float, g: float, beta: float) -> dict:
    angle = angle_deg * np.pi / 180.0
    v0x = v0 * np.cos(angle)
    v0y = v0 * np.sin(angle)
    s = np.array([0.0, 0.0, v0x, v0y])
    t = 0.0
    apex = 0.0
    points = [{"t": 0.0, "x": 0.0, "y": 0.0, "vx": float(v0x), "vy": float(v0y)}]
    max_steps = int(np.ceil(MAX_T / DT))

    for step in range(1, max_steps + 1):
        nxt = rk4_step(s, DT, g, beta)
        if nxt[1] > apex:
            apex = float(nxt[1])

        if nxt[1] < 0.0:
            frac = s[1] / (s[1] - nxt[1])
            t_cross = t + frac * DT
            landing = {
                "t": float(t_cross),
                "x": float(s[0] + frac * (nxt[0] - s[0])),
                "y": 0.0,
                "vx": float(s[2] + frac * (nxt[2] - s[2])),
                "vy": float(s[3] + frac * (nxt[3] - s[3])),
            }
            points.append(landing)
            return {
                "points": points,
                "summary": {
                    "v0x": float(v0x),
                    "v0y": float(v0y),
                    "range": landing["x"],
                    "apex": apex,
                    "flightTime": float(t_cross),
                },
            }

        s = nxt
        t = step * DT
        if step % SAMPLE_EVERY == 0:
            points.append(
                {"t": float(t), "x": float(s[0]), "y": float(s[1]), "vx": float(s[2]), "vy": float(s[3])}
            )

    raise RuntimeError("projectile never landed — check parameters")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("tests/fixtures/reference.json"))
    args = parser.parse_args()

    fixtures = {
        "dt": DT,
        "maxT": MAX_T,
        "sampleEvery": SAMPLE_EVERY,
        "cases": [
            {**case, **simulate(case["v0"], case["angleDeg"], case["g"], case["beta"])}
            for case in CASES
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(fixtures, indent=1) + "\n", encoding="utf-8")
    total = sum(len(c["points"]) for c in fixtures["cases"])
    print(f"wrote {args.out}: {len(CASES)} cases, {total} sampled points")


if __name__ == "__main__":
    main()
