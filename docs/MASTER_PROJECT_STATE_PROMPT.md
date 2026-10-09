# PRAMAN / ROP — MASTER PROJECT STATE & HANDOFF PROMPT

> Purpose: give a fresh Antigravity/Codex agent enough verified context to continue this repository without relying on prior conversation.
>
> Repository inspected directly: `E:\26130`
>
> Inspection date: 2026-10-05
>
> This document is source-grounded. Claims labelled **verified** were checked against source, the checked-in SQLite database, an API smoke check, or a successful test/build command. Claims labelled **demo/mock/configuration-required** are intentional product semantics, not production guarantees.

## 1. Mission and product context

This is PRAMAN, internally named the Regulatory Orchestration Platform (ROP), for Smart India Hackathon 2026 Problem Statement 26130: streamlining industrial approvals, compliance processes, and access to government support services.

The prototype is intended to let an industrial applicant describe a business once, identify applicable approvals, explain why they apply, expose missing facts without guessing, create a dependency-aware approval workflow, monitor configured SLAs, surface deterministic escalations, manage documents, schedule joint inspections, discover schemes, track post-approval compliance, and provide officer/admin operational analytics.

This is an academic/demo prototype. It does not replace MAITRI, NSWS, or any official government portal; it does not submit real government applications; it does not provide legal advice; and its regulatory rules, SLAs, scheme amounts, departments, and statistics are synthetic unless explicitly marked VERIFIED with source metadata.

## 2. Evidence and current truth

### Directly verified during this inspection

- Backend source contains M0 through M10 modules and the full test suite contains 181 test functions.
- `E:\26130\backend\venv\Scripts\python.exe -m pytest tests -q --disable-warnings --tb=no` completed with **181 passed, 2245 warnings, 0 failures** in 83.09 seconds.
- `npm run build` in `frontend` completed successfully with Next.js 14.2.15; all eight application routes compiled and generated successfully.
- The checked-in SQLite database contains 3 users, 1 business, 1 regulatory profile, 1 application, 7 approval steps, 1 escalation, 2 documents, 1 joint inspection, 0 inspection reports, 9 compliance filings, and 11 audit log rows at inspection time. Counts are stateful and may change after a run.
- Demo logins using `applicant@demo.rop`, `officer@demo.rop`, and `admin@demo.rop` with password `Demo@12345` returned HTTP 200 through FastAPI TestClient.
- Authenticated API smoke checks returned populated applicant, officer, admin overview, admin bottleneck, M10 overview, department, and trend responses.
- The current frontend source is not the old Applicant placeholder shown in the prior screenshots: it loads businesses, applications, SLA, escalations, documents, inspections, and compliance data.

### Important qualification

Automated tests use an in-memory SQLite database and test fixtures; they prove backend behaviour, not that a browser is pointed at the intended backend or that every seeded value renders correctly in a live browser. The frontend intentionally catches several fetch failures and replaces them with empty/null state. Therefore an empty dashboard can be an integration/configuration failure even when the repository database and backend APIs are populated.

## 3. Architecture and runtime

The architecture is a laptop-first modular monolith:

```text
Next.js 14 + TypeScript + Tailwind (port 3000)
             REST/JSON + JWT
FastAPI (port 8000)
             SQLAlchemy ORM / Alembic
SQLite: backend/rop.db
```

No PostgreSQL, Redis, Celery, Kafka, Docker, GPU, or external LLM is required for the demo.

Backend stack from `backend/requirements.txt` includes FastAPI/Uvicorn, SQLAlchemy, Alembic, Pydantic settings, python-jose, passlib/bcrypt, PyYAML, python-multipart, and pytest-related packages. The project documents Python 3.12 as the standard runtime. `backend/.python-version` is `3.12` and `backend/venv` is a working Python 3.12 environment.

Frontend stack from `frontend/package.json`: Next 14.2.15, React 18, TypeScript 5, Tailwind 3.4, Axios, Lucide, Radix UI, class-variance-authority, clsx, and tailwind-merge.

Configuration:

- Backend defaults to `sqlite:///./rop.db`, `ENVIRONMENT=development`, `DEBUG=true`, JWT HS256, 480-minute access tokens, and demo password `Demo@12345`.
- Optional Gemini support is configured by `GEMINI_API_KEY`; the default demo path is offline.
- Frontend API base is `NEXT_PUBLIC_API_URL`, defaulting in code to `http://localhost:8000`.
- CORS in `backend/app/main.py` allows localhost and 127.0.0.1 on port 3000.
- Backend startup creates tables and, in development, runs idempotent demo seeding.

