import pytest
from tests.conftest import get_token


class TestLogin:
    def test_applicant_login_success(self, client, applicant_user):
        response = client.post(
            "/api/auth/token",
            data={"username": "test.applicant@test.rop", "password": "TestPass@123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["token_type"] == "bearer"
        assert data["role"] == "applicant"
        assert "access_token" in data
        assert data["email"] == "test.applicant@test.rop"

    def test_officer_login_success(self, client, officer_user):
        response = client.post(
            "/api/auth/token",
            data={"username": "test.officer@test.rop", "password": "TestPass@123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "officer"

    def test_admin_login_success(self, client, admin_user):
        response = client.post(
            "/api/auth/token",
            data={"username": "test.admin@test.rop", "password": "TestPass@123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"

    def test_wrong_password_fails(self, client, applicant_user):
        response = client.post(
            "/api/auth/token",
            data={"username": "test.applicant@test.rop", "password": "WrongPassword"},
        )
        assert response.status_code == 401

    def test_nonexistent_user_fails(self, client):
        response = client.post(
            "/api/auth/token",
            data={"username": "nobody@nowhere.com", "password": "AnyPassword"},
        )
        assert response.status_code == 401

    def test_wrong_password_creates_audit_log(self, client, applicant_user, db):
        from app.models.audit import AuditLog
        client.post(
            "/api/auth/token",
            data={"username": "test.applicant@test.rop", "password": "WrongPass"},
        )
        log = db.query(AuditLog).filter(AuditLog.action == "auth.login_failed").first()
        assert log is not None
        assert log.user_email == "test.applicant@test.rop"

    def test_successful_login_creates_audit_log(self, client, applicant_user, db):
        from app.models.audit import AuditLog
        client.post(
            "/api/auth/token",
            data={"username": "test.applicant@test.rop", "password": "TestPass@123"},
        )
        log = db.query(AuditLog).filter(AuditLog.action == "auth.login_success").first()
        assert log is not None


class TestMe:
    def test_get_me_authenticated(self, client, applicant_user):
        token = get_token(client, "test.applicant@test.rop")
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test.applicant@test.rop"
        assert data["role"] == "applicant"

    def test_get_me_unauthenticated(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_me_invalid_token(self, client):
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalidtoken123"},
        )
        assert response.status_code == 401


class TestRegister:
    def test_register_applicant(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "new.user@test.rop",
                "full_name": "New User",
                "password": "TestPass@123",
                "role": "applicant",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "new.user@test.rop"
        assert data["role"] == "applicant"

    def test_duplicate_email_rejected(self, client, applicant_user):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test.applicant@test.rop",
                "full_name": "Duplicate",
                "password": "TestPass@123",
            },
        )
        assert response.status_code == 409
