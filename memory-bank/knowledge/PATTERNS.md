# Patterns

> 검증된 코드 패턴. 복붙 바로 가능한 형태로 유지.

<!-- 예시 형식:

## [패턴 이름]

**사용 시점:** [언제 이 패턴을 써야 하나]

```language
// 코드
```

-->

## Persist settings from continuously moving controls (2026-11-11)
For a slider, apply the visual change on input, debounce disk writes briefly, then save on change and beforeunload. Also flush when the containing panel closes, since its browser process may exit before a pending timer fires.

## Equalizer controls in a separate settings window (2026-11-11)
Keep the 10-band constants, presets and filter graph in the player module. The settings window sends gains through preload → main → cube window IPC for immediate audio updates, while the cube also reapplies persisted settings on storage events. The cube publishes `eqAvailable` back to the settings window so the "not for YouTube/remote audio" note stays accurate.

## cava-style spectrum on the Web Audio analyser (2026-11-11)
`src/spectrum.ts` ports cavacore: `fftSize` 4096 with `smoothingTimeConstant` 0, `getFloatFrequencyData`, dB to amplitude, 33 bars log-spaced between 50 Hz and 10 kHz (bars never share bins; clumped bass bars are pushed up one bin at a time), band mean times `f^0.85`, then gravity fall-off, integral smoothing (`mem * noise + out`) and auto sensitivity (x0.98 on overshoot, +0.1 % per frame otherwise, fast at start). Frame-rate factors come from the measured frame time. Silence must be fed as `-Infinity` dB, not a -100 dB floor, or auto sensitivity keeps amplifying noise. The ring mirrors the spectrum left/right (`min(i, N - i)`) so the loop closes without a seam. A setting can switch back to the plain method by changing `fftSize`/`smoothingTimeConstant` on the same analyser.

## Analyse YouTube audio with Electron loopback capture (2026-11-11)
The YouTube IFrame's sound cannot be routed into Web Audio. In the main process: `session.defaultSession.setDisplayMediaRequestHandler(async (_r, cb) => cb({ video: (await desktopCapturer.getSources({ types: ["screen"] }))[0], audio: "loopback" }))`. In the page, from a user gesture: `getDisplayMedia({ video: true, audio: true })`, stop the video tracks, feed the audio track through `createMediaStreamSource` into an analyser and do not connect it to the destination (it would echo). It captures all system audio, so only draw while the player reports playing. Fall back to a fake beat if capture fails.

## Settings window as a second Electron window (2026-11-11)
The settings and music-source pop-up run in their own frameless window (`panel.html`, opened by an IPC `open-panel` with an anchor relative to the cube window; the same face again closes it). Both windows keep the same settings object: every `save()` writes localStorage and the settings file, and the other window follows through the `storage` event (`onExternalChange`). The panel sizes itself with a `ResizeObserver` on its content and an IPC `fit-panel`; `move-by` moves the window that sent the message, so right-drag works in both windows.

## Remember a window position by its anchor (2026-11-11)
Save the cube centre (not the window's top-left) because the window size follows the size setting. Debounce `move` by 400 ms, also save on `close`, write via temp file + rename, and ignore a saved point that is not inside any display's work area. When resizing, clamp only the centre to the screen; clamping the whole transparent window pushes a cube at the screen edge inwards on every start.

## Visualizer on its own transparent 2D canvas (2026-11-11)
Drawing around the 3D cube on a separate `<canvas>` behind it gives cheap afterimages: each frame fill the canvas with `destination-out` at `1 - trail * 0.975` before drawing. Keep the retention at or below about 97.5 %; with 8-bit alpha, slower fades leave a faint residue that never disappears. Keep the window larger than the cube (560 px at size 1) so thick lines and the outer rings are not clipped.