## 4. Repository map

```text
E:\26130
├── AGENTS.md                  permanent safety/data-status rules
├── README.md                  quick start, but milestone table is stale
├── PROJECT_STATUS.md          detailed M0–M10 claim/history; internally stale in places
├── NEXT_AGENT.md              final-polish handoff; some credentials/history are stale
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── DEMO_SCRIPT.md
│   ├── HUMAN_TODO.md
│   ├── LIMITATIONS.md
│   ├── PRIVACY.md
│   ├── PROGRESS.md
│   ├── RULE_AUTHORING.md
│   └── MASTER_PROJECT_STATE_PROMPT.md  this handoff
├── backend/
│   ├── app/
│   │   ├── api/               FastAPI routers
│   │   ├── models/            SQLAlchemy ORM models
│   │   ├── core/              JWT security, clock, audit
│   │   ├── regulatory/        YAML loader, rule engine, discovery
│   │   ├── ai/                provider architecture and intake
│   │   ├── workflow/          DAG and state machine
│   │   ├── sla/               SLA configuration/calculation
│   │   ├── escalation/        event generation and resolution
│   │   ├── document/          local vault and scrutiny
│   │   ├── risk/              deterministic risk engine
│   │   ├── inspection/        joint inspection scheduling/reporting
│   │   ├── schemes/           deterministic scheme eligibility
│   │   ├── compliance/        periodic filing calendar and verification
│   │   ├── analytics/         cross-milestone metrics and insights
│   │   ├── integration/       package placeholder only; no real gateway implementation found
│   │   ├── demo/              package marker only; no separate demo-control API found
│   │   ├── main.py
│   │   ├── seed.py
│   │   ├── database.py
│   │   └── config.py
│   ├── data/
│   │   ├── regulatory/scenario_c_rules.yaml
│   │   ├── sla/scenario_c_sla.yaml
│   │   ├── risk/scenario_c_risk.yaml
│   │   ├── schemes/scenario_c_schemes.yaml
│   │   └── compliance/scenario_c_compliance.yaml
│   ├── tests/                 181 tests
│   ├── uploads/documents/     local document vault; seeded PDFs exist
│   ├── rop.db                 checked-in demo SQLite state
│   ├── alembic.ini
│   ├── .env.example
│   ├── requirements.txt
│   └── .python-version
└── frontend/
    ├── src/app/
    │   ├── login/page.tsx
    │   ├── applicant/dashboard/page.tsx
    │   ├── applicant/discovery/[id]/page.tsx
    │   ├── applicant/workflow/[id]/page.tsx
    │   ├── officer/dashboard/page.tsx
    │   ├── admin/dashboard/page.tsx
    │   ├── page.tsx
    │   ├── layout.tsx
    │   └── globals.css
    ├── src/lib/api.ts       Axios API client and TypeScript response types
    ├── src/lib/auth.ts      localStorage JWT/session and role routing
    ├── src/components/      status badges and small UI components
    └── package.json
```

## 5. Data-status and safety contract

Follow `AGENTS.md`, `docs/LIMITATIONS.md`, `docs/ARCHITECTURE.md`, and `docs/RULE_AUTHORING.md`.

Allowed statuses:

- `VERIFIED`: official source metadata is present: URL, title, date, reviewer.
- `DEMO`: synthetic workflow demonstration data. This is the default in this repository.
- `MOCK`: simulated external/government response.
- `VERIFICATION_REQUIRED`: cannot safely determine from available facts.
- `CONFIGURATION_REQUIRED`: human must provide/configure the value.

Never turn synthetic rules, departments, timelines, subsidy amounts, or demo metrics into authoritative claims. Missing facts must remain unknown and result in `Verification Required`, not an invented answer. Analytics must return null/`NO DATA`/`INSUFFICIENT DATA` when facts are insufficient. Keep visible DEMO badges in the UI.

## 6. Backend capabilities, milestone by milestone

### M0 — foundation: implemented and tested

FastAPI application, SQLite WAL configuration, SQLAlchemy models, table creation, Alembic scaffolding, JWT login, bcrypt password hashes, user registration, `/api/auth/me`, role dependencies, `ClockService`, and immutable-style audit recording. Roles are `APPLICANT`, `OFFICER`, and `ADMIN`.

