export interface Settings {
  /** Cube base colour (picked with the colour picker). */
  color: string;
  patternColor: string; iconColor: string;
  /** Auto contrast: pattern and icon colours follow the background unless set by hand. */
  auto: boolean; manualPattern: boolean; manualIcon: boolean;
  /** Up to 3 user textures: pictures whose dark parts become the pattern. */
  userTex: { id: string; url: string }[];
  texture: string;
  /** Icon relief: -1 engraved .. 0 flat .. +1 embossed. */
  relief: number;
  /** Visualizer: mode, line/bar thickness (px at size 1) and afterimage 0..1.5. */
  viz: "bars" | "wave" | "rings"; vizWidth: number; vizTrail: number;
  size: number; opacity: number;
  onTop: boolean; floating: boolean; shuffle: boolean; repeat: "off" | "all" | "one"; folder: string;
  playlistFile: string; urls: string[]; sourceRevision: number;
}

const KEY = "musiccube.settings";
const DEFAULTS: Settings = {
  color: "#8f7cff", patternColor: "#4b3fb0", iconColor: "#241d52",
  auto: true, manualPattern: false, manualIcon: false, userTex: [],
  texture: "plain", relief: 0.5, viz: "bars", vizWidth: 3, vizTrail: 0.4, size: 1, opacity: 1,
  onTop: true, floating: true, shuffle: false, repeat: "all", folder: "", playlistFile: "", urls: [], sourceRevision: 0,
};

function load(): Settings {
  let disk: string | null = null, local: string | null = null;
  try { disk = window.api?.settingsLoad() ?? null; } catch { /* browser-only mode */ }
  try { local = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  for (const raw of [disk, local]) {
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      if (raw === local && window.api) window.api.settingsSave(raw); // migrate settings saved before the shared file existed
      return { ...DEFAULTS, ...value };
    } catch { /* try the other store */ }
  }
  return { ...DEFAULTS };
}

/** The one live settings object, shared by every module. */
export const s = load();

let saveTimer = 0;
export function save(): void {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const data = JSON.stringify(s);
  try { localStorage.setItem(KEY, data); } catch { /* the app file can still keep the settings */ }
  if (window.api && !window.api.settingsSave(data)) console.warn("Settings file save failed");
}

export function saveSoon(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 150);
}

export function flushSave(): void {
  if (saveTimer) save();
}

window.addEventListener("beforeunload", flushSave);

// Settings are shared by the cube window and the settings/folder window through localStorage:
// a change saved in one window arrives here as a storage event.
const listeners: (() => void)[] = [];
export const onExternalChange = (f: () => void) => { listeners.push(f); };
window.addEventListener("storage", (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try { Object.assign(s, JSON.parse(e.newValue)); } catch { return; }
  listeners.forEach((f) => f());
});
