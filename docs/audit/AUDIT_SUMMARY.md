# PRAMAN Audit Summary & Executive Decision Brief

**Document ID:** PRAMAN-AUD-005  
**Target Repository:** `E:\26130`  
**Problem Statement:** SIH 2026 — PS 26130 (Government of Maharashtra)  
**Date of Audit:** October 9, 2026  
**Auditor Role:** Senior Software Architect, Full-Stack Engineer, QA Lead & Security Reviewer  
**Audit Scope:** Read-Only Technical Audit (No code or database modifications)

---

## 1. Executive Decision Overview

This summary brief provides the technical leadership and product governance teams with an objective evaluation of the PRAMAN codebase at `E:\26130`, assessing overall project health, operational risks, reuse opportunities, and pre-implementation prerequisites before code changes begin.

---

## 2. Project Health Scorecard

```
┌─────────────────────────────────────────────────────────────┐
│ OVERALL ARCHITECTURAL HEALTH SCORE: 76 / 100               │
│ RATING: VIABLE FOUNDATIONAL PROTOTYPE WITH TECHNICAL DEBT   │
└─────────────────────────────────────────────────────────────┘
```

| Dimension | Score (0-100) | Status | Assessment |
|---|---|---|---|
| **Core Architecture & Modularity** | **85** | Strong | Clean FastAPI modular monolith; clear boundary separation between auth, regulatory, workflow, and inspection domains. |
| **Backend Test Coverage** | **88** | Excellent | 185 test functions passing (exit code 0); verified in-memory database isolation. |
| **Frontend Production Build** | **90** | Excellent | Next.js 14 App Router builds cleanly; all 24 static and dynamic routes compile without TypeScript errors. |
| **Database & Migration Maturity** | **35** | Critical Risk | Zero Alembic migration versions; schema creation relies on runtime `create_all()`; schema updates risk data loss. |
| **Version Control & Repository State** | **20** | Critical Risk | Repository is not initialized as a Git repository (`fatal: not a git repository`). |
| **Security & Tenant Isolation** | **65** | Moderate Risk | Strong password hashing and JWT RBAC; path traversal risks in document handling and missing IDOR assertions. |
| **Regulatory Domain Authenticity** | **50** | Moderate Risk | Purely synthetic demo rules (Scenario C); zero verified Maharashtra state acts or gazette citations. |

---

## 3. Strongest Existing Modules (Do NOT Rebuild)

The following modules demonstrate solid engineering and should be reused directly:

1. **Deterministic Regulatory Rule & Graph Engine (`backend/app/regulatory/`):**
   - Implements robust condition evaluation (`equals`, `in`, `contains`, `greater_than`, `less_than`, `not_null`) with three-valued logic.
   - Directed Acyclic Graph (DAG) cycle detection and topological sorting (`graph.py`) are fully tested and functional.
2. **Authentication, RBAC & Simulated Clock (`backend/app/core/`, `backend/app/api/auth.py`):**
   - High-quality bcrypt hashing, JWT issuance, and FastAPI dependency role injection.
   - `ClockService` allows simulated time acceleration for SLA breach and escalation demonstration.
3. **Joint Inspection & Risk Scrutiny System (`backend/app/models/inspection.py`, `backend/app/risk/`):**
   - Well-structured models supporting multi-department joint inspections and coordinated findings.
4. **Next.js 14 App Router Desktop Framework (`frontend/src/app/`):**
   - Clean, functional route structure for applicant, officer, and admin personas with responsive Tailwind styling.

---

## 4. Most Serious Blockers & Architectural Gaps

1. **Unversioned Repository State (P0):**
   - `E:\26130` has no `.git` directory. Modifying code without version control risks irreversible loss of working functionality.
2. **Zero Alembic Migration History (P0):**
   - `backend/alembic/versions/` contains only `.gitkeep`. Database schema evolutions (such as introducing `Project` or `DepartmentQuery`) cannot be applied safely to existing databases.
3. **Single-Project Data Model Constraint (P1):**
   - `Business` directly owns `RegulatoryProfile` and `Application`. The platform currently cannot support an industrial enterprise running multiple separate facilities (e.g., Pune plant vs. Nagpur logistics hub).
4. **Document Scrutiny Path Traversal Vulnerability (P0):**
   - File uploads and downloads construct paths using user-supplied filenames without strict sanitization.
5. **Absence of Dedicated Query/Clarification System (P1):**
   - Department queries are restricted to a single string review note on rejected documents. No structured conversation thread exists between officers and applicants.

---

## 5. Reuse vs. Rebuild Guidance for Planned Features

