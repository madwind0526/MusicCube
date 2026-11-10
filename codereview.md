# MusicCube 코드 리뷰

- 리뷰 일자: 2026-11-10
- 리뷰 범위: `src/*.ts`, `desktop/*.cjs`, `test/*.cjs`, `index.html`, `panel.html`, `src/style.css`, `package.json`, `tsconfig.json`, `vite.config.ts`, `start.bat`, `stop.bat`
- 리뷰 방식: 소스 정적 분석 + 빌드/테스트 실행. 소스는 수정하지 않았습니다.
- 검증 결과
  - `npm run build` 통과 (`tsc --noEmit` + `vite build`)
  - `node --test test/playlist.test.cjs` 통과 (1/1)
  - 빌드 경고: `main` 청크가 549.78 kB로 500 kB 경고 기준을 넘음 (three.js 포함, Electron 앱이라 치명적이진 않음)

---

## 한눈에 보는 요약

| 심각도 | 개수 | 대표 내용 |
|---|---:|---|
| High (꼭 수정) | 2 | 설정 창 참조 꼬임, YouTube 플레이어 중복 생성 |
| Medium (수정 권장) | 11 | 영어 UI 문구, 과도한 텍스처 재생성, 저장 빈도, 보안 범위, 접근성 등 |
| Low (틈날 때) | 20 | 캐시/에러 처리, 죽은 코드, 사소한 성능/설정 등 |

### 먼저 고칠 Top 5

1. **H-1** 설정/폴더 창 전환 시 `panel` 참조가 사라져 창이 중복으로 열릴 수 있음
2. **H-2** 첫 재생 시 재생 버튼을 빠르게 두 번 누르면 YouTube 플레이어가 2개 생겨 소리가 겹침
3. **M-3** 재생/일시정지 때마다 6개 면 전체 텍스처를 다시 그림 (체감 렉 가능)
4. **M-5** 슬라이더를 움직일 때마다 사용자 질감 이미지까지 포함해 localStorage에 전체 저장
5. **M-1** 사용자에게 보이는 일부 문구가 영어라 프로젝트 규칙(G-02, UI는 한국어) 위반

---

## High — 꼭 수정

### H-1. 설정/폴더 창을 바꿀 때 `panel` 참조가 꼬임

**위치:** `desktop/main.cjs:76-93`

**증상**

- 설정 창이 열린 상태에서 폴더 버튼을 누르면 새 폴더 창은 뜨지만, 잠시 뒤 내부 `panel` 변수가 `null`이 됩니다.
- 그 상태에서 폴더 버튼을 다시 누르면 창이 하나 더 열리고, 먼저 열린 창은 앱이 추적하지 못하는 "고아 창"이 됩니다.
- 같은 버튼으로 닫기(토글)도 동작하지 않을 수 있습니다.

**원인**

```js
// desktop/main.cjs (현재)
if (panel && !panel.isDestroyed()) { const same = panelKind === kind; panel.close(); if (same) return; }
// ...
panel = new BrowserWindow({ ... });
panel.on("closed", () => { panel = null; });
```

`panel.close()`는 비동기로 닫힙니다. 곧바로 새 창을 만들어 `panel`에 넣어도, **예전 창의 `closed` 콜백이 나중에 실행되면서 새 `panel` 값을 `null`로 덮어씁니다.**

**해결**

자신이 만든 창일 때만 `null`로 만들면 됩니다.

```js
const created = new BrowserWindow({
  width: W, height: H, x, y, /* ... */
  webPreferences: { preload: path.join(__dirname, "preload.cjs") },
});
panel = created;
created.on("closed", () => {
  if (panel === created) panel = null;
});
```

추가로, 다른 종류의 창을 열 때는 예전 창의 `closed` 이벤트에서 새 창을 만드는 방식이 더 안전합니다.

---

### H-2. YouTube 플레이어 중복 생성 (소리 겹침)

**위치:** `src/audio.ts:86-127`, `src/audio.ts:173-180`

**증상**

