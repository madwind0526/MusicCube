// Captures transparent PNGs of the cube (and of the settings window) for the store images.
// Needs the Vite dev server on :5188 (npm run dev). Starts Electron with its own throw-away profile, so the real
// settings and window position are not touched, plays a synthesized demo song, and writes store/cutouts/*.png.
// Usage: node scripts/store-capture.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "store", "cutouts");
const PORT = 9340;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- demo song: kick, hi-hat, bass, arpeggio and a lead, so every band of the spectrum moves ----
function makeDemoWav(file) {
  const sr = 44100, secs = 32, n = sr * secs, buf = Buffer.alloc(44 + n * 2);
  const chords = [[220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392], [164.81, 207.65, 246.94, 329.63]];
  const bass = [55, 43.65, 65.41, 49];
  let seed = 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr, beat = t * 2, inBeat = beat % 1, bar = Math.floor(beat / 4) % 4, eighth = (t * 4) % 1, eighthIdx = Math.floor(t * 4);
    let v = 0;
    v += 0.9 * Math.sin(2 * Math.PI * (45 + 75 * Math.exp(-inBeat * 18)) * inBeat * 0.5) * Math.exp(-inBeat * 7); // kick
    const hat = ((t * 4) % 1) / 4; v += 0.18 * rnd() * Math.exp(-hat * 70) * (eighthIdx % 2 ? 1 : 0.5); // hi-hat
    v += 0.45 * (Math.sin(2 * Math.PI * bass[bar] * t) + 0.3 * Math.sin(4 * Math.PI * bass[bar] * t)) * (0.6 + 0.4 * Math.exp(-inBeat * 3)); // bass
    const note = chords[bar][eighthIdx % 4]; v += 0.22 * Math.sin(2 * Math.PI * note * 2 * t) * Math.exp(-eighth * 3); // arpeggio
    const lead = chords[bar][(Math.floor(t * 2) * 3) % 4] * 4; v += 0.12 * Math.sin(2 * Math.PI * lead * t) * Math.exp(-inBeat * 2); // lead
    pcm[i] = v;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(pcm[i])); // a loop: spreading 1.4 million values overflows the stack
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round((pcm[i] / peak) * 0.85 * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

// ---- scenes: settings applied on top of BASE, plus the cube's rotation ----
const BASE = {
  // the store look: a black cube with red marble veins, white icons
  color: "#0e0e12", patternColor: "#d11a22", iconColor: "#ffffff", auto: false, manualPattern: true, manualIcon: true,
  texture: "marble", relief: 0.5, viz: "wave", vizWidth: 12, vizTrail: 1.2, opacity: 1, floating: false, cava: true,
};
const PLAY_FACE = -Math.PI / 2; // rotation.y that turns the play face toward the camera
const SCENES = [
  // not playing: icons and faces only
  { name: "face-play", playing: false, rot: [0.25, PLAY_FACE + 0.45, 0] },
  { name: "face-gear", playing: false, rot: [0.45, -0.6, 0] },
  { name: "face-next", playing: false, rot: [-0.3, Math.PI - 0.55, 0.05] },
  // playing: the wave (closed waveform) is the main look, seen from four sides
  { name: "wave-1", rot: [0.5, -0.6, 0] },
  { name: "wave-2", rot: [0.45, 0.7, 0] },
  { name: "wave-3", rot: [-0.4, 0.5, 0.1] },
  { name: "wave-4", rot: [-0.7, Math.PI - 0.5, 0.05] },
  // the other modes, for the "see your music" image
  { name: "mode-bars", rot: [0.5, -0.6, 0], s: { viz: "bars", vizWidth: 9 } },
  { name: "mode-rings", rot: [-0.4, 0.5, 0.1], s: { viz: "rings", vizWidth: 10, vizTrail: 1 } },
  { name: "mode-cymatics", rot: [0.5, -0.6, 0], wait: 9000, s: { viz: "cymatics", vizWidth: 3, vizTrail: 0.3 } }, // the sand needs a few seconds to settle
  { name: "mode-ocean", rot: [0.6, -0.9, 0], s: { viz: "ocean", vizWidth: 6, vizTrail: 1 } },
];
const SIZE = 1.5; // cube size setting; the window is 560 * SIZE px wide
const WIN = Math.round(560 * SIZE);

async function connect(match, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const tab = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page" && match(t.url));
      if (tab) {
        const ws = new WebSocket(tab.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        let id = 0;
        const pending = new Map();
        ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
        const send = (method, params = {}) => new Promise((res) => { const i2 = ++id; pending.set(i2, res); ws.send(JSON.stringify({ id: i2, method, params })); });
        await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }); // keep alpha in screenshots
        const ev = async (expression, gesture = false) => {
          const r = (await send("Runtime.evaluate", { expression, returnByValue: true, userGesture: gesture, awaitPromise: true })).result;
          return r.result?.value ?? r.exceptionDetails?.exception?.description;
        };
        const shot = async (file, clip) => {
          const r = await send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 2 } });
          fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
        };
        return { ev, shot, close: () => ws.close() };
      }
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error("could not reach the app on the debugging port");
}

