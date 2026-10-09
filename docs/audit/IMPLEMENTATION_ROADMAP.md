# PRAMAN Implementation Roadmap & Dependency Architecture

**Document ID:** PRAMAN-AUD-003  
**Target Repository:** `E:\26130`  
**Problem Statement:** SIH 2026 — PS 26130 (Government of Maharashtra)  
**Date of Audit:** October 9, 2026  
**Auditor Role:** Senior Software Architect, Full-Stack Engineer, QA Lead & Security Reviewer  
**Audit Scope:** Read-Only Technical Audit (No code or database modifications)

---

## 1. Sequence Assessment & Architectural Dependency Analysis

### 1.1 Critical Flaw in the Proposed Sequential Order
The initially proposed sequence ordered the features as:
1. Unified Application & Project Workspace
2. One-Time Business Profile & Reusable Information
3. Save Draft, Resume & Application Version History
4. Department Query & Clarification Centre
5. Pre-Submission Readiness Check
6. Unified Notifications & Deadline Centre
7. Regulatory Change Impact Radar
8. Government Scheme & Incentive Eligibility Assistant

#### Architectural Diagnosis:
- **Dependency Inversion Between Feature 1 and Feature 2:** The Unified Application & Project Workspace (Feature 1 in proposed order) cannot be cleanly implemented without first stabilizing the boundary between persistent enterprise facts and project-specific operational data (Feature 2 in proposed order).
- **Premature Readiness Evaluation:** Attempting to validate pre-submission readiness (Feature 5 in proposed order) prior to establishing Department Queries (Feature 4) and Draft Versioning (Feature 3) results in throwaway code, because a submission readiness check must verify whether open department queries or pending document revisions exist.

### 1.2 Recommended Implementation Sequence (Phased by Architectural Dependency)

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: CORE DATA MODEL & WORKSPACE FOUNDATION                        │
│ 1.1 One-Time Business Profile & Reusable Info (Feature 4)              │
│ 1.2 Unified Application & Project Workspace (Feature 3)                │
│ 1.3 Save Draft, Resume & Application Version History (Feature 5)       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: COLLABORATIVE RESOLUTION & PRE-SUBMISSION GATE                │
│ 2.1 Department Query & Clarification Centre (Feature 6)                │
│ 2.2 Pre-Submission Readiness Check Engine (Feature 1)                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: OPERATIONAL INTELLIGENCE & BUSINESS ASSISTANCE                │
│ 3.1 Unified Notifications & Deadline Centre (Feature 7)                │
│ 3.2 Government Scheme & Incentive Eligibility Assistant (Feature 8)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: REGULATORY CHANGE MONITORING & AUDIT RADAR                    │
│ 4.1 Regulatory Change Impact Radar (Feature 2)                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Common Data Contracts & Shared Models

Before implementing individual packages, the following shared database entities must be established through a formal Alembic migration.

```
┌───────────────────────────────────────────────────────────────────────┐
│                           COMPANY MASTER                              │
│  id, legal_name, pan, cin, udyam_number, constitution, registered_address│
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ 1:N
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                              PROJECT                                  │
│  id, business_id, project_name, district, taluka, industrial_zone,    │
│  sector, sub_sector, power_demand, water_kld, pollution_category      │
└───────────┬───────────────────────┬───────────────────────┬───────────┘
            │ 1:N                   │ 1:N                   │ 1:N
            ▼                       ▼                       ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐
│     APPLICATION      │ │       DOCUMENT       │ │  COMPLIANCE FILING  │
│ id, project_id, type │ │ id, project_id, type │ │ id, project_id, task│
└───────────┬──────────┘ └──────────────────────┘ └─────────────────────┘
            │ 1:N
            ▼
┌───────────────────────────────────────────────┐
│               DEPARTMENT QUERY                │
│  id, application_id, officer_id, query_text,  │
│  status (OPEN / RESPONDED / RESOLVED)         │
└───────────────────────────────────────────────┘
```

