# M1 티어 평가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대상자·기준을 입력해 기준별 S/A/B/C 티어를 드래그로 매기고, 기준별 점수표로 총점·순위를 내는 정적 웹(GitHub Pages)을 만든다.

**Architecture:** 바닐라 ES 모듈, 빌드 없음. 계산·검증·편집은 DOM과 무관한 순수 함수(`core.js`, `model.js`)에 두고 `node --test`로 검증한다. 화면 코드(`ui-*.js`)는 `textContent`만 써서 얇게 유지하고, 저장은 `store.js` 한 곳에서만 한다.

**Tech Stack:** HTML/CSS/JS(ES 모듈), Node 내장 테스트 러너(`node:test`, `node:assert/strict`), GitHub Actions + GitHub Pages. 외부 의존성 없음.

**Spec:** `docs/PRD.md` (§3 M1), `docs/TECH.md`

## Global Constraints

- 스택: 바닐라 HTML/CSS/JS(ES 모듈), 빌드 없음, npm 의존성 없음. UI는 한국어.
- 사이트 파일은 `web/`에 둔다. 테스트는 `tests/`. 저장소는 이미 git 저장소(브랜치 `main`, remote `origin`)다.
- 티어는 `S`, `A`, `B`, `C` 네 개. 구분 색상: S `#ff7f7f`(빨강), A `#ffbf7f`(주황), B `#ffdf7f`(노랑), C `#bfff7f`(연두). 다크 테마.
- 기본 점수표 `TIER_POINTS = { S: 4, A: 3, B: 2, C: 1 }`.
- 점수표 검증: S/A/B/C 모두 숫자(유한), 0 이상, `S > A > B > C`(엄격). 소수 허용, 음수 불가.
- 총점 = 각 기준에서 그 기준의 점수표로 환산한 점수의 합. 순위: 총점 내림차순 → 동점이면 S 개수 많은 쪽 → 그래도 같으면 공동 순위(1, 1, 3 방식).
- 결과 잠금: 모든 (기준 × 대상자)가 배치돼야 결과가 나온다. 미배치가 있으면 남은 건수를 표시.
- 데이터 모델: `{ version: 1, subjects: [{id,name}], criteria: [{id,name,points?}], placements: { [criterionId]: { [subjectId]: Tier } } }`. `points`는 선택. 이름이 아닌 id로 참조.
- 저장: `localStorage` 키 `tier-eval-v1` 하나에 JSON 전체. JSON 내보내기/가져오기 파일 형식도 같은 구조(들여쓰기 2칸). 가져오기는 병합이 아니라 교체.
- 삭제 시 해당 항목의 배치도 함께 삭제(확인 대화상자). 데이터 초기화 버튼(확인 대화상자).
- 내장 preset은 `js/presets.js`에만 둔다: 샘플(가상: 대상자 `후보 1`~`후보 10`, 기준 `참신성`, `실현 가능성`, `시장성`, `완성도`), 빈 구성. 실제 행사·팀 정보를 넣지 않는다.
- 화면에 사용자 입력 문자열을 넣을 때는 `textContent`/`value`만 쓴다(`innerHTML` 금지).
- 모듈 스크립트는 `file://`에서 동작하지 않는다. 로컬 확인은 `python3 -m http.server -d web 8000`.
- 커밋: 각 Task 끝의 Commit 스텝은 사용자가 커밋을 허용한 경우에만 수행한다. 허용 전에는 건너뛰고 변경만 남긴다.

## Review Focus

스펙이 말하지 않았지만 사용 중 깨질 가능성이 높은 입력, 가능성이 높은 순서대로. 각 줄의 테스트는 해당 Task에 들어 있다.

1. 대상자 또는 기준이 0개인 빈 상태에서 평가·결과 페이지가 죽지 않고 안내를 보여준다. (Task 1, 6, 7)
2. 점수표에 소수를 쓰면 부동소수점 오차(`0.2 + 0.1 !== 0.3`) 때문에 동점이어야 할 대상자가 갈린다. 합계는 소수 6자리로 반올림해 비교한다. (Task 1)
3. 이름이 같은 대상자/기준이 있어도 id로 구분되어 배치가 섞이지 않는다. (Task 1, 3)
4. 이름이나 가져온 JSON에 `<img onerror=...>`, `&` 같은 HTML이 있어도 화면에서 실행되지 않고 글자 그대로 보인다. (Task 5~7)
5. `localStorage`가 비었거나, 깨진 JSON이거나, 접근 시 예외가 나도 빈 데이터로 시작하고 앱이 죽지 않는다. 저장 실패는 사용자에게 알린다. (Task 4, 5)