- 앱을 처음 켜고 YouTube API가 아직 로드되지 않은 상태에서 재생 버튼을 빠르게 두 번 누르면 플레이어가 2개 생성됩니다.
- 두 플레이어가 동시에 소리를 내고, 먼저 만든 iframe host는 정리되지 않습니다.

**원인**

`startYt()`는 `await loadYtApi()`가 끝난 뒤에야 전역 `yt`를 대입합니다. 그 전에 두 번째 `toggle()`이 들어오면 `if (!yt)`가 여전히 참이라 `startYt()`를 다시 호출합니다.

```ts
async function startYt() {
  try {
    const YT = await loadYtApi(); // 여기서 양보
    // ...
    yt = new YT.Player(inner, { ... }); // 이 시점에야 yt가 채워짐
  } catch (e) { ... }
}
```

**해결**

시작 중 플래그 또는 진행 중인 Promise를 공유합니다.

```ts
let ytStarting = false;

async function startYt() {
  if (ytStarting) return;
  ytStarting = true;
  try {
    const YT = await loadYtApi();
    // ... existing player setup ...
  } catch (e) {
    console.warn("YouTube player failed", e);
  } finally {
    ytStarting = false;
  }
}
```

`destroyYt()`는 기존처럼 `yt`/`ytHost`만 정리하면 됩니다. `wantPlay` 로직은 그대로 두어도 됩니다.

---

## Medium — 수정 권장

| ID | 위치 | 문제 | 제안 |
|---|---|---|---|
| M-1 | `src/popup.ts:98,132,141,143,256,261` | 사용자에게 보이는 문구가 영어: `URL input`, `Default Song`, `Music Selection`, `Folder`, `Playlist`, `Auto contrast`, `Always on top` | 프로젝트 규칙 G-02에 맞게 `https:// 주소 입력`, `기본 곡`, `음악 선택`, `폴더`, `재생목록`, `자동 대비`, `항상 위` 등으로 변경. 색상 툴팁(`Background color` 등)도 한국어로 |
| M-2 | `src/icons.ts:5` | 코드 주석에 한국어가 있음 (`凹 ("오목 요")`) → G-01 위반 | `/** The relief icon: a block with a notch cut from the top. */` 처럼 영어로 |
| M-3 | `src/main.ts:39-46`, `src/cube.ts:103-108` | `refreshIcons()`가 재생/일시정지 등 상태 변화마다 6개 면 전부를 다시 그림. `setIcon()`은 아이콘이 같아도 무조건 `paint()` 호출 | `setIcon`에서 변경 여부를 비교해 조기 반환. `paint()`는 아이콘/상태가 실제로 바뀐 면만 실행 |
| M-4 | `src/main.ts:85-92` | 설정이 하나만 바뀌어도 `applyLook()` + `applyTexture()`로 6개 면 전체를 다시 그림 (예: `onTop`만 바꿔도) | `seen`과 비교해 `opacity`, `texture`, 색상, `relief`, `userTex`가 바뀐 경우에만 해당 작업 실행 |
| M-5 | `src/popup.ts:148-154,269-270` | 슬라이더 `oninput`마다 `save()` 호출. 설정에는 사용자 질감 data URL(수십 KB)도 포함되어 매번 JSON 직렬화 + 동기 localStorage 쓰기 발생 | `saveSoon()` 같은 150ms 디바운스 저장을 쓰고, `onchange`에서 즉시 저장. 또는 `userTex`를 별도 키로 분리 |
| M-6 | `src/main.ts:110-140` | `pointercancel`/캡처 상실 시 `down`이 남아 드래그 상태가 고착될 수 있음 | `pointercancel`과 `lostpointercapture`에서 `down = null` 처리 |
| M-7 | `desktop/main.cjs:129-134` | `mcfile://` 핸들러가 **경로에 오디오 확장자만 있으면 어떤 파일이든** `Access-Control-Allow-Origin: *`로 제공. 페이지에 외부 YouTube iframe도 있음 | 선택한 폴더 하위 파일만 허용하거나, 세션별 랜덤 토큰을 URL에 넣어 경로 추측을 막기. 최소한 허용 루트 목록 검사 |
| M-8 | `desktop/main.cjs:120-123` | `setDisplayMediaRequestHandler`가 세션 전체에서 화면 + 시스템 오디오(loopback)를 자동 승인 | 요청이 메인 창의 프레임인지 확인한 뒤 승인. 필요할 때만 활성화 |
| M-9 | `src/audio.ts:158-171`, `src/main.ts:79-83` | 빈 폴더/빈 URL을 선택하면 `setList([])` → 기본 YouTube로 폴백되고 `applySource(true)`가 자동 재생까지 함 | "소스 미선택"과 "선택했지만 비어 있음"을 구분. 빈 폴더는 조용히 대기하거나 안내 |
| M-10 | `package.json:9-14`, `test/` | 테스트 스크립트가 없고 플레이리스트 테스트 1개뿐 | `"test": "node --test test"` 추가. `readPlaylist`(m3u/누락 파일/BOM), `parseYouTube`/`isYouTube`, `applyAuto`, `settings` 병합 테스트 추가 |
| M-11 | `src/style.css:10,53-58`, `src/popup.ts` | `button { all: unset }`으로 포커스 표시가 사라짐. range/color input에 `aria-label` 없음. 툴팁은 hover 전용 | `:focus-visible` 스타일 추가, range/color에 `aria-label` 부여, 키보드 접근성 확인 |

