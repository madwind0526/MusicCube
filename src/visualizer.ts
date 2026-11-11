import { s } from "./settings";

const N = 64; // points around the circle; the spectrum covers half of them and is mirrored left/right
export const BARS = N / 2 + 1; // distinct spectrum values: bass (bottom) .. treble (top)
const HISTORY_MS = 110; // rings mode: spacing in time between rings
const RINGS = 6;

// Draws on its own transparent 2D canvas behind the cube. `fill` writes BARS values 0..1 (cava-style spectrum, or a
// fake beat when the sound cannot be analysed).
export function createVisualizer(canvas: HTMLCanvasElement, fill: (d: Float32Array, now: number, dt: number) => void) {
  const g = canvas.getContext("2d")!;
  const data = new Float32Array(BARS);
  let cx = 0, cy = 0, u = 1; // circle centre (css px) and px per cube-size unit (scales every length)
  let history: { t: number; d: Float32Array }[] = [];
  let phase = 0; // ocean mode: wave phase, advanced by the music's energy
  let oceanHue = 210; // ocean mode: base colour, drifts round the colour wheel (faster when the music is loud)

  /** Call on every window/size change: (centre x, centre y, cube pixel size) in css px. */
  function layout(w: number, h: number, centerX: number, centerY: number, cubePx: number) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = centerX; cy = centerY; u = cubePx / 360;
  }

  // Point i of the ring: angle starts at the bottom; the left half mirrors the right half so the loop is continuous.
  const angle = (i: number) => Math.PI / 2 + (i / N) * Math.PI * 2;
  const value = (src: Float32Array, i: number) => src[Math.min(i, N - i)];
  const hue = (v: number) => 260 - v * 260;
  const avg = (src: Float32Array, a: number, b: number) => { let t = 0; for (let i = a; i < b; i++) t += src[i]; return t / (b - a); };

  function bars(src: Float32Array) {
    const R = 100 * u;
    g.lineCap = "round";
    g.lineWidth = s.vizWidth * u;
    for (let i = 0; i < N; i++) {
      const v = value(src, i), a = angle(i), len = (4 + v * 62) * u;
      g.strokeStyle = `hsl(${hue(v)} 90% 60%)`;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
      g.stroke();
    }
  }

  // Closed smooth curve through points at radius `r(i)`.
  function closedCurve(r: (i: number) => number, points: number, rot = 0) {
    const pts: [number, number][] = [];
    for (let i = 0; i < points; i++) {
      const a = Math.PI / 2 + (i / points) * Math.PI * 2 + rot, rr = r(i);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    g.beginPath();
    for (let i = 0; i < points; i++) {
      const p = pts[i], q = pts[(i + 1) % points];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p0 = pts[0], q0 = pts[1];
    g.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2);
    g.closePath();
    g.lineJoin = "round";
  }

  // The tips joined into one closed smooth curve; `base` radius, `amp` how far loud bins push out, `alpha` opacity.
  function loop(src: Float32Array, base: number, amp: number, alpha: number, width: number) {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += value(src, i);
    closedCurve((i) => base + value(src, i) * amp, N);
    g.lineWidth = width;
    g.strokeStyle = `hsl(${hue(sum / N * 1.8)} 90% 65% / ${alpha})`;
    g.stroke();
  }

  // SongYUE2 style: several loops, each showing the spectrum of an earlier moment, older ones further out.
  function rings(now: number) {
    for (let k = 0; k < RINGS; k++) {
      const target = now - k * HISTORY_MS;
      let frame: (typeof history)[number] | undefined;
      for (let j = history.length - 1; j >= 0; j--) if (history[j].t <= target) { frame = history[j]; break; }
      if (!frame) continue;
      loop(frame.d, (100 + k * 16) * u, 40 * u, 0.9 * (1 - k / (RINGS + 1)), s.vizWidth * 0.6 * u);
    }
  }

  // Ocean: translucent layers of waves running round the cube. Bass drives a slow big swell, mids a middle chop, and
  // treble a fast small ripple; the music's energy also speeds the waves up.
  function ocean(src: Float32Array, dt: number) {
    const bass = avg(src, 0, 6), mid = avg(src, 6, 18), high = avg(src, 18, BARS);
    phase += dt * (0.8 + (bass + mid + high) * 4);
    oceanHue = (oceanHue + dt * (6 + (bass + mid + high) * 18)) % 360;
    const layers = [
      { k: 3, amp: bass, speed: 0.7, h: 0, r: 98 },
      { k: 6, amp: mid, speed: -1.1, h: 40, r: 104 },
      { k: 11, amp: high, speed: 1.8, h: 80, r: 110 },
    ];
    for (const L of layers) {
      const swell = 8 + L.amp * 46; // px of wave height at size 1
      closedCurve((i) => (L.r + swell * Math.sin(L.k * (i / 96) * Math.PI * 2 + phase * L.speed) + bass * 18 * Math.sin((i / 96) * Math.PI * 2 * 2 - phase * 0.5)) * u, 96);
      const hh = (oceanHue + L.h) % 360; // each layer sits a fixed step away on the colour wheel
      g.fillStyle = `hsl(${hh} 85% 55% / 0.28)`;
      g.fill();
      g.lineWidth = s.vizWidth * 0.5 * u;
      g.strokeStyle = `hsl(${hh} 90% 80% / 0.85)`; // foam line on the crest
      g.stroke();
    }
  }

  function update(now: number, dt: number, playing: boolean) {
    const w = canvas.width / (window.devicePixelRatio || 1), h = canvas.height / (window.devicePixelRatio || 1);
    if (!playing) { g.clearRect(0, 0, w, h); history = []; return; }
    fill(data, now, dt);
    // Above 1, reduce fading to extend the old maximum trail by up to 1.5 times.
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = `rgba(0,0,0,${s.vizTrail <= 1 ? 1 - s.vizTrail * 0.975 : 0.025 / s.vizTrail})`;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    if (s.viz === "bars") bars(data);
    else if (s.viz === "wave") loop(data, 100 * u, 62 * u, 1, s.vizWidth * u);
    else if (s.viz === "ocean") ocean(data, dt);
    else {
      history.push({ t: now, d: data.slice() });
      while (history.length > 1 && now - history[0].t > RINGS * HISTORY_MS + 300) history.shift();
      rings(now);
    }
  }

  return { update, layout };
}

/** Fake spectrum for YouTube when the system sound cannot be captured: a 2 Hz bass pulse plus drifting wiggle. */
export function fakeSpectrum(d: Float32Array, now: number) {
  const t = now / 1000;
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 4);
  for (let k = 0; k < d.length; k++) {
    const wiggle = 0.5 + 0.5 * Math.sin(t * 3 + k * 0.9) * Math.sin(t * 1.7 + k * 0.31);
    d[k] = Math.min(1, 0.12 + 0.28 * wiggle * (1 - k / 40) + beat * Math.max(0, 0.9 - k / 12));
  }
}