---

## 파일 구조

```
package.json                  # { "type": "module", "scripts": { "test": "node --test" } }
.github/workflows/pages.yml   # 테스트 후 web/ 배포
web/
  index.html                  # settings.html로 이동
  settings.html  evaluate.html  result.html
  style.css                   # 다크 테마, 티어 색상
  js/core.js                  # 상수, 점수표, 결과 계산, 검증, JSON 입출력, 이름 파싱 (순수)
  js/model.js                 # 불변 편집 함수, preset 적용 (순수)
  js/presets.js               # 내장 preset
  js/store.js                 # localStorage 래퍼
  js/ui-common.js             # el() 헬퍼, 네비게이션, 공용 상태/저장
  js/settings.js  js/evaluate.js  js/result.js
tests/
  core.test.js  model.test.js  store.test.js
  fixtures/scoring.json
```

---

### Task 1: 점수·순위 계산 (core.js 1/2)

**Files:**
- Create: `package.json`, `web/js/core.js`, `tests/core.test.js`, `tests/fixtures/scoring.json`

**Interfaces:**
- Produces (모두 `web/js/core.js`에서 export):
  - `TIERS: ['S','A','B','C']`, `TIER_POINTS: {S:4,A:3,B:2,C:1}`
  - `emptyData(): Data` → `{version:1,subjects:[],criteria:[],placements:{}}`
  - `pointsFor(criterion): Points` — `criterion.points`가 있으면 그것, 없으면 `TIER_POINTS`
  - `validatePoints(points: unknown): string | null` — 오류 메시지 또는 `null`
  - `computeResults(data): { status: 'empty'|'locked'|'ready', missing: number, rows: Row[] }`, `Row = { subjectId, name, total, sCount, rank, tiers: Record<criterionId, Tier|null> }`
  - `progress(data, criterionId): { placed: number, total: number }`

- [ ] **Step 1: 스캐폴딩.** `package.json`을 `{ "type": "module", "scripts": { "test": "node --test" } }`로 만든다. `.gitignore`에 `node_modules/`, `.DS_Store`.

- [ ] **Step 2: fixtures 작성 (`tests/fixtures/scoring.json`).** 배열의 각 원소는 `{ name, data, expected: { status, missing, rows: [{subjectId,total,sCount,rank}] } }`이고 `rows`는 정렬 순서(순위 → 원래 순서)다. 아래 케이스를 모두 넣는다 (기준 `c1`,`c2`는 `points` 없음 = 기본 점수표, 별도 표기 없으면 대상자는 `s1`,`s2`,`s3`).
  - `ranking-1-1-3`: c1: s1=S,s2=A,s3=B / c2: s1=B,s2=A,s3=S → rows `[s1(6,1,1), s3(6,1,1), s2(6,0,3)]`
  - `tiebreak-by-s-count`: 대상자 s1,s2. c1: s1=S,s2=B / c2: s1=C,s2=A → rows `[s1(5,1,1), s2(5,0,2)]`
  - `per-criterion-points`: 대상자 s1,s2. c1 `points {S:10,A:5,B:2,C:0}`, c2 기본. c1: s1=A,s2=S / c2: s1=S,s2=C → rows `[s2(11,1,1), s1(9,1,2)]`
  - `locked`: 대상자 s1,s2, 기준 c1. placements `{c1:{s1:"S"}}` → status `locked`, missing 1, rows `[]`
  - `empty-no-subjects`: 기준 c1만 있음 → status `empty`, missing 0, rows `[]`. `empty-no-criteria`: 대상자만 있음 → 동일.
  - `decimal-tie`: 대상자 s1,s2. c1,c2 모두 `points {S:0.3,A:0.2,B:0.1,C:0}`. c1: s1=A,s2=S / c2: s1=B,s2=C → 두 총점 모두 `0.3`, rows `[s2(0.3,1,1), s1(0.3,0,2)]`
  - `duplicate-names`: 대상자 `{id:"s1",name:"같은이름"}`, `{id:"s2",name:"같은이름"}`, 기준 c1. c1: s1=A,s2=S → rows `[s2(4,1,1), s1(3,0,2)]`

