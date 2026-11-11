// Port of the signal processing in cava's cavacore (MIT, github.com/karlstav/cava): log-spaced bands, treble
// compensation, gravity fall-off, integral smoothing and automatic sensitivity. Only the FFT itself is left to the
// browser's AnalyserNode, so FFTW (GPL) is not needed.

/** Band cut-offs follow cava's defaults: 50 Hz .. 10 kHz. `noise` = cava's noise_reduction (0.77 by default). */
export function createSpectrum(bars: number, low = 50, high = 10000, noise = 0.77) {
  const fall = new Float64Array(bars), mem = new Float64Array(bars), peak = new Float64Array(bars), prev = new Float64Array(bars);
  const lower: number[] = [], upper: number[] = [], eq: number[] = [];
  let planned = "";
  let sens = 1, sensInit = true, fps = 60;

  // Which FFT bins make up each bar. Like cava, a bar never shares bins with its neighbour: when the log spacing
  // clumps in the bass, the bars are pushed up one bin at a time.
  function plan(binCount: number, sampleRate: number) {
    const binHz = sampleRate / 2 / binCount;
    const edge = (n: number) => low * Math.pow(high / low, n / bars);
    for (let n = 0; n < bars; n++) {
      let lo = Math.floor(edge(n) / binHz);
      if (n > 0 && lo <= lower[n - 1]) lo = lower[n - 1] + 1;
      lower[n] = Math.min(lo, binCount - 1);
    }
    for (let n = 0; n < bars; n++) {
      const hi = n < bars - 1 ? lower[n + 1] - 1 : Math.floor(edge(bars) / binHz);
      upper[n] = Math.min(Math.max(hi, lower[n]), binCount - 1);
      eq[n] = Math.pow(edge(n + 1), 0.85); // cava's boost for higher frequencies
    }
    planned = `${binCount}@${sampleRate}`;
  }

  /** `db`: analyser.getFloatFrequencyData output. Writes `bars` values in 0..1 to `out`. */
  function process(db: Float32Array, sampleRate: number, dt: number, out: Float32Array) {
    if (planned !== `${db.length}@${sampleRate}`) plan(db.length, sampleRate);
    let silence = true;
    for (let n = 0; n < bars; n++) {
      let sum = 0;
      for (let i = lower[n]; i <= upper[n]; i++) sum += Math.pow(10, db[i] / 20); // dB -> amplitude (-Infinity -> 0)
      const v = (sum / (upper[n] - lower[n] + 1)) * eq[n];
      if (v > 1e-6) silence = false;
      out[n] = v * sens;
    }

    // smoothing, as in cava (its frame-rate factors are driven by the measured frame time)
    fps += (1 / Math.max(dt, 0.001) - fps) / 64;
    const fm = 66 / Math.min(Math.max(fps, 15), 240);
    const gravity = Math.pow(fm, 2.5) * 2 / noise;
    const integral = Math.pow(fm, 0.1);
    let overshoot = false;
    for (let n = 0; n < bars; n++) {
      let v = out[n];
      if (v < prev[n]) { // falling: accelerate downwards from the last peak instead of dropping at once
        v = Math.max(0, peak[n] * (1 - fall[n] * fall[n] * gravity));
        fall[n] += 0.028;
      } else { peak[n] = v; fall[n] = 0; }
      prev[n] = v;
      v += mem[n] * noise / integral; // weighted average of the past
      mem[n] = v;
      if (v > 1) { overshoot = true; v = 1; }
      out[n] = v;
    }

    // automatic sensitivity: back off fast when clipping, creep up slowly otherwise (and quickly at the start)
    if (overshoot) { sens *= 1 - 0.02 * fm; sensInit = false; }
    else if (!silence) { sens *= 1 + 0.001 * fm; if (sensInit) sens *= 1 + 0.1 * fm; }
  }

  return { process };
}
