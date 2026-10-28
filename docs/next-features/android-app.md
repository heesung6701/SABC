# Feature: Android 앱 (android-app)

**단계**: Android · **선행**: [server-multi-evaluator](server-multi-evaluator.md) (필수) · [admin-evaluator-split](admin-evaluator-split.md) (권장)

## 문제
평가 자리(현장)에서 휴대기기로 쓰기 어렵다. 드래그는 모바일 화면에 맞지 않을 수 있다.

## 목표 / 비목표
- 목표: Android 기기에서 로그인해 평가하고 결과를 본다.
- 비목표 *(제안)*: 설정 편집(관리 기능)은 웹에서만, iOS, 오프라인 평가.

## 요구사항
- 로그인, 평가 선택, 기준별 티어 배치, 결과 확인.
- 모바일 배치 방식: 드래그 대신 탭으로 티어를 선택하는 방식을 우선 검토. 이미 끝낸 feature(루브릭 확인, 보정 등)도 모바일에서 쓸 수 있어야 한다.
- 웹과 같은 계정·데이터를 쓰며, 같은 입력에서 같은 순위가 나와야 한다.

## 완료 기준
- Android 기기에서 평가 한 건을 끝까지 수행한다.
- 같은 데이터에서 웹과 앱의 순위가 일치한다.

## 기술 방식
- Kotlin + Jetpack Compose 네이티브 *(기획자 가정: 작성자가 Compose 주력 개발자)*.
- 서버: server-multi-evaluator의 Supabase를 그대로 사용 (Supabase Kotlin 클라이언트 또는 REST).
- 계산: 점수·순위·잠금을 Kotlin으로 다시 구현하되, 같은 `tests/fixtures/scoring.json`으로 검증한다. 순위를 서버로 옮겼다면 앱은 계산을 하지 않는다.
- 배치 UI: 칩을 누르면 티어 선택 시트가 뜨는 방식을 우선 검토.

## 테스트
- 공용 fixtures 통과.
- 웹과 같은 계정·데이터로 결과 화면의 순위가 일치한다.

## 기획자 판단 / 열린 질문
- 관리 기능을 앱에 넣지 않는다.
- 오프라인에서는 사용하지 않는다 (네트워크 필요).
- 규칙을 두 곳(웹 JS, 앱 Kotlin)에서 유지하는 부담이 처음 실제로 생긴다 → [multiplatform-review](multiplatform-review.md)의 근거 자료로 기록한다.
