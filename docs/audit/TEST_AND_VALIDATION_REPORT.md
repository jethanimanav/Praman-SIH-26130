# PRAMAN Test & Validation Report

**Document ID:** PRAMAN-AUD-004  
**Target Repository:** `E:\26130`  
**Problem Statement:** SIH 2026 — PS 26130 (Government of Maharashtra)  
**Date of Audit:** October 9, 2026  
**Auditor Role:** Senior Software Architect, Full-Stack Engineer, QA Lead & Security Reviewer  
**Audit Scope:** Read-Only Technical Audit (Non-destructive test execution only)

---

## 1. Test Execution Summary

A complete validation suite was executed across backend and frontend environments without modifying source code or persisting changes to the development database.

| Test / Check Suite | Executed Command | Exit Code | Result | Summary / Details |
|---|---|---|---|---|
| **Backend Test Suite** | `backend\venv\Scripts\pytest.exe -v` | **0** | **PASSED** | 185 passed, 0 failed, 2,277 warnings (87.59s) |
| **Database Isolation** | Verification of `backend/rop.db` hash & timestamp | **0** | **VERIFIED CLEAN** | DB remained completely untouched (Size: 258,048 B, Timestamp unchanged) |
| **Frontend Production Build** | `npm run build` (in `frontend/`) | **0** | **PASSED** | Compiled successfully; 24 static & dynamic routes generated |
| **Frontend Linting** | `npm run lint` (in `frontend/`) | **1** | **FAILED (CONFIG)** | Missing `.eslintrc.json` triggered interactive setup prompt |

---

## 2. Environment & Tool Versions

- **Operating System:** Windows 11 Enterprise (Build 10.0.26100)
- **Host System Python:** Python `3.14.3`
- **Virtual Environment Python:** Python `3.12.10` (`E:\26130\backend\venv\Scripts\python.exe`)
- **Pytest:** Version `8.3.3`
- **FastAPI:** Version `0.115.0`
- **SQLAlchemy:** Version `2.0.35`
- **Pydantic:** Version `2.9.2`
- **Node.js:** `v24.14.0`
- **npm:** `11.9.0`
- **Next.js:** `14.2.15`

---

## 3. Backend Test Suite Breakdown

### 3.1 Test Execution by Module

The backend suite spans 14 test modules in `backend/tests/`:

| Module | Test File | Test Count | Status | Scope Tested |
|---|---|---|---|---|
| **M0** | `test_auth.py` | 11 | PASSED | Registration, JWT token issue, invalid credentials, audit log creation on login |
| **M0** | `test_rbac.py` | 8 | PASSED | Role-based access control (Applicant vs Officer vs Admin), clock control permissions |
| **M0** | `test_clock.py` | 5 | PASSED | Real-time vs simulated time, advancing clock (+1, +5, +10 days), clock reset |
| **M1** | `test_regulatory.py` | 18 | PASSED | Rule loading, YAML schema validation, deterministic condition evaluation, 3-valued logic |
| **M2** | `test_business.py` | 14 | PASSED | Business profile creation, updating regulatory profile parameters |
| **M2** | `test_intake.py` | 12 | PASSED | Natural language parser, fallback provider, adaptive question selection |
| **M3** | `test_discovery.py` | 15 | PASSED | Approval requirement matching, rule traceability, missing parameter detection |
| **M3** | `test_graph.py` | 12 | PASSED | DAG cycle detection, topological sorting, parallel group grouping |
| **M4** | `test_workflow.py` | 16 | PASSED | Application state transitions (Draft -> Submitted -> In Review -> Approved), step order |
| **M5** | `test_sla.py` | 14 | PASSED | SLA countdown, status (On Track, Approaching, Overdue), simulated clock integration |
| **M6** | `test_escalations.py` | 16 | PASSED | Escalation trigger on overdue, assignment to officer, resolution audit trails |
| **M7** | `test_documents.py` | 15 | PASSED | File upload, SHA-256 calculation, mime validation, officer document scrutiny |
| **M8** | `test_inspections.py` | 14 | PASSED | Joint inspection scheduling, multi-officer report submission, risk scoring |
| **M9** | `test_compliance.py` | 15 | PASSED | Recurring compliance calendar, statutory renewals, filing status updates |
| **TOTAL** | **14 Modules** | **185** | **100% PASS** | **Execution Duration: 87.59s** |

### 3.2 Analysis of the 2,277 Pytest Warnings

During the test execution, pytest emitted **2,277 warning notices**. A forensic inspection of the warning output confirms they belong to two specific non-fatal categories:

1. **Pydantic V1 -> V2 Deprecations (1,842 warnings):**
   - Use of `@validator` instead of `@field_validator`.
   - Use of `regex` parameter instead of `pattern` in field definitions.
   - Pydantic generic warnings regarding `email-validator` compatibility.
   - **Impact:** Code functions correctly under Pydantic `2.9.2`, but will break if Pydantic is upgraded to `3.0`.
2. **SQLAlchemy 2.0 Class Hierarchy Warnings (435 warnings):**
   - Declarative base instantiation warnings and relationship string references.
   - **Impact:** Deprecation notices; fully functional in current version.

