# MusicCube

> Working directory: `E:\Claude\MusicCube`

## Project Overview

A tiny music player that floats on the Windows desktop as a borderless, transparent 3D cube (like an icon). Dragging rotates it freely in any direction; each face is a button (play/pause, shuffle, repeat, folder = music source, settings, next track). While music plays, the sound is drawn around the cube as bars, a wave, rings, an ocean or cymatics (Chladni sand). See `README.md` for the user-facing description.

## Tech Stack

TypeScript, Vite, Three.js (cube), Canvas 2D (visualizer), Web Audio `AnalyserNode`, Electron (transparent frameless windows), electron-builder (NSIS installer). No server, no UI framework. Structure follows Paradise.

## Commands

```bash
npm run dev            # Vite on :5188 (strictPort)
npm run start:dev      # Electron against the Vite server
npm run build          # tsc --noEmit + vite build
npm start              # run the built app in Electron
npm test               # node --test test/*.test.cjs
npm run desktop:build  # build + Windows installer into release/ (unsigned)
start.bat              # build + run; "start.bat dev" = Vite + Electron --dev
stop.bat               # kills :5188 and only the MusicCube Electron windows
```

When launching Electron from the Claude shell, unset `ELECTRON_RUN_AS_NODE` first (`env -u ELECTRON_RUN_AS_NODE npx electron .`).

## Map of the code

| Path | What |
|---|---|
| `desktop/main.cjs` | Electron main: cube window (transparent, always on top, click-through), separate settings/folder window, folder browsing, `mcfile://` audio protocol (token + allow-list), loopback audio capture, window position memory (`window.json`), settings file (`settings.json`) |
| `desktop/preload.cjs` | exposes `window.api` (typed in `src/env.d.ts`) |
| `desktop/playlist.cjs` | playlist file parsing and audio extension rules |
| `src/main.ts` | scene, drag-rotate + inertia, face-click raycast, window layout, loop |
| `src/cube.ts` | rounded cube, per-face canvas textures, icon relief (bump map) |
| `src/textures.ts` | built-in procedural textures, user texture masks |
| `src/autocolor.ts` | auto contrast for pattern/icon colours |
| `src/audio.ts` | local/remote/YouTube players, 10-band EQ, system-audio loopback capture |
| `src/spectrum.ts` | cava signal processing (log bands, gravity, auto sensitivity) |
| `src/visualizer.ts` | bars / wave / rings / ocean / cymatics on a 2D canvas behind the cube |
| `src/chladni.ts` | Chladni plate formula, spectrum-to-mode mapping, sand step (pure functions, tested) |
| `src/popup.ts`, `src/panel.ts`, `panel.html` | settings and music-source window (its own Electron window) |
| `src/settings.ts` | settings object, disk + localStorage persistence, cross-window sync via storage events |
| `src/icons.ts`, `src/ui.ts` | Lucide icons, small DOM helpers |
| `test/` | player, playlist, spectrum and Chladni tests (TS is loaded by stripping types and running in `vm`; the module under test must have no imports) |
| `scripts/` | `store-capture.mjs` (needs `npm run dev`; `ONLY=<scene>` captures one scene) and `store-mockup.py` write `store/` (store images) |

## Controls

Left-drag rotates; click a face to press it; right-drag on the cube moves the window; right-drag on the settings window moves that window.

## Testing notes

- Run Electron with `--user-data-dir=<scratch dir>` for automated checks, so the real settings and window position are not touched.
- Local files reach the player only through URLs returned by the folder scan (`mcfile://` + token); hand-made URLs get 403.
- The packaged app is checked from `release/win-unpacked/MusicCube.exe`.

## Global requirements

- Code comments must be English.
- User-facing UI strings must be Korean. **Exceptions the user asked for explicitly:** the three colour-picker tooltips and the check box labels (Auto contrast, Always on top, Floating, Cava spectrum) are English. Do not translate them back.
- Ports are assigned only in `C:\Claude\PORTS.md` (this project: Vite dev 5188).
- Read `memory-bank/active-context.md` and `memory-bank/STATE.md` at session start.
- The project is also edited with Codex: check `git log` before assuming a file is unchanged.
