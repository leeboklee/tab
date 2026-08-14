# 분석 캐시·병목 개선 — 핸드오ff

> 플레이북: [`codex-cursor-handoff-playbook.md`](/mnt/c/Users/hapsl/Downloads/codex-cursor-handoff-playbook.md) (WSL)  
> Codex `019ec179` → Cursor 마무리 · **개발 큐 종료 (2026-06-14)**

---

## Codex 세션

| 항목 | 값 |
|------|-----|
| SESSION_ID | `019ec179-657e-7543-a815-a3f7252f1472` |
| jsonl | `~/.codex/sessions/2026/06/13/rollout-2026-06-13T23-53-39-019ec179-657e-7543-a815-a3f7252f1472.jsonl` |
| tmux | 세션 `2` / 윈도 `12` (tabe, usage_limited) |
| Goal | `이어서 문제 없이 마무리해 문서 정리하고` |
| 중단 원인 | usage_limited (요구 미완 아님) |
| codex resume | **불필요** — Cursor에서 완료 |

### Codex patch (14회)

- `python-backend/real_analysis_main.py` ×10
- `README.md` ×5
- `python-backend/requirements.txt` ×1

---

## 완료 (Cursor)

| # | 항목 | 상태 |
|---|------|------|
| 1 | Codex patch → 디스크 대조 | ✅ |
| 2 | TTL 캐시 + `/analysis-metrics` | ✅ |
| 3 | single-flight + inflight lock TTL | ✅ |
| 4 | `_run_cached_analysis` 리팩토링 | ✅ |
| 5 | `failed_stage` 에러 처리 + cloud `ApiResponse` 정규화 | ✅ |
| 6 | `app/lib/real-audio-api.ts` HTTP error body 파싱 | ✅ |
| 7 | `scripts/check-backend.sh`, `scripts/codex-handoff-audit.sh` | ✅ |
| 8 | `npm run check` (build + backend + smoke) | ✅ |

---

## 사용자만 (운영)

| # | 항목 | 상태 |
|---|------|------|
| 1 | `pip install -r requirements.txt` (venv) | 1회 (완료됨) |
| 2 | **git commit + push** | ✅ `feat/analysis-cache-inflight` + [PR #1](https://github.com/leeboklee/tab/pull/1) |
| 3 | `ANALYSIS_METRICS_LIMIT` 운영량 조정 | 선택 |
| 4 | `CLOUD_ANALYSIS_API_BASE` 클라우드 분석 | 선택 |

---

## 검증 명령

```bash
cd ~/projects/tabe

# Codex 세션 ↔ git 대조 (플레이북 §5)
npm run check:codex
# 또는: bash scripts/codex-handoff-audit.sh . 019ec179

# 백엔드 기동 (별 터미널)
npm run dev:backend

# 전체 검증 (플레이북 §15 — build + health + smoke)
npm run check
```

개별:

```bash
npm run build
npm run check:backend
npm run test:smoke:analysis
```

---

## 환경 변수 (신규)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ANALYSIS_RESULT_CACHE_TTL_SEC` | 3600 | 분석 결과 캐시 TTL |
| `ANALYSIS_RESULT_CACHE_MAXSIZE` | 256 | 캐시 최대 항목 |
| `ANALYSIS_METRICS_LIMIT` | 200 | 최근 요청 메트릭 |
| `ANALYSIS_INFLIGHT_LOCK_TTL_SEC` | 3600 | single-flight 잠금 TTL |
| `ANALYSIS_INFLIGHT_LOCK_MAXSIZE` | 512 | single-flight 최대 키 |

---

## 변경 파일 (커밋 대상)

- `python-backend/real_analysis_main.py`
- `python-backend/requirements.txt`
- `README.md`
- `app/lib/real-audio-api.ts`
- `package.json`
- `scripts/check-backend.sh`
- `scripts/codex-handoff-audit.sh`
- `docs/analysis-cache-handoff.md`

**제외:** `.antigravitycli/`, `.playwright-cli/`, `output/`, `추천-PC-구성안.md`

---

## 채팅 마무리 스냅샷 (플레이북 §15)

- **큐:** 없음 (단일 Codex goal 완료)
- **검증:** build / check:backend / smoke Pass
- **커밋/푸시:** `3c14196` → `origin/feat/analysis-cache-inflight` + PR #1; Cursor 보완 커밋 추가
- **handoff:** 본 문서
- **Cloud Agent:** https://cursor.com/agents/bc-dc3063f1-8cfa-4a45-a5ab-5016428bb516
- **백로그(큐 아님):** ESLint 초기 설정 프롬프트, cloud 분석 실서버 연동

### Cursor Agent 검증 (2026-08-13)

- `npm run build` — Pass
- `npm run check:backend` — Pass (cache + inflight locks in `/health`, `/analysis-metrics`)
- `npm run test:smoke:analysis` — Pass (1/2 URL; 2번째는 yt-dlp bot/cookies 이슈, 기존 한계)
- 캐시 hit 재요청 — `cached_age_sec` 확인 (~80ms)
- `npm run lint` — 스킵 (ESLint 미설정)
- cloud 실서버 — 스킵 (`CLOUD_ANALYSIS_API_BASE` 미설정)
- 보완: cloud 실패 시 `analysis-metrics` 기록, `.env.example` 캐시/cloud 변수

### Cursor Cloud 이어받기

- PR: https://github.com/leeboklee/tab/pull/1
- Agent: https://cursor.com/agents/bc-dc3063f1-8cfa-4a45-a5ab-5016428bb516
- 지시: PR 리뷰·안전 보완만, 머지 금지
