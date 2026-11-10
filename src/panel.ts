// Entry of the settings / folder window (its own Electron window, so it moves independently of the cube).
import { hooks, openMusicSource, openSettings } from "./popup";

const api = window.api;
const kind = new URLSearchParams(location.search).get("kind");

// Closing the pop-up closes the window.
hooks.modal = (open) => { if (!open) api?.closePanel(); };
hooks.quit = () => api?.quit();

const hud = document.getElementById("hud")!;
let fitFrame = 0;
const fit = () => {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    const pop = hud.querySelector<HTMLElement>(".modal:not([hidden]) .pop");
    if (!pop) return;
    pop.style.maxHeight = "none";
    const height = hud.offsetHeight;
    pop.style.maxHeight = "";
    api?.fitPanel(height);
  });
};
hooks.fit = fit;

if (kind === "folder") openMusicSource();
else openSettings();

// Fit the window to the pop-up (plus the strip on top that tooltips need).
new ResizeObserver(fit).observe(hud);
