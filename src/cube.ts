import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { IconNode } from "lucide";
import { ic } from "./ui";
import { compose } from "./textures";
import { s } from "./settings";

export type Action = "play" | "shuffle" | "repeat" | "folder" | "settings" | "hold";

// BoxGeometry material order: +x, -x, +y, -y, +z, -z
export const FACES: Action[] = ["play", "shuffle", "repeat", "folder", "settings", "hold"];

const iconCache = new Map<IconNode, Promise<HTMLImageElement>>();
// Lucide icon (the set Paradise uses) -> image, so it can be drawn onto a face texture.
function iconImage(node: IconNode): Promise<HTMLImageElement> {
  let p = iconCache.get(node);
  if (!p) {
    const svg = ic(node);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", "256");
    svg.setAttribute("height", "256");
    svg.setAttribute("stroke", "#14141f");
    svg.setAttribute("stroke-width", "1.8");
    p = new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    });
    iconCache.set(node, p);
  }
  return p;
}

// Icon silhouette (alpha of the icon image) filled by `fill`.
function silhouette(img: HTMLImageElement, fill: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.drawImage(img, 60, 60, 136, 136);
  g.globalCompositeOperation = "source-in";
  fill(g);
  return c;
}

/** Face picture (surface + icon with relief) and its bump map. `relief`: -1 engraved .. 0 flat .. +1 embossed. Light comes from the top-left. */
async function renderFace(node: IconNode | null, on: boolean, relief: number, surface: HTMLCanvasElement) {
  const img = node ? await iconImage(node) : null;
  const face = document.createElement("canvas");
  face.width = face.height = 256;
  const g = face.getContext("2d")!;
  g.drawImage(surface, 0, 0);
  const bump = document.createElement("canvas");
  bump.width = bump.height = 256;
  const b = bump.getContext("2d")!;
  b.fillStyle = "#000";
  b.fillRect(0, 0, 256, 256);
  if (img) {
    const fill = (color: string) => silhouette(img, (c) => { c.fillStyle = color; c.fillRect(0, 0, 256, 256); });
    const body = fill(s.iconColor);
    const dim = on ? 1 : 0.4;
    const k = Math.abs(relief);
    g.globalAlpha = dim;
    if (k >= 0.03) {
      // edge offset and shading grow with |relief|; the sign decides raised or sunk
      const o = Math.sign(relief) * 7 * k;
      g.globalAlpha = Math.min(1, dim * 0.9 * k); g.drawImage(fill("#000"), o, o);
      g.globalAlpha = Math.min(1, dim * k); g.drawImage(fill("#fff"), -o * 0.7, -o * 0.7);
      b.filter = "blur(2px)";
      b.drawImage(fill("#fff"), 0, 0);
      b.filter = "none";
    }
    g.globalAlpha = dim;
    g.drawImage(body, 0, 0);
    g.globalAlpha = 1;
  }
  return { face, bump };
}

export function createCube() {
  const faces = FACES.map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const bump = document.createElement("canvas");
    bump.width = bump.height = 256;
    const bumpMap = new THREE.CanvasTexture(bump);
    return { canvas, map, bump, bumpMap, mat: new THREE.MeshStandardMaterial({ map, bumpMap, roughness: 0.35, metalness: 0.4 }), icon: null as IconNode | null, on: true, seq: 0 };
  });
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 5, 0.14), faces.map((f) => f.mat));

  async function paint(f: (typeof faces)[number]) {
    const seq = ++f.seq;
    const r = await renderFace(f.icon, f.on, s.relief, compose(s.texture, s.color, s.patternColor, () => applyTexture()));
    if (seq !== f.seq) return; // a newer paint superseded this one
    f.canvas.getContext("2d")!.drawImage(r.face, 0, 0);
    f.bump.getContext("2d")!.drawImage(r.bump, 0, 0);
    f.map.needsUpdate = true;
    f.bumpMap.needsUpdate = true;
  }

  function setIcon(action: Action, icon: IconNode, on = true) {
    const f = faces[FACES.indexOf(action)];
    f.icon = icon;
    f.on = on;
    void paint(f);
  }

  // Opacity slider 0..1 maps to 0.15..1 so the cube never disappears completely.
  function applyLook() {
    const o = 0.15 + 0.85 * s.opacity;
    for (const f of faces) {
      f.mat.color.set("#ffffff"); // colours are painted into the face texture
      f.mat.opacity = o;
      if (f.mat.transparent !== o < 1) { f.mat.transparent = o < 1; f.mat.needsUpdate = true; } // the shader's OPAQUE define depends on it
    }
  }

  // Repaint after the background, texture, colours, relief changed.
  function applyTexture() {
    for (const f of faces) { f.mat.bumpScale = 5 * s.relief; void paint(f); }
  }

  return { mesh, setIcon, applyLook, applyTexture };
}
