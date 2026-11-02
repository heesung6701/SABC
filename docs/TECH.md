# SABC 기술 문서 (Milestone 1)

작성일: 2026-10-28 · 상태: 초안 (승인 대기)
관련 문서: [PRD.md](PRD.md) (무엇을·왜) · [next-features/](next-features/README.md) (M1 이후 feature별 기술 방식은 각 feature 문서에 있다)

이 문서는 **M1의 기술 방식**과 전체에 걸친 공통 원칙만 다룬다.

## 1. 공통 원칙

| 항목 | 결정 | 근거 |
|---|---|---|
| 웹 스택 | 바닐라 HTML/CSS/JS(ES 모듈), 빌드 없음 | 서버 없이 가장 빠르게 만들고 배포한다. |
| 계산 로직 분리 | 점수·순위·잠금은 DOM과 무관한 순수 함수 | 테스트, 서버 이전, Android 재구현을 쉽게 한다. |
| 공용 테스트 케이스 | 입력→기대 순위를 JSON으로 두고 모든 구현이 같은 파일을 쓴다 | 웹(JS)과 Android(Kotlin)의 규칙이 어긋나지 않게 한다. |
| 데이터 확장 | 기존 데이터를 깨지 않는 필드 추가를 우선, 구조가 바뀔 때만 `version` 증가 | feature마다 마이그레이션이 생기는 것을 피한다. |

## 2. M1 기술 방식

- 페이지: `index.html`(평가, 메인), `result.html`, `settings.html` + 공용 JS.
- 디자인 시스템: 당근 SEED(`@seed-design/css` 3.0.3)의 `all.min.css`를 jsDelivr CDN에서 링크한다 (빌드 없음, 버전 고정). 컴포넌트는 SEED 클래스 규칙(`seed-<컴포넌트>__<슬롯>--<변형>`)을 `ui-common.js`의 헬퍼(`btn`, `textInput`, `callout`, `switchControl`, `tabList`)로만 만든다. 색·간격·글자는 `--seed-*` 토큰을 쓰고 `style.css`에는 SEED에 없는 배치와 티어 색만 둔다. 인터넷 연결이 없으면 스타일이 적용되지 않는다 (필요하면 CSS 파일을 저장소에 복사해 서빙).
- 드래그: 브라우저 기본 HTML5 드래그 앤 드롭 (별도 라이브러리 없음).
- CSV 일괄 등록: 줄바꿈/쉼표 구분 텍스트를 파싱하는 작은 함수. 라이브러리 없음.
- 파일 형식 3종: ① 전체 백업 JSON(아래 평가 데이터 모델), ② 평가 기준 JSON `{ version: 1, criteria: [{ name, description?, points? }] }` (`exportCriteriaJson`/`parseCriteriaJson`, 가져오면 기준 교체+배치 비움), ③ 대상자+평가표 CSV (`exportSheetCsv`/`importSheetCsv`, 첫 열 대상자·나머지 열 기준 이름·칸은 S/A/B/C, 맨 앞 BOM, 따옴표/쉼표/줄바꿈을 지원하는 `parseCsv`). xlsx는 파서 라이브러리가 필요해 지원하지 않는다. 모두 `core.js`의 순수 함수다.
- JSON 내보내기: 평가 하나의 데이터를 `Blob` + 다운로드 링크로 저장. JSON 가져오기: `<input type="file">`로 읽어 `core.js`의 검증 함수를 통과해야 교체한다 (`version`, id 중복, 존재하지 않는 대상자/기준을 가리키는 배치, 티어 값 확인). 실패하면 오류 위치를 보여주고 기존 데이터는 그대로 둔다.
- Preset: `js/presets.js`에 내장 preset 객체를 둔다 (`subjects`는 이름 배열, `criteria`는 `{ name, description? }` 배열, 배치 없음). 첫 항목은 `hiring`(채용 평가 기준: 기준 5개 + 설명, 대상자 없음)이라 기본 선택된다. 샘플 preset은 가상 데이터로 대상자 `후보 1`~`후보 10`, 기준 `참신성 / 실현 가능성 / 시장성 / 완성도` 4개를 쓴다. 실제 행사·팀 정보는 넣지 않는다. 데이터 파일을 `fetch`하지 않고 JS 모듈로 내장한다 *(기획자 판단)*. 모듈 스크립트는 `file://`에서 동작하지 않으므로 로컬 확인은 `python3 -m http.server -d web`로 한다. 적용은 새 id를 부여해 현재 데이터를 교체하고 배치를 비운다. 이후 편집은 일반 데이터와 동일하다. preset 객체도 JSON 가져오기와 같은 검증 함수를 통과시킨다.
- 저장: `localStorage` 키 하나(`tier-eval-v1`)에 워크스페이스 JSON 전체 저장, 변경 시 즉시 저장. 저장소 읽기/쓰기는 `store.js` 한 곳에만 둔다 (서버 확장 시 교체 지점).
- 배포: GitHub Pages. 문서 폴더(`docs/`)와 사이트 파일이 섞이므로 사이트를 `web/`에 두고 GitHub Actions로 배포하는 방식을 제안한다 (§4 확인).

**파일 구조 (제안)**
```
web/
  index.html  result.html  settings.html   # index.html이 평가 화면
  js/core.js     # 점수·순위·잠금·JSON/CSV 검증·변환, 워크스페이스 검증 (순수 함수)
  js/store.js    # localStorage 읽기/쓰기
  js/presets.js  # 내장 preset (샘플, 빈 구성)
  js/ui-common.js  # DOM 헬퍼, SEED 컴포넌트 헬퍼, 머리글/탭, 앱 껍데기
  js/settings.js  js/evaluate.js  js/result.js   # 페이지별 화면 코드
tests/
  core.test.js           # 프레임워크 없는 Node 스크립트
  fixtures/scoring.json  # 입력 → 기대 점수/순위
```

