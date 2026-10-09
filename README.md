# Regulatory Orchestration Platform (ROP)

**SIH 2026 — Problem Statement 26130**

> Efficiency in streamlining industrial approvals, compliance processes, and access to government support services.

---

## ⚠️ Data Notice

All regulatory data in this prototype is **DEMO** status unless explicitly marked **VERIFIED** with source metadata.

This is a prototype. It does not replace official government portals.

---

## Architecture

```
Frontend (Next.js)  →  Backend (FastAPI)  →  SQLite
                              ↓
                    Modular Application Layer
                    (Auth, Business, Regulatory, Workflow, SLA, ...)
```

---

## Quick Start

### Prerequisites

- Python 3.12 (Standardized backend runtime; avoid Python 3.14 to prevent C/Rust extension compilation issues)
- Node.js 18+
- No Docker required.
- No PostgreSQL required.
- No Redis required.

### Backend

```bash
cd backend
py -3.12 -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt

# Copy and edit environment
copy .env.example .env

# Start the backend
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

App: http://localhost:3000

### Demo Accounts

All demo accounts use password: `Demo@12345`

| Email | Role |
|---|---|
| applicant@demo.rop | Applicant |
| officer@demo.rop | Officer |
| admin@demo.rop | Administrator |

### Run Tests

```bash
cd backend
pytest tests/ -v
```

---

## Milestones

| Milestone | Status |
|---|---|
| M0 Foundation | IN_PROGRESS |
| M1 Regulatory Engine | NOT_STARTED |
| M2 AI Intake | NOT_STARTED |
| M3 Checklist + Graph | NOT_STARTED |
| M4 Workflow + Critical Path | NOT_STARTED |
| M5 Integration + SLA | NOT_STARTED |
| M6 Escalation + Dashboards | NOT_STARTED |

---

## Agent Instructions

See [AGENTS.md](AGENTS.md) for all permanent rules.
See [PROJECT_STATUS.md](PROJECT_STATUS.md) for current state.
See [NEXT_AGENT.md](NEXT_AGENT.md) for handoff.

---

## Limitations

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

---

*This prototype is for academic/competition purposes only.*
