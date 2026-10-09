import sqlite3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError as SAOperationalError
from contextlib import asynccontextmanager
from app.database import engine, Base, SessionLocal
from app.config import get_settings
from app.api import auth, admin, regulatory, business, workflow, sla, officer, document, inspection, compliance, analytics
from app.seed import seed_demo_users, seed_demo_scenario

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    Base.metadata.create_all(bind=engine)
    # Seed demo users and Scenario C demo data if running in development
    if settings.is_development:
        db = SessionLocal()
        try:
            seed_demo_scenario(db)
        finally:
            db.close()
    yield
    # Shutdown: nothing to clean up for SQLite


app = FastAPI(
    title="Regulatory Orchestration Platform (ROP)",
    description=(
        "SIH 2026 — PS 26130\n\n"
        "An orchestration and intelligence layer for industrial regulatory approvals.\n\n"
        "**Data Notice**: All regulatory data is DEMO status unless explicitly marked VERIFIED."
    ),
    version="0.2.0-m2",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(sqlite3.OperationalError)
async def sqlite_operational_error_handler(request: Request, exc: sqlite3.OperationalError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is temporarily busy. Please retry your request."},
    )


@app.exception_handler(SAOperationalError)
async def sqlalchemy_operational_error_handler(request: Request, exc: SAOperationalError):
    if "database is locked" in str(exc).lower():
        return JSONResponse(
            status_code=503,
            content={"detail": "Database is temporarily busy. Please retry your request."},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "A database operational error occurred."},
    )

# Include routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(regulatory.router)
app.include_router(business.router)
app.include_router(workflow.router)
app.include_router(sla.router)
app.include_router(officer.router)
app.include_router(document.router)
app.include_router(inspection.router)
app.include_router(compliance.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    return {
        "name": "Regulatory Orchestration Platform (ROP)",
        "version": "0.1.0-m0",
        "milestone": "M0 — Foundation",
        "status": "running",
        "data_notice": "All regulatory data is DEMO status unless explicitly marked VERIFIED.",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "milestone": "M0"}
