# Active Context

## Current Focus

- v0.2.3(2026-11-14): 크기 슬라이더 깜빡임 수정 — 투명 창 크기를 바꾸면 튀므로 창을 최대 크기(1008px)로 고정하고 캔버스만 크기에 맞춰 줄임(캔버스를 창 전체로 두면 마우스 반응이 느려짐). `--user-data-dir`이 있으면 data/ 대신 그것을 사용.
- 배포 방식 변경(2026-11-13): NSIS 설치형 대신 `release/MusicCube-<ver>.zip`(win-unpacked 폴더형). 단독 portable exe는 실행마다 임시 폴더에 풀려 폐기. 설정/창 위치/캐시는 exe 옆 `data/`(개발 시 프로젝트 루트 `data/`, git 제외).
- v0.2.2 릴리스(2026-11-13): 폴더형 zip 배포 첫 릴리스. v0.2.1 릴리스의 Setup exe는 그대로 둠.
- v0.2.1 전체 코드 리뷰 완료 — 결과는 `codereview.md` (2026-11-12, d2e90df 기준). High 0 / Medium 4 / Low 18.
- 검증: `npm test` 13/13, `npm run build` 통과(main 청크 554.38 kB 경고만).
- 리뷰 다음 단계 후보(미착수): M-1 영어 문구 5곳 한국어화, M-2 색상 툴팁 영어/한국어 방향 결정(사용자 확인 필요), M-3 혼합 재생목록, M-4 loopback 재시도/해제.
- 주의: 커밋 276bd24가 색상 툴팁을 한국어로 바꿨지만 CLAUDE.md/RULES.md는 영어 유지를 규정 — 코드와 규칙이 어긋남(리뷰 M-2).
- v0.2.1 릴리스 상태(cymatics)는 그대로; store/ 이미지는 로컬 전용.
- Tests 13/13; packaged app smoke-checked.