**데이터 모델**

최상위는 평가 여러 개를 담는 워크스페이스(`version: 2`)다. 예전 단일 평가 데이터(`version: 1`)는 `store.load()`가 `평가 1` 하나로 감싸 읽는다 (`toWorkspace`). 아래는 평가 하나의 `data`이며 전체 백업 JSON 형식이기도 하다.
```json
// workspace
{ "version": 2, "activeId": "e1", "evaluations": [{ "id": "e1", "name": "평가 1", "data": { /* 아래 */ } }] }
```
평가 id는 `e1, e2…`(지운 번호는 재사용하지 않고 최대값+1), 마지막 평가는 삭제 불가, 화면 코드는 활성 평가의 `data`만 받는다(`ui-common.js`의 `createApp`이 `updateActive`로 감싼다). 평가 조작은 `model.js`의 순수 함수(`addEvaluation` 등)와 `ui-common.js`의 `evaluations` 객체로 한다.

```json
{
  "version": 1,
  "subjects": [{ "id": "s1", "name": "..." }],
  "criteria": [{ "id": "c1", "name": "...", "description": "...", "points": { "S": 30, "A": 20, "B": 15, "C": 10 } }],
  "placements": { "c1": { "s1": "S" } },
  "settings": { "allowPreview": false }
}
```
- `description`(기준 설명, 문자열)과 `points`는 선택 필드다 (`points`가 없으면 기본 점수표).
- `settings`와 `settings.allowPreview`는 선택 필드다 (없으면 꺼짐). 켜져 있고 미배치가 있으면 `computeResults`가 `status: 'preview'`와 함께 미배치를 0점으로 계산한 순위를 돌려준다.
- 이 JSON이 곧 내보내기/가져오기 파일 형식이다. 사람이 직접 고칠 수 있도록 읽기 쉬운 들여쓰기로 내보낸다.
- 기본 점수표는 `core.js`의 상수 `TIER_POINTS`. 기준에 `points = { S, A, B, C }`가 있으면 그 기준은 그 점수표를, 없으면 `TIER_POINTS`를 쓴다 (점수표 조회는 한 함수에서만).
- 점수표 검증(0 이상 숫자, S > A > B > C)은 `core.js`의 순수 함수로 두고 설정 화면 입력과 JSON 가져오기 검증에 같이 쓴다.
- 이름이 아닌 id로 참조한다. 이름 변경과 이후 다중 평가자 확장이 안전하다.
- feature가 필드를 추가해도 M1 데이터가 열려야 한다 (각 feature 문서에 변경 내용이 있다).

## 3. 테스트와 리스크

**테스트**
- `core.test.js`가 fixtures를 읽어 점수 합산, 동점(S 개수 우선), 공동 순위(1, 1, 3), 미배치 잠금을 검증한다.
- 대상자·기준 삭제 시 배치 동반 삭제.
- 기준 설명: 문자열 검증, 설정 저장·내보내기·가져오기 유지, 빈 값이면 키 제거, `hiring` preset의 기준 이름·설명 존재.
- 미리보기: 꺼짐/없음이면 잠금, 켜짐이면 `preview`(미배치 0점, 미배치 칸 tier는 null), 모두 배치되면 켜져 있어도 `ready`, 아무것도 배치하지 않아도 계산됨, `settings` 검증 위반과 내보내기·가져오기 유지.
- 기준별 점수표: 기준마다 다른 점수표를 쓴 총점·순위 fixtures, `points`가 없으면 기본 점수표와 결과가 같다, 검증 위반 케이스(순서 역전, 숫자 아님, 음수).
- 워크스페이스: 평가 추가·전환·이름 변경·순서 변경·삭제(마지막 하나 보호, 활성 평가 이동), 활성 평가만 수정됨, 잘못된 형식 거부, 예전 단일 데이터 자동 변환.
- CSV/기준 JSON: 내보내기→가져오기 왕복(따옴표·쉼표·BOM), 모르는 열·잘못된 티어·중복 대상자 오류 위치, 소문자 티어·CRLF·빈칸, 기준 JSON 왕복과 배치 비움.
- 가져오기 검증: 정상 파일, 직접 수정한 파일, 깨진 JSON, 존재하지 않는 id를 가리키는 배치, 잘못된 티어 값.
- 내보내기 → 가져오기를 거쳐도 점수·순위가 같다.
- Preset: 내장 preset이 모두 검증을 통과한다. 적용하면 배치가 비워지고 대상자·기준이 preset과 같다. 적용 후 추가/삭제/수정이 가능하고 preset 원본 객체는 변하지 않는다.

**리스크**
- 바닐라 JS는 화면이 늘면 코드가 흩어진다 → 파일을 화면 단위로 나눈다.
- `localStorage`는 브라우저·기기별로 따로 저장된다 (서버 확장 전까지의 한계. JSON 내보내기로 백업·이동).

## 4. 확인 필요 (M1)

| 항목 | 내용 |
|---|---|
| GitHub Pages 배포 방식 | 사이트를 `web/`에 두고 GitHub Actions로 배포 vs 저장소 루트에 사이트 파일 배치. 현재 이 폴더는 git 저장소가 아님. |
