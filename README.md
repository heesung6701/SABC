# SABC

대상자와 평가 기준을 입력하고, 기준별로 S/A/B/C 티어를 드래그로 매겨 점수·순위를 내는 웹 서비스.
Compose Multiplatform(Kotlin/Wasm)으로 만든다.

## 실행

```sh
./gradlew wasmJsBrowserDevelopmentRun   # 개발 서버 (브라우저가 열린다)
./gradlew jvmTest                       # 점수·순위·검증·저장소 테스트
./gradlew wasmJsBrowserDistribution     # 배포 파일: build/dist/wasmJs/productionExecutable
```

JDK 17 이상이 필요하다. WebAssembly GC를 지원하는 최신 브라우저(Chrome·Edge 119+, Firefox 120+, Safari 18.2+)에서 동작한다.

## 구조

- `src/commonMain` — 점수·순위·검증·CSV/JSON·저장소 (순수 Kotlin, 플랫폼 무관)
- `src/wasmJsMain` — Compose UI와 브라우저 연동(localStorage, 파일, confirm)
- `src/jvmTest` — 공용 로직 테스트. `tests/fixtures/scoring.json`을 읽는다

## 문서

- [PRD](docs/PRD.md) — 무엇을, 왜
- [TECH](docs/TECH.md) — 기술 방식
- [Next features](docs/next-features/README.md) — M1 이후 계획
