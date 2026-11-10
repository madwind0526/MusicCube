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
