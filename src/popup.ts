import { Activity, ArrowUp, AudioLines, Brush, Check, Eye, Folder, FolderOpen, Ghost, Info, ListMusic, Maximize2, Music, Plus, Power, SlidersVertical, Target, Waves, X } from "lucide";
import type { IconNode } from "lucide";
import { h, ic } from "./ui";
import { s, save, saveSoon } from "./settings";
import { MAX_USER_TEX, TEXTURES, compose, fileToTex } from "./textures";
import { applyAuto } from "./autocolor";
import { Concave } from "./icons";
import { DEFAULT_TRACK, EQ_LABELS, EQ_PRESETS } from "./audio";

const CUSTOM_EQ = "Custom";
const EQ_PRESET_NAMES: Record<string, string> = {
  Flat: "균형", "Bass Boost": "저음 강조", "Vocal Boost": "보컬 강조",
  "Treble Boost": "고음 강조", Loudness: "음량 보정", Acoustic: "어쿠스틱",
};
const eqMatch = () => Object.entries(EQ_PRESETS).find(([, v]) => v.every((x, i) => x === s.eq[i]))?.[0] ?? CUSTOM_EQ;

/** Wired up by main.ts: what the pop-ups need from the rest of the app. */
export const hooks = {
  look: () => {}, texture: () => {}, size: () => {}, sizeCommit: () => {},
  onTop: (_v: boolean) => {}, quit: () => {}, modal: (_open: boolean) => {}, fit: () => {},
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

function openModal(build: (render: () => void, close: () => void) => (Node | string)[], onClose?: () => void) {
  const back = h("div", "modal");
  const close = () => { back.remove(); removeEventListener("keydown", onKey); onClose?.(); hooks.modal(--depth > 0); if (depth) hooks.fit(); };
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
  const render = () => { back.replaceChildren(h("div", "pop", ...build(render, close))); hooks.fit(); };
  hud.append(back);
  hooks.modal(++depth > 0);
  render();
  return close;
}

interface FsList { path: string; parent: string; dirs: { name: string; path: string }[]; files: { name: string; path: string; kind: "audio" | "list" }[] }

/** Browse folders or playlist files. */
function openExplorer(kind: "folder" | "list", onPick: (path: string) => void) {
  let data: FsList | null = null;
  let rerender = () => {};
  const go = async (p: string) => { data = (await window.api?.fsList(p)) ?? (p ? await window.api?.fsList("") : data) ?? data; rerender(); };
  const source = hud.lastElementChild as HTMLElement;
  source.hidden = true;
  openModal((render, close) => {
    rerender = render;
    const cur = data;
    const head = h("div", "row");
    head.append(
      tb(ArrowUp, "위로", () => cur && void go(cur.parent), "icon"),
      h("div", "pathbar", !cur ? "…" : cur.path === "@roots" ? "컴퓨터" : cur.path),
    );
    if (kind === "folder" && cur && cur.path !== "@roots") head.append(tb(Check, "이 폴더 선택", () => { onPick(cur.path); close(); }, "icon ok"));
    head.append(tb(X, "닫기", close, "icon"));
    const rows = h("div", "list");
    for (const d of cur?.dirs ?? []) {
      const r = h("div", "item click", ic(Folder), h("div", "t", h("span", "", d.name)));
      r.onclick = () => void go(d.path);
      r.tabIndex = 0;
      r.setAttribute("role", "button");
      r.setAttribute("aria-label", d.name);
      r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.click(); } };
      rows.append(r);
    }
    for (const f of cur?.files ?? []) {
      if (kind === "list" && f.kind === "list") {
        const r = h("div", "item click", ic(ListMusic), h("div", "t", h("span", "", f.name)));
        r.onclick = () => { onPick(f.path); close(); };
        r.tabIndex = 0;
        r.setAttribute("role", "button");
        r.setAttribute("aria-label", f.name);
        r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.click(); } };
        rows.append(r);
      } else if (kind === "folder" && f.kind === "audio") rows.append(h("div", "item dim", ic(Music), h("div", "t", h("span", "", f.name))));
    }
    return [head, rows.children.length ? rows : h("div", "empty", "—")];
  }, () => { source.hidden = false; });
  void go(kind === "folder" ? s.folder : "");
}

