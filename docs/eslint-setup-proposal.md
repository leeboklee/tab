# ESLint 초기 설정 제안

> **상태:** 1단계 적용 (`.eslintrc.json`). 기존 코드 대량 수정·강제 린트 통과는 하지 않음.

## 현황

- `package.json`에 `eslint`, `eslint-config-next` devDependency 존재
- `.eslintrc.json` — `"extends": "next/core-web-vitals"`
- `next.config.js` — `eslint.ignoreDuringBuilds: true` (`npm run check`/`build`가 기존 린트 오류로 깨지지 않음)
- `npm run lint` — 비대화형 실행 가능. **`npm run check`에는 아직 넣지 않음**

## 권장 절차 (로컬 1회, 이미 적용됨)

```bash
cd tab
npm run lint
```

설정:

```json
{
  "extends": "next/core-web-vitals"
}
```

## 점진 적용 전략

1. **1단계:** `.eslintrc.json`만 추가, `npm run lint`를 `npm run check`에 넣지 않음 ← **현재**
2. **2단계:** 신규/수정 파일만 `next lint --file <path>`로 검사
3. **3단계:** 경고 0 달성 후 `check` 스크립트에 `npm run lint` 병합

## CI/Cloud Agent 주의

- 설정 파일 없으면 `next lint`가 stdin 프롬프트 → 비대화형 실패
- 지금은 `.eslintrc.json`이 있어 프롬프트 없이 돈다
- 빌드는 린트를 무시하므로 기존 경고로 막히지 않음

## 하지 않을 것

- 전체 코드베이스 일괄 `eslint --fix` (의도치 않은 대규모 diff)
- `eslint-config-next` 메이저 업그레이드와 동시 진행
- 린트 오류를 무시하는 `eslint-disable` 대량 추가

## 참고

- [Next.js ESLint](https://nextjs.org/docs/basic-features/eslint)
- 핸드오프: [`analysis-cache-handoff.md`](./analysis-cache-handoff.md)