| Planned Feature | Recommendation | Rationale |
|---|---|---|
| **Feature 4: One-Time Business Profile** | **REUSE & DECOUPLE** | Retain existing `Business` and `RegulatoryProfile` schemas; decouple corporate credentials into `CompanyMaster` and site facts into `ProjectProfile`. |
| **Feature 3: Unified Project Workspace** | **EXTEND EXISTING** | Retain existing UI routes and backend applications API; add `Project` entity and wrap applicant views in a `ProjectContext`. |
| **Feature 5: Save Draft & Snapshots** | **EXTEND EXISTING** | Leverage existing `Application.status == DRAFT` and `AuditLog` infrastructure to store JSON draft payloads and immutable submission snapshots. |
| **Feature 6: Department Query Centre** | **BUILD FIRST-CLASS** | Do not overload `Document.review_note`; build dedicated `DepartmentQuery` and `QueryResponse` tables. |
| **Feature 1: Pre-Submission Readiness** | **BUILD DIAGNOSTIC** | Reuse `RegulatoryEngine` rules and `Document` status to build an automated pre-flight readiness evaluator. |
| **Feature 7: Unified Notifications** | **BUILD EVENT HUB** | SLA engine already computes triggers; add persistent `Notification` table and UI notification tray. |
| **Feature 8: Scheme Assistant** | **REFACTOR ENGINE** | Reuse matching logic from `app/schemes/engine.py`; externalize rules into structured YAML with official GR citations. |
| **Feature 2: Regulatory Change Radar** | **NEW CAPABILITY** | Create `RegulatorySource` and `RegulatoryChange` tables; build impact reassessment on top of `RegulatoryEngine`. |

---

## 6. Top Five Actions Required BEFORE Code Changes Begin

1. **Action 1 — Initialize Git Repository & Commit Baseline:**
   - Run `git init` in `E:\26130`.
   - Ensure `.gitignore` correctly ignores `backend/rop.db`, `backend/venv`, and `frontend/node_modules`.
   - Commit the verified baseline state with message `"PRAMAN Baseline: Verified M0-M10 working state"`.
2. **Action 2 — Generate Alembic Baseline Migration:**
   - Execute `alembic revision --autogenerate -m "baseline_m0_m10"` to freeze the existing 11 models into version control.
   - Test migration rollback and re-apply on a test SQLite database.
3. **Action 3 — Fix Frontend Linter Configuration:**
   - Create `frontend/.eslintrc.json` with `{"extends": "next/core-web-vitals"}` so that `npm run lint` passes in CI/CD pipelines.
4. **Action 4 — Resolve Document Upload Path Traversal:**
   - Patch `backend/app/api/documents.py` to enforce UUID-based storage filenames, closing the security vulnerability prior to expanding document workflows.
5. **Action 5 — Approve Shared Domain Model:**
   - Align product and engineering teams on the `CompanyMaster` -> `Project` -> `Application` entity relationship before creating new workspace tables.

---

## 7. Recommended First Work Package

**Work Package 1: One-Time Business Profile & Reusable Information (Feature 4)** followed immediately by **Unified Project Workspace (Feature 3)**.

### Rationale:
Every subsequent feature—including Save Draft (Feature 5), Query Centre (Feature 6), and Pre-Submission Readiness (Feature 1)—depends on a stable, decoupled project data model. Attempting to build validation checks or query threads prior to stabilizing the project boundary will force expensive refactoring.

---

## 8. Readiness Gate Criteria (Conditions for Phase Commencement)

Code modifications for the next phase may proceed only when all five of the following conditions are met:

- [ ] **Gate 1:** Git repository initialized and clean baseline committed.
- [ ] **Gate 2:** Alembic baseline migration verified and committed in `backend/alembic/versions/`.
- [ ] **Gate 3:** Frontend `npm run lint` executes non-interactively with exit code 0.
- [ ] **Gate 4:** Security review approves the filename sanitization specification for `Document` storage.
- [ ] **Gate 5:** Technical leadership formally approves the phased implementation roadmap in `docs/audit/IMPLEMENTATION_ROADMAP.md`.

---

## 9. Verification Paths to Audit Deliverables

All five audit documents are generated and available in the repository:
1. Workspace Audit: `E:\26130\docs\audit\WORKSPACE_AUDIT.md`
2. Feature Gap Matrix: `E:\26130\docs\audit\FEATURE_GAP_MATRIX.md`
3. Implementation Roadmap: `E:\26130\docs\audit\IMPLEMENTATION_ROADMAP.md`
4. Test & Validation Report: `E:\26130\docs\audit\TEST_AND_VALIDATION_REPORT.md`
5. Audit Summary: `E:\26130\docs\audit\AUDIT_SUMMARY.md`
