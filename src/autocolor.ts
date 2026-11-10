import { s } from "./settings";

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const rgb = (c: string) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = (c: string) => { const [r, g, b] = rgb(c); return 0.299 * r + 0.587 * g + 0.114 * b; };
const mix = (c: string, to: number, t: number) => "#" + rgb(c).map((v) => hex(v + (to - v) * t)).join("");

/** Auto contrast: pattern = a shade of the background pulled away from it, icon = dark or light, whichever reads. */
export function applyAuto() {
  if (!s.auto) return;
  const light = lum(s.color) > 130;
  if (!s.manualPattern) s.patternColor = light ? mix(s.color, 0, 0.45) : mix(s.color, 255, 0.5);
  if (!s.manualIcon) s.iconColor = light ? "#14141f" : "#f4f4fa";
}