- [ ] **Step 3: 실패하는 테스트 작성 (`tests/core.test.js`).** `node:test`와 `node:assert/strict`를 쓴다.
  - `computeResults matches every fixture case`: fixtures를 `readFileSync(new URL('./fixtures/scoring.json', import.meta.url))`로 읽어 각 케이스마다 `status`, `missing`, `rows.map(({subjectId,total,sCount,rank}) => ...)`를 `deepEqual`로 비교.
  - `computeResults fills tiers per criterion`: `ranking-1-1-3`의 s2 row에서 `tiers`가 `{c1:"A", c2:"A"}`.
  - `pointsFor falls back to TIER_POINTS`: `pointsFor({id:"c1",name:"x"})` deepEqual `TIER_POINTS`; `points`가 있으면 그 객체를 돌려줌.
  - `validatePoints`: `{S:4,A:3,B:2,C:1}`→`null`, `{S:0.3,A:0.2,B:0.1,C:0}`→`null`; 각각 `string`: `{S:1,A:1,B:0,C:0}`(엄격 감소 위반), `{S:4,A:3,B:2,C:-1}`(음수), `{S:"4",A:3,B:2,C:1}`(문자열), `{S:4,A:3,B:2}`(누락), `{S:4,A:3,B:2,C:NaN}`, `null`, `[]`.
  - `progress counts only existing subjects`: 대상자 s1,s2,s3 / 기준 c1 / placements `{c1:{s1:"S", s9:"A"}}` → `{placed:1,total:3}` (존재하지 않는 s9는 세지 않음).
  - `20 subjects x 6 criteria all get a rank`: 코드로 20×6 전부 배치한 데이터(티어는 `(i+j) % 4`로 배정)를 만들어 `status === "ready"`, `rows.length === 20`, 모든 `rank`가 1~20.

- [ ] **Step 4: 실패 확인.** Run: `npm test` — Expected: FAIL (`core.js` 없음).

- [ ] **Step 5: `web/js/core.js` 구현.** 위 Interfaces의 시그니처대로. 결정 사항: (a) `computeResults`는 대상자 또는 기준이 0개면 `status:'empty'`, 존재하는 (기준×대상자) 칸 중 티어가 없는 칸 수가 `missing`이고 `>0`이면 `status:'locked'`와 `rows:[]`; (b) 총점은 `Number(sum.toFixed(6))`으로 반올림해 비교(부동소수점 동점 처리); (c) 순위는 `1 + (총점이 더 크거나, 총점이 같고 sCount가 더 큰 row 수)`, 정렬은 안정 정렬(동순위는 `subjects` 원래 순서); (d) 존재하지 않는 id를 가리키는 placements는 무시.

- [ ] **Step 6: 통과 확인.** Run: `npm test` — Expected: PASS (모든 테스트).

- [ ] **Step 7: Commit** — `git add package.json .gitignore web/js/core.js tests && git commit -m "feat: add scoring and ranking core"`

---

### Task 2: 데이터 검증·JSON 입출력·이름 파싱 (core.js 2/2)

**Files:**
- Modify: `web/js/core.js`, `tests/core.test.js`

**Interfaces:**
- Consumes: Task 1의 `TIERS`, `validatePoints`, `emptyData`
- Produces (core.js):
  - `validateData(data: unknown): string[]` — 오류 목록(빈 배열 = 유효). 각 메시지는 문제 위치 경로로 시작: `version`, `subjects[0].name`, `criteria[1].points`, `placements.c9`, `placements.c1.s9`
  - `parseImportJson(text: string): { data: Data | null, errors: string[] }` — 깨진 JSON이면 `errors[0]`에 `JSON`이 포함
  - `exportJson(data: Data): string` — `JSON.stringify(data, null, 2)`
  - `parseNames(text: string): string[]` — 줄바꿈·쉼표로 나눠 trim, 빈 항목 제거