try { await fetch("http://127.0.0.1:5188/"); } catch { console.error("Start the Vite server first: npm run dev"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "musiccube-store-"));
const music = path.join(tmp, "music");
fs.mkdirSync(music);
makeDemoWav(path.join(music, "demo.wav"));

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE; // otherwise Electron starts as plain Node
const electron = spawn(path.join(ROOT, "node_modules", "electron", "dist", "electron.exe"),
  [ROOT, "--dev", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmp, "profile")}`], { env, stdio: "ignore" });

try {
  const app = await connect((u) => u.endsWith(":5188/"));
  await sleep(2500);
  await app.ev(`window.api.scan(${JSON.stringify(music)}).then((f) => __mc.player.setList(f))`);
  await sleep(500);
  let playing = false;
  const only = process.env.ONLY?.split(","); // ONLY=mode-cymatics captures just those scenes
  for (const sc of SCENES.filter((x) => !only || only.includes(x.name))) {
    await app.ev(`Object.assign(__mc.s, ${JSON.stringify({ ...BASE, size: SIZE, ...sc.s })}); __mc.cube.applyLook(); __mc.cube.applyTexture();`);
    await app.ev(`window.api.setSize(${WIN}, ${WIN}, ${WIN / 2})`); // the renderer follows the window size
    await app.ev(`__mc.cube.mesh.rotation.set(${sc.rot.join(",")}); __mc.cube.mesh.position.y = 0;`);
    const want = sc.playing !== false;
    if (want !== playing) { await app.ev("__mc.ACTIONS.play()", true); playing = want; await sleep(want ? 3500 : 800); }
    await sleep(want ? (sc.wait ?? 3500) : 1200); // long enough for the afterimage to build up and the previous scene to fade
    const shots = Number(process.env.SHOTS || 1); // SHOTS=4 takes several pictures a few seconds apart (to see a mode change)
    for (let i = 0; i < shots; i++) {
      if (i) await sleep(Number(process.env.GAP || 4000));
      await app.shot(path.join(OUT, `${sc.name}${shots > 1 ? "-" + (i + 1) : ""}.png`), { x: 0, y: 0, width: WIN, height: WIN });
    }
    console.log("captured", sc.name);
  }

  if (!only) { // a partial run skips the settings window
    // the settings window, in the base look
    await app.ev(`Object.assign(__mc.s, ${JSON.stringify({ ...BASE, size: SIZE })}); __mc.cube.applyLook(); __mc.cube.applyTexture(); __mc.save();`); // saved: the settings window reads the file
    await app.ev("__mc.ACTIONS.settings()");
    await sleep(2500);
    const panel = await connect((u) => u.includes("panel.html"));
    await sleep(800);
    const box = JSON.parse(await panel.ev("JSON.stringify((() => { const b = document.querySelector('.pop').getBoundingClientRect(); return { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 }; })())"));
    await panel.shot(path.join(OUT, "settings.png"), box);
    console.log("captured settings");
    panel.close();
  }
  app.close();
} finally {
  electron.kill();
  await sleep(500);
  fs.rmSync(tmp, { recursive: true, force: true });
}
