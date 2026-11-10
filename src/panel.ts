// Entry of the settings / folder window (its own Electron window, so it moves independently of the cube).
import { hooks, openExplorer, openSettings } from "./popup";
import { s, save } from "./settings";

const api = window.api;
const kind = new URLSearchParams(location.search).get("kind");

// Closing the pop-up closes the window.
hooks.modal = (open) => { if (!open) api?.closePanel(); };
hooks.quit = () => api?.quit();

if (kind === "folder") {
  openExplorer(
    async (dir) => { const files = (await api?.scan(dir)) ?? []; s.folder = files.length ? dir : ""; save(); },
    () => { s.folder = ""; save(); }, // back to the default YouTube music
  );
} else openSettings();

// Fit the window to the pop-up (plus the strip on top that tooltips need).
new ResizeObserver(() => api?.fitPanel(document.getElementById("hud")!.offsetHeight)).observe(document.getElementById("hud")!);