- [ ] **Step 1: 실패하는 테스트 추가 (`tests/core.test.js`).** 유효 기준 데이터는 `ranking-1-1-3` fixture의 `data`를 쓴다.
  - `validateData accepts valid data`: `[]`.
  - `validateData reports the location`: 아래 입력마다 `errors.length > 0`이고 `errors.join("\n")`이 지정 경로를 포함. `version: 2`→`version`; subjects id 중복→`subjects`; 이름이 빈 문자열→`subjects[0].name`; 기준 id 중복→`criteria`; `points`가 `{S:1,A:1,B:0,C:0}`→`criteria[0].points`; placements가 없는 기준 `c9`를 가리킴→`placements.c9`; 없는 대상자 `s9`→`placements.c1.s9`; 티어 `"X"`→`placements.c1.s1`.
  - `validateData never throws on garbage`: `null`, `[]`, `"x"`, `42`, `{}`, `{version:1,subjects:{}}`를 넣어도 예외 없이 비어 있지 않은 배열.
  - `validateData rejects __proto__ key`: `JSON.parse('{"version":1,"subjects":[],"criteria":[],"placements":{"__proto__":{}}}')`는 오류가 있고 `Object.prototype`이 오염되지 않음.
  - `parseImportJson`: `"{broken"`→`data === null`이고 `errors[0]`에 `JSON`; 유효 JSON→`data` deepEqual 원본, `errors` 빈 배열; 유효 JSON이지만 데이터 오류→`data === null`, `errors` 비어 있지 않음.
  - `export then import keeps results`: `exportJson` 결과를 `parseImportJson`하면 `data` deepEqual이고 `computeResults` 결과도 같다 (`points` 포함 케이스 `per-criterion-points` 사용).
  - `exportJson is indented`: 결과에 `"\n  \"version\""`이 포함.
  - `parseNames`: `"가, 나\n다\n\n  라  ,"`→`["가","나","다","라"]`; `""`→`[]`.

- [ ] **Step 2: 실패 확인.** Run: `npm test` — Expected: FAIL (함수 없음).

- [ ] **Step 3: 구현 (`web/js/core.js`).** 위 시그니처대로. 결정 사항: 오류 메시지는 한국어 한 줄이며 반드시 경로로 시작하고 모든 오류를 수집(첫 오류에서 멈추지 않음); placements 키 검사는 `Object.keys`로 하되 `__proto__`는 존재하지 않는 id이므로 일반 규칙으로 걸린다; `points`가 있으면 `validatePoints` 메시지를 `criteria[i].points: ...`로 감싼다.

