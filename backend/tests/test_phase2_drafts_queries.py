import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.business import Business, RegulatoryProfile
from app.models.project import Project
from app.models.workflow import Application, ApplicationStatus, ApprovalStep, StepStatus
from app.models.document import Document, DocumentStatus
from app.models.query import DepartmentQuery, QueryMessage, QueryStatus
from app.core.security import get_password_hash
from tests.conftest import get_token


@pytest.fixture
def applicant2_user(db: Session) -> User:
    user = User(
        email="applicant2@test.rop",
        full_name="Second Applicant",
        hashed_password=get_password_hash("TestPass@123"),
        role=UserRole.APPLICANT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def business_with_project(db: Session, applicant_user: User) -> tuple[Business, Project]:
    biz = Business(
        user_id=applicant_user.id,
        name="AutoTech Precision Pvt Ltd",
        description="Automotive machining components",
        entity_type="Private Limited Company",
        registration_number="U29100MH2021PTC123456",
        pan_number="AAACA9999F",
        gstin="27AAACA9999F1Z2",
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    proj = Project(
        business_id=biz.id,
        name="AutoTech Chakan Plant Unit 1",
        project_type="New Setup",
        status="ACTIVE",
        district="Pune",
        taluka="Khed",
        industrial_zone="Chakan MIDC Phase II",
        power_load_kw=400,
        water_consumption_kld=25,
        effluent_discharge_kld=18,
        pollution_category="Orange",
        activities=["Metal fabrication", "Electroplating"],
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)

    return biz, proj


@pytest.fixture
def draft_application(db: Session, business_with_project: tuple[Business, Project], applicant_user: User) -> Application:
    biz, proj = business_with_project
    app = Application(
        business_id=biz.id,
        project_id=proj.id,
        applicant_id=applicant_user.id,
        title="Industrial Clearance Application — AutoTech",
        status=ApplicationStatus.DRAFT,
        version=1,
        form_data={"plant_area": 12000, "investment_lakhs": 450},
        total_timeline_days=30,
        critical_path_steps=["REQ-SITING-001"],
    )
    db.add(app)
    db.flush()

    step = ApprovalStep(
        application_id=app.id,
        requirement_id="REQ-SITING-001",
        step_name="MIDC Siting Sanction",
        department="MIDC Planning Directorate",
        estimated_timeline_days=30,
        status=StepStatus.READY,
        is_critical_path=True,
    )
    db.add(step)
    db.commit()
    db.refresh(app)
    return app


@pytest.fixture
def uploaded_doc(db: Session, draft_application: Application, applicant_user: User) -> Document:
    doc = Document(
        business_id=draft_application.business_id,
        project_id=draft_application.project_id,
        application_id=draft_application.id,
        requirement_id="REQ-SITING-001",
        document_name="Site Possession Certificate",
        original_filename="possession_receipt.pdf",
        storage_path="safe-uuid-1234.pdf",
        mime_type="application/pdf",
        file_size_bytes=10240,
        checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status=DocumentStatus.UPLOADED,
        uploaded_by_id=applicant_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# =========================================================================
# FEATURE A: Save Draft, Resume, Concurrency & Version History
# =========================================================================

class TestDraftLifecycleAndVersions:
    def test_save_draft_success(self, client: TestClient, draft_application: Application, applicant_user: User):
        token = get_token(client, applicant_user.email)
        res = client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": "Updated AutoTech Application Title",
                "form_data": {"plant_area": 15000, "investment_lakhs": 500, "workforce": 60},
                "expected_version": 1,
                "change_summary": "Expanded workforce and investment figures",
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["title"] == "Updated AutoTech Application Title"
        assert data["version"] == 2
        assert data["form_data"]["workforce"] == 60

    def test_optimistic_concurrency_conflict_409(
        self, client: TestClient, draft_application: Application, applicant_user: User
    ):
        token = get_token(client, applicant_user.email)

        # First edit succeeds (v1 -> v2)
        res1 = client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "form_data": {"plant_area": 13000},
                "expected_version": 1,
            },
        )
        assert res1.status_code == 200
        assert res1.json()["version"] == 2

        # Second concurrent edit expecting v1 fails with 409 Conflict
        res2 = client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "form_data": {"plant_area": 14000},
                "expected_version": 1,
            },
        )
        assert res2.status_code == 409
        assert "Concurrency conflict" in res2.json()["detail"]

    def test_draft_edit_rejected_when_submitted_400(
        self, client: TestClient, draft_application: Application, applicant_user: User
    ):
        token = get_token(client, applicant_user.email)

        # Submit application
        res_sub = client.post(
            f"/api/workflow/applications/{draft_application.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_sub.status_code == 200
        assert res_sub.json()["status"] == "SUBMITTED"

        # Attempt to edit draft returns 400
        res_edit = client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json={"form_data": {"illegal_edit": True}},
        )
        assert res_edit.status_code == 400
        assert "Cannot edit draft" in res_edit.json()["detail"]

    def test_version_snapshots_and_restore(
        self, client: TestClient, draft_application: Application, applicant_user: User
    ):
        token = get_token(client, applicant_user.email)

        # Save draft revisions v2 and v3
        client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json={"form_data": {"revision": 2}, "change_summary": "Revision two"},
        )
        client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json={"form_data": {"revision": 3}, "change_summary": "Revision three"},
        )

        # List version history
        res_hist = client.get(
            f"/api/workflow/applications/{draft_application.id}/versions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_hist.status_code == 200
        versions = res_hist.json()
        assert len(versions) >= 3
        v_nums = [v["version_number"] for v in versions]
        assert 1 in v_nums and 2 in v_nums and 3 in v_nums

        # Restore version 1
        res_restore = client.post(
            f"/api/workflow/applications/{draft_application.id}/versions/1/restore",
            headers={"Authorization": f"Bearer {token}"},
            json={"change_summary": "Reverting back to baseline"},
        )
        assert res_restore.status_code == 200
        restored_app = res_restore.json()
        # Restored version advances monotonically to 4, preserving history
        assert restored_app["version"] == 4
        assert restored_app["form_data"]["plant_area"] == 12000

    def test_tenant_isolation_on_drafts_and_versions_403(
        self, client: TestClient, draft_application: Application, applicant2_user: User
    ):
        token2 = get_token(client, applicant2_user.email)

        # Applicant 2 cannot edit Applicant 1's draft
        res_edit = client.put(
            f"/api/workflow/applications/{draft_application.id}/draft",
            headers={"Authorization": f"Bearer {token2}"},
            json={"form_data": {"malicious": True}},
        )
        assert res_edit.status_code == 403

        # Applicant 2 cannot view versions
        res_ver = client.get(
            f"/api/workflow/applications/{draft_application.id}/versions",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res_ver.status_code == 403


# =========================================================================
# FEATURE B: Department Query & Clarification Centre
# =========================================================================

class TestDepartmentQueryCentre:
    def test_officer_create_query_success(
        self, client: TestClient, draft_application: Application, officer_user: User
    ):
        token = get_token(client, officer_user.email)
        res = client.post(
            "/api/queries",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "application_id": draft_application.id,
                "subject": "Missing Form 7 Land Possession Certificate",
                "query_details": "Please upload signed copy of Form 7 issued by MIDC Executive Engineer.",
                "department": "MIDC Planning Directorate",
            },
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["application_id"] == draft_application.id
        assert data["status"] == "OPEN"
        assert data["query_code"].startswith("QRY-")
        assert len(data["messages"]) == 1
        assert data["messages"][0]["sender_role"] == "officer"

    def test_applicant_cannot_create_query_403(
        self, client: TestClient, draft_application: Application, applicant_user: User
    ):
        token = get_token(client, applicant_user.email)
        res = client.post(
            "/api/queries",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "application_id": draft_application.id,
                "subject": "Unauthorized Query",
                "query_details": "Applicants cannot issue queries.",
            },
        )
        assert res.status_code == 403

    def test_applicant_list_and_reply_query(
        self,
        client: TestClient,
        draft_application: Application,
        officer_user: User,
        applicant_user: User,
        uploaded_doc: Document,
    ):
        officer_token = get_token(client, officer_user.email)
        app_token = get_token(client, applicant_user.email)

        # 1. Officer creates query
        res_q = client.post(
            "/api/queries",
            headers={"Authorization": f"Bearer {officer_token}"},
            json={
                "application_id": draft_application.id,
                "subject": "Provide Possession Receipt",
                "query_details": "Possession certificate required before site inspection.",
            },
        )
        q_id = res_q.json()["id"]

        # 2. Applicant lists queries for their application
        res_list = client.get(
            f"/api/queries?application_id={draft_application.id}",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert res_list.status_code == 200
        queries = res_list.json()
        assert len(queries) == 1
        assert queries[0]["id"] == q_id

        # 3. Applicant posts response with attachment
        res_reply = client.post(
            f"/api/queries/{q_id}/messages",
            headers={"Authorization": f"Bearer {app_token}"},
            json={
                "message_text": "We have uploaded the verified Form 7 possession receipt.",
                "attachment_document_ids": [uploaded_doc.id],
            },
        )
        assert res_reply.status_code == 200
        updated = res_reply.json()
        assert updated["status"] == "RESPONDED"
        assert len(updated["messages"]) == 2
        last_msg = updated["messages"][-1]
        assert last_msg["sender_role"] == "applicant"
        assert len(last_msg["attachments"]) == 1
        assert last_msg["attachments"][0]["id"] == uploaded_doc.id

    def test_cross_tenant_query_isolation_403(
        self, client: TestClient, draft_application: Application, officer_user: User, applicant2_user: User
    ):
        officer_token = get_token(client, officer_user.email)
        token2 = get_token(client, applicant2_user.email)

        # Officer creates query for applicant 1
        res_q = client.post(
            "/api/queries",
            headers={"Authorization": f"Bearer {officer_token}"},
            json={
                "application_id": draft_application.id,
                "subject": "Confidential Query",
                "query_details": "Details for applicant 1 only.",
            },
        )
        q_id = res_q.json()["id"]

        # Applicant 2 querying this query gets 403
        res_get = client.get(
            f"/api/queries/{q_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res_get.status_code == 403

        # Applicant 2 listing queries does not see it
        res_list = client.get(
            "/api/queries",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res_list.status_code == 200
        assert len(res_list.json()) == 0

    def test_cross_tenant_document_attachment_tampering_fails_400(
        self,
        client: TestClient,
        draft_application: Application,
        officer_user: User,
        applicant_user: User,
        applicant2_user: User,
        db: Session,
    ):
        officer_token = get_token(client, officer_user.email)
        app_token = get_token(client, applicant_user.email)

        # Create foreign document owned by applicant 2
        foreign_biz = Business(user_id=applicant2_user.id, name="Foreign Corp")
        db.add(foreign_biz)
        db.flush()
        foreign_doc = Document(
            business_id=foreign_biz.id,
            requirement_id="REQ-TEST",
            document_name="Foreign Secret Doc",
            original_filename="secret.pdf",
            storage_path="foreign-uuid.pdf",
            mime_type="application/pdf",
            file_size_bytes=5000,
            checksum_sha256="abc123456789",
            uploaded_by_id=applicant2_user.id,
        )
        db.add(foreign_doc)
        db.commit()

        # Officer creates query
        res_q = client.post(
            "/api/queries",
            headers={"Authorization": f"Bearer {officer_token}"},
            json={
                "application_id": draft_application.id,
                "subject": "Attachment Security Test",
                "query_details": "Testing attachment validation.",
            },
        )
        q_id = res_q.json()["id"]

        # Applicant 1 tries to attach foreign_doc.id to their reply
        res_tamper = client.post(
            f"/api/queries/{q_id}/messages",
            headers={"Authorization": f"Bearer {app_token}"},
            json={
                "message_text": "Trying to attach foreign document",
                "attachment_document_ids": [foreign_doc.id],
            },
        )
        assert res_tamper.status_code == 400
        assert "Attachment validation failed" in res_tamper.json()["detail"]

    def test_officer_resolve_and_close_query(
        self, client: TestClient, draft_application: Application, officer_user: User, applicant_user: User
    ):
        officer_token = get_token(client, officer_user.email)
        app_token = get_token(client, applicant_user.email)

        # 1. Create query
        res_q = client.post(
            "/api/queries",
            headers={"Authorization": f"Bearer {officer_token}"},
            json={
                "application_id": draft_application.id,
                "subject": "Clarification on Power Feeder",
                "query_details": "Confirm MSEDCL HT sub-station load sanction.",
            },
        )
        q_id = res_q.json()["id"]

        # 2. Applicant replies
        client.post(
            f"/api/queries/{q_id}/messages",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"message_text": "Sanction letter confirmed for 400 kW."},
        )

        # 3. Applicant cannot resolve query (403)
        res_app_resolve = client.post(
            f"/api/queries/{q_id}/resolve",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"resolution_note": "I consider this resolved."},
        )
        assert res_app_resolve.status_code == 403

        # 4. Officer resolves query
        res_off_resolve = client.post(
            f"/api/queries/{q_id}/resolve",
            headers={"Authorization": f"Bearer {officer_token}"},
            json={"resolution_note": "HT sanction verified. Query satisfied."},
        )
        assert res_off_resolve.status_code == 200
        resolved_data = res_off_resolve.json()
        assert resolved_data["status"] == "RESOLVED"
        assert resolved_data["resolution_note"] == "HT sanction verified. Query satisfied."
        assert resolved_data["resolved_by_id"] == officer_user.id

        # 5. Cannot post message to resolved query (400)
        res_post_resolved = client.post(
            f"/api/queries/{q_id}/messages",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"message_text": "Trying to message on resolved query"},
        )
        assert res_post_resolved.status_code == 400
