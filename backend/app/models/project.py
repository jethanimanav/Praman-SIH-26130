from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Float,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Project(Base):
    """
    Represents a specific industrial facility, plant, or project undertaking
    belonging to a Business (1 Business -> N Projects).
    
    Contains site-level operational, location, and environmental attributes.
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Facility Identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    project_type = Column(String(100), default="New Setup", nullable=False)  # New Setup, Expansion, Modernization
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, COMPLETED, ARCHIVED

    # Site & Location Details
    district = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    industrial_zone = Column(String(255), nullable=True)  # e.g. "Chakan MIDC Phase II"
    location_type = Column(String(100), nullable=True)  # MIDC Industrial Estate, Municipal Corporation, Gram Panchayat
    site_address = Column(Text, nullable=True)
    survey_plot_number = Column(String(100), nullable=True)
    total_area_sqm = Column(Float, nullable=True)
    built_up_area_sqm = Column(Float, nullable=True)

    # Operational & Environmental Attributes
    sector = Column(String(100), default="Manufacturing", nullable=True)
    activities = Column(JSON, default=list, nullable=False)  # List of activity strings
    workforce_count = Column(Integer, nullable=True)
    power_load_kw = Column(Float, nullable=True)
    water_consumption_kld = Column(Float, nullable=True)
    effluent_discharge_kld = Column(Float, nullable=True)
    pollution_category = Column(String(50), nullable=True)  # Red, Orange, Green, White
    hazardous_waste = Column(Boolean, default=False, nullable=False)
    air_emissions = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="projects")
    applications = relationship("Application", back_populates="project", cascade="all, delete-orphan")
    regulatory_profile = relationship("RegulatoryProfile", back_populates="project", uselist=False)

    def __repr__(self):
        return f"<Project id={self.id} name={self.name!r} business_id={self.business_id}>"
