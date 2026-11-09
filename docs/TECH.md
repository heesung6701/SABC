# SABC 기술 문서 (Milestone 1)

작성일: 2026-10-28 · 상태: 초안 (승인 대기)
관련 문서: [PRD.md](PRD.md) (무엇을·왜) · [next-features/](next-features/README.md) (M1 이후 feature별 기술 방식은 각 feature 문서에 있다)

이 문서는 **M1의 기술 방식**과 전체에 걸친 공통 원칙만 다룬다.

## 1. 공통 원칙

| 항목 | 결정 | 근거 |
|---|---|---|
| 웹 스택 | Compose Multiplatform (Kotlin/Wasm), Gradle 빌드 *(2026-11 바닐라 JS에서 전환)* | 계산·데이터 계층을 Kotlin 한 벌로 두고 이후 Android/iOS에서 그대로 쓴다 ([multiplatform-review](next-features/multiplatform-review.md) 후보 C). |
| 계산 로직 분리 | 점수·순위·잠금은 DOM과 무관한 순수 함수 | 테스트, 서버 이전, Android 재구현을 쉽게 한다. |
| 공용 테스트 케이스 | 입력→기대 순위를 JSON으로 두고 모든 구현이 같은 파일을 쓴다 | 웹(JS)과 Android(Kotlin)의 규칙이 어긋나지 않게 한다. |
| 데이터 확장 | 기존 데이터를 깨지 않는 필드 추가를 우선, 구조가 바뀔 때만 `version` 증가 | feature마다 마이그레이션이 생기는 것을 피한다. |

## 2. M1 기술 방식

- 화면: 한 페이지 앱. 평가(메인)·결과·설정을 `AppState.screen`으로 바꾸고 주소 해시(`#result`, `#settings/options`)에 남겨 새로고침해도 유지한다.
- 디자인 시스템: Compose는 캔버스에 그리므로 SEED CSS를 쓸 수 없다. Material 3 컴포넌트에 SEED 브랜드 주황(`#FF6F0F`)과 웹 버전의 티어 색을 입힌다 (`Ui.kt`). 한글은 브라우저 글꼴을 못 쓰므로 Pretendard(OFL) Regular/Bold를 Compose 리소스로 싣고, 받기 전에는 그리지 않는다 (번들 약 3MB 추가). 시스템 다크 모드를 따른다.
- 드래그: Compose 포인터 제스처(`detectDragGestures`)로 칩을 끌고, 화면 맨 위에 유령 칩을 그린 뒤 놓은 위치의 구역에 배치한다 (`EvaluateScreen.kt`의 `DragState`). 마우스와 터치 모두 동작한다.
- CSV 일괄 등록: 줄바꿈/쉼표 구분 텍스트를 파싱하는 작은 함수. 라이브러리 없음.
- 파일 형식 3종: ① 전체 백업 JSON(아래 평가 데이터 모델), ② 평가 기준 JSON `{ version: 1, criteria: [{ name, description?, points? }] }` (`exportCriteriaJson`/`parseCriteriaJson`, 가져오면 기준 교체+배치 비움), ③ 대상자+평가표 CSV (`exportSheetCsv`/`importSheetCsv`, 첫 열 대상자·나머지 열 기준 이름·칸은 S/A/B/C, 맨 앞 BOM, 따옴표/쉼표/줄바꿈을 지원하는 `parseCsv`). xlsx는 파서 라이브러리가 필요해 지원하지 않는다. 모두 `Core.kt`의 순수 함수다.
- JSON 내보내기: 평가 하나의 데이터를 `Blob` + 다운로드 링크로 저장 (`Platform.kt`). JSON 가져오기: `<input type="file">`로 읽어 `Core.kt`의 검증 함수(`JsonElement` 단계에서 위치별 오류를 모은 뒤 데이터 클래스로 읽는다)를 통과해야 교체한다 (`version`, id 중복, 존재하지 않는 대상자/기준을 가리키는 배치, 티어 값 확인). 실패하면 오류 위치를 보여주고 기존 데이터는 그대로 둔다.
- Preset: `Presets.kt`에 내장 preset 객체를 둔다 (`subjects`는 이름 배열, `criteria`는 `{ name, description? }` 배열, 배치 없음). 첫 항목은 `hiring`(채용 평가 기준: 기준 5개 + 설명, 대상자 없음)이라 기본 선택된다. 샘플 preset은 가상 데이터로 대상자 `후보 1`~`후보 10`, 기준 `참신성 / 실현 가능성 / 시장성 / 완성도` 4개를 쓴다. 실제 행사·팀 정보는 넣지 않는다. 데이터 파일을 `fetch`하지 않고 코드로 내장한다 *(기획자 판단)*. 적용은 새 id를 부여해 현재 데이터를 교체하고 배치를 비운다. 이후 편집은 일반 데이터와 동일하다. preset 객체도 JSON 가져오기와 같은 검증 함수를 통과시킨다.
- 저장: `localStorage` 키 하나(`tier-eval-v1`)에 워크스페이스 JSON 전체 저장, 변경 시 즉시 저장. 저장소 읽기/쓰기는 `Store.kt` 한 곳에만 둔다. JS 버전과 같은 키·형식이라 같은 주소에 배포하면 기존 데이터를 그대로 읽는다 (서버 확장 시 교체 지점).
- 배포: GitHub Pages. GitHub Actions가 `./gradlew jvmTest wasmJsBrowserDistribution`을 돌리고 `build/dist/wasmJs/productionExecutable`을 올린다. WebAssembly GC 지원 브라우저가 필요하다 (Chrome·Edge 119+, Firefox 120+, Safari 18.2+).