Relevant files: `backend/app/main.py`, `database.py`, `config.py`, `core/security.py`, `core/clock.py`, `core/audit.py`, `api/auth.py`, `api/deps.py`, `models/user.py`, `models/audit.py`.

### M1 — deterministic regulatory engine: implemented and tested

`backend/app/regulatory/loader.py` loads and validates YAML rules; `engine.py` evaluates atomic operators, nested dot-path fields, all/any/not combinators, and three-valued True/False/Unknown logic. Unknown facts produce `verification_required`. Rule output carries requirement ID/name, reason, category, rule ID, data status, metadata, prerequisites, and missing information. VERIFIED records are schema-checked for source metadata.

Scenario C has seven synthetic rules: siting, CTE pollution, hazardous waste, factory building plan, HT power, fire safety, and groundwater. They carry synthetic departments, estimated timelines, document lists, and prerequisite edges.

APIs: `GET /api/regulatory/rules`, `POST /api/regulatory/assess`.

### M2 — business profile and AI-assisted intake: implemented and tested

`Business` and `RegulatoryProfile` models support business creation and extracted/confirmed profile data. `AIService` has `CachedProvider` (offline Scenario C response), `RuleBasedFallbackProvider` (heuristic extraction without inventing facts), and optional `GeminiProvider` with fallback. Adaptive questions are generated from missing high-impact rule fields; “Not sure” remains unknown; confidence and provenance are retained.

APIs: `POST/GET /api/business`, `GET /api/business/{id}`, `POST /api/business/{id}/describe`, `POST /api/business/{id}/answer-questions`, `POST /api/business/{id}/confirm`.

### M3 — regulatory discovery and explainable checklist: implemented and tested

`RegulatoryDiscoveryService` normalizes M1 output into WHAT, WHY, profile facts used, missing fields, and safe NEXT ACTION guidance. It preserves category, provenance, rule ID, and data status. Discovery requires an authenticated owner and a confirmed profile.

API: `GET /api/business/{business_id}/regulatory-discovery`.

### M4 — approval DAG, critical path, workflow state machine: implemented and tested

`ApprovalDAG` performs cycle detection, topological sort, parallel wave grouping, and longest-duration critical path calculation. `WorkflowService` creates an application only from a confirmed discovery profile, persists `Application` and `ApprovalStep`, initializes READY/BLOCKED state, prevents transitions with unmet prerequisites, and unblocks dependants after approval. React Flow export is supported.

