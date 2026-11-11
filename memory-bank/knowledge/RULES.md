# Rules

> 이 프로젝트의 규칙과 컨벤션. 모든 sub-agent가 반드시 따라야 함.

## G-01: 코드 주석은 영어만 사용 (MANDATORY)

**규칙:** 모든 코드 주석(`//`, `/* */`, `///`)은 영어로 작성. 한글 주석 금지.
**이유:** 소스 파일 내 한글은 인코딩 문제 및 빌드 오류를 유발할 수 있음.
**적용 시점:** 코드 작성 또는 수정 시 항상. UI 텍스트(사용자에게 보이는 문자열)는 한국어 유지.

<!-- 예시 형식:

## [규칙 이름]

**규칙:** [한 줄 요약]
**이유:** [왜 이 규칙이 필요한가]
**적용 시점:** [언제 이 규칙이 발동되나]

-->

## UI language exceptions the user asked for (2026-11-11)
**규칙:** The three colour-picker tooltips ("Background color", "Pattern color", "Icon color") and the check boxes (Auto contrast, Always on top, Floating, Cava spectrum) stay in English although G-02 says UI text is Korean.
**이유:** The user asked for English on these explicitly. A Codex pass once translated them back to Korean to follow G-02 (see `codereview.md` M-1); the user's request wins.
**적용 시점:** Any UI/text review or translation pass.

## Test with an isolated Electron profile (2026-11-11)
**규칙:** Automated runs use `--user-data-dir=<scratch dir>`, never the real profile, and never call `localStorage.clear()` on it.
**이유:** The user's real settings, window position and `window.json` live in the same user-data folder; an earlier test run mixed with them and made the cube look like another configuration.
**적용 시점:** Any script that drives Electron through the remote-debugging port.

## Check git log before assuming concurrent edits (2026-11-11)
**규칙:** Files changing between turns usually come from Codex commits in the same repository, not from a parallel session. Read `git log --stat` first.
**이유:** A misread of Codex's EQ and security changes as "concurrent editing" cost a turn.
**적용 시점:** When a file differs from what was last read.
