const assert = require("node:assert/strict");
const fs = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/chladni.ts"), "utf8");
const api = {};
vm.runInNewContext(stripTypeScriptTypes(source).replace(/^export /gm, "") + "\nObject.assign(api, { chladni, makePlate, evolve, bandWeights, plate, stepParticles });", { api, Math, Array });
const { chladni, makePlate, evolve, bandWeights, plate, stepParticles } = api;

// a small repeatable random generator
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const field = (p, x, y) => { const o = [0, 0, 0]; plate(x, y, p, o); return o; };

test("the formula: still at the plate's edge for whole mode numbers, moving inside", () => {
  assert.ok(Math.abs(chladni(-1, 0.3, 2, 3)) < 1e-9);
  assert.ok(Math.abs(chladni(0.2, 1, 2, 3)) < 1e-9);
  assert.ok(Math.abs(chladni(0.3, 0.4, 2, 3)) > 0.05);
});

test("the blended plate agrees with the formula and its slope with a finite difference", () => {
  const p = makePlate();
  evolve(p, 4.2);
  p.w = [1, 0];
  const [m, n, a, b] = [p.mn[0], p.mn[1], p.ab[0], p.ab[1]];
  for (const [x, y] of [[0.3, -0.4], [-0.7, 0.2], [0.1, 0.9]]) {
    const [f, fx, fy] = field(p, x, y);
    assert.ok(Math.abs(f - chladni(x, y, m, n, a, b)) < 1e-9);
    const e = 1e-5;
    assert.ok(Math.abs(fx - (chladni(x + e, y, m, n, a, b) - chladni(x - e, y, m, n, a, b)) / (2 * e)) < 1e-4, "df/dx");
    assert.ok(Math.abs(fy - (chladni(x, y + e, m, n, a, b) - chladni(x, y - e, m, n, a, b)) / (2 * e)) < 1e-4, "df/dy");
  }
});

test("the band weights follow where the sound is, and silence changes nothing", () => {
  const bass = new Float32Array(33); for (let i = 0; i < 6; i++) bass[i] = 1;
  const treble = new Float32Array(33); for (let i = 12; i < 33; i++) treble[i] = 1;
  const wb = bandWeights(bass), wt = bandWeights(treble);
  assert.ok(wb[0] > 0.9 && wt[1] > 0.9, `${wb} / ${wt}`);
  assert.ok(Math.abs(wb.reduce((a, b) => a + b) - 1) < 1e-9);
  assert.equal(bandWeights(new Float32Array(33)), null);
});

test("the pattern does not fall back on a handful of pictures", () => {
  // sample the plate over 5 minutes with equal weights and count how many different pictures (rounded fingerprints) appear
  const p = makePlate();
  const spots = [[0.2, 0.3], [-0.5, 0.6], [0.7, -0.2], [-0.3, -0.7], [0.0, 0.1], [0.55, 0.55]];
  const seen = new Set();
  for (let t = 0; t < 300; t += 3) {
    evolve(p, t * 0.5);
    seen.add(spots.map(([x, y]) => Math.round(field(p, x, y)[0] * 4)).join(","));
    for (let k = 0; k < 2; k++) assert.ok(p.mn[2 * k + 1] - p.mn[2 * k] > 0.2, "n stays above m");
  }
  assert.ok(seen.size > 70, `only ${seen.size} different pictures in 100 samples`);
});

test("the sand settles on the nodal lines and stays inside the disc", () => {
  const rnd = lcg(7);
  const p = makePlate();
  evolve(p, 3);
  p.w = [0.5, 0.5];
  const pts = new Float32Array(2 * 1500);
  for (let i = 0; i < pts.length; i += 2) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); pts[i] = Math.cos(a) * r; pts[i + 1] = Math.sin(a) * r; }
  const mean = () => { let t = 0; for (let i = 0; i < pts.length; i += 2) t += Math.abs(field(p, pts[i], pts[i + 1])[0]); return t / (pts.length / 2); };
  const before = mean();
  for (let step = 0; step < 500; step++) stepParticles(pts, p, 0.03, rnd);
  const after = mean();
  assert.ok(after < before * 0.6, `mean displacement ${before.toFixed(3)} -> ${after.toFixed(3)}`);
  for (let i = 0; i < pts.length; i += 2) assert.ok(Math.hypot(pts[i], pts[i + 1]) <= 1 + 1e-6);
});