- [ ] **Step 4: 통과 확인.** Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add web/js/core.js tests/core.test.js && git commit -m "feat: add data validation and JSON import/export"`

---

### Task 3: 편집 함수와 preset (model.js, presets.js)

**Files:**
- Create: `web/js/model.js`, `web/js/presets.js`, `tests/model.test.js`

**Interfaces:**
- Consumes: Task 1~2의 `emptyData`, `validateData`, `computeResults`
- Produces:
  - `presets.js`: `PRESETS: Preset[]`, `Preset = { id: string, name: string, subjects: string[], criteria: string[] }` — `{id:'sample', name:'샘플 (가상 데이터)', ...}`, `{id:'empty', name:'빈 구성', subjects:[], criteria:[]}`
  - `model.js` (모두 새 `Data`를 반환, 입력을 변경하지 않음):
    - `nextId(prefix: 's'|'c', items: {id:string}[]): string` — 기존 숫자 접미사 최댓값 + 1 (`[]`이면 `s1`)
    - `addSubject(data, name)`, `addCriterion(data, name)`, `addSubjects(data, names: string[])`, `addCriteria(data, names: string[])` — 이름은 trim하고 빈 이름은 무시(변경 없음)
    - `renameSubject(data, id, name)`, `renameCriterion(data, id, name)` — 빈 이름은 무시
    - `removeSubject(data, id)`, `removeCriterion(data, id)` — 관련 placements 삭제
    - `moveCriterion(data, id, delta: -1|1)` — 경계 밖이면 변경 없음
    - `setPoints(data, criterionId, points: Points | null)` — `null`이면 `points` 키 제거 (검증은 호출자 책임)
    - `setPlacement(data, criterionId, subjectId, tier: Tier | null)` — `null`이면 해당 키 삭제
    - `applyPreset(preset: Preset): Data` — 새 id를 부여, `placements: {}`

- [ ] **Step 1: 실패하는 테스트 작성 (`tests/model.test.js`).** 입력은 `deepFreeze`한 객체를 넘겨 변경 시 예외가 나게 한다 (ES 모듈은 strict mode).
  - `nextId`: `("s",[{id:"s1"},{id:"s3"}])`→`"s4"`; `("c",[])`→`"c1"`.
  - `addSubject trims and ignores blank`: `"  가 "`→이름 `"가"`, id `s1`; `"   "`→입력과 deepEqual.
  - `same-name subjects get distinct ids`: 같은 이름을 두 번 추가하면 id가 `s1`, `s2`.
  - `removeSubject deletes its placements everywhere`: c1,c2에 s1 배치가 있는 데이터에서 삭제하면 어느 기준의 placements에도 `s1`이 없고 다른 대상자 배치는 그대로. `removeCriterion`은 `placements`에서 해당 기준 키가 사라짐.
  - `rename keeps id and placements`: 이름 변경 후 `computeResults`의 해당 row `subjectId`/`total`이 그대로이고 `name`만 바뀜.
  - `moveCriterion`: `[c1,c2,c3]`에서 `("c2",-1)`→`[c2,c1,c3]`; `("c1",-1)`→변경 없음; `("c3",1)`→변경 없음.
  - `setPoints / setPlacement`: 값 설정, `null`로 제거(`"points" in criterion === false`, 배치 키 삭제).
  - `applyPreset`: `PRESETS`의 모든 항목에 대해 `validateData(applyPreset(p))`가 `[]`이고 `placements`가 `{}`; `sample`은 대상자 10개·기준 4개(이름이 `후보 1`~`후보 10`, `참신성`, `실현 가능성`, `시장성`, `완성도`), `empty`는 0/0.
  - `preset source is never mutated`: `deepFreeze`한 preset을 적용한 뒤 결과에 `addSubject`/`renameCriterion`을 해도 `PRESETS`가 `structuredClone`해 둔 원본과 deepEqual.

- [ ] **Step 2: 실패 확인.** Run: `npm test` — Expected: FAIL (모듈 없음).

- [ ] **Step 3: `web/js/presets.js`, `web/js/model.js` 구현.** 위 시그니처대로. 불변 갱신은 spread/`map`/`filter`로 한다.

- [ ] **Step 4: 통과 확인.** Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add web/js tests/model.test.js && git commit -m "feat: add model edit functions and presets"`

---

### Task 4: 저장소 래퍼 (store.js)

**Files:**
- Create: `web/js/store.js`, `tests/store.test.js`

**Interfaces:**
- Consumes: `emptyData`, `validateData` (core.js)
- Produces: `STORAGE_KEY = 'tier-eval-v1'`; `createStore(storage = globalThis.localStorage): { load(): Data, save(data: Data): boolean, clear(): void }`
  - `load`는 항목이 없거나, JSON이 깨졌거나, `validateData`가 오류를 내거나, `storage` 접근이 예외를 던지면 `emptyData()`를 돌려준다.
  - `save`는 성공이면 `true`, 저장 중 예외(용량 초과·사생활 보호 모드)면 `false`.

- [ ] **Step 1: 실패하는 테스트 작성 (`tests/store.test.js`).** `getItem/setItem/removeItem`만 가진 가짜 storage(객체 내부 `Map`)를 만든다.
  - `load on empty storage returns emptyData`.
  - `save then load round-trips`: `ranking-1-1-3` fixture 데이터가 deepEqual로 돌아오고 `save`가 `true`, 저장 키가 `tier-eval-v1`.
  - `corrupt JSON falls back to emptyData`: 값 `"{x"`.
  - `invalid data falls back to emptyData`: 값 `{"version":9,...}`.
  - `storage that throws on read falls back`: `getItem`이 예외 → `load()`가 `emptyData()`.
  - `save returns false when setItem throws`.
  - `clear removes the key`.

- [ ] **Step 2: 실패 확인.** Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: `web/js/store.js` 구현.** 위 시그니처대로 (`storage`가 `undefined`여도 `load`는 `emptyData()`, `save`는 `false`).