---

## 3. Work Package Specifications

### Work Package 1: One-Time Business Profile & Reusable Information (Feature 4)
- **Goal & Scope:** Decouple corporate enterprise identity from site-specific project configurations. Enable persistent, reusable statutory records (PAN, Udyam, CIN) that pre-fill subsequent filings without re-entry.
- **Existing Modules to Reuse:** `backend/app/models/business.py`, `backend/app/api/business.py`, `backend/app/intake/parser.py`.
- **New Backend Work:**
  - Create `CompanyMaster` model distinct from `ProjectProfile`.
  - Implement field provenance metadata (`verified_source`, `last_confirmed_at`).
  - Add API endpoints: `GET /api/business/{id}/reusable-facts`, `POST /api/business/{id}/confirm-staleness`.
- **New Frontend Work:**
  - Redesign Business Profile page to highlight master corporate credentials and freshness badges.
  - Implement a "Prefill from Master" action in project onboarding wizards.
- **Database / Migration Implications:** Migration script `0001_create_company_master.py` migrating existing `Business` fields cleanly.
- **API Contract Requirements:**
  ```json
  {
    "company_id": 1,
    "legal_name": "Precision Auto Components Pvt Ltd",
    "pan": "ABCDE1234F",
    "udyam_number": "UDYAM-MH-12-0012345",
    "staleness_status": "FRESH",
    "last_confirmed_at": "2026-10-09T10:00:00Z"
  }
  ```
- **Security Considerations:** Validate that applicant user strictly owns the company ID (prevent IDOR).
- **Tests Required:** Unit tests for provenance updates; authorization tests preventing cross-tenant access.
- **Acceptance Criteria:** A business can register once and start multiple projects without re-entering PAN, GSTIN, or Udyam credentials.

---

### Work Package 2: Unified Application & Project Workspace (Feature 3)
- **Goal & Scope:** Deliver a unified multi-project operational cockpit for industrial applicants. Enable switching between projects while presenting consolidated summaries of approvals, documents, queries, and inspections.
- **Existing Modules to Reuse:** `backend/app/api/applications.py`, `backend/app/api/documents.py`, `backend/app/workflow/engine.py`.
- **New Backend Work:**
  - Create `Project` model linked to `Business`.
  - Re-point `Application`, `Document`, and `JointInspection` to `project_id`.
  - Create aggregate summary endpoint: `GET /api/projects/{id}/cockpit-summary`.
- **New Frontend Work:**
  - Build persistent `ProjectContext` provider and project selector dropdown in header.
  - Create unified Project Dashboard aggregating: Required Approvals, Document Status, Open Queries, and Upcoming Inspections.
- **Database / Migration Implications:** Foreign key updates linking applications and documents to `projects.id`.
- **API Contract Requirements:**
  ```json
  {
    "project_id": 101,
    "project_name": "Chakan Auto Unit 2",
    "overall_status": "IN_PROGRESS",
    "metrics": {
      "approvals_total": 8,
      "approvals_completed": 3,
      "documents_verified": 12,
      "documents_pending": 2,
      "open_queries": 1,
      "scheduled_inspections": 1
    }
  }
  ```
- **Security Considerations:** Enforce project authorization checks across all sub-resource queries.
- **Tests Required:** Multi-project isolation tests; project dashboard aggregation endpoint tests.
- **Acceptance Criteria:** An applicant with two separate industrial facilities can toggle between them and view independent approval pipelines.

---

### Work Package 3: Save Draft, Resume & Application Version History (Feature 5)
- **Goal & Scope:** Provide resilient draft persistence allowing applicants to pause and resume multi-step applications. Create immutable submission snapshots upon filing.
- **Existing Modules to Reuse:** `backend/app/models/application.py`, `backend/app/models/audit.py`, `backend/app/core/audit.py`.
- **New Backend Work:**
  - Add `draft_payload` (JSON) to `Application` model.
  - Implement submission snapshot table `ApplicationSnapshot` capturing full state at moment of submission.
  - Add draft autosave endpoint: `PATCH /api/applications/{id}/draft`.
