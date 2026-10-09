# ROP Architecture

## Overview

Modular monolith. One process. SQLite. No external services required.

```
Browser
  │
  ▼
Next.js (port 3000)
  │  REST/JSON
  ▼
FastAPI (port 8000)
  │
  ├── app/api/         (route handlers)
  ├── app/core/        (security, audit, clock)
  ├── app/models/      (SQLAlchemy ORM)
  ├── app/services/    (business logic — M1+)
  ├── app/regulatory/  (rule engine — M1)
  ├── app/workflow/    (workflow engine — M4)
  ├── app/sla/         (SLA engine — M5)
  ├── app/escalation/  (escalation — M6)
  ├── app/ai/          (AI service — M2)
  ├── app/integration/ (gateway — M5)
  └── app/demo/        (demo control — M5)
  │
  ▼
SQLite (rop.db)
```

## Modules

### Auth (M0)
- JWT tokens (python-jose)
- Bcrypt password hashing (passlib)
- RBAC via FastAPI dependency injection
- Roles: Applicant, Officer, Admin

### Clock Service (M0)
- Wraps datetime.utcnow()
- Can be offset or pinned for SLA simulation
- Reset to real time at any point
- Admin API to control

### Audit (M0)
- AuditLog table: who, what, when, source, before/after, reason
- record_audit() utility called at every sensitive action
- Immutable (no update/delete endpoints)

### Regulatory Engine (M1)
- YAML-based rule definitions
- Rule loader + validator
- Deterministic rule evaluation
- Returns: applicable | conditional | not_applicable | verification_required
- Data status: VERIFIED | DEMO | VERIFICATION_REQUIRED | CONFIGURATION_REQUIRED

### AI Service (M2)
- AIService with provider pattern
- GeminiProvider (optional, requires API key)
- CachedProvider (pre-recorded responses, offline safe)
- RuleBasedFallbackProvider (no AI needed)
- AI never determines regulatory truth

### Workflow (M4)
- State machine per application
- States: not_started → ready → in_progress → overdue → completed | rejected
- Dependency graph (DAG)
- Cycle detection
- Critical path calculation
- Parallel group identification

### Integration Gateway (M5)
- IntegrationGateway class
- Adapter interface: create_application, submit, get_status
- MockAdapter (default)
- Placeholder: MaitriAdapter, NswsAdapter (CONFIGURATION_REQUIRED)

### SLA Engine (M5)
- SLA rules per requirement type
- Uses ClockService (not real time)
- States: on_track | approaching | overdue
- Escalation trigger when overdue

### Analytics & Executive Insights Engine (M10 - Final Milestone)
- Pure deterministic SQL aggregations querying actual SQLite state across M1–M9
- Zero fabricated metrics or hallucinated statistics (surfaces None / INSUFFICIENT DATA)
- Metrics: Application processing days (mean/median), SLA compliance rate, escalation resolution hours (mean/median), document review backlogs, inspection status/risk distribution, overdue compliance filings
- Deterministic rule-derived operational insights with CRITICAL / WARNING / INFO priorities
- Department workload and on-time adherence matrix
- Full compatibility with ClockService time travel sandbox

## Data Status System

Every regulatory record has exactly one status:

| Status | Meaning |
|---|---|
| VERIFIED | Official source + metadata (source_url, source_title, source_date, reviewed_by) |
| DEMO | Workflow demonstration only |
| MOCK | Simulated external response |
| VERIFICATION_REQUIRED | Cannot safely determine |
| CONFIGURATION_REQUIRED | Human must supply |

Default: DEMO

## Security
- No secrets in repository
- .env excluded from git
- Passwords hashed with bcrypt
- JWT expiry: 8 hours (configurable)
- Protected routes via RBAC dependency
- Audit log for all sensitive actions

## Laptop-First Constraints
- SQLite: no server process needed
- No Redis, Kafka, Celery, Docker required
- No GPU, no local LLM required
- CachedProvider for offline AI demo
- In-memory SQLite for tests (fast)