- [ ] **Step 4: 통과 확인.** Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add web/js/store.js tests/store.test.js && git commit -m "feat: add localStorage store"`

---

### Task 5: 공용 UI와 설정 페이지

**Files:**
- Create: `web/index.html`, `web/settings.html`, `web/style.css`, `web/js/ui-common.js`, `web/js/settings.js`

**Interfaces:**
- Consumes: core.js (`TIERS`, `TIER_POINTS`, `validatePoints`, `validateData`, `parseImportJson`, `exportJson`, `parseNames`, `emptyData`), model.js 전체, presets.js `PRESETS`, store.js `createStore`
- Produces (`ui-common.js`):
  - `el(tag: string, props?: object, ...children: (Node|string)[]): HTMLElement` — 문자열 자식은 텍스트 노드로 추가(`innerHTML` 사용 금지), `props`의 `on*`은 이벤트 핸들러, `class`/`value`/`type`/`href` 등은 속성
  - `renderNav(active: 'settings'|'evaluate'|'result'): HTMLElement` — 설정·평가·결과 링크 3개
  - `createApp(render: (data: Data, commit: (next: Data) => void) => void): void` — `store.load()`로 시작, `commit`은 `store.save`를 호출하고(실패하면 화면 상단에 `role="alert"`로 "저장에 실패했습니다. JSON 내보내기로 백업하세요" 표시) 다시 `render`를 호출

- [ ] **Step 1: `web/index.html`** — `settings.html`로 이동(`<meta http-equiv="refresh" content="0; url=settings.html">` + 링크). **`web/style.css`** — 다크 배경, 티어 라벨 색(`.tier-S` 등 Global Constraints 색), 칩, 행, 탭, `.over`(드롭 대상 강조), 오류(`[role=alert]`) 스타일.

- [ ] **Step 2: `web/js/ui-common.js` 구현.** 위 시그니처대로.

- [ ] **Step 3: `web/settings.html` + `web/js/settings.js` 구현.** `<script type="module" src="js/settings.js">`. 화면 요소와 동작:
  - **Preset**: `<select>`(PRESETS 이름) + "불러오기" 버튼. 현재 대상자·기준·배치가 하나라도 있으면 `confirm("현재 데이터를 교체하고 배치를 초기화합니다. 계속할까요?")`; 확인하면 `commit(applyPreset(preset))`.
  - **대상자**: 각 항목은 이름 `<input>`(change 시 `renameSubject`)과 삭제 버튼(`confirm` 후 `removeSubject`). 추가 영역은 `<textarea>`(줄바꿈·쉼표 구분 일괄 입력)와 "추가" 버튼(`addSubjects(data, parseNames(text))`) — 한 건씩 넣어도 된다.
  - **기준**: 대상자와 같은 이름 수정/삭제/일괄 추가에 더해 위·아래 이동 버튼(`moveCriterion`), 그리고 기준별 점수 입력: 숫자 `<input type="number" min="0" step="any">` 4개(S/A/B/C, 비어 있으면 기본 점수표를 placeholder로 표시) + "점수 적용" 버튼 + "기본으로" 버튼. 적용 규칙: 4칸 모두 비면 `setPoints(..., null)`; 일부만 채우면 오류 "S/A/B/C를 모두 입력하거나 모두 비워 주세요"; 모두 채웠으면 `validatePoints`가 오류를 내면 그 메시지를 `role="alert"` 영역에 표시하고 저장하지 않음, 통과하면 `setPoints`. "기본으로"는 `setPoints(..., null)`.
  - **JSON**: "내보내기" — `exportJson(data)`를 `Blob` + `a[download="tier-eval.json"]`로 다운로드. "가져오기" — `<input type="file" accept="application/json">`로 텍스트를 읽어 `parseImportJson`; `errors`가 있으면 그 목록을 전부 `role="alert"` 영역에 표시하고 데이터는 그대로; 통과하면 `confirm("현재 데이터를 교체합니다. 계속할까요?")` 후 `commit(data)`.
  - **초기화**: 버튼 → `confirm` 후 `commit(emptyData())`.
  - 페이지 상단에 `renderNav('settings')`.

- [ ] **Step 4: 수동 확인.** Run: `python3 -m http.server -d web 8000` 후 브라우저(웹 확인은 `/browse` 사용)로 `http://localhost:8000/`을 연다. Expected:
  - 루트가 설정 페이지로 이동한다.
  - preset `샘플`을 불러오면 대상자 10개·기준 4개가 보이고, 새로고침해도 유지된다.
  - 기준 하나에 점수 `S=10,A=5,B=2,C=0`을 적용하면 저장되고 새로고침 후에도 입력칸에 값이 보인다. `S=1,A=1,B=0,C=0`은 오류 메시지가 뜨고 저장되지 않는다. 4칸을 비우고 적용하거나 "기본으로"를 누르면 기본 점수표로 돌아간다.
  - 대상자를 `<img src=x onerror=alert(1)>`로 추가하면 alert 없이 글자 그대로 보인다.
  - 내보내기 파일을 열어 이름 하나를 직접 고친 뒤 가져오면 반영된다. `{broken`을 담은 파일은 오류 메시지가 뜨고 기존 데이터는 그대로다.
  - 브라우저 개발자 도구에서 `localStorage["tier-eval-v1"]`을 `{x`로 바꿔 새로고침해도 빈 상태로 열린다.

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat: add settings page and shared UI"`

