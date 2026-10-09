# ROP — Architecture Decisions

Record of significant decisions made during development.

---

## 2026-10-04 — D001: SQLite as default database

**Decision**: SQLite is the default and only required database.

**Reason**: Laptop-first constraint. 8 GB RAM, student environment, ₹0 budget.
SQLAlchemy models use standard types for future PostgreSQL portability.

**Implications**: No server process needed. rop.db created automatically.

---

## 2026-10-04 — D002: Modular monolith architecture

**Decision**: Single FastAPI process with modules, not microservices.

**Reason**: One student developer. One laptop. Simpler to understand, debug, demo.

**Implications**: All modules share the same SQLite database and process.

---

## 2026-10-04 — D003: ClockService wrapper

**Decision**: All time references go through ClockService.now(), not datetime.utcnow().

**Reason**: SLA simulation requires advancing time artificially. A direct datetime.utcnow()
call cannot be intercepted cleanly.

**Implications**: Admin API can advance/reset the clock for demo purposes.

---

## 2026-10-04 — D004: DEMO status as default for all regulatory data

**Decision**: Every regulatory record defaults to DEMO status.

**Reason**: Prevents accidental use of unverified regulatory information.
VERIFIED status requires source_url, source_title, source_date, reviewed_by.

**Implications**: UI must display status badges. Tests must reject incomplete VERIFIED records.

---

## 2026-10-04 — D005: AI providers with offline fallback

**Decision**: AIService uses provider pattern: GeminiProvider → CachedProvider → RuleBasedFallbackProvider.

**Reason**: Demo must work offline without Gemini, Ollama, or any external API.

**Implications**: Pre-recorded CachedProvider responses required for demo scenario.

---

## 2026-10-04 — D006: IntegrationGateway pattern

**Decision**: All external system calls go through IntegrationGateway with adapter interface.

**Reason**: Government APIs are mock (no verified endpoints). Swap MockAdapter for real adapter when available.

**Implications**: MaitriAdapter and NswsAdapter are placeholder only (CONFIGURATION_REQUIRED).

---

## 2026-10-04 — D007: Deterministic Three-Valued Logic for Regulatory Evaluation

**Decision**: Regulatory applicability is evaluated using deterministic three-valued logic (True / False / Unknown) rather than probabilistic guessing or LLM inference.

**Reason**: Permanent rule #1 & #12: Never invent regulatory facts; prefer deterministic systems for regulatory logic. AI may assist intake (M2), but regulatory applicability rules must evaluate transparently and deterministically.

**Implications**: Missing business attributes evaluate to UNKNOWN, yielding "Verification Required" rather than guessing applicability. Rules are declared in YAML with Pydantic schema validation. VERIFIED rules strictly require source_url, source_date, and reviewed_by metadata.

---

## 2026-10-04 — D008: AI Intake with Provenance and Deterministic Rule-Derived Adaptive Questions

**Decision**: AI is used solely for natural-language extraction into structured drafts with field confidence and provenance tracking. High-impact missing questions are derived directly from fields evaluated by loaded regulatory rules rather than LLM hallucinations. Human confirmation/correction is required before evaluation.

**Reason**: Permanent rules #1, #12, and #13: AI may assist intake, but AI must never determine regulatory truth or invent missing values. Adaptive questions must focus strictly on 3–7 parameters that change regulatory outcomes.

**Implications**: Zero-cost, offline demonstration with CachedProvider (Scenario C) and RuleBasedFallbackProvider. If the applicant answers "Not sure", fields remain explicitly unknown, yielding `Verification Required` in M1 evaluation without guessing.

---

## 2026-10-04 — D009: Regulatory Discovery as a Deterministic Presentation Layer

**Decision**: Regulatory discovery and checklist generation are structured as a clean, deterministic presentation and explainability layer over the existing M1 rule engine rather than a separate database-persisted entity or a secondary inference engine.

