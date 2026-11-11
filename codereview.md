# MusicCube 코드 리뷰 (v0.2.1 전체)

- 리뷰 일자: 2026-11-12
- 대상 커밋: `d2e90df` (v0.2.1, cymatics 포함)
- 리뷰 범위: `src/*.ts` 12개, `desktop/*.cjs` 3개, `test/*.cjs` 4개, `scripts/*` 2개, `index.html`, `panel.html`, `src/style.css`, `package.json`, `tsconfig.json`, `vite.config.ts`, `start.bat`, `stop.bat`
- 리뷰 방식: 소스 정적 분석(전 파일 열람) + 빌드/테스트 실행 + git 이력 확인. 소스는 수정하지 않았습니다.
- 검증 결과
  - `npm test` 통과: **13/13** (audio 4, chladni 5, playlist 1, spectrum 3)
  - `npm run build` 통과 (`tsc --noEmit` + `vite build`)
  - 빌드 경고: `main` 청크 **554.38 kB** (>500 kB 기준, three.js 포함 — Electron 로컬 로딩이라 치명적이지 않음)

---

## 한눈에 보는 요약

| 심각도 | 개수 | 대표 내용 |
|---|---:|---|
| High (꼭 수정) | 0 | 이전 리뷰의 High 2건은 모두 수정되었고 테스트로 보호됨 |
| Medium (수정 권장) | 4 | 영어 UI 문구 잔존, 색상 툴팁 규칙 불일치, 혼합 재생목록 무시, loopback 재시도 없음 |
| Low (틈날 때) | 18 | 캐시/검증/할당/죽은 코드 등 |

### 먼저 볼 Top 4

1. **M-1** G-02 위반 영어 문구 5곳 (`URL input`, `Default Song`, `Music Selection`, `Folder`, `Playlist`)
2. **M-2** 색상 툴팁 3개가 규칙 문서(영어 유지)와 코드(한국어)로 엇갈림 — 사용자 결정 필요
3. **M-3** YouTube 링크가 하나라도 섞인 재생목록에서 나머지 곡 전부가 무시됨
4. **M-4** loopback 캡처가 한 번 실패하면 재시도 없이 앱 재시작까지 fake 스펙트럼 고정

---

## 이전 리뷰(v0.1.0, 2026-11-10) 반영 현황

