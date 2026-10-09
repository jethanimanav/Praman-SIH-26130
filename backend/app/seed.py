"""
Seed demo users for development and demonstration.

All demo accounts use the password from DEMO_USER_PASSWORD env var.
These accounts are labelled DEMO and must not be used in production.
"""
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.config import get_settings

settings = get_settings()

DEMO_USERS = [
    {
        "email": "applicant@demo.rop",
        "full_name": "Demo Applicant",
        "role": UserRole.APPLICANT,
    },
    {
        "email": "officer@demo.rop",
        "full_name": "Demo Officer",
        "role": UserRole.OFFICER,
    },
    {
        "email": "admin@demo.rop",
        "full_name": "Demo Administrator",
        "role": UserRole.ADMIN,
    },
]


from datetime import timedelta
from app.core.clock import ClockService
from app.models.business import Business, RegulatoryProfile
from app.models.workflow import Application, ApprovalStep, ApplicationStatus, StepStatus
from app.models.escalation import EscalationEvent
from app.models.document import Document, DocumentStatus
from app.models.inspection import JointInspection, InspectionStatus
from app.models.compliance import ComplianceFiling, ComplianceFilingStatus
from app.sla.schema import EscalationStatus
from app.workflow.service import WorkflowService
from app.compliance.service import ComplianceService
from app.document.storage import DocumentStorageService


def seed_demo_users(db: Session) -> None:
    """Create demo users if they do not already exist."""
    password_hash = get_password_hash(settings.demo_user_password)
    for user_data in DEMO_USERS:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing:
            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                hashed_password=password_hash,
                role=user_data["role"],
            )
            db.add(user)
    db.commit()