**파일 구조**
```
src/commonMain/kotlin/sabc/   # 플랫폼 무관 (Android/iOS에서 재사용)
  Core.kt     # 데이터 모델, 점수·순위·잠금, JSON/CSV 검증·변환, 워크스페이스 검증
  Model.kt    # 데이터 조작 (모두 새 값을 돌려주는 순수 함수)
  Presets.kt  # 내장 preset
  Store.kt    # 저장소 읽기/쓰기 (KeyValueStorage 인터페이스 뒤)
src/wasmJsMain/kotlin/sabc/   # 웹 UI
  Main.kt  Ui.kt  EvaluateScreen.kt  ResultScreen.kt  SettingsScreen.kt  EvaluationDialogs.kt
  Platform.kt # localStorage, 파일 받기/고르기, confirm, 주소 해시 (js() 호출은 여기만)
src/jvmTest/kotlin/sabc/      # 공용 로직 테스트 (kotlin.test, JVM에서 실행)
tests/fixtures/scoring.json   # 입력 → 기대 점수/순위 (모든 구현이 공유)
```

**데이터 모델**

최상위는 평가 여러 개를 담는 워크스페이스(`version: 2`)다. 예전 단일 평가 데이터(`version: 1`)는 `store.load()`가 `평가 1` 하나로 감싸 읽는다 (`toWorkspace`). 아래는 평가 하나의 `data`이며 전체 백업 JSON 형식이기도 하다.
```json
// workspace
{ "version": 2, "activeId": "e1", "evaluations": [{ "id": "e1", "name": "평가 1", "data": { /* 아래 */ } }] }
```
평가 id는 `e1, e2…`(지운 번호는 재사용하지 않고 최대값+1), 평가를 모두 지우면 `activeId: null`이 되고 평가 만들기 화면이 뜬다, 화면 코드는 활성 평가의 `data`만 바꾼다(`Main.kt`의 `AppState.commit`이 `updateActive`로 감싼다). 평가 조작은 `Model.kt`의 순수 함수(`addEvaluation` 등)를 `AppState.commitWorkspace`로 적용한다.

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
- 기본 점수표는 `Core.kt`의 상수 `TIER_POINTS`. 기준에 `points = { S, A, B, C }`가 있으면 그 기준은 그 점수표를, 없으면 `TIER_POINTS`를 쓴다 (점수표 조회는 한 함수에서만).
- 점수표 검증(0 이상 숫자, S > A > B > C)은 `Core.kt`의 순수 함수로 두고 설정 화면 입력과 JSON 가져오기 검증에 같이 쓴다.
- 이름이 아닌 id로 참조한다. 이름 변경과 이후 다중 평가자 확장이 안전하다.
- feature가 필드를 추가해도 M1 데이터가 열려야 한다 (각 feature 문서에 변경 내용이 있다).

## 3. 테스트와 리스크

**테스트**
- `CoreTest.kt`가 fixtures를 읽어 점수 합산, 동점(S 개수 우선), 공동 순위(1, 1, 3), 미배치 잠금을 검증한다.
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
- 첫 로딩이 무겁다: Skia(wasm) 약 8.6MB + 앱 4MB + 글꼴 3MB (전송 시 압축 전 기준). 캔버스 렌더링이라 브라우저 텍스트 검색·선택·확대가 제한된다.
- `localStorage`는 브라우저·기기별로 따로 저장된다 (서버 확장 전까지의 한계. JSON 내보내기로 백업·이동).

## 4. 확인 필요 (M1)

| 항목 | 내용 |
|---|---|
| GitHub Pages 배포 방식 | 결정됨: GitHub Actions가 Gradle로 빌드한 `build/dist/wasmJs/productionExecutable`을 배포. |