| 구 ID | 항목 | 상태 | 비고 |
|---|---|---|---|
| H-1 | 설정/폴더 창 전환 시 `panel` 참조 꼬임 | ✅ | `desktop/main.cjs:129-135` — `created` 가드(`if (panel === created)`)로 해결. 경쟁 시나리오(연속 토글, 종류 전환) 추적 확인 |
| H-2 | YouTube 플레이어 중복 생성 | ✅ | `src/audio.ts:113-160` — `ytStarting` + `ytGeneration` 이중 가드. `test/audio.test.cjs` 2건이 회귀 보호 |
| M-1 | 영어 UI 문구 | ⚠️ | 색상 툴팁은 한국어로 바뀜(→ M-2 참조), 체크박스 4개는 사용자 요청대로 영어 유지. **5곳 잔존(→ M-1 신규)** |
| M-2 | icons.ts 한글 주석 | ✅ | 영어 주석으로 교체됨 |
| M-3 | setIcon 무조건 repaint | ✅ | `src/cube.ts:104-110` — 변경 없으면 조기 반환 |
| M-4 | 설정 하나 바뀌어도 전체 repaint | ✅ | `src/main.ts:110-119` — `seen`/`surface()` 비교로 변경 항목만 적용 |
| M-5 | 슬라이더마다 전체 저장 | ✅ | `saveSoon()` 150 ms 디바운스 + `onchange` 즉시 저장 (`src/settings.ts:68-71`) |
| M-6 | pointercancel 고착 | ✅ | `src/main.ts:168-169` — `pointercancel` + `lostpointercapture` 처리 |
| M-7 | mcfile:// 광역 제공 | ✅ | `desktop/main.cjs:189-198` — 세션 토큰 + 확장자 + allow-list, 위반 시 403 |
| M-8 | 표시미디어 자동 승인 범위 | ✅ | `desktop/main.cjs:177-183` — `req.frame`이 큐브 창 메인 프레임일 때만 승인 |
| M-9 | 빈 폴더 → 기본 유튜브 자동재생 | ✅ | `selected` 구분 + 테스트("empty selected folder does not start…") 보호 |
| M-10 | 테스트 없음 | ✅ | `npm test` 스크립트 + 4개 파일 13건. 잔여: settings 병합/autocolor/listDir·walk은 무테스트 |
| M-11 | 접근성(포커스/aria) | ✅ | `:focus-visible` 스타일, aria-label, 키보드 조작(Enter/Space) 전면 적용 |
| L-1 | iconImage onerror 없음 | ✅ | `src/cube.ts:27` — `onerror → res(null)` |
| L-2 | masks 캐시 | ⚠️ | 로드 완료 후 캐시는 있으나 진행 중 중복 디코딩·삭제 시 미회수 (→ 신규 L-1) |
| L-3 | 설정 검증 없음 | ⚠️ | `eq`만 정규화, 나머지 키는 무검증 (→ 신규 L-2) |
| L-4 | Vector2 등 매번 생성 | ❌ | `hitAt`/프레임 루프 할당 유지 (→ 신규 L-3) |
| L-5 | DPI 변경 미갱신 | ❌ | (→ 신규 L-4) |
| L-6 | single instance lock 후 계속 실행 | ✅ | `return`으로 조기 종료 (`desktop/main.cjs:21`) |
| L-7 | net.fetch 실패 예외 | ✅ | try/catch → 404 (`desktop/main.cjs:197`) |
| L-8 | fromWebContents null | ✅ | 가드 추가 (`desktop/main.cjs:114,141-142`) |
| L-9 | 패널 항상 위 고정 | ✅ | `on-top` IPC가 패널에도 전파 (`desktop/main.cjs:148`) |
| L-10 | 탐색기 시작 폴더 | ✅ | 현재 선택 폴더에서 시작 (`src/popup.ts:106`) |
| L-11 | 미사용 CSS/btn | ❌ | (→ 신규 L-5) |
| L-12 | 중간 import | ❌ | `src/textures.ts:26` (→ 신규 L-6) |
| L-13 | FsList 타입 중복 | ❌ | `src/popup.ts:64` vs `src/env.d.ts:7` (→ 신규 L-7) |
| L-14 | analyserData 복사 | ✅ | 시각화 구조 재작성으로 자연 해소 |
| L-15 | CSP/옵션 명시 없음 | ⚠️ | CSP는 여전히 없음, `contextIsolation`/`sandbox`는 Electron 33 기본값(안전)에 의존 (→ 신규 L-8) |
| L-16 | 청크 크기 경고 | ❌ | 549.78 kB → 554.38 kB (→ 신규 L-9) |
| L-17 | walk 상한 | ✅ | 내부 루프에도 상한 검사 (`desktop/main.cjs:83,90`) |
| L-18 | 재생목록 BOM | ✅ | 확인 결과 **기능상 무해**: BOM 줄은 모든 필터를 통과해 떨어져 나가고 AUDIO 확장자 검사에서 버려짐. 정리 원하면 `line.replace(/^\uFEFF/, "")` |
| L-19 | start.bat 고정 대기 | ⚠️ | 포트 정리용 폴링은 추가됨. dev 모드의 Vite 시작 대기는 3초 고정 (→ 신규 L-10) |
| L-20 | ESLint 없음 | ❌ | (→ 신규 L-11) |

---

## Medium — 수정 권장

### M-1. G-02 위반 영어 문구 5곳 잔존

**위치:** `src/popup.ts:113, 147, 156, 158`

사용자에게 보이는 문자열이 영어로 남아 있다. CLAUDE.md/RULES.md의 예외 목록(색상 툴팁 3개, 체크박스 4개)에 포함되지 않은 것들이므로 G-02(한국어) 위반이다.

| 위치 | 현재 | 제안 |
|---|---|---|
| popup.ts:113 (placeholder) | `https:// URL input` | `https:// 주소 입력` (aria-label은 이미 "음악 URL 입력") |
| popup.ts:147 | `Default Song` | `기본 곡` |
| popup.ts:156 | `Music Selection` | `음악 선택` |
| popup.ts:158 | `Folder` / `Playlist` | `폴더` / `재생목록` |

만약 이 문자열들도 영어로 유지하기를 원한다면 RULES.md의 예외 목록에 추가해 규칙을 맞춰야 한다(문서와 코드 중 한쪽은 고쳐야 함).

### M-2. 색상 툴팁 3개 — 규칙 문서(영어)와 코드(한국어) 불일치

**위치:** `src/popup.ts:340`

