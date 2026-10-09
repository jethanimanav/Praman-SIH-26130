import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.business import Business, RegulatoryProfile
from app.models.project import Project
from app.models.workflow import Application, ApplicationStatus
from app.models.document import Document, DocumentStatus
from app.models.query import DepartmentQuery, QueryStatus
from app.models.notification import Notification
from app.models.radar import RegulatorySource, RegulatoryChangeRecord, ProjectImpactAssessment
from app.workflow.service import WorkflowService
from app.readiness.service import ReadinessService
from app.notification.service import NotificationService
from app.radar.service import RadarService
from app.core.clock import ClockService
from app.core.security import get_password_hash
from tests.conftest import get_token


@pytest.fixture
def confirmed_business_with_project(db: Session, applicant_user: User) -> tuple[Business, Project]:
    biz = Business(
        user_id=applicant_user.id,
        name="Apex Precision Engineering Works",
        description="Auto component precision manufacturing and electroplating",
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    profile_data = {
        "sector": "manufacturing",
        "location": {"zone_type": "industrial"},
        "processes": ["electroplating", "metal_fabrication"],
        "effluent_generation": True,
        "air_emissions": True,
        "hazardous_waste_generated": True,
        "workers_count": 45,
        "power_connected_kw": 300.0,
        "built_up_area_sqm": 2800.0,
        "water_source": "borewell",
    }
    profile = RegulatoryProfile(
        business_id=biz.id,
        extracted_data=profile_data,
        confirmed_data=profile_data,
        is_confirmed=True,
    )
    db.add(profile)

    proj = Project(
        business_id=biz.id,
        name="Chakan Manufacturing Plant Unit 1",
        district="Pune",
        taluka="Khed",
        industrial_zone="Chakan MIDC Phase II",
        sector="manufacturing",
        power_load_kw=300.0,
        built_up_area_sqm=2800.0,
        effluent_discharge_kld=25.0,
        hazardous_waste=True,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return biz, proj


# ==============================================================================
# 1. Feature A — Pre-Submission Readiness Check Tests
# ==============================================================================

class TestReadinessCheck:
    def test_readiness_clean_application_can_submit(
        self, client: TestClient, applicant_user: User, confirmed_business_with_project: tuple[Business, Project], db: Session
    ):
        biz, proj = confirmed_business_with_project
        app = WorkflowService.create_application_from_discovery(
            db=db, business=biz, user=applicant_user, title="Clean Readiness Application", project_id=proj.id
        )

        readiness = ReadinessService.assess_application_readiness(db, app)
        assert readiness.can_submit is True
        assert readiness.blocker_count == 0
        assert readiness.overall_status.value in ("READY", "NEEDS_ATTENTION")
        assert readiness.readiness_score_pct >= 70

        # API endpoint check
        token = get_token(client, applicant_user.email)
        resp = client.get(
            f"/api/workflow/applications/{app.id}/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["application_id"] == app.id
        assert data["can_submit"] is True
        assert "disclaimer" in data

    def test_readiness_open_query_is_blocker_and_prevents_submit(
        self, client: TestClient, applicant_user: User, officer_user: User, confirmed_business_with_project: tuple[Business, Project], db: Session
    ):
        biz, proj = confirmed_business_with_project
        app = WorkflowService.create_application_from_discovery(
            db=db, business=biz, user=applicant_user, title="Blocked Query Application", project_id=proj.id
        )

        # Create an OPEN department query
        query = DepartmentQuery(
            application_id=app.id,
            business_id=biz.id,
            project_id=proj.id,
            query_code="QRY-2026-TEST-001",
            subject="Clarification on Effluent Treatment Flow Diagram",
            query_details="Please upload detailed ETP piping layout",
            department="MPCB Regional Office",
            issued_by_id=officer_user.id,
            status=QueryStatus.OPEN,
            created_at=ClockService.now(),
        )
        db.add(query)
        db.commit()

        # Check readiness
        readiness = ReadinessService.assess_application_readiness(db, app)
        assert readiness.can_submit is False
        assert readiness.blocker_count >= 1
        assert readiness.overall_status.value == "BLOCKED"
        assert any(b.category.value == "QUERY" for b in readiness.items if b.is_blocking)

        # Attempt to submit via API -> must fail with 400 Bad Request
        token = get_token(client, applicant_user.email)
        sub_resp = client.post(
            f"/api/workflow/applications/{app.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert sub_resp.status_code == 400
        assert "validation blocker" in sub_resp.json()["detail"]
        assert "QRY-2026-TEST-001" in sub_resp.json()["detail"]

    def test_readiness_rejected_document_is_blocker(
        self, client: TestClient, applicant_user: User, confirmed_business_with_project: tuple[Business, Project], db: Session
    ):
        biz, proj = confirmed_business_with_project
        app = WorkflowService.create_application_from_discovery(
            db=db, business=biz, user=applicant_user, title="Doc Rejection App", project_id=proj.id
        )

        doc = Document(
            business_id=biz.id,
            application_id=app.id,
            requirement_id="REQ-FACTORY-001",
            document_name="Factory Layout",
            original_filename="bad_layout.pdf",
            storage_path="bad_layout.pdf",
            mime_type="application/pdf",
            file_size_bytes=1024,
            checksum_sha256="dummy_sha",
            status=DocumentStatus.REJECTED,
            review_note="Emergency exits not marked clearly",
            uploaded_by_id=applicant_user.id,
        )
        db.add(doc)
        db.commit()

        readiness = ReadinessService.assess_application_readiness(db, app)
        assert readiness.can_submit is False
        assert any(b.category.value == "DOCUMENT" and b.is_blocking for b in readiness.items)


# ==============================================================================
# 2. Feature B — Unified Notifications Tests
# ==============================================================================

class TestUnifiedNotifications:
    def test_notification_creation_and_idempotency(self, db: Session, applicant_user: User):
        n1 = NotificationService.create_notification(
            db=db,
            user_id=applicant_user.id,
            title="Test Event Notice",
            message="Your filing is due in 3 days",
            event_type="COMPLIANCE_REMINDER",
            severity="WARNING",
            idempotency_key="unique-idemp-001",
        )
        assert n1.id is not None
        assert n1.is_read is False

        # Attempt to create with same idempotency key -> returns existing without creating duplicate
        n2 = NotificationService.create_notification(
            db=db,
            user_id=applicant_user.id,
            title="Test Event Notice Duplicate",
            message="Duplicate message",
            event_type="COMPLIANCE_REMINDER",
            idempotency_key="unique-idemp-001",
        )
        assert n2.id == n1.id

    def test_notification_list_and_read_apis(
        self, client: TestClient, applicant_user: User, officer_user: User, db: Session
    ):
        token = get_token(client, applicant_user.email)

        # Clear or create fresh notifications
        n1 = NotificationService.create_notification(
            db=db,
            user_id=applicant_user.id,
            title="Applicant Alert 1",
            message="Notice 1",
            event_type="ALERT",
            idempotency_key="alert-test-1",
        )
        n2 = NotificationService.create_notification(
            db=db,
            user_id=applicant_user.id,
            title="Applicant Alert 2",
            message="Notice 2",
            event_type="ALERT",
            idempotency_key="alert-test-2",
        )

        # Get list
        list_resp = client.get(
            "/api/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert data["unread_count"] >= 2
        assert len(data["items"]) >= 2

        # Mark single as read
        mark_resp = client.post(
            f"/api/notifications/{n1.id}/read",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert mark_resp.status_code == 200
        assert mark_resp.json()["is_read"] is True

        # Officer cannot mark applicant's notification as read (403)
        off_token = get_token(client, officer_user.email)
        off_resp = client.post(
            f"/api/notifications/{n2.id}/read",
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert off_resp.status_code == 403

        # Mark all as read
        all_resp = client.post(
            "/api/notifications/read-all",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert all_resp.status_code == 200

        # Unread count should now be 0 for applicant
        count_resp = client.get(
            "/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert count_resp.json()["unread_count"] == 0


# ==============================================================================
# 3. Feature C — Government Scheme Eligibility Assistant Tests
# ==============================================================================

class TestSchemeEligibilityAssistant:
    def test_scheme_criteria_breakdown_and_buckets(
        self, client: TestClient, applicant_user: User, confirmed_business_with_project: tuple[Business, Project]
    ):
        biz, proj = confirmed_business_with_project
        token = get_token(client, applicant_user.email)

        resp = client.get(
            f"/api/business/{biz.id}/schemes",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "disclaimer" in data
        assert len(data["schemes"]) >= 4

        # Verify criteria breakdown exists on every scheme item
        for s in data["schemes"]:
            assert "eligibility_bucket" in s
            assert s["eligibility_bucket"] in ("POTENTIALLY_ELIGIBLE", "NOT_MATCHED", "NEEDS_MORE_INFO")
            assert "criteria_breakdown" in s
            assert "matched" in s["criteria_breakdown"]
            assert "failed" in s["criteria_breakdown"]
            assert "unknown" in s["criteria_breakdown"]
            assert "suggested_next_steps" in s
            assert len(s["suggested_next_steps"]) > 0

    def test_interactive_scheme_assessment_api(
        self, client: TestClient, applicant_user: User, confirmed_business_with_project: tuple[Business, Project]
    ):
        biz, proj = confirmed_business_with_project
        token = get_token(client, applicant_user.email)

        # Baseline: SCHEME-SOLAR-REBATE requires captive_solar_installed
        # Simulate answering the questionnaire: captive_solar_installed = True
        payload = {
            "answers": {
                "captive_solar_installed": True,
            }
        }
        resp = client.post(
            f"/api/business/{biz.id}/schemes/interactive-assessment",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        schemes_by_id = {s["scheme_id"]: s for s in data["schemes"]}
        solar_scheme = schemes_by_id["SCHEME-SOLAR-REBATE"]
        assert solar_scheme["status"] == "ELIGIBLE"
        assert solar_scheme["eligibility_bucket"] == "POTENTIALLY_ELIGIBLE"
        assert any("captive_solar_installed eq True" in cond for cond in solar_scheme["matched_conditions"])

    def test_project_schemes_api(
        self, client: TestClient, applicant_user: User, confirmed_business_with_project: tuple[Business, Project]
    ):
        biz, proj = confirmed_business_with_project
        token = get_token(client, applicant_user.email)

        resp = client.get(
            f"/api/projects/{proj.id}/schemes",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["business_id"] == biz.id
        assert data["eligible_count"] >= 3


# ==============================================================================
# 4. Feature D — Regulatory Change Impact Radar Tests
# ==============================================================================

class TestRegulatoryRadar:
    def test_radar_sources_and_changes_crud(
        self, client: TestClient, applicant_user: User, officer_user: User, db: Session
    ):
        off_token = get_token(client, officer_user.email)
        app_token = get_token(client, applicant_user.email)

        # Create source as officer
        src_payload = {
            "source_code": "SRC-RADAR-TEST-01",
            "name": "State Water Regulatory Directorate",
            "issuing_authority": "Water Resources Dept, GoM",
            "official_url": "https://mwrra.gov.in",
            "source_type": "CIRCULAR",
            "verification_status": "DEMO",
        }
        src_resp = client.post(
            "/api/radar/sources",
            json=src_payload,
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert src_resp.status_code == 201
        source_id = src_resp.json()["id"]

        # Applicant cannot create source (403)
        bad_src_resp = client.post(
            "/api/radar/sources",
            json=src_payload,
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert bad_src_resp.status_code == 403

        # Create regulatory change record as officer
        chg_payload = {
            "change_code": "CHG-TEST-EFFLUENT-01",
            "source_id": source_id,
            "title": "Mandatory ETP Secondary Recirculation Audit",
            "summary": "Mandatory tertiary filtration audit for units discharging trade effluent.",
            "target_sector": "manufacturing",
            "affected_topics": ["effluent", "water_reuse"],
            "matching_conditions": {"effluent_generation": True, "sector": "manufacturing"},
            "impact_summary": "Requires submitting tertiary filtration audit within 60 days.",
            "recommended_action": "Schedule ETP water recirculation audit.",
        }
        chg_resp = client.post(
            "/api/radar/changes",
            json=chg_payload,
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert chg_resp.status_code == 201
        change_id = chg_resp.json()["id"]

        # List sources & changes
        get_sources = client.get("/api/radar/sources", headers={"Authorization": f"Bearer {app_token}"})
        assert get_sources.status_code == 200
        assert any(s["source_code"] == "SRC-RADAR-TEST-01" for s in get_sources.json())

        get_changes = client.get("/api/radar/changes", headers={"Authorization": f"Bearer {app_token}"})
        assert get_changes.status_code == 200
        assert any(c["change_code"] == "CHG-TEST-EFFLUENT-01" for c in get_changes.json())

    def test_radar_project_impact_evaluation_and_officer_review(
        self, client: TestClient, applicant_user: User, officer_user: User, confirmed_business_with_project: tuple[Business, Project], db: Session
    ):
        biz, proj = confirmed_business_with_project
        app_token = get_token(client, applicant_user.email)
        off_token = get_token(client, officer_user.email)

        from app.seed import seed_demo_radar_and_notifications
        seed_demo_radar_and_notifications(db, applicant_user, officer_user)

        # Evaluate project impacts
        impact_resp = client.get(
            f"/api/radar/projects/{proj.id}/impacts",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert impact_resp.status_code == 200
        data = impact_resp.json()
        assert data["project_id"] == proj.id
        assert data["total_changes_evaluated"] >= 1
        assert "disclaimer" in data

        # Check grouping
        assert len(data["potentially_affected"]) >= 1
        first_impact = data["potentially_affected"][0]
        assert first_impact["impact_level"] == "POTENTIALLY_AFFECTED"
        assert first_impact["review_status"] == "PENDING_REVIEW"
        assert first_impact["explanation"] is not None

        # Officer reviews impact
        review_payload = {
            "decision": "CONFIRMED",
            "review_notes": "Facility verified as high risk electroplating unit with trade effluent discharge.",
        }
        rev_resp = client.post(
            f"/api/radar/impacts/{first_impact['id']}/review",
            json=review_payload,
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert rev_resp.status_code == 200
        rev_data = rev_resp.json()
        assert rev_data["review_status"] == "CONFIRMED"
        assert rev_data["review_notes"] == "Facility verified as high risk electroplating unit with trade effluent discharge."

        # Applicant cannot review impact (403)
        bad_rev = client.post(
            f"/api/radar/impacts/{first_impact['id']}/review",
            json=review_payload,
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert bad_rev.status_code == 403

        # Review with empty notes fails (400)
        empty_note_rev = client.post(
            f"/api/radar/impacts/{first_impact['id']}/review",
            json={"decision": "CONFIRMED", "review_notes": "   "},
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert empty_note_rev.status_code == 400
        assert "mandatory" in empty_note_rev.json()["detail"]
