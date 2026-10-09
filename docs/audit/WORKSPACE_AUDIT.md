# PRAMAN Workspace Audit & Technical Health Assessment

**Document ID:** PRAMAN-AUD-001  
**Target Repository:** `E:\26130`  
**Problem Statement:** SIH 2026 — PS 26130 (Government of Maharashtra)  
**Date of Audit:** October 9, 2026  
**Auditor Role:** Senior Software Architect, Full-Stack Engineer, QA Lead & Security Reviewer  
**Audit Scope:** Read-Only Technical Audit (No code or database modifications)

---

## 1. Executive Summary

A comprehensive architectural, code, security, test, and readiness audit was performed on the PRAMAN (Regulatory Orchestration Platform) repository at `E:\26130`. The objective was to assess the current state of Milestones M0 through M10 and establish an evidence-based gap analysis against eight proposed enterprise features.

### Overall Status Assessment
The codebase represents a **substantive, functional prototype** spanning a modular FastAPI Python backend and a Next.js 14 App Router TypeScript frontend. However, it displays a dual identity: a robust foundational rule-engine, DAG workflow, and inspection management core on one hand, and significant architectural debt regarding versioning, migrations, and database schema decoupling on the other.

| Evaluation Area | Status | Evidence / Key Observation |
|---|---|---|
| **Version Control & Repository State** | **CRITICAL DEBT** | `E:\26130` is **NOT a Git repository**. No `.git` metadata exists. History and versioning are currently unmanaged. |
| **Backend Test Suite** | **HEALTHY / HIGH WARNINGS** | **185 tests passed, 0 failed** in 87.59s. 2,277 warnings emitted (Pydantic V2 and SQLAlchemy 2.0 deprecations). |
| **Database Isolation in Tests** | **VERIFIED CLEAN** | Tests execute against in-memory SQLite (`sqlite:///:memory:` with `StaticPool`). Development database `backend/rop.db` remained strictly untouched. |
| **Database Migrations** | **CRITICAL GAP** | Alembic is configured, but `backend/alembic/versions/` contains only `.gitkeep`. **Zero migration versions exist**. Tables are initialized via runtime `create_all()`. |
| **Frontend Production Build** | **PASSED** | `npm run build` completed successfully (exit code 0). 24 routes built cleanly with zero TypeScript errors. |
| **Frontend Linter** | **CONFIG DEFECT** | `npm run lint` fails (exit code 1) because `.eslintrc.json` is missing, triggering an interactive CLI prompt in automated pipelines. |
| **Regulatory Rule Authenticity** | **DEMO ONLY** | Rules in `scenario_c_rules.yaml` are synthetic demo rules for automotive manufacturing. Zero real Maharashtra Acts are legally verified. |
| **Architectural Drift** | **MODERATE** | Architectural docs reference `IntegrationGateway` and `MockAdapter`, but `backend/app/integration/` is an empty package (27 bytes). |

---

## 2. Verified Workspace Identity & Environment

### 2.1 Workspace Paths
- **Repository Root:** `E:\26130`
- **Backend Root:** `E:\26130\backend`
- **Frontend Root:** `E:\26130\frontend`
- **Documentation Root:** `E:\26130\docs`

### 2.2 Git State
- **Git Repository Detected:** **NO** (`fatal: not a git repository (or any of the parent directories): .git`).
- **Untracked / Orphan Artifacts:** Root contains an 84-byte orphan `package-lock.json` with an empty object `{}`.

### 2.3 Runtime Environment
- **Host OS:** Windows 11 Enterprise (Build 10.0.26100)
- **Host System Python:** Python `3.14.3` (`C:\Users\Kohinoor\AppData\Local\Programs\Python\Python314\python.exe`)
- **Backend Virtualenv Python:** Python `3.12.10` (`E:\26130\backend\venv\Scripts\python.exe`)
- **Node.js Runtime:** `v24.14.0`
- **Package Manager:** npm `11.9.0`
- **Next.js Version:** `14.2.15`
- **FastAPI Version:** `0.115.0`
- **SQLAlchemy Version:** `2.0.35`
- **Pydantic Version:** `2.9.2`
- **Pytest Version:** `8.3.3`