def seed_demo_scenario(db: Session) -> None:
    """
    Idempotent deterministic seed for Scenario C:
    Apex Precision Automotive Components Pvt Ltd
    Populates Business, Profile, Application, Steps, Escalation, Documents, CIS Inspection, and Compliance filings.
    Clearly labeled with DEMO status.
    """
    seed_demo_users(db)

    applicant = db.query(User).filter(User.email == "applicant@demo.rop").first()
    officer = db.query(User).filter(User.email == "officer@demo.rop").first()
    if not applicant or not officer:
        return

    # Check if demo business already exists
    existing_biz = (
        db.query(Business)
        .filter(Business.user_id == applicant.id, Business.name == "Apex Precision Automotive Components Pvt Ltd")
        .first()
    )
    from app.project.service import ProjectService
    if existing_biz:
        if not existing_biz.registration_number:
            existing_biz.registration_number = "U29100MH2018PTC305612"
            existing_biz.entity_type = "Private Limited Company"
            existing_biz.pan_number = "AAACA1234K"
            existing_biz.gstin = "27AAACA1234K1Z8"
            existing_biz.contact_email = "compliance@apexprecision.in"
            existing_biz.contact_phone = "+91 20 2747 1234"
            existing_biz.registered_office_address = "Plot No. E-45, Phase II, MIDC Industrial Area, Chakan, Pune - 410501"
            db.commit()
        ProjectService.ensure_default_project_for_business(db, existing_biz)

        existing_app = (
            db.query(Application)
            .filter(Application.business_id == existing_biz.id)
            .first()
        )
        if existing_app:
            return  # Already seeded, idempotent no-op

    biz = existing_biz
    if not biz:
        biz = Business(
            user_id=applicant.id,
            name="Apex Precision Automotive Components Pvt Ltd",
            description="Automotive precision engineering, CNC fabrication, electroplating, and battery casing manufacturing unit situated in Chakan MIDC Industrial Zone, Pune, Maharashtra.",
            registration_number="U29100MH2018PTC305612",
            entity_type="Private Limited Company",
            pan_number="AAACA1234K",
            gstin="27AAACA1234K1Z8",
            contact_email="compliance@apexprecision.in",
            contact_phone="+91 20 2747 1234",
            registered_office_address = "Plot No. E-45, Phase II, MIDC Industrial Area, Chakan, Pune - 410501",
        )
        db.add(biz)
        db.commit()
        db.refresh(biz)
        ProjectService.ensure_default_project_for_business(db, biz)

    # 2. Confirmed Regulatory Profile (Scenario C)
    existing_profile = db.query(RegulatoryProfile).filter(RegulatoryProfile.business_id == biz.id).first()
    if not existing_profile:
        scenario_c_profile = {
            "sector": "manufacturing",
            "location": {"zone_type": "industrial"},
            "processes": ["electroplating", "metal_fabrication"],
            "effluent_generation": True,
            "air_emissions": True,
            "hazardous_waste_generated": True,
            "workers_count": 45,
            "power_connected_kw": 350.0,
            "built_up_area_sqm": 3500.0,
            "water_source": "borewell",
            "investment_plant_machinery_cr": 12.5,
            "annual_turnover_cr": 45.0,
        }
        reg_profile = RegulatoryProfile(
            business_id=biz.id,
            extracted_data=scenario_c_profile,
            confirmed_data=scenario_c_profile,
            is_confirmed=True,
        )
        db.add(reg_profile)
        db.commit()

    # 3. Create Application from Discovery rules
    app = WorkflowService.create_application_from_discovery(
        db=db,
        business=biz,
        user=applicant,
        title="Apex Automotive — Industrial Clearances & Establishment Approvals",
    )
    app.status = ApplicationStatus.IN_REVIEW
    app.submitted_at = ClockService.now() - timedelta(days=26)
    db.commit()
    db.refresh(app)

    # 4. Configure Steps and Overdue SLA
    now = ClockService.now()
    step_siting = db.query(ApprovalStep).filter(
        ApprovalStep.application_id == app.id,
        ApprovalStep.requirement_id == "REQ-SITING-001"
    ).first()

    if step_siting:
        step_siting.status = StepStatus.IN_PROGRESS
        step_siting.started_at = now - timedelta(days=26)  # 26 days ago (21 day limit)
        db.add(step_siting)

        # Create active EscalationEvent on siting step
        existing_esc = db.query(EscalationEvent).filter(
            EscalationEvent.application_id == app.id,
            EscalationEvent.requirement_id == "REQ-SITING-001"
        ).first()

        if not existing_esc:
            esc = EscalationEvent(
                application_id=app.id,
                approval_step_id=step_siting.id,
                requirement_id="REQ-SITING-001",
                sla_id="SLA-DEMO-001",
                trigger_type="OVERDUE_THRESHOLD_BREACH",
                level="LEVEL_1",
                recipient_role="supervising_officer",
                days_overdue=5.0,
                reason="Industrial Siting Clearance has exceeded statutory SLA limit of 21 days by 5 days (DEMO DATA).",
                status=EscalationStatus.TRIGGERED,
                triggered_at=now - timedelta(days=5),
            )
            db.add(esc)

    # 5. Seed Documents
    if step_siting:
        doc_store = DocumentStorageService
        fname1, sha1, size1 = doc_store.save_file(
            "apex_chakan_site_layout_plan_v1.pdf",
            b"%PDF-1.4 DEMO SITE LAYOUT PLAN FOR APEX AUTOMOTIVE CHAKAN PUNE\n%%EOF",
            "application/pdf",
        )
        fname2, sha2, size2 = doc_store.save_file(
            "midc_allotment_order_chakan.pdf",
            b"%PDF-1.4 DEMO MIDC ALLOTMENT ORDER FOR APEX AUTOMOTIVE CHAKAN PUNE\n%%EOF",
            "application/pdf",
        )

        doc1 = Document(
            business_id=biz.id,
            application_id=app.id,
            approval_step_id=step_siting.id,
            requirement_id="REQ-SITING-001",
            document_name="Site Layout Plan",
            original_filename="apex_chakan_site_layout_plan_v1.pdf",
            storage_path=fname1,
            mime_type="application/pdf",
            file_size_bytes=size1,
            checksum_sha256=sha1,
            version=1,
            is_current=True,
            status=DocumentStatus.UNDER_REVIEW,
            data_status="DEMO",
            uploaded_at=now - timedelta(days=2),
            uploaded_by_id=applicant.id,
        )

        doc2 = Document(
            business_id=biz.id,
            application_id=app.id,
            approval_step_id=step_siting.id,
            requirement_id="REQ-SITING-001",
            document_name="Industrial Land Allotment Letter",
            original_filename="midc_allotment_order_chakan.pdf",
            storage_path=fname2,
            mime_type="application/pdf",
            file_size_bytes=size2,
            checksum_sha256=sha2,
            version=1,
            is_current=True,
            status=DocumentStatus.ACCEPTED,
            data_status="DEMO",
            uploaded_at=now - timedelta(days=10),
            uploaded_by_id=applicant.id,
            reviewed_at=now - timedelta(days=8),
            reviewed_by_id=officer.id,
            review_decision="ACCEPTED",
            review_note="Verified against MIDC Land Registry record MIDC-CHK-2026-9041.",
        )
        db.add_all([doc1, doc2])

    # 6. Seed Joint Inspection
    insp = JointInspection(
        application_id=app.id,
        business_id=biz.id,
        scheduled_date=now + timedelta(days=4),
        time_slot="10:30 AM - 01:30 PM",
        status=InspectionStatus.SCHEDULED,
        risk_category="HIGH",
        lead_inspector_id=officer.id,
        participating_departments=[
            "State Pollution Control Board (DEMO)",
            "Directorate of Industrial Safety & Health (DEMO)",
            "State Fire Services (DEMO)",
        ],
        checklist_items=[
            "Zero Liquid Discharge (ZLD) Effluent Treatment Plant capacity verification",
            "Hazardous waste secondary containment bunds and manifest log check",
            "Fire hydrant ring line pressure and automated deluge systems",
            "Worker personal protective equipment and ventilation in electroplating zone",
        ],
        notes="Harmonized Central Inspection System (CIS) multi-department site visit for high-risk red-category industrial facility.",
        data_status="DEMO",
    )
    db.add(insp)

    # 7. Seed Post-Approval Compliance Filings
    filings = ComplianceService.ensure_application_filings(db, app)
    for f in filings:
        if "PCB-001" in f.compliance_id or "Effluent" in f.title:
            f.status = ComplianceFilingStatus.OVERDUE
            f.due_date = now - timedelta(days=2)
            f.penalty_risk_active = True
        elif "PCB-002" in f.compliance_id or "Hazardous" in f.title:
            f.status = ComplianceFilingStatus.SUBMITTED
            f.submitted_at = now - timedelta(hours=8)
            f.submitted_by_id = applicant.id
            f.filing_data = {
                "hazardous_waste_category": "5.1",
                "quantity_mt": 1.45,
                "disposal_facility": "MEPL Ranjangaon TSDF (DEMO)",
            }
            f.remarks = "Quarterly hazardous waste manifest return submitted for Q3 with authorised TSDF receipt."
        elif "CGWA" in f.compliance_id or "Groundwater" in f.title:
            f.status = ComplianceFilingStatus.DUE_SOON
            f.due_date = now + timedelta(days=6)

    db.commit()

    seed_demo_radar_and_notifications(db, applicant, officer, app.id)


