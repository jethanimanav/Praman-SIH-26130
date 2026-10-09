# PRAMAN Feature Gap Matrix & Architectural Mapping

**Document ID:** PRAMAN-AUD-002  
**Target Repository:** `E:\26130`  
**Problem Statement:** SIH 2026 — PS 26130 (Government of Maharashtra)  
**Date of Audit:** October 9, 2026  
**Auditor Role:** Senior Software Architect, Full-Stack Engineer, QA Lead & Security Reviewer  
**Audit Scope:** Read-Only Technical Audit (No code or database modifications)

---

## 1. Feature Gap Matrix Overview

This document maps the eight proposed enterprise features against the existing PRAMAN codebase (Milestones M0 through M10). Each feature is analyzed across 13 required architectural dimensions, citing exact repository file paths, database models, endpoints, components, and test files.

Status definitions used throughout this matrix:
- **`CONFIRMED`** — directly verified as implemented and functional.
- **`PARTIALLY_IMPLEMENTED`** — some required behavior exists, but significant gaps remain.
- **`MISSING`** — inspected implementation does not contain the required capability.
- **`BROKEN`** — observed failure or demonstrably incorrect behavior.
- **`UNVERIFIED`** — insufficient evidence to determine the actual state.
- **`NOT_APPLICABLE`** — does not apply in this architectural scope.

---

## 2. Comparative Matrix Table (All 8 Features)