- **New Frontend Work:**
  - Implement client-side debounce autosave in application forms.
  - Add "Last saved at [timestamp]" indicator and "Resume Draft" callouts.
  - Implement version history viewer comparing draft changes against submitted snapshots.
- **Database / Migration Implications:** Add `draft_payload` column and `application_snapshots` table.
- **API Contract Requirements:**
  ```json
  {
    "application_id": 501,
    "version": 1,
    "status": "DRAFT",
    "last_saved_at": "2026-10-09T12:30:00Z",
    "payload": { "boiler_capacity_tons": 5.5, "fuel_storage_type": "LPG" }
  }
  ```
- **Security Considerations:** Prevent editing of `draft_payload` once application transitions to `SUBMITTED`.
- **Tests Required:** Test autosave concurrency, test immutability of submitted snapshots.
- **Acceptance Criteria:** Applicant can disconnect internet or close browser mid-application, log in later, and resume with zero data loss.

---

### Work Package 4: Department Query & Clarification Centre (Feature 6)
- **Goal & Scope:** Implement a dedicated clarification management system enabling departmental officers to raise targeted queries on applications, and applicants to provide responses and attachments within statutory timeframes.
- **Existing Modules to Reuse:** `backend/app/models/document.py`, `backend/app/api/documents.py`, `backend/app/core/clock.py`.
- **New Backend Work:**
  - Create `DepartmentQuery` and `QueryResponse` models.
  - Query state machine: `OPEN` -> `RESPONDED` -> `RESOLVED` / `REOPENED`.
  - Add query SLA countdown logic (e.g., Maharashtra RTS 7-day clock).
  - Add endpoints: `POST /api/queries/raise`, `POST /api/queries/{id}/respond`, `POST /api/queries/{id}/resolve`.
- **New Frontend Work:**
  - Applicant Query Inbox with urgency badges (Overdue, Approaching Deadline).
  - Officer Clarification Workbench with response review and attachment verification.
- **Database / Migration Implications:** Create `department_queries` and `query_responses` tables.
- **API Contract Requirements:**
  ```json
  {
    "query_id": 42,
    "application_id": 501,
    "department": "MPCB",
    "raised_by": "Dr. V. Patil (Sub-Regional Officer)",
    "query_text": "Please clarify effluent treatment capacity for electroplating rinse water.",
    "status": "OPEN",
    "deadline": "2026-10-16T17:00:00Z"
  }
  ```
- **Security Considerations:** Officers can only query applications assigned to their department; applicants can only respond to their own queries.
- **Tests Required:** Query state transition tests; role-based query creation tests; query response attachment validation.
- **Acceptance Criteria:** An officer can raise a clarification request, pause the application SLA timer, and receive an applicant document response that automatically resumes scrutiny.

---

### Work Package 5: Pre-Submission Readiness Check Engine (Feature 1)
- **Goal & Scope:** Create an automated diagnostic engine that audits an application draft against required forms, document checklists, DAG prerequisites, and profile consistency before allowing formal submission.
- **Existing Modules to Reuse:** `backend/app/regulatory/engine.py`, `backend/app/regulatory/graph.py`, `backend/app/models/document.py`.
- **New Backend Work:**
  - Implement `ReadinessAuditEngine` evaluating:
    1. Mandatory field completion.
    2. Document presence and scrutiny state (`VERIFIED`).
    3. Contradiction checks (e.g., hazardous waste profile without hazardous disposal plan).
    4. Workflow prerequisite status (e.g., MPCB Consent to Establish required before Factory Plan Approval).
    5. Absence of unresolved departmental queries.
  - Add endpoint: `POST /api/applications/{id}/readiness-check`.
