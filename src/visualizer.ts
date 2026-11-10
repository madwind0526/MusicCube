import { s } from "./settings";

const N = 64; // points around the circle; the spectrum covers half of them and is mirrored left/right
const HISTORY_MS = 110; // rings mode: spacing in time between rings
const RINGS = 6;

// Draws on its own transparent 2D canvas behind the cube. `fill` writes 128 frequency bytes: the real analyser,
// or a fake beat when the sound cannot be analysed.
export function createVisualizer(canvas: HTMLCanvasElement, fill: (d: Uint8Array, now: number) => void) {
  const g = canvas.getContext("2d")!;
  const data = new Uint8Array(128);
  let cx = 0, cy = 0, u = 1; // circle centre (css px) and px per cube-size unit (scales every length)
  let history: { t: number; d: Uint8Array }[] = [];

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
  const value = (src: Uint8Array, i: number) => {
    const frac = Math.min(i, N - i) / (N / 2); // 0 (bass, bottom) .. 1 (treble, top)
    return src[2 + Math.floor(Math.pow(frac, 1.4) * 70)] / 255;
  };
  const hue = (v: number) => 260 - v * 260;

  function bars(src: Uint8Array) {
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

  // The tips joined into one closed smooth curve; `base` radius, `amp` how far loud bins push out, `alpha` opacity.
  function loop(src: Uint8Array, base: number, amp: number, alpha: number, width: number) {
    const pts: [number, number, number][] = [];
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const v = value(src, i), a = angle(i), r = base + v * amp;
      sum += v;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, v]);
    }
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[(i + 1) % N];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p0 = pts[0], q0 = pts[1];
    g.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2); // close
    g.lineJoin = "round";
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

  function update(now: number, playing: boolean) {
    const w = canvas.width / (window.devicePixelRatio || 1), h = canvas.height / (window.devicePixelRatio || 1);
    if (!playing) { g.clearRect(0, 0, w, h); history = []; return; }
    fill(data, now);
    // Above 1, reduce fading to extend the old maximum trail by up to 1.5 times.
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = `rgba(0,0,0,${s.vizTrail <= 1 ? 1 - s.vizTrail * 0.975 : 0.025 / s.vizTrail})`;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    if (s.viz === "bars") bars(data);
    else if (s.viz === "wave") loop(data, 100 * u, 62 * u, 1, s.vizWidth * u);
    else {
      history.push({ t: now, d: data.slice() });
      while (history.length > 1 && now - history[0].t > RINGS * HISTORY_MS + 300) history.shift();
      rings(now);
    }
  }

  return { update, layout };
}

/** Fake spectrum for YouTube: a 2 Hz bass pulse plus drifting wiggle on the other bands. */
export function fakeSpectrum(d: Uint8Array, now: number) {
  const t = now / 1000;
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 4);
  for (let k = 0; k < d.length; k++) {
    const wiggle = 0.5 + 0.5 * Math.sin(t * 3 + k * 0.9) * Math.sin(t * 1.7 + k * 0.31);
    const v = 0.12 + 0.28 * wiggle * (1 - k / 160) + beat * Math.max(0, 0.9 - k / 40);
    d[k] = Math.min(1, v) * 255;
  }
}
