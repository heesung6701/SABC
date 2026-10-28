# Next Features (M1 이후)

M1([PRD](../PRD.md), [TECH](../TECH.md))이 끝난 뒤에 진행하는 feature들이다. feature마다 문서 하나에 **문제, 목표/비목표, 요구사항, 완료 기준, 기술 방식, 테스트, 열린 질문**을 정의한다.

## 진행 규칙
- **선행 feature가 끝나야 시작한다.** 선행이 없는 feature는 M1만 끝나면 시작할 수 있다.
- 시작 전에 해당 feature의 "문제"가 M1을 써보면서 실제로 불편했던 것인지 확인한다. 아니면 순서를 바꾼다.
- 완료 기준으로 문제가 풀렸는지 확인한 뒤에 다음 feature로 넘어간다. 한 번에 여러 feature를 섞지 않는다.
- feature가 데이터 필드를 추가해도 이전에 저장한 데이터가 그대로 열려야 한다.

## feature 목록

| feature | 단계 | 선행 | 한 줄 문제 |
|---|---|---|---|
| [tier-rubric](tier-rubric.md) | 정적 웹 | M1 | 티어가 뜻하는 바를 적어둘 곳이 없어 판단이 흔들린다 |
| [tier-adjustment](tier-adjustment.md) | 정적 웹 | M1 | 같은 티어 안의 우열을 반영 못 해 동점이 많다 |
| [server-multi-evaluator](server-multi-evaluator.md) | DB 연동 웹 | M1 (이미 만든 정적 웹 feature가 있으면 그 필드도 서버에 반영) | 한 사람 의견만 반영되고 데이터가 브라우저에 갇혀 있다 |
| [admin-evaluator-split](admin-evaluator-split.md) | DB 연동 웹 | server-multi-evaluator | 설정을 누구나 수정할 수 있다 |
| [android-app](android-app.md) | Android | server-multi-evaluator (권장: admin-evaluator-split) | 현장에서 휴대기기로 평가하기 어렵다 |
| [multiplatform-review](multiplatform-review.md) | 검토 | android-app | 웹·Android 규칙이 두 번 구현되고 iOS는 지원이 없다 |

## 선행 관계

```
M1 ─┬─ tier-rubric
    ├─ tier-adjustment
    └─ server-multi-evaluator ─┬─ admin-evaluator-split
                               └─ android-app ─ multiplatform-review
```

- `tier-rubric`, `tier-adjustment`은 서로 독립이라 M1 이후 어떤 순서로든 가능하다. (기준별 티어 점수는 M1에 포함됐다.)
- 서버 쪽(`server-multi-evaluator`) 이전에 정적 웹 feature를 몇 개 끝낼지는 M1 결과를 보고 정한다. 이미 끝낸 feature의 필드는 서버 스키마와 가져오기에 포함해야 한다.
- `android-app`은 서버를 쓰므로 `server-multi-evaluator`가 필수다. 앱에서 관리자 권한을 다루려면 `admin-evaluator-split`이 먼저 있는 게 좋다.

## 공통 열린 질문
- Vercel의 역할 (호스팅 이전 vs 서버리스 함수) → [server-multi-evaluator](server-multi-evaluator.md)