---

### Task 6: 평가 페이지

**Files:**
- Create: `web/evaluate.html`, `web/js/evaluate.js`
- Modify: `web/style.css` (필요 시)

**Interfaces:**
- Consumes: `createApp`, `el`, `renderNav` (ui-common.js), `TIERS`, `progress` (core.js), `setPlacement` (model.js)

- [ ] **Step 1: `web/evaluate.html` + `web/js/evaluate.js` 구현.** `createApp`의 `render`로 구성:
  - 상단 `renderNav('evaluate')`.
  - 대상자 또는 기준이 0개면 본문 대신 "설정 페이지에서 대상자와 기준을 먼저 입력하세요" 안내와 설정 링크만 표시 (크래시 금지).
  - 선택된 기준 id는 모듈 변수로 보관(없거나 삭제됐으면 첫 기준). 기준별 탭 버튼, 선택 탭 강조.
  - 진행률 `placed/total` 표시(`progress`).
  - S/A/B/C 네 행: 왼쪽 티어 라벨(`.tier-X` 색), 오른쪽 드롭 영역. 그 아래 미배치 풀 드롭 영역.
  - 칩 = 대상자 이름(`textContent`). `draggable=true`, `dragstart`에서 `dataTransfer.setData('text/plain', subjectId)`. 배치된 칩에는 `×` 버튼(클릭 시 `setPlacement(..., null)`).
  - 드롭 영역: `dragover`에서 `preventDefault()` + `.over` 클래스, `dragleave`에서 제거, `drop`에서 `subjectId`를 읽어 존재하는 대상자일 때만 `setPlacement(data, criterionId, subjectId, tier)` (풀이면 `null`) 후 `commit`.
  - 같은 이름의 대상자도 id로 구분되어 칩이 각각 따로 움직인다.

- [ ] **Step 2: 수동 확인.** 서버를 띄운 상태에서 설정 페이지로 샘플 preset을 불러온 뒤 `http://localhost:8000/evaluate.html`. Expected:
  - 빈 데이터(설정 초기화 후)에서는 안내 문구만 나오고 콘솔 오류가 없다.
  - 칩을 S 행으로 끌어다 놓으면 이동하고 진행률이 `1/10`으로 오른다. `×`로 풀로 돌아가고 풀로 끌어도 돌아간다.
  - 기준 탭을 바꾸면 배치가 기준별로 따로 보인다. 새로고침해도 배치가 유지된다.
  - 같은 이름 대상자 둘을 추가해도 각각 따로 움직이고, 이름에 `<b>x</b>`를 넣어도 태그가 아니라 글자로 보인다.

- [ ] **Step 3: Commit** — `git add web && git commit -m "feat: add evaluate page with drag and drop"`

---

### Task 7: 결과 페이지

**Files:**
- Create: `web/result.html`, `web/js/result.js`

**Interfaces:**
- Consumes: `createApp`, `el`, `renderNav`, `computeResults` (core.js)

