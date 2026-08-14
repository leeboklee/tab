# ESLint 초기 설정 제안

> **상태:** 제안만 (미적용). 기존 코드 대량 수정·강제 린트 통과는 하지 않음.

## 현황

- `package.json`에 `eslint`, `eslint-config-next` devDependency 존재
- `.eslintrc*` / `eslint.config.*` 없음
- `npm run lint` → Next.js 대화형 초기화 프롬프트 (비대화형 CI/Cloud Agent에서 스킵)

## 권장 절차 (로컬 1회)

```bash
cd tab
npm install

# 대화형 — Strict 권장
npm run lint
# → "Strict (recommended)" 선택 시 .eslintrc.json 자동 생성
```

생성 예시 (Strict):

```json
{
  "extends": "next/core-web-vitals"
}
```

## 점진 적용 전략

1. **1단계:** `.eslintrc.json`만 추가, `npm run lint`를 `npm run check`에 넣지 않음
2. **2단계:** 신규/수정 파일만 `next lint --file <path>`로 검사
3. **3단계:** 경고 0 달성 후 `check` 스크립트에 `npm run lint` 병합

## CI/Cloud Agent 주의

- `next lint`는 설정 파일 없으면 stdin 프롬프트 → **비대화형 실패**
- CI에서는 반드시 `.eslintrc.json` 커밋 후 `npm run lint` 실행

## 하지 않을 것

- 전체 코드베이스 일괄 `eslint --fix` (의도치 않은 대규모 diff)
- `eslint-config-next` 메이저 업그레이드와 동시 진행
- 린트 오류를 무시하는 `eslint-disable` 대량 추가

## 참고

- [Next.js ESLint](https://nextjs.org/docs/basic-features/eslint)
- 핸드오프: [`analysis-cache-handoff.md`](./analysis-cache-handoff.md)