- CLAUDE.md와 `memory-bank/knowledge/RULES.md`의 "UI language exceptions"(2026-11-11): 색상 선택기 말풍선 3개(`Background color` / `Pattern color` / `Icon color`)은 **영어를 유지**하고 "되돌리지 마세요"라고 명시.
- 그러나 현재 코드는 `picker("color", "배경색")`, `picker("patternColor", "무늬색")`, `picker("iconColor", "아이콘색")`으로 **한국어**다.
- git 확인(`git log -S`): 커밋 `276bd24` "Persist MusicCube settings and resolve review findings"(리뷰 수정 커밋)에서 영어 → 한국어로 번역된 뒤 이후 되돌려지지 않았다. RULES.md가 말하는 "한 번 한국어로 되돌린 Codex 수정"이 그대로 남은 상태다.

**조치(둘 중 하나, 사용자 결정 필요):**

1. 규칙대로 복원: `Background color` / `Pattern color` / `Icon color`로 되돌림
2. 한국어 유지: CLAUDE.md와 RULES.md의 예외 항목에서 색상 툴팁 3개를 제거해 문서를 코드에 맞춤

체크박스 4개(Auto contrast, Always on top, Floating, Cava spectrum)는 규칙대로 영어 유지 중이므로 그대로 둔다.

> ✅ **수정됨 (2026-11-12):** 사용자가 앞서 영어를 명시적으로 요청했던 항목이라 1번(영어 복원)으로 처리. `src/popup.ts:340`이 `Background color` / `Pattern color` / `Icon color`로 돌아감. 문서(CLAUDE.md, RULES.md)와 코드가 일치.

### M-3. YouTube 링크가 섞인 재생목록이 나머지 항목을 전부 버림

**위치:** `src/audio.ts:202-207` (`setList`)

```ts
const youtube = urls.find(isYouTube);
ytUrl = youtube ?? DEFAULT_TRACK;
list = youtube ? [] : urls;   // YouTube가 하나라도 있으면 목록 전체가 버려짐
useYt = !!youtube || (urls.length === 0 && defaultWhenEmpty);
```

**증상**

- m3u/pls에 로컬 mp3 10개 + 유튜브 링크 1개가 있으면 유튜브 **1곡만** 재생되고 나머지 10개는 사라진다.
- 유튜브 링크가 여러 개면 첫 번째만 재생된다.
- 일반 http mp3 URL도 유튜브가 있는 순간 함께 버려진다.

**제안**

```ts
const rest = urls.filter((u) => !isYouTube(u));
list = youtube ? rest : urls; // YouTube가 없는 항목은 로컬/원격 재생으로 유지
```

단, 이 경우 유튜브와 일반 트랙의 동시 재생 정책(useYt 우선)을 정리해야 한다. 최소한으로는 동작 제한을 README/안내에 명시하는 것도 방법이다.

> ✅ **수정됨 (2026-11-12):** `src/audio.ts`의 `setList`가 YouTube가 아닌 항목(`rest`)을 항상 목록으로 유지한다. 정책: 두 플레이어는 이어 붙일 수 없으므로 **재생 가능한 항목이 하나라도 있으면 그것들을 재생하고 YouTube 링크는 건너뛰며, YouTube 링크만 있는 목록일 때만 YouTube 플레이어를 쓴다.** README "Music source"에 명시. 회귀 테스트: `a list that mixes files and YouTube links plays the files`.

### M-4. 시스템 오디오 loopback — 실패 1회로 재시도 불가, 해제도 없음

**위치:** `src/audio.ts:92-109` (`startLoopback`), `src/audio.ts:162-169` (`destroyYt`)

**문제 1 — 재시도 없음:** `loopTried = true`가 실패 여부와 무관하게 세팅되어, 일시적 원인(일시적 장치 오류 등)으로 `getDisplayMedia`가 한 번 실패하면 앱을 다시 시작할 때까지 유튜브 스펙트럼이 fake(`fakeSpectrum`)로 고정된다. 패키지 앱에서는 핸들러가 자동 승인하므로 발생 빈도는 낮지만, 발생하면 복구 수단이 없다.

**문제 2 — 해제 없음:** 캡처에 성공한 오디오 트랙은 로컬 파일/원격 URL로 소스를 바꿔도 계속 시스템 오디오를 캡처한다(비용만 드는 배경 캡처).

**제안**

