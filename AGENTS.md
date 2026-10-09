# AGENTS.md — Permanent Rules for All Agents

This file contains the permanent operating rules for every AI agent/account
that works on this repository.

**Read this file BEFORE touching any code.**

---

## Project

**Regulatory Orchestration Platform (ROP)**
SIH 2026 — Problem Statement 26130

---

## Permanent Rules

1. **Never invent government/regulatory facts.**
   Do not guess laws, Acts, sections, departments, approval requirements,
   forms, fees, SLAs, escalation paths, schemes, officer names, or
   government API endpoints. Use DEMO, MOCK, or VERIFICATION_REQUIRED.

2. **Read PROJECT_STATUS.md before working.**
   Determine what is actually done. Trust the code and tests, not status text.

3. **Read NEXT_AGENT.md before working.**
   This is the short handoff from the previous session.

4. **Inspect existing code before creating new code.**
   Do not recreate what already exists. Do not overwrite working code.

5. **Do not duplicate existing functionality.**
   Search the codebase before adding new modules, utilities, or endpoints.

6. **Keep the application runnable at all times.**
   Every commit checkpoint must start and produce no import errors.

7. **Run relevant tests after changes.**
   Never mark something TESTED unless tests have actually been run.

8. **Update PROJECT_STATUS.md and NEXT_AGENT.md before finishing.**
   Leave the repository ready for the next agent.

9. **Do not move to the next milestone if the current milestone fails.**
   Fix before advancing.

10. **Keep the project laptop-friendly.**
    Max RAM target: 8 GB. No GPU. No expensive services.

11. **Do not introduce unnecessary infrastructure.**
    Default: SQLite, FastAPI, Next.js. No Redis, Kafka, Celery, Kubernetes,
    vector databases, or paid cloud services.

12. **Prefer deterministic systems for regulatory/workflow logic.**
    Rules in YAML/config files. AI may assist; AI must not determine
    regulatory truth.

13. **AI may assist but must not determine regulatory truth.**
    Gemini/LLM output must be confirmed by the user before entering the system.

14. **Government integrations are mock unless verified.**
    All external API calls go through IntegrationGateway with MockAdapter.
    Never invent real API endpoints or credentials.

15. **Demo data must be visibly labelled.**
    Every regulatory record must show one of:
    VERIFIED | DEMO | MOCK | VERIFICATION_REQUIRED | CONFIGURATION_REQUIRED

---

## Data Status Labels

| Label                  | Meaning                                         |
|------------------------|-------------------------------------------------|
| VERIFIED               | Supported by official source (with metadata)    |
| DEMO                   | Created to demonstrate workflow behaviour only  |
| MOCK                   | Simulated external/government response          |
| VERIFICATION_REQUIRED  | Cannot safely determine without research        |
| CONFIGURATION_REQUIRED | Human must supply or configure                  |

Default: **DEMO**

---

## Technology Stack

- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy, Alembic, SQLite
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Lucide, Recharts, React Flow
- **AI**: GeminiProvider (optional), CachedProvider (default demo), RuleBasedFallbackProvider
- **Auth**: JWT, bcrypt, RBAC (Applicant / Officer / Admin)

---

## Milestone Order (M0 → M6 → optional M7–M11)

M0 Foundation → M1 Regulatory Engine → M2 AI Intake →
M3 Checklist+Graph → M4 Workflow+CriticalPath → M5 Integration+SLA →
M6 Escalation+Dashboards → (M7–M11 optional)

---

## End of AGENTS.md