| Feature | Existing Implementation | Relevant Backend Files & Functions | Relevant Models & Migrations | Existing APIs | Existing Frontend Routes & Components | Existing Tests | Confirmed Gaps | Dependencies on Other Features | External Integration Requirements | Regulatory Data Verification Requirements | Implementation Status | Recommended Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Feature 1: Pre-Submission Readiness Check** | Document scrutiny check (`PENDING`/`VERIFIED`), basic field validation in Pydantic schemas. | `backend/app/api/documents.py:verify_document`, `backend/app/regulatory/engine.py:evaluate` | `Document`, `Application`, `RegulatoryProfile` (0 migrations) | `GET /api/documents/business/{id}`, `POST /api/documents/{id}/verify` | `frontend/src/app/applicant/applications/[id]/page.tsx`, `components/StatusBadge.tsx` | `backend/tests/test_documents.py`, `backend/tests/test_workflow.py` | No unified validation engine; no contradiction detection between profile and documents; no readiness scorecard (Ready vs Action Required vs Unable to Verify); does not verify DAG prerequisites prior to submission. | Feature 3, Feature 4, Feature 5 | None (Internal validation engine) | Document checklist and department submission rules must be verified against official notifications. | **PARTIALLY_IMPLEMENTED** | Build `ReadinessCheckEngine` consolidating profile completeness, document scrutiny, and DAG prerequisites into a single pre-flight diagnostic API. |
| **Feature 2: Regulatory Change Impact Radar** | Static YAML rule loader with version tags; rule metadata schema. | `backend/app/regulatory/loader.py:load_rules`, `backend/app/regulatory/engine.py` | Pydantic `RuleSchema`; **No database models** (0 migrations) | `GET /api/regulatory/rules` | `frontend/src/app/applicant/approvals/page.tsx`, `frontend/src/app/admin/dashboard/page.tsx` | `backend/tests/test_regulatory.py` | No regulatory source registry; no detection/versioning of amended Acts/rules; no human review workflow for legal changes; no cascade analysis to alert affected active applications/profiles. | Feature 3, Feature 4 | Gazette / Portal feed scraper or manual officer admin entry (MOCK/DEMO default) | Full legal provenance required: Act/Rule number, official gazette URL, publication date, effective date. | **MISSING** | Design `RegulatorySource` and `RegulatoryChange` database models, create officer review interface, and implement rule impact graph re-evaluation. |
| **Feature 3: Unified Application & Project Workspace** | Applicant dashboard listing business profiles, applications, and documents for a single business. | `backend/app/api/business.py`, `backend/app/api/applications.py` | `Business`, `Application`, `ApprovalStep` (0 migrations) | `GET /api/business/me`, `GET /api/applications/business/{id}` | `frontend/src/app/applicant/dashboard/page.tsx`, `frontend/src/app/applicant/projects/page.tsx` | `backend/tests/test_business.py`, `backend/tests/test_applications.py` | No `Project` model (assumes 1 Business = 1 Project); UI defaults to first application; no multi-project switcher; fragmented tabs without consolidated progress across approvals, queries, and inspections. | Feature 4 | None | None | **PARTIALLY_IMPLEMENTED** | Introduce `Project` entity model, migrate database schema, and redesign applicant workspace to allow Project-level aggregation of applications, documents, and compliance. |
| **Feature 4: One-Time Business Profile & Reusable Information** | Business registration and RegulatoryProfile models; basic intake parser. | `backend/app/api/business.py:create_business`, `backend/app/intake/parser.py` | `Business`, `RegulatoryProfile` (0 migrations) | `POST /api/business/`, `GET /api/business/{id}`, `POST /api/business/{id}/profile` | `frontend/src/app/applicant/intake/page.tsx`, `frontend/src/app/applicant/projects/new/page.tsx` | `backend/tests/test_business.py`, `backend/tests/test_intake.py` | No separation between core company facts (PAN, CIN, GST) and project-specific industrial facts; no field-level provenance/confirmation dates; profile updates directly mutate state without version lineage or draft safeguards. | None (Foundational) | Integration with MCA21 / GSTN / Udyam (MOCK/DEMO default) | Master validation rules for statutory identifiers (PAN, Udyam format). | **PARTIALLY_IMPLEMENTED** | Decouple entity into `CompanyMaster` (reusable enterprise facts) and `ProjectProfile` (site-specific operational facts); add provenance tracking. |
| **Feature 5: Save Draft, Resume & Application Version History** | Application model has `DRAFT` enum status; basic creation endpoint. | `backend/app/api/applications.py:create_application`, `backend/app/core/audit.py` | `Application`, `ApprovalStep`, `AuditLog` (0 migrations) | `POST /api/applications/`, `GET /api/applications/{id}` | `frontend/src/app/applicant/applications/page.tsx` | `backend/tests/test_applications.py`, `backend/tests/test_workflow.py` | Forms do not persist in-progress drafts to backend or localStorage; submitted applications are mutable (no immutable version snapshots); no amendment workflow or version diffing. | Feature 3, Feature 4 | None | Legal validity of submitted declarations requires tamper-proof snapshots. | **PARTIALLY_IMPLEMENTED** | Implement `ApplicationDraft` staging table or versioned JSON snapshotting upon transition from `DRAFT` to `SUBMITTED`. |
| **Feature 6: Department Query & Clarification Centre** | Document status `QUERY_RAISED` with string `review_note`; Officer rejection flow. | `backend/app/api/documents.py:verify_document` | `Document.status`, `Document.review_note` (0 migrations) | `POST /api/documents/{id}/verify` | `frontend/src/app/officer/applications/[id]/page.tsx` | `backend/tests/test_documents.py` | No first-class `DepartmentQuery` entity; queries restricted strictly to documents (no general application queries); no multi-turn conversation thread; no applicant response attachment model; no query SLA tracking. | Feature 3, Feature 5 | Optional notification trigger (SMS/Email via mock) | Department-specific clarification turnaround standards (RTS Maharashtra). | **PARTIALLY_IMPLEMENTED** | Create dedicated `DepartmentQuery` and `QueryResponse` database models, create query center UI for applicants and officers. |
| **Feature 7: Unified Notifications & Deadline Centre** | Static SLA countdown calculation and simulated clock trigger; mock toast notifications. | `backend/app/sla/engine.py:calculate_sla_status`, `backend/app/core/clock.py` | `ApprovalStep`, `ComplianceFiling`, `EscalationEvent` (0 migrations) | `GET /api/sla/status/{id}`, `GET /api/compliance/business/{id}` | `frontend/src/app/applicant/dashboard/page.tsx`, `frontend/src/app/officer/sla/page.tsx` | `backend/tests/test_sla.py`, `backend/tests/test_clock.py` | No `Notification` database model; no persistence of dispatched alerts; no user notification preference center; notifications are computed dynamically on page load; no background scheduler pushing event notifications. | Feature 3, Feature 5, Feature 6 | Integration with notification gateways (MOCK/DEMO default) | Department SLA timelines and holiday calendars require official verification. | **PARTIALLY_IMPLEMENTED** | Build a centralized persistent `NotificationEvent` repository, event-driven dispatcher, and frontend Notification Center tray. |
| **Feature 8: Government Scheme & Incentive Eligibility Assistant** | In-memory scheme matching engine (`PSI 2019`, `M-STED`); hardcoded rule logic in Python. | `backend/app/schemes/engine.py:evaluate_schemes`, `backend/app/api/schemes.py` | Pure in-memory dictionaries; **No database models** (0 migrations) | `GET /api/schemes/eligible/{business_id}`, `GET /api/schemes/list` | `frontend/src/app/applicant/schemes/page.tsx` | `backend/tests/test_schemes.py` | Schemes are hardcoded in Python dictionaries; no database persistence; no source metadata (gazette URLs, validity periods); no distinction between indicative eligibility vs official application requirements; no subsidy calculation engine. | Feature 3, Feature 4 | External government scheme portals (MOCK/DEMO default) | All schemes must be verified against current Maharashtra Industrial Policy and GRs (Government Resolutions). | **PARTIALLY_IMPLEMENTED** | Create `Scheme` and `SchemeEligibilityCriteria` database/YAML schema, add official GR source citations, and implement detailed criteria evaluation breakdown. |

