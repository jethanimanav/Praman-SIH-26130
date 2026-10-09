import pytest
from tests.conftest import get_token


class TestRBAC:
    def test_admin_can_access_audit_logs(self, client, admin_user):
        token = get_token(client, "test.admin@test.rop")
        response = client.get(
            "/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_applicant_cannot_access_admin_routes(self, client, applicant_user):
        token = get_token(client, "test.applicant@test.rop")
        response = client.get(
            "/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_officer_cannot_access_admin_routes(self, client, officer_user):
        token = get_token(client, "test.officer@test.rop")
        response = client.get(
            "/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_unauthenticated_cannot_access_admin_routes(self, client):
        response = client.get("/api/admin/audit-logs")
        assert response.status_code == 401

    def test_admin_can_get_clock_status(self, client, admin_user):
        token = get_token(client, "test.admin@test.rop")
        response = client.get(
            "/api/admin/clock",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_time" in data
        assert "is_simulated" in data

    def test_admin_can_advance_clock(self, client, admin_user):
        token = get_token(client, "test.admin@test.rop")
        response = client.post(
            "/api/admin/clock/advance",
            headers={"Authorization": f"Bearer {token}"},
            json={"days": 1, "hours": 0, "minutes": 0},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_simulated"] is True
        # Reset after test
        client.post(
            "/api/admin/clock/reset",
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_applicant_cannot_advance_clock(self, client, applicant_user):
        token = get_token(client, "test.applicant@test.rop")
        response = client.post(
            "/api/admin/clock/advance",
            headers={"Authorization": f"Bearer {token}"},
            json={"days": 1},
        )
        assert response.status_code == 403

    def test_admin_can_list_users(self, client, admin_user, applicant_user, officer_user):
        token = get_token(client, "test.admin@test.rop")
        response = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        users = response.json()
        assert len(users) >= 3  # admin + applicant + officer