- **New Frontend Work:**
  - Build interactive "Pre-Submission Readiness Scorecard" displaying green checks, warnings, and blockers with direct deep-links to missing items.
- **Database / Migration Implications:** None (Computed diagnostic assessment).
- **API Contract Requirements:**
  ```json
  {
    "application_id": 501,
    "readiness_status": "ACTION_REQUIRED",
    "score": 85,
    "checks": [
      { "category": "DOCUMENTS", "name": "MPCB CTE Certificate", "status": "PASS" },
      { "category": "PREREQUISITES", "name": "MIDC Land Allotment", "status": "PASS" },
      { "category": "QUERIES", "name": "Unresolved Clarifications", "status": "FAIL", "message": "1 open query from MPCB requires response" }
    ]
  }
  ```
- **Security Considerations:** Readiness checks must not mutate application records.
- **Tests Required:** Test cases evaluating partial documents, contradictory fields, and prerequisite failures.
- **Acceptance Criteria:** Applicant receives clear, actionable guidance preventing premature submissions that would face immediate departmental rejection.

---

### Work Package 6: Unified Notifications & Deadline Centre (Feature 7)
- **Goal & Scope:** Establish an enterprise notification and alert hub consolidating application milestones, query deadlines, inspection dates, and SLA escalations into persistent, actionable alerts.
- **Existing Modules to Reuse:** `backend/app/sla/engine.py`, `backend/app/core/clock.py`, `backend/app/models/escalation.py`.
- **New Backend Work:**
  - Create persistent `Notification` model (`id`, `user_id`, `title`, `body`, `type`, `action_url`, `is_read`, `created_at`).
  - Implement event bus triggers on query creation, inspection scheduling, and SLA breaches.
  - Endpoints: `GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`.
- **New Frontend Work:**
  - Global Notification Bell icon in top navigation bar with unread count badge.
  - Dropdown drawer and dedicated `/notifications` management view.
- **Database / Migration Implications:** Create `notifications` table.
- **API Contract Requirements:**
  ```json
  {
    "id": 901,
    "type": "QUERY_DEADLINE",
    "severity": "WARNING",
    "title": "Query Response Due in 48 Hours",
    "message": "MPCB clarification on Application APP-2026-0042 is due by October 11.",
    "action_url": "/applicant/queries/42",
    "is_read": false,
    "created_at": "2026-10-09T08:00:00Z"
  }
  ```
- **Security Considerations:** Users can only retrieve and mark notifications addressed to their `user_id`.
- **Tests Required:** Notification event creation tests; read status update tests; user tenant isolation.
- **Acceptance Criteria:** Whenever a query is raised or an SLA approaches breach, a persistent notification appears in the user's tray with a direct action link.

---

### Work Package 7: Government Scheme & Incentive Assistant (Feature 8)
- **Goal & Scope:** Upgrade the prototype scheme matcher into an authoritative policy assistant linking industrial profiles to Maharashtra Package Scheme of Incentives (PSI) benefits, capital subsidies, and stamp duty waivers with verified GR citations.
- **Existing Modules to Reuse:** `backend/app/schemes/engine.py`, `backend/app/api/schemes.py`.
- **New Backend Work:**
  - Externalize scheme definitions to structured YAML schema (`data/schemes/maharashtra/`).
  - Add scheme eligibility engine calculating indicative subsidy ceilings based on taluka category (A/B/C/D/D+).
  - Add detailed breakdown endpoint: `GET /api/schemes/{id}/eligibility-detail`.
- **New Frontend Work:**
  - Redesign Scheme Finder with taluka classification guides, required document checklists, and indicative incentive calculation breakdowns.