---

## 3. Deep-Dive Feature Architectural Analysis

### 3.1 Feature 1: Pre-Submission Readiness Check
- **Current State:** The system currently relies on Pydantic request models (`ApplicationCreate`) and manual document verification by officers (`POST /api/documents/{id}/verify`). If an applicant clicks "Submit", the system transitions the status to `SUBMITTED` as long as basic required foreign keys exist.
- **Architectural Gaps:**
  - No deterministic pre-flight evaluation checks whether all required document categories (e.g., MPCB CTE, MIDC Allotment Letter) are uploaded and marked `VERIFIED`.
  - No validation checks if business parameters (e.g., power demand `> 500 kW`) contradict uploaded documents (e.g., connected load sanction letter).
  - No readiness assessment outcome enum (`READY`, `ACTION_REQUIRED`, `UNABLE_TO_VERIFY`).
- **Reuse Opportunity:** Leverage `backend/app/regulatory/engine.py` rule outputs and `Document` repository records to evaluate completeness.

### 3.2 Feature 2: Regulatory Change Impact Radar
- **Current State:** Rules reside entirely in static files (`backend/data/rules/demo/scenario_c_rules.yaml`). They are loaded into memory at startup.
- **Architectural Gaps:**
  - Zero models exist for tracking regulatory amendments, gazette notifications, or circulars.
  - Zero mechanism exists to detect when an amendment invalidates a previously generated checklist or requires a re-filing.
  - No human-in-the-loop workflow allowing administrators to review, approve, and stage regulatory rule updates.
- **Reuse Opportunity:** Extend the rule evaluator in `backend/app/regulatory/engine.py` to compare previous profile assessments against updated rule revisions.

### 3.3 Feature 3: Unified Application & Project Workspace
- **Current State:** The UI has an applicant dashboard with fragmented routes (`/applicant/projects`, `/applicant/applications`, `/applicant/documents`, `/applicant/graph`).
- **Architectural Gaps:**
  - The backend lacks an explicit `Project` table. Currently, `Business` serves as both enterprise entity and industrial project.
  - The frontend navigation assumes a single active workflow context, often defaulting to `applications[0]`.
  - There is no single-pane overview consolidating the status of approvals, pending documents, inspections, queries, and recurring obligations.
- **Reuse Opportunity:** Existing UI cards and tables in `/applicant/applications` and `/applicant/documents` can be composed into a tabbed project command center once the `Project` entity is introduced.

### 3.4 Feature 4: One-Time Business Profile & Reusable Information
- **Current State:** The `Business` model captures PAN, Udyam number, constitution, and address. The `RegulatoryProfile` captures industrial parameters (water, power, chemicals).
- **Architectural Gaps:**
  - Modifying business details mutates the existing row in place, potentially compromising historical audits of past applications.
  - No distinction between immutable enterprise master facts (Registration No, PAN) and project-specific operating parameters (connected power, diesel generator capacity).
  - No tracking of field-level confirmation dates or staleness indicators (e.g., "Confirmed 6 months ago").
