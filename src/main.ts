import { analyticNoDrag, parabolaPoints } from './analytic';
import { simulate, type SimResult } from './physics';
import { drawPlot, type Mapper, type PlotTheme } from './plot';

interface Controls {
  v0: number;
  angleDeg: number;
  g: number;
  beta: number;
}

const theme: PlotTheme = {
  bg: '#0b0f16',
  grid: '#1c2637',
  axis: '#3d4f6e',
  predicted: '#63b3ff',
  actual: '#ffb454',
  apex: '#ff6b81',
  text: '#7f93b2',
};

const DT = 0.005;

function requireEl<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

const canvas = requireEl<HTMLCanvasElement>('#plot');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');
const controlsEl = requireEl('#controls');
const dataEl = requireEl('#data');

const controls: Controls = { v0: 50, angleDeg: 45, g: 9.81, beta: 0.005 };

let result: SimResult = simulate({ ...controls, dt: DT, maxT: 60 });
let flightStart: number | null = null;
let lastMapper: Mapper | null = null;

const SLIDERS: {
  key: keyof Controls;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: 'v0', label: 'Launch speed', min: 5, max: 100, step: 1, unit: 'm/s' },
  { key: 'angleDeg', label: 'Angle', min: 5, max: 85, step: 1, unit: '°' },
  { key: 'g', label: 'Gravity', min: 1, max: 25, step: 0.01, unit: 'm/s²' },
  { key: 'beta', label: 'Drag β', min: 0, max: 0.05, step: 0.001, unit: '/m' },
];

const sliderInputs = new Map<keyof Controls, HTMLInputElement>();
const sliderReadouts = new Map<keyof Controls, HTMLElement>();

function rerun(): void {
  result = simulate({ ...controls, dt: DT, maxT: 60 });
  flightStart = null;
  renderData();
}

/** Reflect programmatic control changes (drag-to-aim) back into the sliders. */
function syncSliderUI(key: keyof Controls): void {
  const input = sliderInputs.get(key);
  const readout = sliderReadouts.get(key);
  const spec = SLIDERS.find((s) => s.key === key);
  if (input) input.value = String(controls[key]);
  if (readout && spec) readout.textContent = ` ${controls[key]} ${spec.unit}`;
}

function buildControls(): void {
  controlsEl.innerHTML = '<h2>Launch parameters</h2>';
  for (const spec of SLIDERS) {
    const label = document.createElement('label');
    const readout = document.createElement('strong');
    readout.textContent = ` ${controls[spec.key]} ${spec.unit}`;
    label.append(`${spec.label}:`, readout);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(controls[spec.key]);
    input.addEventListener('input', () => {
      controls[spec.key] = Number(input.value);
      readout.textContent = ` ${input.value} ${spec.unit}`;
      rerun();
    });
    label.append(input);
    controlsEl.append(label);
    sliderInputs.set(spec.key, input);
    sliderReadouts.set(spec.key, readout);
  }
  const fire = document.createElement('button');
  fire.type = 'button';
  fire.textContent = '▶ Animate flight';
  fire.addEventListener('click', () => {
    flightStart = performance.now();
  });
  controlsEl.append(fire);
}

function fmt(v: number, digits = 2): string {
  return v.toFixed(digits);
}

function renderData(): void {
  const s = result.summary;
  const ideal = analyticNoDrag(controls.v0, controls.angleDeg, controls.g);
  const dragLoss = ideal.range > 0 ? (1 - s.range / ideal.range) * 100 : 0;
  dataEl.innerHTML = `
    <h2>Flight data (integrated)</h2>
    <div class="grid">
      <div class="stat">v₀ₓ<b>${fmt(s.v0x)} m/s</b></div>
      <div class="stat">v₀ᵧ<b>${fmt(s.v0y)} m/s</b></div>
      <div class="stat">Apex<b>${fmt(s.apex)} m</b><small>vacuum ${fmt(ideal.apex)} m</small></div>
      <div class="stat">Range<b>${fmt(s.range)} m</b><small>vacuum ${fmt(ideal.range)} m</small></div>
      <div class="stat">Flight time<b>${fmt(s.flightTime)} s</b><small>vacuum ${fmt(ideal.flightTime)} s</small></div>
      <div class="stat">Drag loss<b class="delta">${fmt(dragLoss, 1)}%</b><small>of vacuum range</small></div>
    </div>`;
}

// --- Drag-to-aim on the chart ------------------------------------------------

let aiming = false;

function aimFromPointer(e: PointerEvent): void {
  if (!lastMapper) return;
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const wx = lastMapper.wx(px);
  const wy = lastMapper.wy(py);
  if (wx <= 0 && wy <= 0) return;
  const deg = (Math.atan2(wy, Math.max(0.001, wx)) * 180) / Math.PI;
  controls.angleDeg = Math.round(Math.min(85, Math.max(5, deg)));
  syncSliderUI('angleDeg');
  rerun();
}

canvas.addEventListener('pointerdown', (e) => {
  aiming = true;
  canvas.setPointerCapture(e.pointerId);
  aimFromPointer(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (aiming) aimFromPointer(e);
});
canvas.addEventListener('pointerup', () => {
  aiming = false;
});

buildControls();
renderData();

function frame(now: number): void {
  let markerT: number | null = null;
  if (flightStart !== null) {
    const t = (now - flightStart) / 1000;
    markerT = t <= result.summary.flightTime ? t : null;
    if (markerT === null) flightStart = null;
  }
  lastMapper = drawPlot(
    ctx as CanvasRenderingContext2D,
    canvas.width,
    canvas.height,
    parabolaPoints(controls.v0, controls.angleDeg, controls.g),
    result.points,
    markerT,
    theme,
    controls.angleDeg,
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
