from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.audit import record_audit
from app.api.deps import get_current_active_user
from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
    email: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.APPLICANT


@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
):
    """Exchange email + password for a JWT access token."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        record_audit(
            db,
            "auth.login_failed",
            user_email=form_data.username,
            reason="Invalid credentials",
            source="api",
            ip_address=request.client.host if request.client else None,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive")

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    record_audit(
        db,
        "auth.login_success",
        user_id=user.id,
        user_email=user.email,
        user_role=user.role.value,
        source="api",
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        full_name=user.full_name,
        email=user.email,
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Return the current authenticated user's profile."""
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Register a new user.
    In production, restrict role assignment to admins only.
    In development/demo, allow self-registration for any role.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(
        db,
        "auth.register",
        user_id=user.id,
        user_email=user.email,
        user_role=user.role.value,
        new_value={"email": user.email, "role": user.role.value},
        source="api",
    )
    db.commit()
    return user
