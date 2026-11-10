import { Activity, ArrowUp, AudioLines, Brush, Check, Eye, Folder, Ghost, Maximize2, Music, Plus, Power, Target, X } from "lucide";
import type { IconNode } from "lucide";
import { h, ic } from "./ui";
import { s, save } from "./settings";
import { MAX_USER_TEX, TEXTURES, compose, fileToTex } from "./textures";
import { applyAuto } from "./autocolor";
import { Concave } from "./icons";

/** Wired up by main.ts: what the pop-ups need from the rest of the app. */
export const hooks = {
  look: () => {}, texture: () => {}, size: () => {}, sizeCommit: () => {},
  onTop: (_v: boolean) => {}, quit: () => {}, modal: (_open: boolean) => {},
};

const hud = document.getElementById("hud")!;
let depth = 0;

// Speech-bubble tooltip (CSS, from data-tip) on an icon button.
function tb(icon: IconNode, tip: string, fn: () => void, cls = ""): HTMLButtonElement {
  const b = h("button", cls, ic(icon));
  b.dataset.tip = tip;
  b.setAttribute("aria-label", tip);
  b.onclick = fn;
  return b;
}
// Tooltip on a plain icon label (the icon in front of a slider).
const label = (icon: IconNode, tip: string) => { const e = h("span", "lab", ic(icon)); e.dataset.tip = tip; return e; };

function openModal(build: (render: () => void, close: () => void) => (Node | string)[]) {
  const back = h("div", "modal");
  const close = () => { back.remove(); removeEventListener("keydown", onKey); hooks.modal(--depth > 0); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && hud.lastElementChild === back) close(); };
  back.onclick = (e) => { if (e.target === back) close(); };
  addEventListener("keydown", onKey);
  // Right-drag anywhere on the pop-up moves the window (cube and pop-up together, same as right-drag on the cube).
  let drag: { x: number; y: number } | null = null;
  back.addEventListener("contextmenu", (e) => e.preventDefault());
  back.addEventListener("pointerdown", (e) => {
    if (e.button !== 2 || !(e.target as HTMLElement).closest(".pop")) return;
    back.setPointerCapture(e.pointerId);
    drag = { x: e.screenX, y: e.screenY };
  });
  back.addEventListener("pointermove", (e) => {
    if (!drag) return;
    window.api?.moveBy(e.screenX - drag.x, e.screenY - drag.y);
    drag = { x: e.screenX, y: e.screenY };
  });
  back.addEventListener("pointerup", () => { drag = null; });
  const render = () => back.replaceChildren(h("div", "pop", ...build(render, close)));
  hud.append(back);
  hooks.modal(++depth > 0);
  render();
  return close;
}

interface FsList { path: string; parent: string; dirs: { name: string; path: string }[]; files: { name: string; path: string }[] }

/** Folder pop-up (the same explorer as Paradise): browse, then pick a folder; all its sub-folders play. */
export function openExplorer(onPick: (dir: string) => void, onDefault: () => void) {
  let data: FsList | null = null;
  let rerender = () => {};
  const go = async (p: string) => { data = (await window.api?.fsList(p)) ?? data; rerender(); };
  openModal((render, close) => {
    rerender = render;
    const cur = data;
    const head = h("div", "row");
    head.append(
      tb(ArrowUp, "위로", () => cur && void go(cur.parent), "icon"),
      h("div", "pathbar", !cur ? "…" : cur.path === "@roots" ? "컴퓨터" : cur.path),
    );
    if (cur && cur.path !== "@roots") head.append(tb(Check, "이 폴더 선택", () => { onPick(cur.path); close(); }, "icon ok"));
    head.append(tb(Music, "기본 음악 (YouTube)", () => { onDefault(); close(); }, "icon"), tb(X, "닫기", close, "icon"));
    const rows = h("div", "list");
    for (const d of cur?.dirs ?? []) {
      const r = h("div", "item click", ic(Folder), h("div", "t", h("span", "", d.name)));
      r.onclick = () => void go(d.path);
      rows.append(r);
    }
    for (const f of cur?.files ?? []) rows.append(h("div", "item dim", ic(Music), h("div", "t", h("span", "", f.name)))); // context only
    return [head, rows.children.length ? rows : h("div", "empty", "—")];
  });
  void go("");
}

function range(icon: IconNode, tip: string, min: number, max: number, step: number, v: number, set: (n: number) => number | void, commit?: () => void) {
  const r = h("input");
  r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(v);
  r.oninput = () => { const v = set(Number(r.value)); if (typeof v === "number") r.value = String(v); save(); };
  if (commit) r.onchange = commit;
  return h("div", "row", label(icon, tip), r);
}

// Tooltip wrapper for elements that cannot show ::after themselves (inputs).
const tipped = (el: HTMLElement, tip: string) => { const w = h("span", "tipwrap", el); w.dataset.tip = tip; return w; };

function check(text: string, v: boolean, set: (b: boolean) => void) {
  const l = h("label", "check");
  const i = h("input");
  i.type = "checkbox"; i.checked = v;
  i.onchange = () => set(i.checked);
  l.append(i, text);
  return l;
}