---

## 4. Database Isolation Verification

### 4.1 Proof of Development Database Non-Mutation
Prior to running the backend test suite, the development database `backend/rop.db` was inspected:
- **Pre-Test File Size:** `258,048` bytes
- **Pre-Test Last Write Time:** `07-10-2026 21:27:31`

After running `backend\venv\Scripts\pytest.exe -v` (185 tests):
- **Post-Test File Size:** `258,048` bytes
- **Post-Test Last Write Time:** `07-10-2026 21:27:31`

### 4.2 Test Isolation Mechanism
Inspection of `backend/tests/conftest.py` confirms that all tests execute strictly against an ephemeral in-memory SQLite database:
```python
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
```
Each test function creates a fresh in-memory schema and tears it down upon exit, ensuring 100% test isolation.

---

## 5. Frontend Production Build & Static Analysis

### 5.1 Next.js Production Build (`npm run build`)
Executing `npm run build` inside `e:\26130\frontend` generated the following output:

```
> rop-frontend@0.1.0 build
> next build

   ▲ Next.js 14.2.15
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (24/24) ...
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    137 B          87.2 kB
├ ○ /_not-found                          871 B            88 kB
├ ○ /admin/analytics                     1.8 kB          102 kB
├ ○ /admin/audit-logs                    2.1 kB          94.5 kB
├ ○ /admin/clock                         1.5 kB          93.9 kB
├ ○ /admin/dashboard                     2.4 kB          94.8 kB
├ ○ /applicant/applications              2.6 kB          95.1 kB
├ ƒ /applicant/applications/[id]         3.4 kB          95.8 kB
├ ○ /applicant/approvals                 2.8 kB          95.2 kB
├ ○ /applicant/compliance                2.5 kB          94.9 kB
├ ○ /applicant/dashboard                 2.2 kB          94.6 kB
├ ○ /applicant/documents                 2.9 kB          95.3 kB
├ ○ /applicant/graph                     3.8 kB          96.2 kB
├ ○ /applicant/intake                    4.1 kB          96.5 kB
├ ○ /applicant/projects                  2.1 kB          94.5 kB
├ ○ /applicant/projects/new              3.2 kB          95.6 kB
├ ○ /applicant/schemes                   2.7 kB          95.1 kB
├ ○ /login                               3.1 kB          95.5 kB
├ ○ /officer/applications                2.5 kB          95.0 kB
├ ƒ /officer/applications/[id]           3.6 kB          96.1 kB
├ ○ /officer/dashboard                   2.3 kB          94.7 kB
├ ○ /officer/escalations                 2.2 kB          94.6 kB
├ ○ /officer/inspections                 2.4 kB          94.8 kB
└ ƒ /officer/inspections/[id]            3.5 kB          95.9 kB
+ First Load JS shared by all            87.1 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
**Result:** **100% Success (Exit Code 0)**. Zero TypeScript compilation errors. All 24 routes successfully prerendered or server-compiled.

### 5.2 Frontend Linter Failure (`npm run lint`)
Executing `npm run lint` inside `e:\26130\frontend` produced:
```
> rop-frontend@0.1.0 lint
> next lint

? How would you like to configure ESLint? https://nextjs.org/docs/basic-features/eslint
> Base configuration (recommended)
  Cancel
```
**Result:** **Failed (Exit Code 1)** in non-interactive shell.
**Root Cause:** The repository contains `package.json` with script `"lint": "next lint"`, but lacks an `.eslintrc.json` configuration file, prompting Next.js to halt and await interactive input.

---

## 6. Testing Gaps & Missing Test Categories

1. **Absence of Frontend Automated Tests:** The repository contains zero Jest, Vitest, React Testing Library, or Cypress/Playwright tests in `frontend/`. Frontend functionality is verified solely by TypeScript compilation and manual inspection.
2. **Absence of IDOR / Cross-Tenant Negative Tests:** Current backend tests verify that an applicant can fetch their own business, but do not assert that Applicant B receives a 403 Forbidden when attempting to read or modify Applicant A's business ID or uploaded documents.
3. **Absence of Concurrent Update Tests:** The application does not test race conditions (e.g., two officers approving the same application simultaneously or applicant uploading while officer rejects).
4. **Mocked Rule Execution:** All tests in `test_regulatory.py` evaluate against synthetic Scenario C rules. Zero tests validate against real Maharashtra departmental statutes.

---

## 7. Reproduction Steps for Confirmed Issues

### Issue 1: Frontend Linter Interactive Hang / Failure
1. Open terminal in `E:\26130\frontend`.
2. Run `npm run lint` in a non-interactive environment (CI pipeline or standard script execution).
3. Observe process return exit code 1 due to missing `.eslintrc.json`.

### Issue 2: Path Traversal Vulnerability in Document Storage
1. Inspect `backend/app/api/documents.py:84`:
   `file_path = os.path.join(UPLOAD_DIR, f"{business_id}_{file.filename}")`
2. Submit a multipart POST request to `/api/documents/upload` with filename `../../test_escape.txt`.
3. The resulting path escapes `UPLOAD_DIR` unless explicit sanitization is applied.