### M-3 보충 예시

```ts
function setIcon(action: Action, icon: IconNode, on = true) {
  const f = faces[FACES.indexOf(action)];
  if (f.icon === icon && f.on === on) return; // skip unchanged faces
  f.icon = icon;
  f.on = on;
  void paint(f);
}
```

### M-6 보충 예시

```ts
canvas.addEventListener("pointercancel", () => { down = null; });
canvas.addEventListener("lostpointercapture", () => { down = null; });
```

---

## Low — 틈날 때 개선

| ID | 위치 | 내용 | 제안 |
|---|---|---|---|
| L-1 | `src/cube.ts:24-28` | `iconImage()`에 `img.onerror`가 없어 SVG 로드 실패 시 Promise가 영원히 대기하고 면이 비어 보일 수 있음 | `onerror`에서 reject 또는 기본 아이콘 사용 |
| L-2 | `src/textures.ts:29,50-91` | `masks` 캐시가 사용자 질감 삭제 후에도 남음. 로드 전에는 호출마다 새 canvas/Image 생성 | 삭제 시 `masks.delete(id)`, 로드 중 Promise 캐시 |
| L-3 | `src/settings.ts:27-29` | localStorage 값을 검증/마이그레이션 없이 병합. 손상된 값이 들어오면 UI가 깨질 수 있음 | 키/타입별 검증 함수 또는 버전 필드 추가 |
| L-4 | `src/main.ts:101-105,148` | `hitAt()`/프레임 루프에서 `Vector2`, `Quaternion`, `Vector3`를 매번 생성 | 재사용 객체로 교체 |
| L-5 | `src/main.ts:17`, `src/visualizer.ts:16-22` | 모니터 이동/DPI 변경 시 `devicePixelRatio`가 갱신되지 않음 | `matchMedia("(resolution: ...)")` 또는 resize 시 pixelRatio 재설정 |
| L-6 | `desktop/main.cjs:17` | `requestSingleInstanceLock()` 실패 시 `app.quit()`만 호출하고 이후 등록이 계속됨 | `else` 블록으로 감싸거나 조기 반환 |
| L-7 | `desktop/main.cjs:129-134` | `net.fetch` 실패(파일 삭제 등) 시 핸들러 예외가 그대로 발생 | `try/catch`로 404 응답 반환 |
| L-8 | `desktop/main.cjs:73,95-101` | `BrowserWindow.fromWebContents()`가 `null`일 수 있는데 바로 `getBounds()` 호출 | null 가드 추가 |
| L-9 | `desktop/main.cjs:86-88` | 패널 창은 항상 `alwaysOnTop: true`라 큐브의 "항상 위"를 꺼도 패널은 위에 남음 | `s.onTop` 변경 시 패널에도 반영하거나 정책 문서화 |
| L-10 | `src/popup.ts:91` | 플레이리스트 선택 탐색기는 항상 홈에서 시작 | 현재 플레이리스트의 폴더에서 시작 |
| L-11 | `src/style.css:14,47-51,64-66,78-80`, `src/ui.ts:14` | 사용되지 않는 CSS(`--cube-h`, `.texrow`, `.tex`, `.chip`, `.stylebtn`)와 `btn()` export | 삭제 |
| L-12 | `src/textures.ts:26`, `src/icons.ts:4` | 파일 중간에 `import`가 있음 | 파일 상단으로 이동 |
| L-13 | `src/popup.ts:57`, `src/env.d.ts:5` | `FsList` 타입이 중복 정의됨 | 공용 타입으로 통합 |
| L-14 | `src/main.ts:33-37` | 분석 데이터를 `analyserData`에 받고 다시 `d`로 복사 | `fill`에 `analyserData`를 직접 넘기거나 복사 제거 |
| L-15 | `index.html`, `panel.html`, `desktop/main.cjs:26,88` | CSP 메타 태그가 없고, `contextIsolation`/`sandbox`를 명시하지 않음 (Electron 기본값은 안전한 편) | CSP 추가, `contextIsolation: true`, `sandbox: true` 명시 |
| L-16 | 빌드 출력 | `main` 청크 549.78 kB 경고 | Electron에서는 허용 가능. 필요 시 `build.chunkSizeWarningLimit` 조정 또는 three.js 동적 import |
| L-17 | `desktop/main.cjs:53-67` | 한 폴더에 파일이 매우 많으면 `MAX_TRACKS`를 넘겨 수집한 뒤 마지막에 자름 | 내부 루프에서도 상한 확인 |
| L-18 | `desktop/playlist.cjs:11` | UTF-8 BOM이 있으면 첫 줄 `[playlist]`가 매칭되지 않음 | `line.replace(/^\uFEFF/, "")` |
| L-19 | `start.bat:28-31` | Vite dev 서버 대기 시간이 약 3초 고정 | 포트가 열릴 때까지 폴링 |
| L-20 | 프로젝트 전체 | ESLint/Prettier 설정 없음 | 린트/포맷 스크립트 추가 |

