# NEXT AGENT

## Current Milestone
Phases 0 through 4 (COMPLETE & VERIFIED) — Project Ready for Demonstration

## Roadmap Progress
- Phase 0: Baseline safety, Git, Alembic, test isolation (COMPLETE)
- Phase 1: Shared Business Profile & Unified Project Workspace (COMPLETE)
- Phase 2: Save Draft & Version History + Department Query & Clarification Centre (COMPLETE)
- Phase 3: Pre-Submission Readiness Check + Unified Notifications (COMPLETE)
- Phase 4: Government Scheme Eligibility Assistant + Regulatory Change Impact Radar (COMPLETE)

## Status
**Current Test Baseline: 220/220 TESTS PASSING (100% GREEN, ZERO REGRESSIONS).**  
**Frontend Build: 24/24 ROUTES COMPILED CLEANLY WITH EXIT CODE 0 (`npm run build`).**  
**Frontend Lint: 0 ERRORS (`npm run lint`).**  
**Alembic Migrations: Tested bi-directionally on disposable database (b1e354a991f2 <-> c2d4918e77a1 <-> e4f5a6b7c8d9).**  
**Database: `backend/rop.db` and backup untouched, read-only integrity intact.**

---

## What Was Completed in Phase 3 & Phase 4:

### 1. Feature A — Pre-Submission Readiness Check
- **Domain & Service**: `ReadinessService` (`backend/app/readiness/`) dynamically evaluates profile completeness, approval-step document mandates, unresolved department queries, and inspection reports into `BLOCKER`, `WARNING`, and `INFO` items.
- **Blocker Enforcement**: `submit_application` checks blockers before submission, preventing premature submissions with HTTP 400 when configured blockers exist while allowing clean submissions.
- **REST API**: `GET /api/workflow/applications/{id}/readiness`.
- **Frontend UI**:
  - Interactive header pill: `{readiness.readiness_score_pct}% Ready • {readiness.blocker_count} Blockers` in `applicant/workflow/[id]/page.tsx`.
  - Detailed Readiness Assessment Drawer Modal displaying score meter, categorized severity cards, action guidance, and direct jump buttons to relevant workflow tabs or project profile.
  - Submit button validates readiness blockers and opens the assessment drawer if blocked.

### 2. Feature B — Unified Notifications & Deadline Centre
- **Domain Model**: `Notification` model with user association, event type, severity (`INFO`, `WARNING`, `URGENT`, `SUCCESS`), idempotency key, entity linking, and read status timestamps.
- **Service & Events**: `NotificationService` (`backend/app/notification/`) with deduplication idempotency. Integrated notification triggers on application submission and query status changes.
- **REST APIs**: `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`.
- **Frontend UI**: Interactive Notification Bell flyout in `ApplicantLayout.tsx` with dynamic unread count pill, severity styles, mark-all-read action, individual mark-read handling, and navigation redirection.

### 3. Feature C — Government Scheme & Incentive Eligibility Assistant
- **Engine Enhancement**: Enhanced Scheme Engine (`backend/app/schemes/`) with transparent criteria breakdown (`matched`, `failed`, `unknown`), eligibility buckets (`POTENTIALLY_ELIGIBLE`, `NOT_MATCHED`, `NEEDS_MORE_INFO`), missing evidence requirements, and suggested next steps based on Maharashtra Package Scheme of Incentives (PSI 2019).
- **Interactive Scenarios**: `POST /api/business/{id}/schemes/interactive-assessment` overlays temporary questionnaire answers (solar capacity, ZLD, promoter category, MSME scale) in-memory without mutating verified database records.
- **REST APIs**: `GET /api/business/{id}/schemes`, `GET /api/projects/{id}/schemes`, `POST /api/business/{id}/schemes/interactive-assessment`.
- **Frontend UI**: Section 3 in `applicant/project/page.tsx` with scenario modeler controls, total potential benefit counter, filter tabs, criteria breakdowns (checkmarks/crosses/questions), required documents, and prominent statutory disclaimers.

### 4. Feature D — Regulatory Change Impact Radar
- **Domain Models**: `RegulatorySource`, `RegulatoryChangeRecord`, and `ProjectImpactAssessment` in `backend/app/models/radar.py`.
- **Radar Service**: `RadarService` (`backend/app/radar/`) maintaining source registry (MPCB, DISH, MIDC), change records, deterministic project profile condition matching (`POTENTIALLY_AFFECTED`, `NEEDS_REVIEW`, `NO_MATCH`), and officer review workflow with mandatory audit notes.
- **REST APIs**: `GET/POST /api/radar/sources`, `GET/POST /api/radar/changes`, `GET /api/radar/projects/{id}/impacts`, `POST /api/radar/impacts/{id}/review`.
- **Frontend UI**: Section 4 in `applicant/project/page.tsx` with impact counters, filter tabs, matching explanation cards, recommended operational actions, and officer review tracking.

---

## Test & Build Verification Baseline

### Backend Tests (220/220 passing):
```powershell
cd e:\26130\backend
.\venv\Scripts\python.exe -m pytest -v
```
Result: `220 passed, 3106 warnings in 89.70s (100% green)`.  
Phase 3 & 4 tests (`tests/test_phase3_phase4.py`): 10/10 passed in 5.57s.

### Frontend Production Build:
```powershell
cd e:\26130\frontend
npm run lint
npm run build
```
Result: `npm run lint` exit code 0. `npm run build` compiled 24/24 routes cleanly with exit code 0.

---

## Important Rules for Future Work
- Do NOT run destructive migrations or delete `backend/rop.db`.
- Do NOT commit automatically without explicit user review.
- All regulatory data and incentive calculations must retain visible DEMO status badges.
- Government APIs remain mock with MockAdapter.