```ts
// 소스가 YouTube로 돌아올 때마다 한 번은 다시 시도
if (!useYt && loopAnalyser) { /* stop tracks, loopAnalyser = null, loopTried = false */ }
```

- `setList`에서 `useYt`가 꺼질 때 `st.getAudioTracks().forEach((t) => t.stop())`으로 스트림 해제
- 해제 시 `loopTried = false`로 초기화해 재진입 시 재시도

> ✅ **수정됨 (2026-11-12):** `startLoopback`이 실패(예외, 오디오 트랙 없음)하면 `loopTried`를 되돌려 다음 재생 때 다시 시도한다. 캡처 스트림을 `loopStream`에 보관하고, `setList`에서 YouTube를 벗어나면 `stopLoopback()`으로 트랙을 정지·`loopAnalyser`를 비운다. 시스템이 캡처를 끝내면(`ended`) 같은 경로로 정리된다. 회귀 테스트: `a failed system-audio capture is retried, and the capture is released when YouTube is left`.

---

## Low — 틈날 때 개선

| ID | 위치 | 내용 | 제안 |
|---|---|---|---|
| L-1 | `src/textures.ts:50-70` | 사용자 질감 로드 전에는 `maskCanvas`가 캐시에 없어 compose 호출마다 새 canvas+Image 생성. 첫 적용 시 6면 × 반복 재페인트로 최대 수십 번 디코딩 가능. 삭제한 질감의 캐시 회수도 없음(ID가 고유라 영향은 누수만) | 진행 중 Promise 캐시, 삭제 시 `masks.delete(id)` |
| L-2 | `src/settings.ts:47-53, 83-87` | `eq`만 정규화. `viz`/`size`/`texture`/`userTex` 모양 등은 손상값 검증 없이 병합되고 storage 이벤트도 무검증 `Object.assign` | 키별 타입 검증 또는 스키마 버전 필드 |
| L-3 | `src/main.ts:128-131, 176-179` | `hitAt`마다 `Vector2`, 프레임마다 `Quaternion`/`Vector3` 생성 (pointermove/초 60회) | 모듈 스코프 재사용 객체 |
| L-4 | `src/main.ts:18`, `src/visualizer.ts:26` | 모니터 이동/DPI 변경 시 `devicePixelRatio` 미갱신 | resize에서 `setPixelRatio`/dpr 재설정 |
| L-5 | `src/style.css:15,50-53,81-83,95-97`, `src/ui.ts:14` | 미사용: `--cube-h`, `.texrow`/`.tex`/`.chip`/`.stylebtn` CSS, `btn()` export (grep 확인) | 삭제 |
| L-6 | `src/textures.ts:26` | 파일 중간에 `import { s }` | 파일 상단으로 이동 |
| L-7 | `src/popup.ts:64`, `src/env.d.ts:7` | `FsList` 타입 중복 정의 | 공용 타입으로 통합 |
| L-8 | `index.html`, `panel.html`, `desktop/main.cjs:46-52,129-133` | CSP 메타 태그 없음. `contextIsolation`/`sandbox` 명시 없음(Electron 33 기본값 true로 안전하지만 명시 권장). `setWindowOpenHandler` 부재 | CSP 추가(youtube 프레임 허용), 보안 옵션 명시, window.open 차단 |
| L-9 | 빌드 출력 | `main` 청크 554.38 kB 경고 | `build.chunkSizeWarningLimit` 조정 또는 three 동적 import(Electron 로컬 로딩이라 실효는 작음) |
| L-10 | `start.bat:30` | dev 모드의 Vite 시작 대기가 `ping -n 4`(약 3초) 고정. 포트 정리 폴링은 이미 있음 | 5188이 열릴 때까지 폴링 후 Electron 실행 |
| L-11 | `package.json` | lint/format 도구 없음 | ESLint + Prettier 스크립트 추가 |
| L-12 | `src/audio.ts:144-146` | YT `onError` → `nextVideo()` 무한 체인: 전 항목이 삽입 금지된 재생목록이면 오류가 끝없이 순회(크래시는 아님, 각 시도 수 초 간격) | 실패 카운트 후 정지/안내 |
| L-13 | `desktop/main.cjs:80-94` | `walk`에 방문 Set이 없어 심볼릭 링크 순환 시 같은 폴더 재방문 → 중복 수집(MAX_TRACKS 상한까지만) | `visited` Set |
| L-14 | `desktop/main.cjs:12,59` | `allowedAudio`가 세션 내 무한 증가(스캔마다 전체 경로 재추가, Set 중복 제거됨, 미미) | 스캔 단위 교체 등 |
| L-15 | `desktop/main.cjs:120-127` | 큐브 창만 닫히면(Alt+F4) 패널이 남아 `window-all-closed` 미발생 — 패널의 종료 버튼으로 복구 가능. 큐브 파괴 후 `open-panel`의 `win.getBounds()` 예외 가능성은 실제 경로가 거의 없음 | 큐브 `close` 시 패널도 닫기 |
| L-16 | `scripts/store-mockup.py:31` | `ramp = ... if False else None` 죽은 코드 | 삭제 |
| L-17 | `src/popup.ts:309-314` | `eqSet(s.eq, true)` — `setEq`의 `on=false` 경로(bypass)는 UI에서 도달 불가 | EQ on/off 토글 추가 또는 파라미터 정리 |
| L-18 | `desktop/main.cjs:114,146` | `move-by`/`fit-panel` 인자 미검증(NaN이면 `setPosition`에서 예외. 자체 렌더러에서만 호출되어 위험 낮음) | `Number.isFinite` 가드 |