---

## 잘된 점

- 모듈 분리가 명확하고 파일이 작아 읽기 쉬움 (`audio`, `cube`, `visualizer`, `settings`, `textures`, `popup`).
- 비동기 텍스처 렌더링에 `seq` 가드를 두어 늦게 끝난 이전 렌더가 최신 결과를 덮어쓰지 않게 한 점이 좋음 (`src/cube.ts:93-101`).
- 소스 스캔 경쟁 조건을 `sourceVersion`으로 막은 점이 좋음 (`src/main.ts:77-83`).
- 브라우저에서도 열 수 있도록 `window.api?.` 옵셔널 체이닝을 일관되게 사용.
- `mcfile://` 커스텀 스킴에서 오디오 확장자만 제공하려는 검증 시도가 있음.
- 코드 주석은 대부분 영어이며, UI 문자열은 대부분 한국어.
- `memory-bank`에 트러블슈팅 기록이 잘 정리되어 있어 유지보수에 도움이 됨.

---

## 권장 작업 순서

1. **H-1, H-2** 수정 (실사용에서 창 중복/소리 겹침 방지)
2. **M-1 ~ M-6** 수정 (규칙 준수 + 체감 성능 + 드래그 안정성)
3. **M-7 ~ M-11** 수정 (보안/동작/테스트/접근성)
4. Low 항목은 해당 파일을 수정할 때 함께 정리
5. 수정 후 `npm run build`와 테스트를 다시 실행하고, 실제 Electron에서 드래그/클릭/YouTube 재생을 확인

---

## 부록: 실행한 검증 명령

```powershell
npm run build
node --test test/playlist.test.cjs
```
