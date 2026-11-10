# Trouble Shooting

> 발생했던 버그와 해결 방법. 같은 문제를 두 번 겪지 않기 위한 기록.

<!-- 예시 형식:

## [문제 제목]

### 증상

[어떤 에러 또는 현상이 나타났나]

### 원인

[왜 발생했나]

### 해결

[어떻게 고쳤나 — 코드/명령어 포함]

-->

## Electron + Claude Code shell: ELECTRON_RUN_AS_NODE=1 (2026-11-10)
`app` is undefined when launching electron from the Claude shell; run `env -u ELECTRON_RUN_AS_NODE npx electron .`.

## Nested music source explorer in the Electron panel (2026-11-10)
The source popup and folder explorer both use `.modal` in a standalone panel where modals flow vertically. Opening the explorer without hiding the source popup stacks two panels and stretches the window. Hide the source popup while the explorer is open, then restore it when the explorer closes, including Escape and cancel.

## Paradise DEFAULT_TRACK playlist id is rejected by YouTube (error 2)
`list=PLCqwmfitbQCY` is too short; audio.ts falls back to the single video `1t39vq3LdRs`.

## Camera zoom for fixed pixel size (2026-11-10)
With a resizable window, zoom = targetPx / windowHeightPx (not the inverse), plus setViewOffset to keep the cube at a fixed pixel position.