---

## 3. Complete Repository Inventory

### 3.1 Backend Architecture (`backend/`)
The backend is structured as a modular monolith in FastAPI.

```
backend/
├── alembic/
│   ├── env.py                  # Alembic environment runner
│   ├── script.py.mako          # Migration template
│   └── versions/               # Contains ONLY .gitkeep (0 migrations!)
├── alembic.ini                 # Alembic configuration
├── rop.db                      # SQLite development database (258,048 bytes)
├── requirements.txt            # Dependency manifest
├── tests/                      # 14 test modules, 185 test cases
└── app/
    ├── main.py                 # FastAPI initialization, CORS, lifespans, router mounts
    ├── config.py               # Pydantic Settings (.env configuration)
    ├── database.py             # SQLite engine, PRAGMA WAL/foreign_keys, sessionmaker, get_db
    ├── seed.py                 # Seed demo accounts and scenario C data
    ├── api/                    # 14 router modules (55 endpoints)
    │   ├── admin.py            # Audit logs, simulated clock control, user list
    │   ├── analytics.py        # Executive KPIs, departmental bottlenecks, SLA compliance
    │   ├── applications.py     # Application lifecycle, step updates, submissions
    │   ├── auth.py             # JWT token issuance, /me, registration
    │   ├── business.py         # Business registration and regulatory profile CRUD
    │   ├── compliance.py       # Recurring compliance filings, renewal tracking
    │   ├── deps.py             # Security dependencies, role checkers (APPLICANT, OFFICER, ADMIN)
    │   ├── documents.py        # File upload, checksum hashing, scrutiny reviews
    │   ├── escalations.py      # SLA breach escalations, officer assignment, resolution
    │   ├── inspections.py      # Joint inspection scheduling, multi-officer reports
    │   ├── intake.py           # Adaptive question generation, natural language intake
    │   ├── regulatory.py       # Rule assessment execution, graph visualization, rules listing
    │   ├── schemes.py          # Government incentive/subsidy eligibility evaluation
    │   └── sla.py              # SLA status calculations, overdue detection
    ├── core/
    │   ├── audit.py            # record_audit() utility function
    │   ├── clock.py            # ClockService wrapper for simulated time & SLA testing
    │   └── security.py         # Passlib bcrypt hashing, Jose JWT encoder/decoder
    ├── models/                 # SQLAlchemy 2.0 Declarative Models (11 tables)
    │   ├── application.py      # Application, ApprovalStep
    │   ├── audit.py            # AuditLog
    │   ├── business.py         # Business, RegulatoryProfile
    │   ├── compliance.py       # ComplianceFiling
    │   ├── document.py         # Document
    │   ├── escalation.py       # EscalationEvent
    │   ├── inspection.py       # JointInspection, InspectionReport
    │   └── user.py             # User, UserRole
    ├── regulatory/             # Regulatory Rule & DAG Engine
    │   ├── engine.py           # RegulatoryEngine rule evaluator
    │   ├── graph.py            # Dependency DAG builder, topological sort, critical path
    │   ├── loader.py           # YAML rule parser and schema validator
    │   └── schema.py           # Pydantic schemas for rules and conditions
    ├── intake/
    │   ├── adaptive.py         # Dynamic questionnaire generator
    │   ├── parser.py           # Natural language business description parser
    │   └── providers.py        # Provider pattern: GeminiProvider, CachedProvider, Fallback
    ├── workflow/
    │   └── engine.py           # Workflow engine, step progress, parallel groups
    ├── sla/
    │   └── engine.py           # SLA countdowns, calendar calculations, breach trigger
    ├── escalation/
    │   └── engine.py           # Escalation hierarchy, automated trigger engine
    ├── risk/
    │   └── engine.py           # Risk calculation (Green/Orange/Red), inspection scoring
    ├── schemes/
    │   └── engine.py           # In-memory scheme matching rules (PSI 2019, M-STED, etc.)
    ├── analytics/
    │   └── engine.py           # Metric aggregators, departmental turnaround stats
    ├── integration/            # Empty module (__init__.py only, 27 bytes)
    ├── services/               # Empty module (__init__.py only, 27 bytes)
    └── demo/                   # Empty module (__init__.py only, 27 bytes)
```

