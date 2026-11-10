# MusicCube

> Working directory: `E:\Claude\MusicCube`

## Project Overview

A tiny music player that floats on the Windows desktop as a borderless, transparent cube (like an icon). Dragging rotates it freely in any direction; each face is a button (play/pause, shuffle, repeat, folder, settings, hold/floating). While music plays, frequency bars and bass ripples spread out around the cube.

## Tech Stack

TypeScript, Vite, Three.js (cube + visualizer), Web Audio `AnalyserNode`, Electron (transparent frameless window). No server, no UI framework. Structure follows Paradise.

## Commands

```bash
npm run dev        # Vite on :5188 (strictPort)
npm run build      # tsc --noEmit + vite build
npm start          # run the built app in Electron
start.bat          # build + run; "start.bat dev" = Vite + Electron --dev
stop.bat           # kills :5188 and only the MusicCube Electron window
```

## Map of the code

| Path | What |
|---|---|
| `desktop/main.cjs` | Electron main: transparent frameless always-on-top window, folder dialog + scan, window move IPC |
| `desktop/preload.cjs` | exposes `window.api` |
| `src/main.ts` | scene, drag-rotate + inertia, face-click raycast, settings panel, loop |
| `src/cube.ts` | cube mesh, per-face canvas textures, look (colour/roughness/metalness/opacity) |
| `src/visualizer.ts` | frequency bars + bass ripples around the cube |
| `src/audio.ts` | playlist, shuffle/repeat, analyser |
| `src/settings.ts` | settings in localStorage |

## Controls

Left-drag rotates; click a face to press it; right-drag moves the window.

## Global requirements

- Code comments must be English.
- User-facing UI strings must be Korean.
- Ports are assigned only in `C:\Claude\PORTS.md` (this project: Vite dev 5188).
- Read `memory-bank/active-context.md` and `memory-bank/STATE.md` at session start.