/** Settings pop-up: colours, texture grid (7 built-in + up to 3 of the user's), relief, visualizer, size/opacity, two check boxes. */
export function openSettings() {
  openModal((render, close) => {
    // Colour changes refresh everything in place (re-rendering would close an open colour picker).
    const pickers: [HTMLInputElement, "color" | "patternColor" | "iconColor"][] = [];
    const cells: [string, HTMLElement][] = [];
    const refresh = () => {
      pickers.forEach(([i, k]) => { i.value = s[k]; });
      cells.forEach(([id, c]) => { c.style.backgroundImage = `url(${compose(id, s.color, s.patternColor, refresh).toDataURL()})`; });
    };
    const changed = () => { applyAuto(); save(); hooks.texture(); refresh(); };

    const picker = (key: "color" | "patternColor" | "iconColor", tip: string) => {
      const i = h("input");
      i.type = "color"; i.value = s[key];
      i.oninput = () => {
        s[key] = i.value;
        if (key === "patternColor") s.manualPattern = true; // a hand-picked colour stays until auto contrast is switched on again
        else if (key === "iconColor") s.manualIcon = true;
        changed();
      };
      pickers.push([i, key]);
      return tipped(i, tip);
    };

    // ---- texture grid: 7 built-in + user pictures, 10 at most, 2 rows of 5 ----
    const grid = h("div", "bggrid");
    const card = (id: string, name: string) => {
      const c = h("div", "bg");
      c.dataset.tip = name;
      c.classList.toggle("on", s.texture === id);
      c.onclick = () => { s.texture = id; save(); hooks.texture(); render(); };
      cells.push([id, c]);
      grid.append(c);
      return c;
    };
    for (const t of TEXTURES) card(t.id, t.name);
    for (const u of s.userTex) {
      const c = card(u.id, "내 질감");
      c.append(tb(X, "삭제", () => {
        s.userTex = s.userTex.filter((t) => t.id !== u.id);
        if (s.texture === u.id) s.texture = "plain";
        save(); hooks.texture(); render();
      }, "del"));
      const del = c.querySelector(".del") as HTMLElement;
      del.addEventListener("click", (e) => e.stopPropagation());
    }
    if (s.userTex.length < MAX_USER_TEX) {
      const add = h("div", "bg add", ic(Plus));
      add.dataset.tip = "질감 이미지 추가";
      add.onclick = () => {
        const f = h("input");
        f.type = "file"; f.accept = "image/*";
        f.onchange = async () => {
          if (!f.files?.[0]) return;
          try {
            const id = "u" + Date.now().toString(36);
            s.userTex.push({ id, url: await fileToTex(f.files[0]) });
            s.texture = id;
            save(); hooks.texture(); render();
          } catch { /* not an image: ignore */ }
        };
        f.click();
      };
      grid.append(add);
    }

    // ---- visualizer mode ----
    const modes = h("div", "row", label(Activity, "시각화"));
    for (const [id, icon, name] of [["bars", AudioLines, "막대"], ["wave", Activity, "파형"], ["rings", Target, "고리 (SongYUE2)"]] as const) {
      const b = tb(icon, name, () => { s.viz = id; save(); render(); }, "icon");
      b.classList.toggle("on", s.viz === id);
      modes.append(b);
    }

    // relief: left = engraved, centre = flat, right = embossed
    const relief = range(Concave, "요철 (왼쪽 음각 / 가운데 평면 / 오른쪽 양각)", -1, 1, 0.01, s.relief, (n) => { s.relief = Math.abs(n) < 0.06 ? 0 : n; hooks.texture(); return s.relief; });
    const slider = relief.querySelector("input")!;
    slider.before(h("span", "pm", "−"));
    slider.after(h("span", "pm", "+"));

    const auto = check("Auto contrast", s.auto, (v) => {
      s.auto = v;
      if (v) { s.manualPattern = s.manualIcon = false; applyAuto(); }
      changed();
    });
    const top = check("Always on top", s.onTop, (v) => { s.onTop = v; save(); hooks.onTop(v); });

    queueMicrotask(refresh);
    return [
      h("div", "row", picker("color", "Background color"), picker("patternColor", "Pattern color"), picker("iconColor", "Icon color"), h("span", "grow"), tb(Power, "종료", () => hooks.quit(), "icon"), tb(X, "닫기", close, "icon")),
      grid,
      relief,
      modes,
      h("div", "pair", range(Brush, "두께", 1, 40, 0.5, s.vizWidth, (n) => { s.vizWidth = n; }), range(Ghost, "잔상", 0, 1, 0.01, s.vizTrail, (n) => { s.vizTrail = n; })),
      h("div", "pair", range(Maximize2, "크기", 0.5, 1.8, 0.05, s.size, (n) => { s.size = n; hooks.size(); }, () => hooks.sizeCommit()), range(Eye, "투명도", 0, 1, 0.01, s.opacity, (n) => { s.opacity = n; hooks.look(); })),
      h("div", "row center", auto, top),
    ];
  });
}