- [ ] **Step 1: `web/result.html` + `web/js/result.js` 구현.** `computeResults(data)`의 `status`별로:
  - `empty`: "대상자와 기준을 먼저 입력하세요" + 설정 링크.
  - `locked`: "미배치 N건이 남아 있어 결과를 볼 수 없습니다" + 평가 페이지 링크 (표는 그리지 않음).
  - `ready`: 표 — 열은 순위, 대상자, 기준별 티어(기준 이름을 열 머리글로, 티어 칸에 `.tier-X` 색), 총점, S 개수. 공동 순위는 같은 숫자를 그대로 표시(`1, 1, 3`). 총점은 소수 6자리 이하로 불필요한 0 없이 표시(`Number` → 문자열).
  - 상단 `renderNav('result')`.

- [ ] **Step 2: 수동 확인.** Expected:
  - 빈 데이터에서 안내만 보이고 오류가 없다.
  - 샘플 preset에서 일부만 배치하면 "미배치 N건"의 N이 실제 남은 칸 수와 같고, 평가 링크가 동작한다.
  - 모두 배치하면 표가 나온다. 총점 같고 S 개수가 많은 대상자가 앞에 오며, 총점·S 개수가 모두 같으면 같은 순위 숫자가 보이고 그 다음 순위는 건너뛴다(1, 1, 3).
  - 기준에 소수 점수표(`S=0.3,A=0.2,B=0.1,C=0`)를 설정해 총점이 같아야 하는 두 대상자가 같은 총점으로 표시된다.
  - 기준별 점수표를 바꾸면 결과 총점이 바로 그에 맞게 바뀐다.

- [ ] **Step 3: Commit** — `git add web && git commit -m "feat: add result page"`

---

### Task 8: 배포 설정과 완료 기준 확인

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

- [ ] **Step 1: `.github/workflows/pages.yml` 작성.** `main` 푸시와 수동 실행(`workflow_dispatch`)에서 동작. 권한 `contents: read`, `pages: write`, `id-token: write`. 한 job 안에서: `actions/checkout@v4` → `actions/setup-node@v4`(node 22) → `npm test` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3`(`path: web`) → `actions/deploy-pages@v4`(environment `github-pages`). 테스트가 실패하면 배포하지 않는다.

- [ ] **Step 2: `README.md`에 실행 방법 추가.** 한국어로: 서비스 한 줄 설명, 로컬 확인 `python3 -m http.server -d web 8000`, 테스트 `npm test`, 문서 링크(`docs/PRD.md`, `docs/TECH.md`, `docs/next-features/README.md`). 기존 `# SABC` 제목은 유지.

- [ ] **Step 3: 전체 테스트.** Run: `npm test` — Expected: 모든 테스트 PASS, 실패 0.

- [ ] **Step 4: PRD §3 "완료 기준" 확인 (로컬).** 서버를 띄우고 하나씩 확인하여 결과를 기록한다:
  - 샘플 preset을 불러와 전부 배치하고 순위를 본다. 대상자 20개 × 기준 6개를 설정 페이지 일괄 추가로 만들어 평가·결과가 불편 없이 동작한다.
  - preset을 불러온 뒤 대상자·기준을 추가/삭제/수정해도 정상이고, 빈 구성에서 직접 입력해도 같은 흐름이 동작한다.
  - 새로고침·브라우저 재시작 후에도 배치가 유지된다.
  - 기준별 다른 점수표가 결과에 반영되고, 순서가 어긋난 점수표는 저장되지 않는다.
  - 내보낸 JSON을 가져오면 같은 결과가 나오고(점수표 포함), 직접 고친 JSON도 가져와지며, 잘못된 JSON은 기존 데이터를 건드리지 않고 오류를 보여준다.

- [ ] **Step 5: 배포 URL 확인은 사용자 몫으로 남긴다.** 원격 푸시와 GitHub Pages 설정(저장소 Settings → Pages → Source: GitHub Actions)은 외부에 공개되는 동작이므로 사용자가 허락한 뒤에만 진행한다. 푸시 후 `https://heesung6701.github.io/SABC/`에서 Step 4를 한 번 더 확인한다.

- [ ] **Step 6: Commit** — `git add .github README.md && git commit -m "ci: deploy web to GitHub Pages"`