### 3.2 Frontend Architecture (`frontend/`)
The frontend is built with Next.js 14 App Router, React 18, TypeScript, and Tailwind CSS.

```
frontend/
├── package.json                # Next.js 14.2.15, Tailwind, Radix UI, Lucide, Axios
├── tsconfig.json               # TypeScript strict mode configured
├── tailwind.config.ts          # Custom CSS token mappings
├── src/
│   ├── app/                    # 24 App Router pages and layouts
│   │   ├── layout.tsx          # Root layout with Inter font and global styling
│   │   ├── page.tsx            # Root redirect to /login
│   │   ├── login/              # Login interface with demo account shortcuts
│   │   ├── applicant/          # Applicant Workspace
│   │   │   ├── dashboard/      # Overview, quick links, active alerts
│   │   │   ├── projects/       # Project list and project profile creation
│   │   │   ├── intake/         # Natural language and adaptive Q&A wizard
│   │   │   ├── approvals/      # Discovered required approvals list
│   │   │   ├── applications/   # Applications list & detail views (/applications/[id])
│   │   │   ├── documents/      # Document repository, upload modal, verification status
│   │   │   ├── graph/          # Approval sequence visual graph (React Flow/SVG)
│   │   │   ├── compliance/     # Recurring compliance filings calendar
│   │   │   └── schemes/        # Matching government schemes & incentives
│   │   ├── officer/            # Department Officer Workspace
│   │   │   ├── dashboard/      # Review queue, pending applications
│   │   │   ├── applications/   # Scrutiny workbench, query issuance, approvals
│   │   │   ├── sla/            # SLA tracker, overdue monitoring
│   │   │   ├── escalations/    # Assigned escalation events
│   │   │   └── inspections/    # Joint inspection schedule and reports
│   │   └── admin/              # Administrator Workspace
│   │       ├── dashboard/      # System overview, data integrity, user counts
│   │       ├── audit-logs/     # Immutable audit trail viewer with search/filter
│   │       ├── analytics/      # Executive KPIs, SLA compliance charts
│   │       └── clock/          # ClockService time simulator control panel
│   ├── components/             # Reusable UI components
│   │   ├── Navbar.tsx          # Role-aware global navigation bar
│   │   ├── StatusBadge.tsx     # Standardized data badges (VERIFIED, DEMO, MOCK, etc.)
│   │   └── ui/                 # Shadcn-inspired UI components (Button, Input, Label)
│   └── lib/
│       ├── api.ts              # Axios instance, Bearer token interceptor, 401 redirect
│       ├── auth.ts             # Session persistence, localStorage handlers, role paths
│       └── utils.ts            # clsx and tailwind-merge helper (cn)
```

---

## 4. Module-by-Module Technical Audit (M0–M10)