Application states: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`. Step states: `BLOCKED`, `READY`, `IN_PROGRESS`, `APPROVED`, `REJECTED`.

APIs: `POST/GET /api/workflow/applications`, `GET /api/workflow/applications/{id}`, `POST /api/workflow/applications/{id}/submit`, `POST /api/workflow/applications/{id}/steps/{step_id}/transition`, `GET /api/workflow/applications/{id}/graph`.

### M5 — SLA monitoring and deterministic escalation generation: implemented and tested

YAML SLA configuration is in `backend/data/sla/scenario_c_sla.yaml`. `SLAEngine` calculates real-time status through `ClockService`, including NOT_STARTED, ON_TRACK, WARNING, OVERDUE, PAUSED, COMPLETED, and missing-SLA verification-required states. Completion freezes timing; pause time is deducted. `EscalationEngine` is deterministic and idempotent. Missing recipients produce `ESCALATION_CONFIGURATION_REQUIRED`.

APIs: `GET /api/workflow/applications/{id}/sla`, `GET /api/workflow/applications/{id}/escalations`, `POST /api/workflow/applications/{id}/steps/{step_id}/pause`, `POST .../resume`.

The repository does not contain a completed real government integration gateway. `app/integration` is only a package marker, and official API information remains configuration-required. Treat the integration claims in older docs as intended architecture, not as a verified implementation.

### M6 — officer/admin escalation resolution dashboards: implemented and tested

Escalation events have a human workflow `TRIGGERED -> ACKNOWLEDGED -> RESOLVED`. Resolution requires a meaningful note and audit entries are created. Officer overview, escalation queue, acknowledgement, resolution, admin overview, bottleneck diagnostics, audit logs, user listing, and admin clock controls are implemented.

APIs: `GET /api/officer/overview`, `GET /api/officer/escalations`, `GET /api/officer/escalations/{id}`, `POST .../{id}/acknowledge`, `POST .../{id}/resolve`; `GET /api/admin/overview`, `GET /api/admin/bottlenecks`, `GET /api/admin/audit-logs`, `GET /api/admin/users`, `GET /api/admin/clock`, `POST /api/admin/clock/advance`, `POST /api/admin/clock/reset`.

### M7 — local document vault and officer scrutiny: implemented and tested

Documents are stored under `backend/uploads/documents/` with UUID storage names, SHA-256 checksums, path traversal defense, extension/size checks, version preservation, and current-version flags. Lifecycle is `UPLOADED -> UNDER_REVIEW -> ACCEPTED/REJECTED/QUERY_RAISED`. Rejection/query decisions require notes. Legal readiness is based on officer-accepted documents, not mere upload.

APIs: `GET/POST /api/workflow/applications/{id}/documents`, `POST .../documents/upload`, `GET /api/documents/{id}/download`, `GET /api/officer/documents/pending`, `POST /api/officer/documents/{id}/review`.

### M8 — deterministic risk and Central Joint Inspection System: implemented and tested

`RiskEngine` reads `scenario_c_risk.yaml`, evaluates sector/process/environment/power/worker/area factors, produces a 0–100 score and HIGH/MEDIUM/LOW classification, and surfaces missing critical fields without guessing. `JointInspection` supports one active inspection per application, scheduling/rescheduling with a justification, multi-department participating lists/checklists, officer reports, and workflow clearance after satisfactory findings.

APIs: `GET /api/workflow/applications/{id}/risk-assessment`, `GET .../inspections`, `POST .../inspections/schedule`, `POST .../inspections/{inspection_id}/reschedule`, `GET /api/officer/inspections`, `GET .../inspections/{id}`, `POST .../inspections/{id}/report`.

### M9 — schemes and post-approval compliance: implemented and tested

`SchemesEngine` evaluates six synthetic scheme definitions in `scenario_c_schemes.yaml` into ELIGIBLE, POTENTIALLY_ELIGIBLE, or NOT_ELIGIBLE with matched/unmet conditions, missing-field hints, required documents, and synthetic financial amounts. `ComplianceService` reads six compliance templates from `scenario_c_compliance.yaml` and projects a 12-month calendar with monthly, quarterly, half-yearly, annual, and biennial frequencies. Filing status is dynamic relative to `ClockService`: UPCOMING, DUE_SOON, OVERDUE, SUBMITTED, VERIFIED, REJECTED; penalty risk and officer notes are supported.

APIs: `GET /api/business/{business_id}/schemes`, `GET /api/workflow/applications/{id}/compliance-calendar`, `POST /api/workflow/applications/{id}/compliance-filings/{filing_id}/submit`, `GET /api/officer/compliance-filings`, `POST /api/officer/compliance-filings/{filing_id}/verify`.

### M10 — analytics and executive insights: implemented and tested

`AnalyticsService` aggregates actual SQLite state across applications, steps, SLA calculations, escalations, documents, inspections, and compliance filings. It intentionally avoids fabricated averages and returns null/insufficient-data states where historical data is inadequate. It produces executive KPIs, prioritized deterministic insights, SLA health distribution, document health, inspection health, compliance health, department performance, and month trends.

Admin-only APIs: `GET /api/admin/analytics/overview`, `GET /api/admin/analytics/departments`, `GET /api/admin/analytics/bottlenecks` if routed through the analytics router, and `GET /api/admin/analytics/trends`.

## 7. Database model and current seeded state

SQLAlchemy models are in `backend/app/models/`:

- `User`: email, full name, bcrypt hash, role, active flag, timestamps.
- `AuditLog`: actor identity, action, entity, before/after, reason, extra metadata, source, IP, timestamp.
- `Business`: applicant-owned business name/description.
- `RegulatoryProfile`: extracted data, confirmed data, confirmation flag, provenance-related profile state.
- `Application`: business/applicant, title, lifecycle status, total timeline, critical path, submitted/completed timestamps.
- `ApprovalStep`: requirement, department, timeline, status, data status, prerequisites, critical-path flag, timing/pause fields, notes.
- `EscalationEvent`: application/step/SLA, level, recipient, overdue days, status, acknowledge/resolve actors/times, notes.
- `Document`: business/application/step linkage, requirement, original filename, UUID storage path, MIME/size/checksum, version/current flag, scrutiny state, review metadata.
- `JointInspection`: application/business, scheduled slot, state, risk, lead inspector, departments, checklist, notes, data status.
- `InspectionReport`: inspection outcome, department findings, deficiencies, corrective action, reinspection and deadline.
- `ComplianceFiling`: application, compliance ID/title/department/frequency/period/due date, status, penalty risk, submission data/document, officer verification metadata.

Current checked-in demo scenario is Scenario C: Apex Precision Automotive Components Pvt Ltd in Chakan MIDC/Pune, manufacturing with electroplating, metal fabrication, effluent, air emissions, hazardous waste, borewell, 45 workers, 350 kW power, and 3500 sqm built-up area. It has a confirmed profile and one in-review application with seven approval steps. Siting is IN_PROGRESS and overdue; the other steps are blocked by prerequisites. The critical path is siting -> CTE -> hazardous waste, with a stored total timeline of 96 days.

Seeded operational records include one TRIGGERED Level 1 siting escalation, one UNDER_REVIEW site layout PDF, one ACCEPTED land allotment PDF, one HIGH-risk scheduled joint inspection, and nine projected compliance filings. No inspection report is currently stored.

`seed_demo_scenario` is idempotent but returns early if the demo business already has an application. It will not repair or refresh a partially stale existing demo scenario. This is a likely source of demo-state drift and should be addressed only deliberately, with a recoverable/resettable demo mechanism.

## 8. Frontend truth

Routes compiled successfully:

- `/login`: demo-fill login UI and JWT/session persistence.
- `/applicant/dashboard`: applicant command center; loads businesses, applications, primary-application SLA, escalation, document, inspection, and compliance telemetry; can create a new business and navigate to discovery.
- `/applicant/discovery/[id]`: explainable regulatory discovery and workflow initialization.
- `/applicant/workflow/[id]`: workflow milestones, critical path, SLA/time machine, escalations, document repository/version history, risk, joint inspection, schemes, and compliance calendar.
- `/officer/dashboard`: escalation resolution, document scrutiny, joint inspection queue/reporting, and periodic compliance verification.
- `/admin/dashboard`: admin operational overview, M10 insights, department view, bottleneck diagnostics, and clock sandbox.

`frontend/src/lib/api.ts` has typed Axios wrappers for the entire backend surface. `frontend/src/lib/auth.ts` stores `rop_token` and `rop_user` in localStorage and routes by role.

The earlier screenshots’ Applicant page with “My Projects — Coming in M2”, “Approval Tracker — Coming in M5”, and “Documents — Coming in M7” is not present in the current Applicant source. Treat those screenshots as evidence of a previously stale build or a different running checkout, not as a faithful description of the current files.

## 9. Known inconsistencies and likely causes of the reported empty dashboards

These are real issues to resolve for final demo readiness:

1. `README.md` still presents M0 as IN_PROGRESS and M1–M6 as NOT_STARTED. It predates M7–M10 and must be updated or clearly marked historical.
2. `backend/app/main.py` still reports version `0.2.0-m2` and root/health milestone `M0`, although M10 exists. This is misleading in health checks and demo screenshots.
3. `PROJECT_STATUS.md` says M10 is complete and 181 tests pass, but it also contains older M8/M9/M11 handoff text, old test totals, “Current Task” sections, and “Next Task” instructions that contradict its current heading.
4. `NEXT_AGENT.md` correctly says no M11, but it lists test credentials `test.*@test.rop`, while the live seed uses `*@demo.rop`. Use the seed credentials unless intentionally changing fixtures.
5. `docs/DEMO_SCRIPT.md` refers to a separate Demo Control Panel, a `DEMO-REF-0001` sandbox submission, and grievance tracking. No corresponding complete frontend route/model/API was found; these steps are stale or aspirational and should not be presented as implemented.
6. The integration and demo packages are effectively placeholders; there is no verified MAITRI/NSWS adapter or real submission path.
7. Frontend API errors are swallowed in several places (`.catch(() => [])`, `.catch(() => null)`, or broad catch blocks). A wrong `NEXT_PUBLIC_API_URL`, backend not running, CORS failure, expired token, or API error can render an apparently empty dashboard instead of an explicit error state.
8. The applicant page takes the first application returned by the API as the primary application. This is acceptable for one-seed demos but is not a robust multi-application selection model.
9. The seeded database is populated and API smoke calls are populated, so the reported empty Officer/Admin dashboards are not explained by an empty repository database. Reproduce in the browser while inspecting the browser network requests and resolved API base URL before changing backend logic.
10. The Admin UI contains both an `INSUFFICIENT DATA` state and an “Optimal Operational Performance” fallback. The latter is displayed when the insights array is empty; ensure empty/failed analytics are not interpreted as optimal performance. A non-empty seeded database should generate meaningful analytics and bottleneck data.
11. The root and health endpoints advertising M0 can make an operator think an old backend is running. Update the advertised milestone only after confirming the running process uses this checkout.

## 10. Required final-polish work for the next agent

Do not create M11 and do not add unrelated product features. Work in this order:

1. Start the backend from `E:\26130\backend` using the project Python 3.12 virtual environment and start the frontend from `E:\26130\frontend`. Confirm the frontend is using `NEXT_PUBLIC_API_URL=http://localhost:8000` (or the actual chosen backend URL).
2. Use browser devtools or equivalent live verification to log in with all three `*@demo.rop` accounts and inspect network responses for `/api/business`, `/api/workflow/applications`, `/api/officer/overview`, `/api/officer/escalations`, `/api/officer/documents/pending`, `/api/admin/overview`, `/api/admin/bottlenecks`, and `/api/admin/analytics/*`.
3. If the browser sees 401/403/404/5xx or a different payload, fix the integration/configuration mismatch. Do not mask it by hard-coding dashboard numbers.
4. Replace silent empty fallbacks with visible, role-appropriate loading/error states. “No records” must be distinct from “API failed”.
5. Ensure every role dashboard clearly shows DEMO status and the seeded Scenario C records. Applicant should show the active application, overdue escalation, documents, scheduled inspection, and compliance state. Officer should show the active escalation, under-review document, scheduled inspection, and compliance queue. Admin should show M10 KPIs/insights and the overdue critical-path bottleneck, or an explicit insufficient-data state if the database is truly empty.
6. Fix the Admin empty-insights logic so empty analytics cannot display “Optimal Operational Performance” unless the backend explicitly proves there are active records and no warnings. Prefer a neutral “No actionable insight” only when valid analytics have been computed.
7. Add a safe, explicit demo reset/reseed path if needed. It must be idempotent, visibly demo-only, and must not silently destroy user data. Do not use destructive DB reset commands without a clearly scoped human decision.
8. Reconcile the stale documentation: update README milestone table/commands, remove or label obsolete Demo Control/grievance claims, align NEXT_AGENT credentials and test totals, and update root/health milestone/version strings.
9. Keep the current tests green and add regression coverage for the frontend/backend integration issue if the project’s test approach permits it. At minimum rerun the full backend suite and `npm run build`.
10. For any real legal/regulatory data or government API claims, stop and obtain human-supplied official sources and configuration. Do not invent them.

