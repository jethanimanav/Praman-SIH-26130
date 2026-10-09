import pytest
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from tests.conftest import get_token


@pytest.fixture
def applicant_user2(db):
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


class TestProjectWorkspace:
    def test_create_and_list_projects(self, client, applicant_user):
        token = get_token(client, applicant_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Business with company details
        biz_resp = client.post(
            "/api/business",
            headers=headers,
            json={
                "name": "Tata Motors Suppliers Ltd",
                "description": "Auto manufacturing vendor",
                "registration_number": "U34100MH2020PTC123456",
                "entity_type": "Private Limited Company",
                "pan_number": "AABCT1234F",
                "gstin": "27AABCT1234F1Z5",
                "contact_email": "contact@tatavendor.in",
                "contact_phone": "+91 98200 12345",
                "registered_office_address": "Plot 42, Bandra Kurla Complex, Mumbai 400051",
            },
        )
        assert biz_resp.status_code == 201
        biz_id = biz_resp.json()["id"]
        assert biz_resp.json()["pan_number"] == "AABCT1234F"

        # 2. Create Project 1 (Chakan Plant)
        proj1_resp = client.post(
            "/api/projects",
            headers=headers,
            json={
                "business_id": biz_id,
                "name": "Chakan Facility Phase 1",
                "project_type": "New Setup",
                "district": "Pune",
                "taluka": "Khed",
                "industrial_zone": "Chakan MIDC Phase II",
                "location_type": "MIDC Industrial Estate",
                "site_address": "Plot A-12, Chakan MIDC, Pune 410501",
                "survey_plot_number": "Plot A-12",
                "total_area_sqm": 50000.0,
                "built_up_area_sqm": 25000.0,
                "sector": "Manufacturing",
                "activities": ["automotive_stamping", "powder_coating"],
                "workforce_count": 120,
                "power_load_kw": 450.0,
                "water_consumption_kld": 30.0,
                "effluent_discharge_kld": 15.0,
                "pollution_category": "Orange",
                "hazardous_waste": True,
                "air_emissions": True,
            },
        )
        assert proj1_resp.status_code == 201
        p1 = proj1_resp.json()
        assert p1["name"] == "Chakan Facility Phase 1"
        assert p1["business_id"] == biz_id
        assert p1["district"] == "Pune"
        assert p1["pollution_category"] == "Orange"
        p1_id = p1["id"]

        # 3. Create Project 2 (Talegaon Plant) under same Business
        proj2_resp = client.post(
            "/api/projects",
            headers=headers,
            json={
                "business_id": biz_id,
                "name": "Talegaon Warehousing & Assembly",
                "project_type": "Expansion",
                "district": "Pune",
                "taluka": "Maval",
                "industrial_zone": "Talegaon MIDC",
                "location_type": "MIDC Industrial Estate",
                "sector": "Logistics & Assembly",
                "activities": ["warehousing", "sub_assembly"],
                "workforce_count": 40,
                "power_load_kw": 80.0,
                "pollution_category": "Green",
            },
        )
        assert proj2_resp.status_code == 201
        p2_id = proj2_resp.json()["id"]

        # 4. List projects for applicant
        list_resp = client.get("/api/projects", headers=headers)
        assert list_resp.status_code == 200
        projects = list_resp.json()
        assert len(projects) >= 2
        p_ids = [p["id"] for p in projects]
        assert p1_id in p_ids
        assert p2_id in p_ids

        # 5. List with business_id filter
        filter_resp = client.get(f"/api/projects?business_id={biz_id}", headers=headers)
        assert filter_resp.status_code == 200
        assert len(filter_resp.json()) == 2

    def test_project_tenant_isolation(self, client, applicant_user, applicant_user2):
        token1 = get_token(client, applicant_user.email)
        token2 = get_token(client, applicant_user2.email)
        h1 = {"Authorization": f"Bearer {token1}"}
        h2 = {"Authorization": f"Bearer {token2}"}

        # Applicant 1 creates Business 1 and Project 1
        b1 = client.post("/api/business", headers=h1, json={"name": "Business 1"}).json()
        p1 = client.post(
            "/api/projects",
            headers=h1,
            json={"business_id": b1["id"], "name": "Facility 1"},
        ).json()

        # Applicant 2 tries to access Applicant 1's project -> 403 Forbidden
        get_other = client.get(f"/api/projects/{p1['id']}", headers=h2)
        assert get_other.status_code == 403

        # Applicant 2 tries to update Applicant 1's project -> 403 Forbidden
        put_other = client.put(
            f"/api/projects/{p1['id']}",
            headers=h2,
            json={"name": "Hacked Name"},
        )
        assert put_other.status_code == 403

        # Applicant 2 tries to create project under Applicant 1's business -> 403 Forbidden
        post_other = client.post(
            "/api/projects",
            headers=h2,
            json={"business_id": b1["id"], "name": "Unauthorized Plant"},
        )
        assert post_other.status_code == 403

    def test_project_overview_and_company_update(self, client, applicant_user):
        token = get_token(client, applicant_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        # Create Business & Project
        b = client.post(
            "/api/business",
            headers=headers,
            json={
                "name": "Bharat Precision Ltd",
                "pan_number": "BBBBB1234B",
                "gstin": "27BBBBB1234B1Z2",
            },
        ).json()
        p = client.post(
            "/api/projects",
            headers=headers,
            json={"business_id": b["id"], "name": "Nashik Plant", "district": "Nashik"},
        ).json()

        # Fetch overview
        ov_resp = client.get(f"/api/projects/{p['id']}/overview", headers=headers)
        assert ov_resp.status_code == 200
        overview = ov_resp.json()
        assert overview["project"]["name"] == "Nashik Plant"
        assert overview["company"]["name"] == "Bharat Precision Ltd"
        assert overview["company"]["pan_number"] == "BBBBB1234B"
        assert overview["data_status"] == "DEMO"
        assert "documents_summary" in overview
        assert "inspections_summary" in overview
        assert "compliance_summary" in overview

        # Update company master info via PUT /api/business/{id}
        up_resp = client.put(
            f"/api/business/{b['id']}",
            headers=headers,
            json={
                "registration_number": "CIN-987654321",
                "contact_email": "updated@bharatprecision.in",
            },
        )
        assert up_resp.status_code == 200
        assert up_resp.json()["registration_number"] == "CIN-987654321"

        # Verify overview reflects updated company info
        ov_resp2 = client.get(f"/api/projects/{p['id']}/overview", headers=headers)
        assert ov_resp2.status_code == 200
        assert ov_resp2.json()["company"]["registration_number"] == "CIN-987654321"
        assert ov_resp2.json()["company"]["contact_email"] == "updated@bharatprecision.in"

    def test_project_update(self, client, applicant_user):
        token = get_token(client, applicant_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        b = client.post("/api/business", headers=headers, json={"name": "Dynamic Works"}).json()
        p = client.post(
            "/api/projects",
            headers=headers,
            json={"business_id": b["id"], "name": "Initial Facility", "power_load_kw": 100.0},
        ).json()

        # Update project fields
        up_resp = client.put(
            f"/api/projects/{p['id']}",
            headers=headers,
            json={
                "name": "Updated Facility Name",
                "power_load_kw": 250.0,
                "status": "COMPLETED",
            },
        )
        assert up_resp.status_code == 200
        updated = up_resp.json()
        assert updated["name"] == "Updated Facility Name"
        assert updated["power_load_kw"] == 250.0
        assert updated["status"] == "COMPLETED"

    def test_project_not_found(self, client, applicant_user):
        token = get_token(client, applicant_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.get("/api/projects/99999", headers=headers)
        assert resp.status_code == 404

    def test_multi_project_application_isolation_and_filter(self, client, applicant_user):
        token = get_token(client, applicant_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        # Create business
        b = client.post("/api/business", headers=headers, json={"name": "Multi Facility Corp"}).json()
        b_id = b["id"]

        # Confirm profile for business to allow application creation
        client.post(
            f"/api/business/{b_id}/confirm",
            headers=headers,
            json={
                "profile_data": {
                    "sector": "manufacturing",
                    "location": {"zone_type": "industrial"},
                    "processes": ["metal_fabrication"],
                    "workers_count": 25,
                }
            },
        )

        # Create two distinct projects under same business
        p1 = client.post(
            "/api/projects",
            headers=headers,
            json={"business_id": b_id, "name": "Facility Alpha", "district": "Pune"},
        ).json()
        p2 = client.post(
            "/api/projects",
            headers=headers,
            json={"business_id": b_id, "name": "Facility Beta", "district": "Thane"},
        ).json()

        # Create application for Facility Alpha
        app1_resp = client.post(
            "/api/workflow/applications",
            headers=headers,
            json={"business_id": b_id, "project_id": p1["id"], "title": "Alpha Clearances"},
        )
        assert app1_resp.status_code == 201, f"Create application failed: {app1_resp.text}"
        app1 = app1_resp.json()
        assert app1["project_id"] == p1["id"]

        # Filter applications by project_id
        list_alpha = client.get(f"/api/workflow/applications?project_id={p1['id']}", headers=headers).json()
        assert len(list_alpha) == 1
        assert list_alpha[0]["id"] == app1["id"]
        assert list_alpha[0]["project_id"] == p1["id"]

        list_beta = client.get(f"/api/workflow/applications?project_id={p2['id']}", headers=headers).json()
        assert len(list_beta) == 0

        # Project overview for Alpha includes Alpha Clearances
        ov_alpha = client.get(f"/api/projects/{p1['id']}/overview", headers=headers).json()
        assert len(ov_alpha["applications"]) == 1
        assert ov_alpha["applications"][0]["title"] == "Alpha Clearances"
