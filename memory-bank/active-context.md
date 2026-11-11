# Active Context

## Current Focus

- v0.2.0 is released (installer unsigned). Main additions: cava-style spectrum (switchable), visualizer modes bars / wave / rings / ocean, YouTube spectrum from system-audio loopback, separate settings window, window position memory, 6th face = next track, new default YouTube song.
- Verified: `npm test` 8/8, `npm run build`, packaged app launches and opens the settings window.
- Not verified by hand: real mouse feel of the relief slider and the new settings window; Cava off/on judged only on a test tone and one YouTube song.
- Open ideas: log-scale bass tuning if the user finds the bass weak; a signed installer and an app icon.
- v0.2.1 is released: the cymatics visualizer mode (two plates, 4-way symmetric, no rotation) accepted by the user. `store/` (promo images, 6 screenshots + feature graphic) is git-ignored and local only; regenerate with `scripts/store-capture.mjs` + `scripts/store-mockup.py` (backdrops in `store/gen` come from Paradise).
- Tests 13/13; packaged app smoke-checked.