## 11. Canonical run and verification commands

Backend, Windows PowerShell:

```powershell
cd E:\26130\backend
.\venv\Scripts\python.exe -m pytest tests -q
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend:

```powershell
cd E:\26130\frontend
npm run build
npm run dev
```

Expected current verification baseline:

- Backend: 181 passed.
- Frontend: production build succeeds; routes `/`, `/login`, `/applicant/dashboard`, `/applicant/discovery/[id]`, `/applicant/workflow/[id]`, `/officer/dashboard`, and `/admin/dashboard` compile.
- API: `/health` returns `{"status":"healthy", ...}`; note that the current milestone field is stale M0 and should be corrected in final polish.

## 12. Handoff instruction to the next agent

You are continuing PRAMAN/ROP for SIH 2026 PS 26130. Treat this document and the source files as the authority, not older chat summaries. Preserve the laptop-first SQLite architecture, deterministic behaviour, RBAC, audit trail, DEMO/VERIFIED/ MOCK/VERIFICATION_REQUIRED/CONFIGURATION_REQUIRED semantics, and anti-hallucination rules. Do not claim a feature is production-ready merely because its unit tests pass. First reproduce the live dashboard state against the actual seeded backend, identify whether the empty UI is a frontend configuration/error-state problem, then make only the minimum final demo-readiness changes. Keep the repository runnable offline and leave the full test/build baseline green.