- **Database / Migration Implications:** Optional `Scheme` model or validated YAML repository.
- **API Contract Requirements:**
  ```json
  {
    "scheme_code": "MH-PSI-2019",
    "scheme_name": "Package Scheme of Incentives 2019",
    "eligibility_status": "ELIGIBLE",
    "zone_category": "Zone D (Vidarbha / Marathwada)",
    "indicative_benefits": {
      "capital_subsidy_pct": 30.0,
      "electricity_duty_exemption_years": 7,
      "stamp_duty_exemption_pct": 100.0
    },
    "authoritative_source": "GR No. PSI-2019/CR-104/IND-8 dated 12/06/2019"
  }
  ```
- **Security Considerations:** Clearly label all benefit amounts as "Indicative Estimate — Subject to District Industries Centre (DIC) Sanction".
- **Tests Required:** Scheme matching tests for Taluka classifications A through D+.
- **Acceptance Criteria:** A business in Nanded (Zone D+) receives an accurate breakdown of eligible fiscal incentives with official Government Resolution citations.

---

### Work Package 8: Regulatory Change Impact Radar (Feature 2)
- **Goal & Scope:** Establish an administrative and applicant radar system tracking regulatory gazette changes, circulars, and rule amendments, assessing their impact on active projects and existing filings.
- **Existing Modules to Reuse:** `backend/app/regulatory/engine.py`, `backend/app/regulatory/loader.py`, `backend/app/regulatory/graph.py`.
- **New Backend Work:**
  - Create `RegulatorySource` and `RegulatoryChange` models.
  - Implement rule version diff engine comparing rule sets.
  - Implement impact scanner: identifies all active `Project` and `Application` records affected by a modified rule.
  - Endpoints: `POST /api/admin/regulatory-changes`, `GET /api/regulatory-changes/impact/{project_id}`.
- **New Frontend Work:**
  - Admin Regulatory Desk: Review gazette updates, stage rule changes, and preview impacted businesses.
  - Applicant Impact Alert: Banner in project cockpit alerting user to rule revisions affecting their plant.
- **Database / Migration Implications:** Create `regulatory_sources` and `regulatory_changes` tables.
- **API Contract Requirements:**
  ```json
  {
    "change_id": 12,
    "act_name": "Maharashtra Water (Prevention & Control of Pollution) Rules",
    "amendment_date": "2026-10-01",
    "summary": "Mandatory installation of Online Continuous Emission Monitoring System (OCEMS) for Orange Category units > 15 KLD.",
    "affected_projects_count": 14,
    "impact_level": "HIGH"
  }
  ```
- **Security Considerations:** Only users with `ADMIN` role can stage or publish regulatory changes.
- **Tests Required:** Regulatory change cascade tests; impact evaluation on existing projects.
- **Acceptance Criteria:** An admin can enter a revised environmental threshold, and the system automatically flags all active projects exceeding that threshold with an action requirement.

---

## 4. Regression Gates & Rollback Plan

### 4.1 Regression Gates (Enforced Before Any Milestone Merge)
1. **Gate 1 (Unit & Integration):** All 185 existing backend tests must pass with 0 failures (`pytest tests/ -v`).
2. **Gate 2 (Database Migration):** Alembic migrations must execute bidirectionally (`alembic upgrade head` followed by `alembic downgrade -1` and `alembic upgrade head`) without schema residue.
3. **Gate 3 (Build Integrity):** `npm run build` in `frontend/` must complete with exit code 0 and zero TypeScript errors.
4. **Gate 4 (Tenant Isolation):** Pytest security suite must assert that Cross-Tenant IDOR attempts return HTTP 403 Forbidden.
5. **Gate 5 (Data Status Labelling):** All UI components rendering regulatory claims must display a valid `StatusBadge` (`VERIFIED`, `DEMO`, or `MOCK`).

### 4.2 Rollback Strategy
- Every work package must be implemented on an isolated branch once Git is initialized.
- Every database modification must include a complete `downgrade()` implementation in its Alembic migration.
- SQLite backups of `backend/rop.db` must be taken prior to applying database migrations in development and staging environments.
