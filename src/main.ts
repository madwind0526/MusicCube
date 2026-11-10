import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Anchor, Cog, FolderOpen, Pause, Play, Repeat, Repeat1, Shuffle, Wind } from "./icons";
import { createCube, FACES } from "./cube";
import { createPlayer } from "./audio";
import { createVisualizer, fakeSpectrum } from "./visualizer";
import { onExternalChange, s, save } from "./settings";
import { applyAuto } from "./autocolor";


const BASE = 360; // cube size in px at size 1
const WIN = 560; // window size in px at size 1: room around the cube for the visualizer at its thickest

// ---- scene ----
const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.DirectionalLight(0xffffff, 2).translateX(2).translateY(3).translateZ(4));
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
camera.position.z = 5;

const cube = createCube();
scene.add(cube.mesh);
cube.mesh.quaternion.setFromEuler(new THREE.Euler(0.5, -0.6, 0));

// ---- player ----
const player = createPlayer(refreshIcons);
player.shuffle = s.shuffle;
player.repeat = s.repeat;
const analyserData = new Uint8Array(128);
const viz = createVisualizer(document.getElementById("viz") as HTMLCanvasElement, (d, now) => {
  if (player.synthetic) fakeSpectrum(d, now);
  else { player.analyser.getByteFrequencyData(analyserData); d.set(analyserData); }
});

function refreshIcons() {
  cube.setIcon("play", player.playing ? Pause : Play);
  cube.setIcon("shuffle", Shuffle, s.shuffle);
  cube.setIcon("repeat", s.repeat === "one" ? Repeat1 : Repeat, s.repeat !== "off");
  cube.setIcon("folder", FolderOpen);
  cube.setIcon("settings", Cog);
  cube.setIcon("hold", s.floating ? Wind : Anchor);
}

const ACTIONS = {
  play: () => player.toggle(),
  shuffle: () => { player.shuffle = s.shuffle = !s.shuffle; save(); refreshIcons(); },
  repeat: () => {
    const order = ["off", "all", "one"] as const;
    player.repeat = s.repeat = order[(order.indexOf(s.repeat) + 1) % 3];
    save(); refreshIcons();
  },
  folder: () => window.api?.openPanel("folder", anchorY()),
  settings: () => window.api?.openPanel("settings", anchorY()),
  hold: () => { s.floating = !s.floating; save(); refreshIcons(); },
};

// ---- window layout: a square window centred on the cube; settings and folder pick open in their own window ----
const cubePx = () => Math.round(BASE * s.size);
const winPx = () => Math.round(WIN * s.size);
const anchorY = () => winPx() / 2 + cubePx() / 2 - 20; // where the panel window starts, relative to this window's top
function layoutWindow() { window.api?.setSize(winPx(), winPx(), winPx() / 2); }
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.zoom = cubePx() / H; // keeps the cube's pixel size independent of the window size
  camera.updateProjectionMatrix();
  viz.layout(W, H, W / 2, H / 2, cubePx());
}
window.addEventListener("resize", resize);

// The settings/folder window saves into localStorage; this window follows.
const source = () => JSON.stringify([s.folder, s.playlistFile, s.urls]);
let sourceVersion = 0;
async function applySource() {
  const version = ++sourceVersion;
  const urls = s.folder ? await window.api?.scan(s.folder) : s.playlistFile ? await window.api?.readPlaylist(s.playlistFile) : s.urls;
  if (version === sourceVersion) player.setList(urls ?? []);
}
let seen = { size: s.size, source: source(), onTop: s.onTop };
onExternalChange(() => {
  cube.applyLook();
  cube.applyTexture();
  if (s.size !== seen.size) { layoutWindow(); resize(); }
  if (s.onTop !== seen.onTop) window.api?.setOnTop(s.onTop);
  if (source() !== seen.source) void applySource();
  seen = { size: s.size, source: source(), onTop: s.onTop };
});

// ---- pointer: drag rotates the cube, a click presses a face, right-drag on the cube moves the window ----
const ray = new THREE.Raycaster();
const spin = new THREE.Vector3(); // angular velocity (rad/s) in camera space
let down: { x: number; y: number; moved: boolean; right: boolean } | null = null;
let last = { x: 0, y: 0, t: 0 };
let ignoring = false;

function hitAt(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  return ray.intersectObject(cube.mesh)[0];
}
// Clicks on the transparent area fall through to the desktop; the window only catches the mouse over the cube.
function setIgnore(v: boolean) { if (v !== ignoring) { ignoring = v; window.api?.ignoreMouse(v); } }

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  const right = e.button === 2;
  if (right && !hitAt(e)) return;
  canvas.setPointerCapture(e.pointerId);
  down = { x: e.clientX, y: e.clientY, moved: false, right };
  last = { x: e.screenX, y: e.screenY, t: performance.now() };
  spin.set(0, 0, 0);
});
canvas.addEventListener("pointermove", (e) => {
  if (!down) { setIgnore(!hitAt(e)); return; }
  const dx = e.screenX - last.x, dy = e.screenY - last.y;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) down.moved = true;
  if (down.right) window.api?.moveBy(dx, dy);
  else if (down.moved) {
    const dt = Math.max((performance.now() - last.t) / 1000, 0.001);
    const angle = Math.hypot(dx, dy) * 0.012;
    if (angle > 0) {
      const axis = new THREE.Vector3(dy, dx, 0).normalize(); // drag right spins about +Y, drag down about +X
      cube.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
      spin.copy(axis).multiplyScalar(angle / dt);
    }
  }
  last = { x: e.screenX, y: e.screenY, t: performance.now() };
});
canvas.addEventListener("pointerup", (e) => {
  const d = down;
  down = null;
  if (!d || d.moved || d.right) return;
  const hit = hitAt(e);
  if (hit?.face) void ACTIONS[FACES[hit.face.materialIndex]]();
});

// ---- loop ----
let prev = performance.now();
function frame(now: number) {
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  if (!down && spin.lengthSq() > 1e-4) { // inertia after release
    cube.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spin.clone().normalize(), spin.length() * dt));
    spin.multiplyScalar(Math.exp(-2.5 * dt));
  }
  cube.mesh.position.y = s.floating ? Math.sin(now / 700) * 0.08 : 0; // the "floating" sway
  viz.update(now, player.playing);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

layoutWindow();
resize();
applyAuto();
cube.applyLook();
cube.applyTexture();
refreshIcons();
window.api?.setOnTop(s.onTop);
if (s.folder || s.playlistFile || s.urls.length) void applySource();
requestAnimationFrame(frame);

if (import.meta.env.DEV) (window as any).__mc = { player, ACTIONS, s, cube }; // test hook, dev mode only