export function openMusicSource() {
  openModal((_render, close) => {
    const src = h("input", "source-input");
    src.type = "text";
    src.placeholder = "https:// URL input";
    src.setAttribute("aria-label", "음악 URL 입력");
    src.spellcheck = false;
    const shown = () => s.folder || s.playlistFile || s.urls.join(" ");
    src.value = shown();
    const error = h("div", "source-error");
    const setUrls = () => {
      if (src.value === shown()) return;
      const parts = src.value.split(/[\s,;]+/).filter(Boolean);
      if (parts.some((v) => { try { return !["http:", "https:"].includes(new URL(v).protocol); } catch { return true; } })) {
        error.textContent = "http 또는 https 주소를 입력해 주세요.";
        return;
      }
      s.urls = parts;
      s.folder = s.playlistFile = "";
      save();
      error.textContent = "";
    };
    src.onchange = setUrls;
    src.onkeydown = (e) => { if (e.key === "Enter") src.blur(); };
    src.onfocus = () => { if (s.folder || s.playlistFile) src.select(); };
    const pick = (kind: "folder" | "list") => openExplorer(kind, (path) => {
      s.folder = kind === "folder" ? path : "";
      s.playlistFile = kind === "list" ? path : "";
      s.urls = [];
      save();
      src.value = shown();
      error.textContent = "";
    });
    const button = (name: string, icon: IconNode, kind: "folder" | "list") => {
      const b = h("button", "srcbtn", name, ic(icon));
      b.onclick = () => pick(kind);
      return b;
    };
    const defaultSong = h("button", "default-song", "Default Song");
    defaultSong.onclick = () => {
      s.folder = s.playlistFile = "";
      s.urls = [DEFAULT_TRACK];
      s.sourceRevision++;
      save();
      close();
    };
    return [
      h("div", "row source-head", h("div", "poptitle", "Music Selection"), h("span", "grow"), defaultSong, tb(X, "닫기", close, "icon")),
      src, error,
      h("div", "srcbtns", button("Folder", FolderOpen, "folder"), button("Playlist", ListMusic, "list")),
    ];
  });
}