def seed_demo_radar_and_notifications(db: Session, applicant: User, officer: User, app_id: int = None) -> None:
    from app.models.radar import RegulatorySource, RegulatoryChangeRecord
    from app.models.notification import Notification

    # 1. Sources
    src1 = db.query(RegulatorySource).filter(RegulatorySource.source_code == "SRC-MPCB-01").first()
    if not src1:
        src1 = RegulatorySource(
            source_code="SRC-MPCB-01",
            name="Maharashtra Pollution Control Board (MPCB) Notifications",
            issuing_authority="Environment & Climate Change Dept, GoM",
            official_url="https://mpcb.gov.in/notifications",
            source_type="CIRCULAR",
            verification_status="DEMO",
            is_active=True,
            created_at=ClockService.now(),
        )
        db.add(src1)

    src2 = db.query(RegulatorySource).filter(RegulatorySource.source_code == "SRC-DISH-01").first()
    if not src2:
        src2 = RegulatorySource(
            source_code="SRC-DISH-01",
            name="Directorate of Industrial Safety & Health (DISH) Advisories",
            issuing_authority="Labour & Employment Dept, GoM",
            official_url="https://dish.maharashtra.gov.in",
            source_type="POLICY",
            verification_status="DEMO",
            is_active=True,
            created_at=ClockService.now(),
        )
        db.add(src2)

    src3 = db.query(RegulatorySource).filter(RegulatorySource.source_code == "SRC-MIDC-01").first()
    if not src3:
        src3 = RegulatorySource(
            source_code="SRC-MIDC-01",
            name="Maharashtra Industrial Development Corporation (MIDC) Directives",
            issuing_authority="Industries Department, GoM",
            official_url="https://midcindia.org",
            source_type="CIRCULAR",
            verification_status="DEMO",
            is_active=True,
            created_at=ClockService.now(),
        )
        db.add(src3)
    db.commit()

    # 2. Regulatory Changes
    chg1 = db.query(RegulatoryChangeRecord).filter(RegulatoryChangeRecord.change_code == "REG-2026-MPCB-ZLD").first()
    if not chg1:
        chg1 = RegulatoryChangeRecord(
            change_code="REG-2026-MPCB-ZLD",
            source_id=src1.id if src1 else None,
            title="Online Continuous Effluent Monitoring (OCEMS) Mandate for Surface Finishing",
            summary="All metal finishing and electroplating units generating industrial trade effluent must install 24x7 telemetry sensors linked to the MPCB central dashboard.",
            gazette_or_order_ref="MPCB/JD-WPC/2026/Cir-08",
            verification_status="DEMO",
            target_sector="manufacturing",
            affected_topics=["effluent", "cems", "pollution_control"],
            matching_conditions={"effluent_generation": True, "sector": "manufacturing"},
            impact_summary="Requires calibration certificate and telemetry integration with MPCB server within 90 days.",
            recommended_action="Conduct audit of ETP discharge parameters and verify telemetry sensors in Document Vault.",
            created_at=ClockService.now(),
        )
        db.add(chg1)

    chg2 = db.query(RegulatoryChangeRecord).filter(RegulatoryChangeRecord.change_code == "REG-2026-DISH-VAPOR").first()
    if not chg2:
        chg2 = RegulatoryChangeRecord(
            change_code="REG-2026-DISH-VAPOR",
            source_id=src2.id if src2 else None,
            title="Automated Toxic Chemical Vapor Containment Protocol (DISH 2026)",
            summary="Mandatory automated toxic gas detectors and scrubber interlocks for chemical storage rooms handling Class-A solvents or electroplating acids.",
            gazette_or_order_ref="DISH/HAZ-CHEM/2026/Notif-44",
            verification_status="DEMO",
            target_sector="manufacturing",
            affected_topics=["worker_safety", "hazardous_waste", "toxic_vapor"],
            matching_conditions={"hazardous_waste_generated": True},
            impact_summary="Inspection protocols will verify automated vapor extraction during joint CIS inspections.",
            recommended_action="Submit Hazard Identification & Risk Assessment (HIRA) report in CIS Inspection dossier.",
            created_at=ClockService.now(),
        )
        db.add(chg2)

    chg3 = db.query(RegulatoryChangeRecord).filter(RegulatoryChangeRecord.change_code == "REG-2026-IT-SEZ").first()
    if not chg3:
        chg3 = RegulatoryChangeRecord(
            change_code="REG-2026-IT-SEZ",
            source_id=src3.id if src3 else None,
            title="IT/ITeS Special Economic Zone Hybrid Workspace Exemption",
            summary="Concessional floor area and hybrid telecommuting norms for software development centers.",
            gazette_or_order_ref="MIDC/IT-POL/2026/Cir-02",
            verification_status="DEMO",
            target_sector="information_technology",
            affected_topics=["sez", "it_parks"],
            matching_conditions={"sector": "information_technology"},
            impact_summary="Applicable exclusively to IT/ITeS parks; does not apply to heavy manufacturing or engineering units.",
            recommended_action="No action required for non-IT sectors.",
            created_at=ClockService.now(),
        )
        db.add(chg3)
    db.commit()

    # 3. Demo Notifications
    now = ClockService.now()
    demo_notifs = [
        {
            "user_id": applicant.id,
            "title": "Joint Inspection Scheduled",
            "message": "Central Inspection System (CIS) joint site visit scheduled for high-risk red category facility verification.",
            "event_type": "INSPECTION_SCHEDULED",
            "severity": "WARNING",
            "entity_type": "inspection",
            "action_url": f"/applicant/workflow/{app_id}?tab=cis" if app_id else "/applicant/dashboard",
            "idempotency_key": "demo-notif-insp-1",
        },
        {
            "user_id": applicant.id,
            "title": "Regulatory Radar Alert",
            "message": "New MPCB notification flagged: OCEMS telemetry mandate for metal surface finishing units.",
            "event_type": "REGULATORY_RADAR",
            "severity": "INFO",
            "entity_type": "radar",
            "action_url": "/applicant/project",
            "idempotency_key": "demo-notif-radar-1",
        },
        {
            "user_id": applicant.id,
            "title": "Statutory Return Overdue",
            "message": "Monthly treated effluent discharge return (PCB-001) has breached the due date. Penalty risk active.",
            "event_type": "COMPLIANCE_DEADLINE",
            "severity": "URGENT",
            "entity_type": "compliance",
            "action_url": f"/applicant/workflow/{app_id}?tab=compliance" if app_id else "/applicant/dashboard",
            "idempotency_key": "demo-notif-comp-1",
        },
        {
            "user_id": officer.id,
            "title": "Pending Document Scrutiny",
            "message": "Site Layout Plan submitted for Apex Precision Automotive unit is awaiting officer scrutiny.",
            "event_type": "DOCUMENT_PENDING",
            "severity": "INFO",
            "entity_type": "document",
            "action_url": "/officer/scrutiny",
            "idempotency_key": "demo-notif-off-1",
        },
    ]

    for item in demo_notifs:
        existing = db.query(Notification).filter(Notification.idempotency_key == item["idempotency_key"]).first()
        if not existing:
            notif = Notification(
                user_id=item["user_id"],
                title=item["title"],
                message=item["message"],
                event_type=item["event_type"],
                severity=item["severity"],
                is_read=False,
                entity_type=item["entity_type"],
                action_url=item["action_url"],
                idempotency_key=item["idempotency_key"],
                data_status="DEMO",
                created_at=now - timedelta(hours=2),
            )
            db.add(notif)
    db.commit()