**Reason**: The confirmed `RegulatoryProfile` is already persisted in the database. Creating an extra database table for discovery results would introduce unnecessary state synchronization issues. Re-evaluating the confirmed profile through M1 guarantees complete determinism, traceability back to exact rule conditions, and real-time reflection of any updated regulatory YAML rules.

**Implications**: Every discovery item explicitly exposes: WHAT was identified, WHY it was identified (rule explanation), BASED ON (exact profile field values that triggered it), MISSING (fields causing UNKNOWN status), and NEXT ACTION (safe procedural guidance without hallucinating government protocols).

---

## 2026-10-04 — D010: Deterministic Approval DAG & Milestone Advance State Machine

**Decision**: Approval sequences are modeled as a Directed Acyclic Graph (DAG) with mathematically rigorous cycle detection, topological sorting, parallel execution waves, and critical path analysis (longest cumulative timeline). State transitions are governed by strict advance validation in SQLite.

**Reason**: Industrial approvals exhibit strict precedence constraints (e.g., Land Siting before CTE, Factory Approval before Fire NOC). At the same time, multiple approvals can proceed concurrently across independent departments (e.g., Power Feasibility, Factory Plans, and CTE in parallel). A mathematical DAG prevents cyclical dependencies and deterministically computes the minimum project duration (critical path).

**Implications**:
- All steps specify explicit prerequisites (`REQ-...`).
- State machine blocks steps (`BLOCKED`) until all their prerequisites reach `APPROVED`.
- When an approval is recorded, downstream dependent steps whose prerequisites are all satisfied automatically transition to `READY`.
- Officers/admins alone can mark approvals; applicants can initiate ready steps.
- Applications automatically advance from DRAFT -> SUBMITTED -> IN_REVIEW -> APPROVED.

## D011: Deterministic Configuration-Driven SLA and Idempotent Escalation Engine
- **Status**: Accepted (Milestone M5)
- **Context**: Need accurate SLA monitoring, warning alerts, and officer escalations across approval steps without expensive background workers or unreliable AI hallucination of government deadlines.
- **Decision**:
  - SLA configurations reside in declarative YAML (`data/sla/scenario_c_sla.yaml`).
  - Strict anti-hallucination: Zero LLM involvement in calculating deadlines or escalation chains. Missing SLA data explicitly surfaces `SLA_VERIFICATION_REQUIRED`; missing escalation recipients surface `ESCALATION_CONFIGURATION_REQUIRED`.
  - On-the-fly, zero-infrastructure calculation: SLA status (`ON_TRACK`, `WARNING`, `OVERDUE`, `PAUSED`, `COMPLETED`) is calculated on demand relative to `ClockService.now()`, step `started_at`, and accumulated paused duration (`total_paused_seconds`). Completed steps are frozen at `completed_at`.
  - Idempotent Escalation: Overdue steps evaluate against `escalation_threshold_days` and generate `EscalationEvent` records without creating duplicate records across subsequent poll requests.

## D012: Role-Scoped Escalation Resolution and Auditable Operational Workflow
- **Status**: Accepted (Milestone M6)
- **Context**: Need operational dashboards for regulatory officers and system administrators to review, investigate, acknowledge, and resolve SLA escalations while maintaining complete audit trails and role isolation.
- **Decision**:
  - Deterministic 3-state escalation lifecycle: `TRIGGERED` -> `ACKNOWLEDGED` -> `RESOLVED`.
  - Illegal transitions (e.g. `RESOLVED` -> `TRIGGERED`, duplicate acknowledge, duplicate resolve) are rejected with 400 Bad Request.
  - Mandatory human resolution notes: Resolution strictly requires a non-empty `resolution_note` explaining official action taken; automated or empty notes are rejected.
  - Role-scoped authorization: Applicants cannot view or alter officer queues (403 Forbidden). Officers can access department-scoped queues and acknowledge/resolve escalations. Administrators have full system-wide visibility.
  - Zero fabricated metrics: Admin overview analytics and bottleneck diagnostics are computed directly from active database state and stored timestamps. If insufficient data exists, metrics safely surface `0` or `INSUFFICIENT DATA`.

