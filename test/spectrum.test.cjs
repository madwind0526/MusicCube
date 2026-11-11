const assert = require("node:assert/strict");
const fs = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/spectrum.ts"), "utf8");
const api = {};
vm.runInNewContext(stripTypeScriptTypes(source).replace(/^export /gm, "") + "\napi.createSpectrum = createSpectrum;", { api, Math, Float64Array });
const { createSpectrum } = api;

const BINS = 2048, RATE = 48000, BARS = 33;
const binOf = (hz) => Math.round(hz / (RATE / 2 / BINS));
// A flat noise floor with one strong tone, in analyser dB.
const frame = (toneHz, floor = -100) => {
  const db = new Float32Array(BINS).fill(floor);
  if (toneHz) db[binOf(toneHz)] = -20;
  return db;
};
const run = (spec, db, frames = 1) => {
  const out = new Float32Array(BARS);
  for (let i = 0; i < frames; i++) spec.process(db, RATE, 1 / 60, out);
  return out;
};
const loudest = (out) => out.indexOf(Math.max(...out));

test("a tone lights the bar of its frequency on a log scale", () => {
  const low = loudest(run(createSpectrum(BARS), frame(100), 20));
  const mid = loudest(run(createSpectrum(BARS), frame(1000), 20));
  const high = loudest(run(createSpectrum(BARS), frame(8000), 20));
  assert.ok(low < mid && mid < high, `bars ${low} < ${mid} < ${high}`);
  // 1 kHz is log(1000/50) / log(10000/50) = 56% of the way from 50 Hz to 10 kHz
  assert.ok(Math.abs(mid - 0.565 * BARS) <= 2, `1 kHz landed in bar ${mid}`);
});

test("silence stays silent and values stay within 0..1", () => {
  const quiet = run(createSpectrum(BARS), frame(0, -Infinity), 30); // digital silence: the analyser reports -Infinity dB
  assert.ok(quiet.every((v) => v === 0));
  const loud = run(createSpectrum(BARS), new Float32Array(BINS).fill(0), 60); // full scale everywhere
  assert.ok(loud.every((v) => v >= 0 && v <= 1));
});

test("auto sensitivity brings a quiet signal up and falling values decay gradually", () => {
  const spec = createSpectrum(BARS);
  const quiet = new Float32Array(BINS).fill(-100);
  quiet[binOf(1000)] = -70;
  const first = run(spec, quiet)[loudest(run(createSpectrum(BARS), quiet))];
  const later = Math.max(...run(spec, quiet, 120));
  assert.ok(later > first * 3, `sensitivity grew ${first} -> ${later}`);

  const spec2 = createSpectrum(BARS);
  const peak = Math.max(...run(spec2, frame(1000), 30));
  const silent = frame(0, -Infinity);
  assert.ok(Math.max(...run(spec2, silent, 1)) > peak * 0.5, "no instant drop when the tone stops");
  assert.ok(Math.max(...run(spec2, silent, 20)) < peak, "then it falls");
  assert.ok(Math.max(...run(spec2, silent, 240)) < 1e-6, "and fades to (almost exactly) zero");
});