### 4.1 M0 — Authentication & Foundation
- **Backend Source:** `backend/app/api/auth.py`, `backend/app/core/security.py`, `backend/app/core/clock.py`, `backend/app/models/user.py`, `backend/app/models/audit.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - Password hashing using `passlib.context.CryptContext` with `bcrypt`.
  - JWT token generation via `python-jose` with HS256 algorithm and configurable expiration.
  - Role-Based Access Control (`UserRole`: `APPLICANT`, `OFFICER`, `ADMIN`) enforced via FastAPI dependency injection (`require_role`).
  - Immutable audit logging (`AuditLog` model and `record_audit()` utility).
  - Simulated clock (`ClockService`) allowing admin-triggered time offsets for SLA simulation.
- **Defects & Limitations:**
  - In `backend/app/main.py`, FastAPI app version is declared as `0.2.0-m2`, while `/` root endpoint returns `0.1.0-m0` and `/health` returns `milestone="M0"`.
  - Session tokens are stored in browser `localStorage`, making them vulnerable to Cross-Site Scripting (XSS).
  - No refresh token mechanism exists; tokens expire in 480 minutes (8 hours) by default.

### 4.2 M1 — Regulatory Rule Engine
- **Backend Source:** `backend/app/regulatory/engine.py`, `loader.py`, `schema.py`, `data/rules/demo/scenario_c_rules.yaml`.
- **Status:** **PARTIALLY IMPLEMENTED (DEMO DATA ONLY)**
- **Capabilities Verified:**
  - Dynamic YAML loading with schema validation.
  - Deterministic condition evaluation (`equals`, `in`, `contains`, `greater_than`, `less_than`, `is_true`, `is_false`, `not_null`).
  - Three-valued applicability evaluation: `applicable`, `not_applicable`, `verification_required`.
- **Defects & Limitations:**
  - `data/rules/demo/scenario_c_rules.yaml` contains only synthetic demo rules for automotive manufacturing.
  - Zero rules from actual Maharashtra state departments (MIDC, MPCB, DISH, PWD) are verified or backed by official gazette URLs.
  - Rules are loaded from disk into memory on demand; no database persistence or dynamic rule versioning exists.

### 4.3 M2 — Business Profile & Adaptive Intake
- **Backend Source:** `backend/app/intake/parser.py`, `adaptive.py`, `providers.py`, `backend/app/models/business.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - `Business` and `RegulatoryProfile` relational models.
  - Provider abstraction (`BaseIntakeProvider`) with `GeminiProvider`, `CachedProvider`, and `RuleBasedFallbackProvider`.
  - Dynamic generation of 3 to 7 clarifying questions based on missing or ambiguous profile fields.
- **Defects & Limitations:**
  - Single-project lock: The `Business` model directly owns `RegulatoryProfile` (1:1). It does not support a business having multiple industrial projects (e.g., Pune plant vs. Nagpur warehouse).
  - Business details overwrite existing fields upon update without draft staging or versioning.