## D013: Local Document Vault with Human Officer Scrutiny and Deterministic Versioning
- **Status**: Accepted (Milestone M7)
- **Context**: Need a secure document management system for compliance dossiers associated with regulatory requirements. Must run locally without cloud storage (S3/Azure), preserve full audit histories across replacements, and enforce authoritative human scrutiny without confusing technical file uploads with legal validity.
- **Decision**:
  - Local File System Vault: Files are stored under `uploads/documents/` using random UUID filenames (`uuid.hex + ext`) to completely prevent path traversal and file collisions.
  - Path Traversal & Content Guards: Storage root verification (`target_path.startswith(storage_root)`), MIME type allowlisting (`.pdf`, `.png`, `.jpg`, `.jpeg`), size caps (max 10 MB), and empty file rejection.
  - Integrity & Deduplication Tracking: SHA-256 checksum calculated and persisted for every uploaded dossier.
  - Version Incrementing Without Data Loss: Re-uploading a document for the same requirement/slot marks the previous version inactive (`is_current = False`) and records version $N+1$ (`is_current = True`). Historical versions remain fully queryable and downloadable.
  - Human Officer Scrutiny Authority: AI/OCR systems do not possess legal authority to approve regulatory submissions. All verification follows a strict state machine: `UPLOADED` -> `UNDER_REVIEW` -> `ACCEPTED` / `REJECTED` / `QUERY_RAISED`.
  - Mandatory Scrutiny Explanations: Rejection (`REJECTED`) and clarification notices (`QUERY_RAISED`) strictly mandate non-empty explanations to guide applicant remediation.
  - Anti-Hallucination Readiness Calculation: Upload completeness % measures files uploaded, but legal readiness score % is computed strictly from `ACCEPTED` documents.

---

## D014: Deterministic Composite Risk Assessment and Central Joint Inspection Scheduling (CIS)
- **Status**: Accepted (Milestone M8)
- **Context**: Under industrial regulatory compliance and DPIIT Business Reforms Action Plan (BRAP), enterprises require risk classification (High/Medium/Low or Red/Orange/Green) to govern inspection frequency and scrutiny levels. Businesses are historically burdened by independent, repetitive visits from multiple departments (Pollution Control, DISH, Fire, Electricity). A Central Inspection System (CIS) synchronizes multi-department inspections into a single joint site visit.
- **Decision**:
  - Declarative Risk Configuration: Scoring rules and thresholds are specified in YAML (`backend/data/risk/scenario_c_risk.yaml`) evaluating confirmed profile data (hazardous chemicals/waste, effluent generation, air emissions, worker density, built-up area, high-tension power).
  - Deterministic Classification: Composite score (0-100) classified into HIGH (RED, >=70, mandatory joint physical inspection, annual cycle), MEDIUM (ORANGE, 40-69, targeted joint inspection), and LOW (GREEN, <40, self-certification/desk verification eligible).
  - Anti-Hallucination Guard: If key parameters are unconfirmed or null, explicit `missing_critical_fields` are surfaced and flagged without guessing. All risk records labelled with `DEMO`.
  - Central Joint Inspection Scheduling: Synchronizes all regulatory bodies having pending approvals into a single unified `JointInspection` entity, preventing duplicate uncoordinated visits.
  - Official Inspection Scrutiny: Official findings and reports (`InspectionReport`) are authored and submitted by authorized inspecting officers (`SATISFACTORY` / `DEFICIENCIES_NOTED` / `NON_COMPLIANT`). Mandatory deficiency notes and corrective directives are enforced for non-compliant visits.
  - Workflow Gating & Clearance: A satisfactory joint inspection automatically annotates and clears the inspection prerequisite across relevant approval steps.

---

