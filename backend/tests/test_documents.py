import hashlib
import io
import pytest
from app.core.security import get_password_hash, create_access_token
from app.document.storage import DocumentStorageService, MAX_FILE_SIZE_BYTES
from app.models.audit import AuditLog
from app.models.business import Business, RegulatoryProfile
from app.models.document import Document, DocumentStatus
from app.models.user import User, UserRole
from app.models.workflow import Application
from app.workflow.service import WorkflowService
from tests.conftest import get_token


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    """Ensure all test uploads go into an isolated temporary directory."""
    vault = tmp_path / "test_vault"
    vault.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(DocumentStorageService, "get_storage_root", classmethod(lambda cls: vault))
    return vault


@pytest.fixture
def workflow_app(db, applicant_user):
    """Creates a business and workflow application with Scenario C rules."""
    biz = Business(
        user_id=applicant_user.id,
        name="Apex Precision Engineering",
        description="Auto components manufacturing",
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    scenario_c_confirmed = {
        "sector": "manufacturing",
        "location": {"zone_type": "industrial"},
        "processes": ["electroplating", "metal_fabrication"],
        "effluent_generation": True,
        "air_emissions": True,
        "hazardous_waste_generated": True,
        "workers_count": 35,
        "power_connected_kw": 250.0,
        "built_up_area_sqm": 2500.0,
        "water_source": "borewell",
    }
    profile = RegulatoryProfile(
        business_id=biz.id,
        extracted_data=scenario_c_confirmed,
        confirmed_data=scenario_c_confirmed,
        is_confirmed=True,
    )
    db.add(profile)
    db.commit()

    application = WorkflowService.create_application_from_discovery(
        db=db,
        business=biz,
        user=applicant_user,
        title="Apex Manufacturing Setup",
    )
    return application


@pytest.fixture
def other_applicant(db):
    user = User(
        email="other.applicant@test.rop",
        full_name="Other Applicant",
        hashed_password=get_password_hash("TestPass@123"),
        role=UserRole.APPLICANT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class TestDocumentManagementAndScrutiny:

    def test_get_application_documents_initial_missing(self, client, applicant_user, workflow_app):
        token = get_token(client, applicant_user.email)
        res = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()

        assert data["application_id"] == workflow_app.id
        assert data["business_name"] == "Apex Precision Engineering"
        assert data["data_status"] == "DEMO"

        completeness = data["completeness"]
        assert completeness["total_required"] > 0
        assert completeness["uploaded_count"] == 0
        assert completeness["accepted_count"] == 0
        assert completeness["missing_count"] == completeness["total_required"]
        assert completeness["upload_completeness_pct"] == 0.0
        assert completeness["scrutiny_acceptance_pct"] == 0.0
        assert completeness["is_complete"] is False

        # Verify expected documents from Scenario C rules are present
        doc_names = [d["document_name"] for d in data["documents"]]
        assert "Site Layout Plan" in doc_names
        assert "Industrial Land Allotment Letter" in doc_names
        assert "Environmental Management Plan (EMP)" in doc_names

        # Verify each slot is initially MISSING
        for slot in data["documents"]:
            assert slot["status"] == "MISSING"
            assert slot["is_uploaded"] is False
            assert slot["current_document"] is None
            assert slot["history"] == []

    def test_applicant_upload_valid_pdf(self, client, applicant_user, workflow_app, db):
        token = get_token(client, applicant_user.email)
        file_bytes = b"%PDF-1.4 Mock PDF content for Site Layout Plan"

        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "requirement_id": "REQ-SITING-001",
                "document_name": "Site Layout Plan",
            },
            files={
                "file": ("site_layout.pdf", file_bytes, "application/pdf"),
            },
        )
        assert res.status_code == 200
        data = res.json()

        assert data["version"] == 1
        assert data["original_filename"] == "site_layout.pdf"
        assert data["mime_type"] == "application/pdf"
        assert data["status"] == "UPLOADED"
        assert data["checksum_sha256"] == hashlib.sha256(file_bytes).hexdigest()
        assert data["file_size_bytes"] == len(file_bytes)
        assert data["uploaded_by_email"] == applicant_user.email

        # Check that checklist reflects upload
        checklist_res = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        cdata = checklist_res.json()
        assert cdata["completeness"]["uploaded_count"] == 1
        assert cdata["completeness"]["accepted_count"] == 0  # Uploaded does NOT mean accepted!
        assert cdata["completeness"]["under_review_count"] == 1

        slot = next(d for d in cdata["documents"] if d["document_name"] == "Site Layout Plan")
        assert slot["status"] == "UPLOADED"
        assert slot["is_uploaded"] is True
        assert slot["current_document"]["id"] == data["id"]

    def test_applicant_upload_empty_file_fails(self, client, applicant_user, workflow_app):
        token = get_token(client, applicant_user.email)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "requirement_id": "REQ-SITING-001",
                "document_name": "Site Layout Plan",
            },
            files={
                "file": ("empty.pdf", b"", "application/pdf"),
            },
        )
        assert res.status_code == 400
        assert "empty" in res.json()["detail"].lower()

    def test_applicant_upload_unsupported_extension_fails(self, client, applicant_user, workflow_app):
        token = get_token(client, applicant_user.email)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "requirement_id": "REQ-SITING-001",
                "document_name": "Site Layout Plan",
            },
            files={
                "file": ("malicious.exe", b"executable bytes", "application/octet-stream"),
            },
        )
        assert res.status_code == 400
        assert "unsupported file extension" in res.json()["detail"].lower()

    def test_applicant_cannot_upload_to_unowned_application(self, client, other_applicant, workflow_app):
        token = get_token(client, other_applicant.email)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "requirement_id": "REQ-SITING-001",
                "document_name": "Site Layout Plan",
            },
            files={
                "file": ("test.pdf", b"%PDF-1.4 sample", "application/pdf"),
            },
        )
        assert res.status_code == 403
        assert "permission" in res.json()["detail"].lower()

    def test_applicant_cannot_view_unowned_application_documents(self, client, other_applicant, workflow_app):
        token = get_token(client, other_applicant.email)
        res = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403

    def test_officer_can_view_any_application_documents(self, client, officer_user, workflow_app):
        token = get_token(client, officer_user.email)
        res = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200

    def test_document_versioning_and_history(self, client, applicant_user, workflow_app, db):
        token = get_token(client, applicant_user.email)
        v1_bytes = b"%PDF-1.4 Initial Version 1 Draft Plan"
        v2_bytes = b"%PDF-1.4 Corrected Version 2 Layout Plan"

        # Upload v1
        res1 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "requirement_id": "REQ-SITING-001",
                "document_name": "Site Layout Plan",
            },
            files={"file": ("layout_v1.pdf", v1_bytes, "application/pdf")},
        )
        assert res1.status_code == 200
        doc1_id = res1.json()["id"]
        assert res1.json()["version"] == 1

        # Upload v2 replacement
        res2 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "requirement_id": "REQ-SITING-001",
                "document_name": "Site Layout Plan",
            },
            files={"file": ("layout_v2.pdf", v2_bytes, "application/pdf")},
        )
        assert res2.status_code == 200
        doc2_id = res2.json()["id"]
        assert res2.json()["version"] == 2

        # Check DB states
        d1 = db.query(Document).filter(Document.id == doc1_id).first()
        d2 = db.query(Document).filter(Document.id == doc2_id).first()
        assert d1.is_current is False
        assert d2.is_current is True

        # Check checklist response structure
        checklist = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        slot = next(s for s in checklist["documents"] if s["document_name"] == "Site Layout Plan")
        assert slot["current_document"]["version"] == 2
        assert len(slot["history"]) == 1
        assert slot["history"][0]["version"] == 1

    def test_officer_pending_queue_and_applicant_restriction(self, client, applicant_user, officer_user, workflow_app):
        # Applicant uploads a doc
        app_token = get_token(client, applicant_user.email)
        client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 test", "application/pdf")},
        )

        # Applicant tries to view officer pending queue -> 403
        res_app = client.get(
            "/api/officer/documents/pending",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert res_app.status_code == 403

        # Officer views pending queue -> 200
        off_token = get_token(client, officer_user.email)
        res_off = client.get(
            "/api/officer/documents/pending",
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert res_off.status_code == 200
        items = res_off.json()
        assert len(items) >= 1
        found = next((i for i in items if i["document_name"] == "Site Layout Plan"), None)
        assert found is not None
        assert found["application_title"] == "Apex Manufacturing Setup"
        assert found["status"] == "UPLOADED"

    def test_officer_scrutiny_accept_workflow(self, client, applicant_user, officer_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        off_token = get_token(client, officer_user.email)
        res = client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "ACCEPTED", "note": "Verified with zonal industrial planning map."},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ACCEPTED"
        assert data["review_decision"] == "ACCEPTED"
        assert data["reviewed_by_email"] == officer_user.email

    def test_officer_scrutiny_reject_requires_non_empty_note(self, client, applicant_user, officer_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        off_token = get_token(client, officer_user.email)

        # Empty note on REJECTED -> 400
        res1 = client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "REJECTED", "note": ""},
        )
        assert res1.status_code == 400
        assert "mandatory" in res1.json()["detail"].lower()

        # Valid note -> 200
        res2 = client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "REJECTED", "note": "Illegible boundaries and missing surveyor signature."},
        )
        assert res2.status_code == 200
        assert res2.json()["status"] == "REJECTED"
        assert res2.json()["review_note"] == "Illegible boundaries and missing surveyor signature."

    def test_officer_scrutiny_query_raised_and_applicant_loop(self, client, applicant_user, officer_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan_v1.pdf", b"%PDF-1.4 test v1", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        off_token = get_token(client, officer_user.email)

        # Raising query without note -> 400
        res_fail = client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "QUERY_RAISED", "note": None},
        )
        assert res_fail.status_code == 400

        # Raising query with explanation -> 200
        res_query = client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={
                "decision": "QUERY_RAISED",
                "note": "Please submit revenue seal verification on sheet 2.",
            },
        )
        assert res_query.status_code == 200
        assert res_query.json()["status"] == "QUERY_RAISED"

        # Applicant sees QUERY_RAISED in checklist with officer note
        checklist = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {app_token}"},
        ).json()
        slot = next(s for s in checklist["documents"] if s["document_name"] == "Site Layout Plan")
        assert slot["status"] == "QUERY_RAISED"
        assert slot["current_document"]["review_note"] == "Please submit revenue seal verification on sheet 2."

        # Applicant responds by uploading new version v2
        reupload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan_v2_with_seal.pdf", b"%PDF-1.4 test v2 with seal", "application/pdf")},
        )
        assert reupload_res.status_code == 200
        v2_data = reupload_res.json()
        assert v2_data["version"] == 2
        assert v2_data["status"] == "UPLOADED"

        # Officer now accepts v2
        accept_res = client.post(
            f"/api/officer/documents/{v2_data['id']}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "ACCEPTED", "note": "Revenue seal verified."},
        )
        assert accept_res.status_code == 200
        assert accept_res.json()["status"] == "ACCEPTED"

    def test_applicant_cannot_perform_officer_scrutiny(self, client, applicant_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        res = client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"decision": "ACCEPTED"},
        )
        assert res.status_code == 403

    def test_completeness_and_readiness_metrics(self, client, applicant_user, officer_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        off_token = get_token(client, officer_user.email)

        # Get initial count
        chk1 = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {app_token}"},
        ).json()["completeness"]
        total_req = chk1["total_required"]
        assert total_req > 0
        assert chk1["is_complete"] is False

        # Upload 1 doc
        u1 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 1", "application/pdf")},
        ).json()

        chk2 = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {app_token}"},
        ).json()["completeness"]
        assert chk2["uploaded_count"] == 1
        assert chk2["accepted_count"] == 0
        assert chk2["is_complete"] is False

        # Officer accepts doc 1
        client.post(
            f"/api/officer/documents/{u1['id']}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "ACCEPTED"},
        )

        chk3 = client.get(
            f"/api/workflow/applications/{workflow_app.id}/documents",
            headers={"Authorization": f"Bearer {app_token}"},
        ).json()["completeness"]
        assert chk3["accepted_count"] == 1
        assert chk3["scrutiny_acceptance_pct"] == round(1 / total_req * 100.0, 1)

    def test_download_document_and_security(self, client, applicant_user, officer_user, other_applicant, workflow_app):
        app_token = get_token(client, applicant_user.email)
        other_token = get_token(client, other_applicant.email)
        off_token = get_token(client, officer_user.email)

        file_content = b"%PDF-1.4 Secret Engineering Layout Document"
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("secret_plan.pdf", file_content, "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        # 1. Other applicant cannot download (403)
        res_forbidden = client.get(
            f"/api/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res_forbidden.status_code == 403

        # 2. Owner applicant can download (200)
        res_owner = client.get(
            f"/api/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert res_owner.status_code == 200
        assert res_owner.content == file_content
        assert "application/pdf" in res_owner.headers.get("content-type", "")

        # 3. Officer can download (200)
        res_off = client.get(
            f"/api/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert res_off.status_code == 200
        assert res_off.content == file_content

    def test_path_traversal_prevention(self, tmp_path):
        with pytest.raises(Exception) as exc:
            DocumentStorageService.get_file_path("../../windows/system32/cmd.exe")
        assert "traversal" in str(exc.value).lower() or "400" in str(exc.value)

    def test_audit_logs_recorded_for_all_actions(self, client, applicant_user, officer_user, workflow_app, db):
        app_token = get_token(client, applicant_user.email)
        off_token = get_token(client, officer_user.email)

        # Upload
        u_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 audit test", "application/pdf")},
        )
        doc_id = u_res.json()["id"]

        # Review
        client.post(
            f"/api/officer/documents/{doc_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "ACCEPTED", "note": "Audit verified"},
        )

        logs = db.query(AuditLog).filter(AuditLog.entity_type == "document").all()
        actions = [l.action for l in logs]
        assert "document_uploaded" in actions
        assert "document_scrutiny_reviewed" in actions

    def test_oversized_file_rejected(self, client, applicant_user, workflow_app):
        token = get_token(client, applicant_user.email)
        # 10MB + 1 byte
        oversized_bytes = b"0" * (MAX_FILE_SIZE_BYTES + 1)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("huge.pdf", oversized_bytes, "application/pdf")},
        )
        assert res.status_code == 400
        assert "exceeds maximum allowed size" in res.json()["detail"].lower()

    def test_officer_pending_queue_filter_by_status(self, client, applicant_user, officer_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        off_token = get_token(client, officer_user.email)

        # Upload doc 1
        res1 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan1.pdf", b"%PDF-1.4 1", "application/pdf")},
        )
        doc1_id = res1.json()["id"]

        # Upload doc 2
        res2 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Industrial Land Allotment Letter"},
            files={"file": ("letter.pdf", b"%PDF-1.4 2", "application/pdf")},
        )
        doc2_id = res2.json()["id"]

        # Raise query on doc 1
        client.post(
            f"/api/officer/documents/{doc1_id}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "QUERY_RAISED", "note": "Seal missing"},
        )

        # Filter by QUERY_RAISED
        query_res = client.get(
            "/api/officer/documents/pending?status=QUERY_RAISED",
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert query_res.status_code == 200
        items = query_res.json()
        assert all(i["status"] == "QUERY_RAISED" for i in items)
        assert any(i["id"] == doc1_id for i in items)

        # Filter by UPLOADED
        uploaded_res = client.get(
            "/api/officer/documents/pending?status=UPLOADED",
            headers={"Authorization": f"Bearer {off_token}"},
        )
        assert uploaded_res.status_code == 200
        up_items = uploaded_res.json()
        assert all(i["status"] == "UPLOADED" for i in up_items)
        assert any(i["id"] == doc2_id for i in up_items)

    def test_nonexistent_entity_errors(self, client, applicant_user, officer_user):
        app_token = get_token(client, applicant_user.email)
        off_token = get_token(client, officer_user.email)

        # Nonexistent app documents
        res1 = client.get(
            "/api/workflow/applications/99999/documents",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert res1.status_code == 404

        # Nonexistent app upload
        res2 = client.post(
            "/api/workflow/applications/99999/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Test"},
            files={"file": ("t.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        assert res2.status_code == 404

        # Nonexistent document review
        res3 = client.post(
            "/api/officer/documents/99999/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "ACCEPTED"},
        )
        assert res3.status_code == 404

        # Nonexistent document download
        res4 = client.get(
            "/api/documents/99999/download",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert res4.status_code == 404

    def test_officer_under_review_status(self, client, applicant_user, officer_user, workflow_app):
        app_token = get_token(client, applicant_user.email)
        off_token = get_token(client, officer_user.email)

        u = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {app_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("p.pdf", b"%PDF-1.4 test", "application/pdf")},
        ).json()

        res = client.post(
            f"/api/officer/documents/{u['id']}/review",
            headers={"Authorization": f"Bearer {off_token}"},
            json={"decision": "UNDER_REVIEW", "note": "Assigned to surveyor for field inspection"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "UNDER_REVIEW"
        assert res.json()["review_note"] == "Assigned to surveyor for field inspection"


class TestDocumentSecurityAndPathTraversal:
    """Security regression tests verifying path traversal prevention and tenant isolation."""

    def test_posix_path_traversal_upload_sanitized(self, client, applicant_user, workflow_app, isolated_storage):
        token = get_token(client, applicant_user.email)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("../../../../etc/passwd.pdf", b"%PDF-1.4 traversal test", "application/pdf")},
        )
        assert res.status_code == 200
        data = res.json()
        # Original filename must have directory components stripped
        assert data["original_filename"] == "passwd.pdf"
        assert "/" not in data["original_filename"]
        assert ".." not in data["original_filename"]

        # Physical file must be inside isolated_storage
        created_files = list(isolated_storage.iterdir())
        assert len(created_files) == 1
        assert created_files[0].name.endswith(".pdf")
        assert not created_files[0].name.startswith("..")

    def test_windows_path_traversal_upload_sanitized(self, client, applicant_user, workflow_app, isolated_storage):
        token = get_token(client, applicant_user.email)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("..\\..\\Windows\\System32\\cmd.pdf", b"%PDF-1.4 win test", "application/pdf")},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["original_filename"] == "cmd.pdf"
        assert "\\" not in data["original_filename"]

    def test_absolute_path_and_drive_prefix_upload_sanitized(self, client, applicant_user, workflow_app):
        token = get_token(client, applicant_user.email)
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("C:\\secret\\financial_audit.pdf", b"%PDF-1.4 abs test", "application/pdf")},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["original_filename"] == "financial_audit.pdf"
        assert ":" not in data["original_filename"]

    def test_unicode_and_spaces_filename_preserved(self, client, applicant_user, workflow_app):
        token = get_token(client, applicant_user.email)
        test_content = b"%PDF-1.4 unicode allotment letter test"
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("MIDC Allotment Letter \u092a\u094d\u0930\u092e\u093e\u0923 2026.pdf", test_content, "application/pdf")},
        )
        assert res.status_code == 200
        doc_id = res.json()["id"]

        # Download should succeed and return original content
        dl = client.get(
            f"/api/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert dl.status_code == 200
        assert dl.content == test_content

    def test_storage_get_file_path_rejection_vectors(self):
        dangerous_paths = [
            "../../etc/passwd",
            "..\\..\\boot.ini",
            "C:\\Windows\\win.ini",
            "C:/Windows/win.ini",
            "/etc/shadow",
            "\\\\?\\C:\\Windows\\win.ini",
            "sub/file.pdf",
            "sub\\file.pdf",
            "..",
            "",
        ]
        for path in dangerous_paths:
            with pytest.raises(Exception) as exc:
                DocumentStorageService.get_file_path(path)
            assert "400" in str(exc.value) or "traversal" in str(exc.value).lower()

    def test_storage_delete_file_safety(self):
        # Must return False and not execute arbitrary unlinks outside storage root
        assert DocumentStorageService.delete_file("../../etc/passwd") is False
        assert DocumentStorageService.delete_file("..\\..\\Windows\\System32\\cmd.exe") is False
        assert DocumentStorageService.delete_file("C:\\Windows\\win.ini") is False
        assert DocumentStorageService.delete_file("") is False

    def test_cross_applicant_download_forbidden(self, client, applicant_user, other_applicant, workflow_app):
        owner_token = get_token(client, applicant_user.email)
        other_token = get_token(client, other_applicant.email)

        # Owner uploads document
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {owner_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 confidential", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        # Other applicant attempts download -> 403 Forbidden
        dl_res = client.get(
            f"/api/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert dl_res.status_code == 403
        assert "permission" in dl_res.json()["detail"].lower()

    def test_cross_applicant_upload_forbidden(self, client, other_applicant, workflow_app):
        other_token = get_token(client, other_applicant.email)

        # Other applicant attempts upload to workflow_app owned by applicant_user -> 403 Forbidden
        upload_res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/documents/upload",
            headers={"Authorization": f"Bearer {other_token}"},
            data={"requirement_id": "REQ-SITING-001", "document_name": "Site Layout Plan"},
            files={"file": ("plan.pdf", b"%PDF-1.4 unauthorized", "application/pdf")},
        )
        assert upload_res.status_code == 403
        assert "permission" in upload_res.json()["detail"].lower()