- **Reuse Opportunity:** The existing `RegulatoryProfile` schema in `backend/app/models/business.py` captures necessary industrial attributes; it simply needs relational separation from enterprise identity.

### 3.5 Feature 5: Save Draft, Resume & Application Version History
- **Current State:** The `Application` model has a status of `DRAFT`. However, creation requires immediate full payload validation, and partial forms cannot be saved.
- **Architectural Gaps:**
  - No autosave or partial draft persistence endpoint.
  - When an application moves from `DRAFT` to `SUBMITTED`, the record remains in the same table and can theoretically be altered if authorization logic permits.
  - No immutable version snapshotting (e.g., JSON representation stored in `AuditLog` or an `ApplicationVersion` table).
- **Reuse Opportunity:** The existing `AuditLog` entity (`backend/app/models/audit.py`) can be integrated with application submission events to store immutable submission payloads.

### 3.6 Feature 6: Department Query & Clarification Centre
- **Current State:** Officers can set document status to `QUERY_RAISED` with a string `review_note`.
- **Architectural Gaps:**
  - There is no applicant-facing communication thread.
  - Queries cannot be raised against application form data or inspection findings.
  - No state machine exists for queries (`OPEN`, `RESPONDED`, `RESOLVED`, `CLOSED`).
  - No timeline or SLA countdown is attached to queries (e.g., Maharashtra Right to Services mandate of 7 days for query responses).
- **Reuse Opportunity:** Re-use the document attachment handling in `backend/app/api/documents.py` to attach applicant response documents to query threads.

### 3.7 Feature 7: Unified Notifications & Deadline Centre
- **Current State:** SLA deadlines are calculated passively in `backend/app/sla/engine.py` and displayed on the officer SLA page.
- **Architectural Gaps:**
  - There is no `Notification` entity in the database.
  - Events (e.g., "Officer raised query", "Inspection scheduled for tomorrow", "SLA approaching in 48 hours") are not recorded as user notifications.
  - No notification dropdown or badge exists in the navigation header.
- **Reuse Opportunity:** The simulated clock in `backend/app/core/clock.py` provides testing capabilities for advancing time and triggering SLA events.

### 3.8 Feature 8: Government Scheme & Incentive Eligibility Assistant
- **Current State:** `backend/app/schemes/engine.py` implements hardcoded rules for Package Scheme of Incentives (PSI 2019) and M-STED based on district classification and investment.
- **Architectural Gaps:**
  - Scheme data is hardcoded in Python dictionaries, preventing administrative updates.
  - No link to official Government Resolutions (GRs) or application portals.
  - Outcomes do not provide structured breakdowns of eligible subsidies (e.g., Capital Subsidy vs Electricity Duty Exemption vs Interest Subvention).
- **Reuse Opportunity:** The matching engine in `app/schemes/engine.py` has working logic; it should be refactored to read externalized YAML or database models.

---

## 4. Implementation Readiness Summary

| Feature | Architectural Readiness | Data Model Gap | API Gap | UI Gap | Recommended Phase |
|---|---|---|---|---|---|
| **Feature 4: Reusable Profile** | **HIGH** | Low (Split entities) | Low | Low | **Phase 1 (Foundation)** |
| **Feature 3: Project Workspace** | **HIGH** | Medium (Add `Project`) | Medium | Medium | **Phase 1 (Foundation)** |
| **Feature 5: Draft & Snapshots** | **HIGH** | Low (Draft JSON field) | Low | Medium | **Phase 1 (Foundation)** |
| **Feature 6: Query Center** | **MEDIUM** | Medium (Query tables) | Medium | Medium | **Phase 2 (Collaboration)** |
| **Feature 1: Readiness Check** | **HIGH** | Low (Evaluation rule) | Low | Low | **Phase 3 (Validation Gate)** |
| **Feature 7: Notification Center** | **MEDIUM** | Medium (`Notification`) | Medium | Medium | **Phase 4 (Operations)** |
| **Feature 8: Scheme Assistant** | **MEDIUM** | Low (YAML migration) | Low | Low | **Phase 4 (Operations)** |
| **Feature 2: Regulatory Radar** | **LOW** | High (Source registry) | High | High | **Phase 5 (Intelligence)** |