## D015: Declarative Support Schemes Discovery and Post-Approval Periodic Compliance Calendar Engine
- **Status**: Accepted (Milestone M9)
- **Context**: Industrial enterprises navigating setup approvals often miss out on available state and central government support schemes, capital subsidies, and green transition incentives. Furthermore, once establishment clearances (e.g. Consent to Establish, Factory Plan Approval) are granted, ongoing statutory compliance returns (monthly effluent logs, quarterly groundwater meter readings, half-yearly environmental compliance returns, annual factory and fire returns) must be tracked to prevent license cancellations and penal liabilities.
- **Decision**:
  - Declarative Support Schemes Rules: Government incentives and subsidy conditions are defined in YAML (`backend/data/schemes/scenario_c_schemes.yaml`) with category, maximum financial assistance amount, application mechanism, prerequisite documents, and conditions evaluated directly against confirmed business profile facts.
  - Deterministic Three-Valued Schemes Evaluation: Pure deterministic `SchemesEngine` categorizes each scheme into `ELIGIBLE`, `POTENTIALLY_ELIGIBLE`, or `NOT_ELIGIBLE`. If partial attributes match, concrete `missing_fields_hint` and qualification guidance are generated without fabricating eligibility facts.
  - Post-Approval 12-Month Projected Compliance Calendar: Ongoing operational obligations are defined in YAML (`backend/data/compliance/scenario_c_compliance.yaml`) specifying frequencies (monthly, quarterly, semi-annual, annual), lead notice days, statutory Acts, required forms, and required metric fields.
  - Zero-Infrastructure Simulated Time Evaluation: Filings in `ComplianceFiling` are dynamically projected across a 12-month forward horizon. Statutory status (`UPCOMING`, `DUE_SOON`, `OVERDUE`) and penalty risks are derived on the fly relative to `ClockService.now()`, completely avoiding background cron daemons or vector databases.
  - Authoritative Officer Verification & Rejection Explanations: Applicant filing returns record raw metric logs and uploaded reports. Officer verification enforces mandatory statutory justification notes on rejections. Immutable audit logs track submissions and officer decisions. All records visibly carry `data_status: "DEMO"`.
---

## D016: Deterministic Cross-Milestone Analytics and Executive Insights Engine (Final Milestone M10)
- **Status**: Accepted (Milestone M10)
- **Context**: System administrators, regulatory department heads, and executive oversight bodies require real-time visibility into cross-department application turnaround times, SLA compliance rates, officer scrutiny queues, facility risk distributions, and overdue statutory compliance filings. Crucially, metrics must be derived deterministically from actual SQLite state across all milestones (M1–M9) with absolute zero hallucination or fabricated government statistics.
- **Decision**:
  - Deterministic Aggregation Engine: `AnalyticsService` executes pure SQL aggregations and exact date-math calculations over `Application`, `ApprovalStep`, `EscalationEvent`, `Document`, `JointInspection`, and `ComplianceFiling` records.
  - Zero Fabricated Metrics: Missing historical records, durations, or rates strictly yield `None` / `INSUFFICIENT DATA` / `NO DATA` rather than fabricating statistical averages or guessing government efficiency scores.
  - Mean & Median Turnaround Calculations: Application processing times and escalation resolution hours report both arithmetic mean and median, robustly handling skewed distributions and empty dataset edge cases.
  - Deterministic Rule-Derived Operational Insights: High-priority operational alerts (`CRITICAL`, `WARNING`, `INFO`) are synthesized from concrete conditions (e.g. overdue critical path approval milestones, active SLA breaches, document scrutiny backlogs, compliance filing penalty risks) without querying external LLMs or black-box classifiers.
  - Department Workload & On-Time Performance Matrix: Aggregates step counts, active workloads, overdue milestones, and on-time adherence rates (`on_time_rate = completed_on_time / completed_steps * 100`) per regulatory body.
  - Zero-Infrastructure Simulated Time Compatibility: Works seamlessly with `ClockService` time travel, allowing administrators to advance simulated platform time and observe real-time SLA health, escalation triggering, and compliance penalty transitions deterministically.
