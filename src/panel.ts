// Entry of the settings / folder window (its own Electron window, so it moves independently of the cube).
import { hooks, openMusicSource, openSettings } from "./popup";

const api = window.api;
const kind = new URLSearchParams(location.search).get("kind");

// Closing the pop-up closes the window.
hooks.modal = (open) => { if (!open) api?.closePanel(); };
hooks.quit = () => api?.quit();

if (kind === "folder") openMusicSource();
else openSettings();

// Fit the window to the pop-up (plus the strip on top that tooltips need).
new ResizeObserver(() => api?.fitPanel(document.getElementById("hud")!.offsetHeight)).observe(document.getElementById("hud")!);
