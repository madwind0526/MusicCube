// Chladni plate patterns (the formula of StellarScript/Cymatics, MIT): sand on a vibrating plate collects on the
// nodal lines, where the plate does not move. Here the "sand" is a cloud of particles that jitter more where the
// plate moves more and slide towards the quiet lines.
//
// A fixed handful of plate modes would give a handful of repeating pictures. So the plate is a blend of two modes
// (one for the bass, one for the treble, weighted by how much sound is in each) whose mode numbers are not whole numbers
// and drift slowly, and whose two terms keep changing their share: the pattern never repeats exactly.

const P = Math.PI;

/** Plate displacement at (x, y) in -1..1 for the mode numbers m and n. Zero on the nodal lines. */
export function chladni(x: number, y: number, m: number, n: number, a = 1, b = 1): number {
  const u = (x + 1) / 2, v = (y + 1) / 2;
  return a * Math.sin(P * n * u) * Math.sin(P * m * v) + b * Math.sin(P * m * u) * Math.sin(P * n * v);
}

/** The plates [m, n - m] at rest: a coarse one for the bass and a fine one for the treble. (A first version had four, low / low-mid / high-mid / high.) */
const BASE: readonly (readonly [number, number])[] = [[2, 1], [6, 3]];
/** The spectrum bars (bass first) that drive each plate. */
const GROUPS: readonly (readonly [number, number])[] = [[0, 6], [12, 33]];

export interface Plate {
  /** How strongly each mode vibrates (sums to 1). */
  w: number[];
  /** m0, n0, m1, n1, ... (drifting, not whole numbers) */
  mn: number[];
  /** a0, b0, a1, b1, ...: the share of the two terms of each mode */
  ab: number[];
}

export const makePlate = (): Plate => ({ w: [0.5, 0.5], mn: Array(4).fill(0), ab: Array(4).fill(1) });

/** Moves the mode numbers and term shares along with `phase` (it grows with time, faster when the music is loud). */
export function evolve(p: Plate, phase: number): void {
  for (let k = 0; k < BASE.length; k++) {
    const m = BASE[k][0] + 1.3 * Math.sin(phase * (0.21 + 0.07 * k) + k * 1.9);
    p.mn[2 * k] = m;
    p.mn[2 * k + 1] = m + BASE[k][1] + 0.5 * Math.sin(phase * (0.17 + 0.05 * k) + k * 2.7 + 1); // n stays above m: m = n would cancel the plate
    const ang = phase * (0.11 + 0.04 * k) + k * 1.3;
    p.ab[2 * k] = Math.cos(ang);
    p.ab[2 * k + 1] = Math.sin(ang * 1.3 + 0.7);
  }
}

/** Target weights of the modes from the spectrum bars (0..1), or null in silence (keep the pattern). */
export function bandWeights(bars: ArrayLike<number>): number[] | null {
  const e = GROUPS.map(([a, b]) => { let t = 0; for (let i = a; i < Math.min(b, bars.length); i++) t += bars[i]; return t / (b - a); });
  const sum = e.reduce((a, b) => a + b, 0);
  if (sum < 0.04) return null;
  return e.map((v) => v / sum);
}

/** Plate displacement and its slope at (x, y): writes [f, df/dx, df/dy] to `out`. */
export function plate(x: number, y: number, p: Plate, out: number[]): void {
  const u = (x + 1) / 2, v = (y + 1) / 2;
  let f = 0, fx = 0, fy = 0;
  for (let k = 0; k < BASE.length; k++) {
    const w = p.w[k];
    if (w < 0.01) continue; // a mode that hardly vibrates costs nothing
    const m = p.mn[2 * k], n = p.mn[2 * k + 1], a = p.ab[2 * k] * w, b = p.ab[2 * k + 1] * w;
    const snu = Math.sin(P * n * u), cnu = Math.cos(P * n * u), smv = Math.sin(P * m * v), cmv = Math.cos(P * m * v);
    const smu = Math.sin(P * m * u), cmu = Math.cos(P * m * u), snv = Math.sin(P * n * v), cnv = Math.cos(P * n * v);
    f += a * snu * smv + b * smu * snv;
    fx += (P / 2) * (a * n * cnu * smv + b * m * cmu * snv); // d/dx = (1/2) d/du
    fy += (P / 2) * (a * m * snu * cmv + b * n * smu * cnv);
  }
  out[0] = f; out[1] = fx; out[2] = fy;
}

const probe = [0, 0, 0];

/** One step of the sand: `pts` is x0, y0, x1, y1, ... inside the unit disc; `v` is the vibration strength.
 *  Besides shaking, each grain slides a little towards a quieter spot (down the slope of the plate's motion). */
export function stepParticles(pts: Float32Array, p: Plate, v: number, rnd: () => number, pull = 0.0005): void {
  for (let i = 0; i < pts.length; i += 2) {
    let x = pts[i], y = pts[i + 1];
    plate(x, y, p, probe);
    const s = v * (0.12 + Math.abs(probe[0])); // quiet spots stay put, lively spots shake
    x += (rnd() * 2 - 1) * s - pull * probe[0] * probe[1];
    y += (rnd() * 2 - 1) * s - pull * probe[0] * probe[2];
    const r = Math.hypot(x, y);
    if (r > 1) { x /= r; y /= r; } // the plate is a disc: stay on it
    pts[i] = x; pts[i + 1] = y;
  }
}
