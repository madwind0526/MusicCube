// Procedural surface textures: grey-scale patterns that the cube colour tints (multiply). No image files needed.
const hash = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const smooth = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number) => { let t = 0, a = 0.5; for (let i = 0; i < 4; i++) { t += a * smooth(x, y); x *= 2; y *= 2; a /= 2; } return t; };

/** Each pattern returns lightness 0..1 for a pixel of the 256 px tile (1 = plain, lower = structure). */
export const TEXTURES: { id: string; name: string; f: (x: number, y: number) => number }[] = [
  { id: "plain", name: "무광", f: () => 1 },
  { id: "brushed", name: "브러시드 메탈", f: (x, y) => 0.8 + 0.2 * smooth(x * 0.01, y * 1.3) - 0.08 * hash(x, y) },
  { id: "wood", name: "나무결", f: (x, y) => 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(y * 0.07 + fbm(x * 0.006, y * 0.025) * 9)) },
  { id: "marble", name: "대리석", f: (x, y) => 1 - 0.55 * Math.pow(1 - Math.abs(Math.sin((x + y) * 0.022 + fbm(x * 0.01, y * 0.01) * 9)), 5) },
  { id: "leather", name: "가죽", f: (x, y) => 0.62 + 0.38 * smooth(x * 0.22, y * 0.22) * (0.7 + 0.3 * smooth(x * 0.05, y * 0.05)) },
  { id: "carbon", name: "카본", f: (x, y) => (((x >> 3) + (y >> 3)) & 1 ? 0.62 : 0.9) - 0.1 * smooth(x * 0.5, y * 0.5) },
  { id: "concrete", name: "콘크리트", f: (x, y) => 0.6 + 0.4 * fbm(x * 0.03, y * 0.03) - 0.1 * hash(x, y) },
];

import { s } from "./settings";

export const MAX_USER_TEX = 3;
const masks = new Map<string, HTMLCanvasElement>();

/** A picked image file -> centre-cropped 256 px JPEG data URL (small enough for localStorage). */
export function fileToTex(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const m = Math.min(img.width, img.height);
      c.getContext("2d")!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
    img.src = url;
  });
}

// User texture: the picture's contrast-stretched darkness becomes the pattern strength. Empty until the picture has loaded.
function userMask(id: string, onLoad?: () => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const url = s.userTex.find((t) => t.id === id)?.url;
  if (!url) return c;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0, 256, 256);
    const d = g.getImageData(0, 0, 256, 256);
    let lo = 255, hi = 0;
    const L = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) { const l = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2]; L[i] = l; if (l < lo) lo = l; if (l > hi) hi = l; }
    for (let i = 0; i < 65536; i++) { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = (1 - (L[i] - lo) / Math.max(1, hi - lo)) * 255; }
    g.putImageData(d, 0, 0);
    masks.set(id, c);
    onLoad?.();
  };
  img.src = url;
  return c;
}

// Pattern strength per pixel as white-with-alpha: 0 where the pattern is light (plain areas), up to 1 where it is dark.
function maskCanvas(id: string, onLoad?: () => void): HTMLCanvasElement {
  let c = masks.get(id);
  if (c) return c;
  if (id.startsWith("u")) return userMask(id, onLoad);
  c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  const f = (TEXTURES.find((t) => t.id === id) ?? TEXTURES[0]).f;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const m = Math.max(0, Math.min(1, (1 - f(x, y)) * 2.2));
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = m * 255;
  }
  g.putImageData(img, 0, 0);
  masks.set(id, c);
  return c;
}

/** The surface in real colours: `base` everywhere, `pattern` where the texture has structure. */
export function compose(id: string, base: string, pattern: string, onLoad?: () => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const tg = t.getContext("2d")!;
  tg.drawImage(maskCanvas(id, onLoad), 0, 0);
  tg.globalCompositeOperation = "source-in";
  tg.fillStyle = pattern;
  tg.fillRect(0, 0, 256, 256);
  g.drawImage(t, 0, 0);
  return c;
}