function range(icon: IconNode, tip: string, min: number, max: number, step: number, v: number, set: (n: number) => number | void, commit?: () => void) {
  const r = h("input");
  r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(v);
  r.setAttribute("aria-label", tip);
  r.oninput = () => { const v = set(Number(r.value)); if (typeof v === "number") r.value = String(v); saveSoon(); };
  r.onchange = () => { save(); commit?.(); };
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
  let pendingColors: (() => void)[] = [];
  let eqNoteEl: HTMLElement | null = null;
  let eqOn = window.api?.eqAvailable() ?? false;
  window.api?.onEqState((available) => { eqOn = available; if (eqNoteEl) eqNoteEl.hidden = available; });
  const flushColors = () => pendingColors.forEach((commit) => commit());
  addEventListener("beforeunload", flushColors);
  openModal((render, close) => {
    flushColors();
    pendingColors = [];
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
      i.setAttribute("aria-label", tip);
      let pending = 0, applied = "";
      const commit = () => {
        clearTimeout(pending);
        pending = 0;
        if (applied === i.value) return;
        applied = i.value;
        s[key] = i.value;
        if (key === "patternColor") s.manualPattern = true; // a hand-picked colour stays until auto contrast is switched on again
        else if (key === "iconColor") s.manualIcon = true;
        changed();
      };
      // The native chooser does not expose pointerup; commit after its input events settle.
      i.oninput = () => { clearTimeout(pending); pending = window.setTimeout(commit, 100); };
      i.onchange = commit;
      pendingColors.push(() => { if (pending) commit(); });
      pickers.push([i, key]);
      return tipped(i, tip);
    };

    // ---- texture grid: 7 built-in + user pictures, 10 at most, 2 rows of 5 ----
    const grid = h("div", "bggrid");
    const card = (id: string, name: string) => {
      const c = h("div", "bg");
      c.dataset.tip = name;
      c.tabIndex = 0;
      c.setAttribute("role", "button");
      c.setAttribute("aria-label", name);
      c.classList.toggle("on", s.texture === id);
      c.onclick = () => { s.texture = id; save(); hooks.texture(); render(); };
      c.onkeydown = (e) => { if (e.target === c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); c.click(); } };
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
      add.tabIndex = 0;
      add.setAttribute("role", "button");
      add.setAttribute("aria-label", "질감 이미지 추가");
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
      add.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add.click(); } };
      grid.append(add);
    }

    // ---- visualizer mode ----
    const modes = h("div", "row", label(Activity, "시각화"));
    for (const [id, icon, name] of [["bars", AudioLines, "막대"], ["wave", Activity, "파형"], ["rings", Target, "고리 (SongYUE2)"], ["ocean", Waves, "파도"]] as const) {
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
    const floating = check("Floating", s.floating, (v) => { s.floating = v; save(); });
    const cava = check("Cava spectrum", s.cava, (v) => { s.cava = v; save(); });

    // 10-band equalizer, matching Paradise's bands, presets and scale.
    const eqSel = h("select");
    eqSel.setAttribute("aria-label", "이퀄라이저 프리셋");
    const eqBars: HTMLInputElement[] = [];
    const eqNames = () => eqSel.replaceChildren(
      ...(eqMatch() === CUSTOM_EQ ? [new Option("직접 설정", CUSTOM_EQ)] : []),
      ...Object.keys(EQ_PRESETS).map((name) => new Option(EQ_PRESET_NAMES[name] ?? name, name)),
    );
    const eqRefresh = () => { eqNames(); eqSel.value = eqMatch(); };
    const eqCommit = (saveNow: boolean) => {
      s.eqPreset = eqMatch();
      window.api?.eqSet(s.eq, true);
      if (saveNow) save(); else saveSoon();
      eqRefresh();
    };
    eqSel.onchange = () => {
      const preset = EQ_PRESETS[eqSel.value];
      if (!preset) return;
      s.eq = [...preset];
      eqCommit(true);
      eqBars.forEach((bar, i) => { bar.value = String(s.eq[i]); });
    };
    const eqRow = h("div", "eq");
    EQ_LABELS.forEach((name, i) => {
      const bar = h("input");
      bar.type = "range"; bar.min = "-100"; bar.max = "100"; bar.step = "1";
      bar.value = String(s.eq[i]);
      bar.setAttribute("aria-label", name + " Hz");
      bar.oninput = () => { s.eq[i] = Number(bar.value); eqCommit(false); };
      bar.onchange = () => save();
      eqBars.push(bar);
      eqRow.append(h("div", "eqbar", h("div", "vslide", bar), h("small", "", name)));
    });
    eqRefresh();
    const eqNote = h("div", "note", ic(Info), "유튜브나 웹 주소로 재생하는 음악에는 적용되지 않습니다");
    eqNote.hidden = eqOn;
    eqNoteEl = eqNote;

    queueMicrotask(refresh);
    return [
      h("div", "row", picker("color", "배경색"), picker("patternColor", "무늬색"), picker("iconColor", "아이콘색"), h("span", "grow"), tb(Power, "종료", () => hooks.quit(), "icon"), tb(X, "닫기", close, "icon")),
      grid,
      relief,
      modes,
      h("div", "pair", range(Brush, "두께", 1, 40, 0.5, s.vizWidth, (n) => { s.vizWidth = n; }), range(Ghost, "잔상", 0, 1.5, 0.01, s.vizTrail, (n) => { s.vizTrail = n; })),
      h("div", "pair", range(Maximize2, "크기", 0.5, 1.8, 0.05, s.size, (n) => { s.size = n; hooks.size(); }, () => hooks.sizeCommit()), range(Eye, "투명도", 0, 1, 0.01, s.opacity, (n) => { s.opacity = n; hooks.look(); })),
      h("div", "row center", auto, top, floating, cava),
      h("div", "row", ic(SlidersVertical), eqSel),
      eqRow,
      eqNote,
    ];
  }, () => { flushColors(); removeEventListener("beforeunload", flushColors); eqNoteEl = null; save(); });
}
