import { createElement } from "lucide";
import type { IconNode } from "lucide";

export const ic = (i: IconNode) => createElement(i) as SVGElement;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...kids);
  return e;
}

// Icon-only button; the label is for screen readers and long-press tooltips only.
export function btn(icon: IconNode, label: string, fn: () => void, cls = ""): HTMLButtonElement {
  const b = h("button", cls, ic(icon));
  b.setAttribute("aria-label", label);
  b.title = label;
  b.onclick = fn;
  return b;
}