### 4.4 M3 — Regulatory Discovery & Dependency Graph
- **Backend Source:** `backend/app/regulatory/graph.py`, `backend/app/api/regulatory.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - Discovery endpoint `/api/regulatory/evaluate/{business_id}` determines required approvals from profile parameters.
  - Directed Acyclic Graph (DAG) construction with cycle detection using Kahn's algorithm or DFS.
  - Topological sorting and critical path length calculation.
- **Defects & Limitations:**
  - Results are computed dynamically in-memory and are not persisted as an immutable assessment record. If rules or profiles change later, historical discoveries cannot be audited.

### 4.5 M4 — Workflow Engine
- **Backend Source:** `backend/app/workflow/engine.py`, `backend/app/models/application.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - Application lifecycle management (`DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `QUERY_RAISED`).
  - Granular step tracking (`ApprovalStep` model).
  - Identification of parallel execution groups.
- **Defects & Limitations:**
  - Application submissions do not lock the underlying profile or document state. A user can alter profile parameters after submitting an application.

### 4.6 M5 — SLA Monitoring & Integration Gateway
- **Backend Source:** `backend/app/sla/engine.py`, `backend/app/api/sla.py`.
- **Status:** **PARTIALLY IMPLEMENTED (GATEWAY MISSING)**
- **Capabilities Verified:**
  - Deadline calculation based on configured business days or calendar days.
  - Status classification: `ON_TRACK`, `APPROACHING`, `OVERDUE`.
  - Tight coupling with `ClockService` for predictable simulation.
- **Defects & Limitations:**
  - **Phantom Module:** `docs/ARCHITECTURE.md` describes an `IntegrationGateway` with `MockAdapter`, `MaitriAdapter`, and `NswsAdapter`. In reality, `backend/app/integration/` contains only an empty `__init__.py`. External submissions are directly stubbed inside the application router.
  - SLA checks are passive (calculated when endpoints are queried). There is no background worker or cron scheduler to evaluate deadlines autonomously.

### 4.7 M6 — Escalation & Officer Workflows
- **Backend Source:** `backend/app/escalation/engine.py`, `backend/app/models/escalation.py`, `backend/app/api/escalations.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - Automatic escalation event generation upon SLA breach (`Level 1`, `Level 2`, `Level 3`).
  - Officer assignment, status updates, and audit logging.
  - Officer-specific review queues in frontend.
- **Defects & Limitations:**
  - Escalation routing rules are hard-coded in the engine rather than configured per department or jurisdiction.

### 4.8 M7 — Document Vault
- **Backend Source:** `backend/app/models/document.py`, `backend/app/api/documents.py`.
- **Status:** **CONFIRMED IMPLEMENTED (SECURITY VULNERABILITIES IDENTIFIED)**
- **Capabilities Verified:**
  - Document metadata tracking (`document_type`, `file_size_bytes`, `mime_type`, `sha256_hash`).
  - Scrutiny status tracking (`PENDING`, `VERIFIED`, `REJECTED`, `QUERY_RAISED`).
  - Officer review notes recording.
- **Defects & Limitations:**
  - **Path Traversal Risk:** Files are written to disk using user-influenced file names without strict sanitization.
  - **MIME Sniffing Vulnerability:** MIME type is trusted from the client header rather than verified via magic bytes.
  - No document versioning: Uploading a new file for the same type creates a separate record or overwrites without version lineage.

### 4.9 M8 — Risk & Joint Inspections
- **Backend Source:** `backend/app/risk/engine.py`, `backend/app/models/inspection.py`, `backend/app/api/inspections.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - Industrial risk category calculation (Red / Orange / Green / White) based on CPCB / MPCB parameters.
  - Joint inspection coordination model (`JointInspection`) linking multiple departmental reports (`InspectionReport`).
- **Defects & Limitations:**
  - Risk parameters are statically hardcoded in Python logic rather than maintained in configurable regulatory rule sets.

### 4.10 M9 — Government Schemes & Recurring Compliance
- **Backend Source:** `backend/app/schemes/engine.py`, `backend/app/models/compliance.py`, `backend/app/api/compliance.py`, `backend/app/api/schemes.py`.
- **Status:** **PARTIALLY IMPLEMENTED (DATA HARDCODED)**
- **Capabilities Verified:**
  - Matching logic for Maharashtra industrial policies (PSI 2019, Dr. Babasaheb Ambedkar Special Incentive Scheme).
  - Tracking of recurring statutory compliance obligations (`ComplianceFiling`) with renewal due dates.
- **Defects & Limitations:**
  - Schemes have no database model. They are defined as Python dictionary literals in `app/schemes/engine.py`. Adding or updating a government scheme requires code changes.

### 4.11 M10 — Analytics & Executive Insights
- **Backend Source:** `backend/app/analytics/engine.py`, `backend/app/api/analytics.py`.
- **Status:** **CONFIRMED IMPLEMENTED**
- **Capabilities Verified:**
  - Aggregation of system-wide approval turnaround times, departmental SLA compliance rates, and bottleneck identification.
  - Admin executive dashboard with Recharts visualizations.
- **Defects & Limitations:**
  - Fragile empty-state behavior: When the database contains zero applications, metrics can return misleading 100% compliance figures or divide-by-zero approximations.

---

## 5. Security & Reliability Findings

Findings are categorized under the mandatory Prioritization Framework (P0 to P3).

### 5.1 Critical Severity (P0)

#### P0-1: Absence of Version Control in Workspace
- **What is wrong:** The workspace at `E:\26130` is not initialized as a Git repository.
- **Evidence:** `git status` reports `fatal: not a git repository`.
- **Impact:** Any code modification, refactoring, or accidental file deletion risks catastrophic, irrecoverable loss of working code. Team collaboration and release tracking are completely impossible.
- **Affected Modules:** Entire repository.
- **Recommended Remediation:** Initialize a Git repository (`git init`), create a robust `.gitignore` excluding `rop.db` and virtual environments, and commit the verified baseline state.
- **Dependencies:** None.
- **Verification:** Run `git status` and verify clean working tree.

#### P0-2: Database Schema & Migration Drift (Zero Alembic Versions)
- **What is wrong:** Alembic is configured, but directory `backend/alembic/versions/` contains zero migration scripts. Schema creation relies entirely on `Base.metadata.create_all(bind=engine)` inside `lifespan()`.
- **Evidence:** Listing `backend/alembic/versions/` returns only `.gitkeep`.
- **Impact:** Any schema modification (such as adding `Project` or `DepartmentQuery` tables) cannot be migrated safely against existing production or demo databases without wiping data or manual SQLite DDL alterations.
- **Affected Modules:** `backend/alembic/`, `backend/app/models/`.
- **Recommended Remediation:** Generate an initial baseline migration (`alembic revision --autogenerate -m "baseline"`) reflecting current models, and ensure all future changes use standard Alembic migration scripts.
- **Dependencies:** P0-1.
- **Verification:** Run `alembic upgrade head` on a test SQLite database and verify all 11 tables match `Base.metadata`.

#### P0-3: Path Traversal Vulnerability in Document Storage
- **What is wrong:** In `backend/app/api/documents.py`, uploaded files are saved to disk using `file.filename` with insufficient path resolution checks, and download routes construct paths directly from database values.
- **Evidence:** `backend/app/api/documents.py:84`:
  ```python
  file_path = os.path.join(UPLOAD_DIR, f"{business_id}_{file.filename}")
  ```
  If `file.filename` contains `../../`, files may be written outside the intended upload directory.
- **Impact:** Arbitrary file overwrite and information disclosure.
- **Affected Modules:** `backend/app/api/documents.py`.
- **Recommended Remediation:** Sanitize filenames using `werkzeug.utils.secure_filename` or assign UUID-based storage filenames (e.g., `f"{uuid.uuid4().hex}.dat"`), storing original filenames only as database metadata.
- **Dependencies:** None.
- **Verification:** Write unit test submitting `../../etc/test.txt` and assert that file is safely stored within `UPLOAD_DIR`.

---

### 5.2 High Severity (P1)

#### P1-1: Insecure Direct Object Reference (IDOR) on Business & Document Resources
- **What is wrong:** Several endpoints in `backend/app/api/business.py`, `documents.py`, and `applications.py` allow querying and modifying records by ID without asserting that the record belongs to the requesting user's business.
- **Evidence:** In `backend/app/api/business.py:get_business(business_id: int)`:
  ```python
  business = db.query(Business).filter(Business.id == business_id).first()
  ```
  No check exists confirming `business.user_id == current_user.id`. Any authenticated applicant can inspect another applicant's business profile and documents.
- **Impact:** Horizontal privilege escalation and privacy violation across industrial applicants.
- **Affected Modules:** `backend/app/api/business.py`, `backend/app/api/documents.py`, `backend/app/api/applications.py`.
- **Recommended Remediation:** Enforce ownership authorization checks: if `current_user.role == UserRole.APPLICANT`, verify `resource.user_id == current_user.id` or `resource.business.user_id == current_user.id`.
- **Dependencies:** M0 auth dependencies.
- **Verification:** Write pytest asserting that Applicant B receives HTTP 403 Forbidden when requesting Applicant A's business ID.

#### P1-2: Architectural Disconnect — Decoupled Business vs. Project Entities
- **What is wrong:** The database architecture lacks a `Project` model. `RegulatoryProfile` and `Application` link directly to `Business`.
- **Evidence:** `backend/app/models/business.py:RegulatoryProfile`:
  `business_id = Column(Integer, ForeignKey("businesses.id"))`
  `backend/app/models/application.py:Application`:
  `business_id = Column(Integer, ForeignKey("businesses.id"))`
- **Impact:** A manufacturing firm cannot manage multiple independent projects (e.g., a greenfield chemical plant in Ratnagiri and an electronics assembly line in Pune) without creating multiple business registrations with duplicate PANs.
- **Affected Modules:** `backend/app/models/business.py`, `backend/app/models/application.py`, frontend project routes.
- **Recommended Remediation:** Introduce a `Project` model positioned between `Business` and `Application`/`RegulatoryProfile`, or decouple project-level attributes cleanly.
- **Dependencies:** P0-2 (Alembic migration).
- **Verification:** Verify schema supports 1 `Business` -> N `Projects` -> M `Applications`.

---

### 5.3 Medium Severity (P2)

#### P2-1: Missing ESLint Configuration File Breaking CI Pipelines
- **What is wrong:** In `frontend/`, `npm run lint` fails because `.eslintrc.json` is missing.
- **Evidence:** Executing `npm run lint` yields exit code 1 with: `How would you like to configure ESLint?`.
- **Impact:** Automated CI/CD pipelines cannot run lint checks non-interactively.
- **Affected Modules:** `frontend/`.
- **Recommended Remediation:** Create `frontend/.eslintrc.json` extending `next/core-web-vitals`.
- **Dependencies:** None.
- **Verification:** Execute `npm run lint` in `frontend/` and verify clean exit code 0.

#### P2-2: Missing Departmental Query Data Model
- **What is wrong:** Department queries are currently shoehorned into `Document.review_note` with status `QUERY_RAISED`. There is no first-class `DepartmentQuery` entity supporting structured questions, responses, attachments, and resolution timestamps.
- **Evidence:** `backend/app/models/document.py` has `review_note`, but no query conversation model exists.
- **Impact:** Applicants cannot participate in clarification threads on applications or non-document questions.
- **Affected Modules:** `backend/app/models/`, `backend/app/api/`.
- **Recommended Remediation:** Implement `DepartmentQuery` and `QueryResponse` models with foreign keys to `Application` and `User`.
- **Dependencies:** P0-2.
- **Verification:** Run unit tests exercising query creation, applicant response, and officer closure.

---

### 5.4 Low Severity (P3)

#### P3-1: Version and Milestone Reporting Inconsistencies
- **What is wrong:** Backend root `/` reports `0.1.0-m0` and `M0 — Foundation`, while `main.py` specifies `version="0.2.0-m2"`, and M10 features are already merged.
- **Evidence:** Dynamic curl of `GET /` vs `FastAPI(version=...)` metadata.
- **Impact:** Misleading operational telemetry during auditing and API documentation inspection.
- **Affected Modules:** `backend/app/main.py`.
- **Recommended Remediation:** Centralize version and milestone declarations in `backend/app/config.py`.
- **Dependencies:** None.
- **Verification:** Query `GET /` and verify version aligns with current project state.

---

## 6. Frontend & User Experience Audit

### 6.1 Architecture & Desktop Usability
- The frontend uses Next.js 14 App Router with clean separation between `/applicant`, `/officer`, and `/admin`.
- Layouts are structured for desktop workspaces (1280px+ containers, sidebar navigations, responsive grid tables).
- Navigation between portals is governed by user role stored in session state.

### 6.2 Key Usability Findings
1. **Single Application Assumption:** The applicant workspace often defaults to selecting the first available application (`applications[0]`), creating confusion for businesses with multiple filings.
2. **Hard-Coded Demo Labels:** Several views display hard-coded DEMO badges or synthetic status alerts even when live data is returned.
3. **Absence of Query Center:** There is no dedicated UI for reviewing and responding to department queries. Applicants must discover queries by inspecting individual rejected documents.
4. **Draft Resumption Gap:** The intake flow does not persist partial form inputs to localStorage or the backend. If an applicant navigates away during intake, all wizard inputs are lost.

---

## 7. Technical Debt & Documentation Inconsistencies

1. **Phantom Modules:** `docs/ARCHITECTURE.md` asserts the existence of `IntegrationGateway` with `MaitriAdapter` and `NswsAdapter`. In reality, `backend/app/integration/` contains only an empty `__init__.py`.
2. **Missing Scheme Persistence:** `backend/app/schemes/engine.py` embeds scheme rules directly in Python source code rather than YAML or database records, contrary to the architectural principle that regulatory rules should remain externalized and configurable.
3. **Deprecation Warnings:** 2,277 warnings emitted during test execution stem from Pydantic V1-style validators (`@validator` instead of `@field_validator`) and regex definitions in Pydantic 2.9.2. While non-fatal, these will break upon upgrading to Pydantic 3.0.
