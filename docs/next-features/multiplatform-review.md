# Feature: 멀티플랫폼 전환 검토 (multiplatform-review)

**단계**: 검토 (개발 feature 아님) · **선행**: [android-app](android-app.md)

## 문제
웹(JS)과 Android(Kotlin)를 따로 유지하면 점수·순위 규칙이 두 번 구현되고, iOS 사용자는 앱으로 평가할 수 없다.

## 목표 / 비목표
- 목표: 공용 코드(예: Compose Multiplatform)로 전환할지, iOS를 어떻게 지원할지 근거 있게 결정.
- 비목표: 이 feature 안에서 전환 개발을 하는 것. 전환이 결정되면 별도 feature로 쪼갠다.

## 요구사항
- 판단 근거를 모은다: 웹·Android에서 규칙이 어긋난 사례, 두 구현의 유지 부담, iOS 요구 여부.
- 선택지별 장단점과 범위를 비교한다.

## 검토 대상 (기술)
- 후보 A: 현 구조 유지 (웹 JS + Android 네이티브, 계산은 서버로 통일). iOS는 별도 판단.
- 후보 B: Kotlin Multiplatform으로 계산·데이터 계층만 공용화하고 UI는 플랫폼별 유지.
- 후보 C: Compose Multiplatform으로 UI까지 공용화 (웹 Wasm 포함 여부 별도 판단).
- 판단 기준: 규칙이 어긋난 사례 수, 두 구현의 유지 시간, iOS 요구 여부, 웹 로딩 성능 요구, 이 시점의 Compose Multiplatform 웹·iOS 지원 상태(착수 시 확인).

## 완료 기준
전환 여부와 범위(iOS 포함 여부)가 근거와 함께 결정되어 결정 기록으로 남는다.
