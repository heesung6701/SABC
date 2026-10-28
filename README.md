# SABC

대상자와 평가 기준을 입력하고, 기준별로 S/A/B/C 티어를 드래그로 매겨 점수·순위를 내는 정적 웹 서비스.

## 실행

```sh
python3 -m http.server -d web 8000   # http://localhost:8000
npm test                             # 점수·순위·검증·저장소 테스트
```

모듈 스크립트는 `file://`에서 동작하지 않으므로 로컬 서버로 열어야 한다.

## 문서

- [PRD](docs/PRD.md) — 무엇을, 왜
- [TECH](docs/TECH.md) — 기술 방식
- [Next features](docs/next-features/README.md) — M1 이후 계획