---

## 잘된 점

- 이전 High 2건이 구조적으로 해결되었고(창 `created` 가드, YT 시작 가드) **회귀 테스트로 보호**됨 — 좋은 수정 패턴.
- 비동기 경쟁 가드가 일관됨: `sourceVersion`(소스 스캔), `seq`(텍스처 페인트), `ytGeneration`(YT 파괴), `pendingColors`(컬러 커밋 지연), `saveSoon`(저장 디바운스).
- 보안이 이전보다 단단함: `mcfile://` 토큰+확장자+allow-list+403, 표시미디어 승인은 큐브 프레임만, `settings-save`는 크기 상한+JSON 검증, 창 위치/설정 모두 tmp+rename 원자적 쓰기, 사라진 모니터의 저장 위치 무시.
- 순수 계산이 잘 분리됨: `spectrum.ts`(cava 포팅), `chladni.ts`(공식/입자)는 의존성 없는 순수 함수라 vm 기반 테스트로 보호됨. 특히 chladni 테스트(기울기 유한차분 검증, 패턴 반복 불가 검증)의 품질이 좋음.
- XSS 위험이 낮음: 문자열은 `append`/`textContent`/속성으로만 삽입하고 innerHTML 경로가 없음.
- 사용자 질감 저장(256px JPEG data URL, 3개 제한)으로 localStorage 예산 관리가 현실적.
- 브라우저에서도 열리는 `window.api?.` 옵셔널 패턴과 dev 전용 테스트 훅(`__mc`)이 깔끔.

---

## 권장 작업 순서

1. **M-1, M-2** — UI 언어 정리. 색상 툴팁 처리 방향(영어 복원 vs 문서 갱신)을 먼저 결정
2. **M-3, M-4** — 재생목록 혼합 처리와 loopback 재시도/해제
3. Low 항목은 해당 파일을 만질 때 함께 정리(L-1/L-2가 사용자 체감에 가장 가까움)
4. 수정 후 `npm run build` + `npm test` 재실행, 패키지 앱에서 로컬↔유튜브 전환과 설정 창을 다시 확인

---

## 부록: 실행한 검증 명령

```powershell
npm test          # 13/13 통과 (audio 4, chladni 5, playlist 1, spectrum 3)
npm run build     # tsc --noEmit + vite build 통과, main 청크 554.38 kB 경고
```

git 확인: `git log -S "배경색" -- src/popup.ts`, `git log -S "Background color" -- src/popup.ts` (M-2 근거)

---

## 수정 현황 (2026-11-12)

사용자 요청에 따라 **꼭 필요한 항목만** 수정했다.

| 항목 | 처리 |
|---|---|
| M-1 (영어 문구 5곳) | **수정하지 않음** — 사용자 지시로 보류 |
| M-2 (색상 툴팁) | ✅ 영어 복원 |
| M-3 (혼합 재생목록) | ✅ 수정 + 테스트 |
| M-4 (loopback 재시도/해제) | ✅ 수정 + 테스트 |
| Low 18건 (L-1 ~ L-18) | 수정하지 않음 — 지금 필요하지 않다고 판단 (사용자 요청: 필요한 것만) |

검증: `npm test` **15/15**(audio 6, chladni 5, playlist 1, spectrum 3), `npm run build` 통과.

