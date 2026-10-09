"""phase1_project_entity_and_company_fields

Revision ID: b1e354a991f2
Revises: a88cca56a147
Create Date: 2026-10-09 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1e354a991f2'
down_revision: Union[str, None] = 'a88cca56a147'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Create projects table if not already present
    if 'projects' not in existing_tables:
        op.create_table(
            'projects',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('business_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('project_type', sa.String(length=100), nullable=False, server_default='New Setup'),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='ACTIVE'),
            sa.Column('district', sa.String(length=100), nullable=True),
            sa.Column('taluka', sa.String(length=100), nullable=True),
            sa.Column('industrial_zone', sa.String(length=255), nullable=True),
            sa.Column('location_type', sa.String(length=100), nullable=True),
            sa.Column('site_address', sa.Text(), nullable=True),
            sa.Column('survey_plot_number', sa.String(length=100), nullable=True),
            sa.Column('total_area_sqm', sa.Float(), nullable=True),
            sa.Column('built_up_area_sqm', sa.Float(), nullable=True),
            sa.Column('sector', sa.String(length=100), nullable=True, server_default='Manufacturing'),
            sa.Column('activities', sa.JSON(), nullable=False),
            sa.Column('workforce_count', sa.Integer(), nullable=True),
            sa.Column('power_load_kw', sa.Float(), nullable=True),
            sa.Column('water_consumption_kld', sa.Float(), nullable=True),
            sa.Column('effluent_discharge_kld', sa.Float(), nullable=True),
            sa.Column('pollution_category', sa.String(length=50), nullable=True),
            sa.Column('hazardous_waste', sa.Boolean(), nullable=False, server_default=sa.text('0')),
            sa.Column('air_emissions', sa.Boolean(), nullable=False, server_default=sa.text('0')),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('projects', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_projects_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_projects_business_id'), ['business_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_projects_status'), ['status'], unique=False)

    # 2. Add company profile columns to businesses
    biz_cols = [c['name'] for c in inspector.get_columns('businesses')]
    with op.batch_alter_table('businesses', schema=None) as batch_op:
        if 'registration_number' not in biz_cols:
            batch_op.add_column(sa.Column('registration_number', sa.String(length=100), nullable=True))
        if 'entity_type' not in biz_cols:
            batch_op.add_column(sa.Column('entity_type', sa.String(length=100), nullable=True))
        if 'pan_number' not in biz_cols:
            batch_op.add_column(sa.Column('pan_number', sa.String(length=50), nullable=True))
        if 'gstin' not in biz_cols:
            batch_op.add_column(sa.Column('gstin', sa.String(length=50), nullable=True))
        if 'contact_email' not in biz_cols:
            batch_op.add_column(sa.Column('contact_email', sa.String(length=255), nullable=True))
        if 'contact_phone' not in biz_cols:
            batch_op.add_column(sa.Column('contact_phone', sa.String(length=50), nullable=True))
        if 'registered_office_address' not in biz_cols:
            batch_op.add_column(sa.Column('registered_office_address', sa.Text(), nullable=True))

    # 3. Add project_id to regulatory_profiles
    reg_cols = [c['name'] for c in inspector.get_columns('regulatory_profiles')]
    if 'project_id' not in reg_cols:
        with op.batch_alter_table('regulatory_profiles', schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_regulatory_profiles_project_id', 'projects', ['project_id'], ['id'])
            batch_op.create_index('ix_regulatory_profiles_project_id', ['project_id'], unique=True)

    # 4. Add project_id to applications
    app_cols = [c['name'] for c in inspector.get_columns('applications')]
    if 'project_id' not in app_cols:
        with op.batch_alter_table('applications', schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_applications_project_id', 'projects', ['project_id'], ['id'])
            batch_op.create_index('ix_applications_project_id', ['project_id'], unique=False)

    # 5. Add project_id to documents
    doc_cols = [c['name'] for c in inspector.get_columns('documents')]
    if 'project_id' not in doc_cols:
        with op.batch_alter_table('documents', schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_documents_project_id', 'projects', ['project_id'], ['id'])
            batch_op.create_index('ix_documents_project_id', ['project_id'], unique=False)

    # 6. Add project_id to joint_inspections
    insp_cols = [c['name'] for c in inspector.get_columns('joint_inspections')]
    if 'project_id' not in insp_cols:
        with op.batch_alter_table('joint_inspections', schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_joint_inspections_project_id', 'projects', ['project_id'], ['id'])
            batch_op.create_index('ix_joint_inspections_project_id', ['project_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 6. Drop project_id from joint_inspections
    if 'joint_inspections' in existing_tables:
        insp_cols = [c['name'] for c in inspector.get_columns('joint_inspections')]
        if 'project_id' in insp_cols:
            with op.batch_alter_table('joint_inspections', schema=None) as batch_op:
                batch_op.drop_index(batch_op.f('ix_joint_inspections_project_id'))
                batch_op.drop_constraint('fk_joint_inspections_project_id', type_='foreignkey')
                batch_op.drop_column('project_id')

    # 5. Drop project_id from documents
    if 'documents' in existing_tables:
        doc_cols = [c['name'] for c in inspector.get_columns('documents')]
        if 'project_id' in doc_cols:
            with op.batch_alter_table('documents', schema=None) as batch_op:
                batch_op.drop_index(batch_op.f('ix_documents_project_id'))
                batch_op.drop_constraint('fk_documents_project_id', type_='foreignkey')
                batch_op.drop_column('project_id')

    # 4. Drop project_id from applications
    if 'applications' in existing_tables:
        app_cols = [c['name'] for c in inspector.get_columns('applications')]
        if 'project_id' in app_cols:
            with op.batch_alter_table('applications', schema=None) as batch_op:
                batch_op.drop_index(batch_op.f('ix_applications_project_id'))
                batch_op.drop_constraint('fk_applications_project_id', type_='foreignkey')
                batch_op.drop_column('project_id')

    # 3. Drop project_id from regulatory_profiles
    if 'regulatory_profiles' in existing_tables:
        reg_cols = [c['name'] for c in inspector.get_columns('regulatory_profiles')]
        if 'project_id' in reg_cols:
            with op.batch_alter_table('regulatory_profiles', schema=None) as batch_op:
                batch_op.drop_index(batch_op.f('ix_regulatory_profiles_project_id'))
                batch_op.drop_constraint('fk_regulatory_profiles_project_id', type_='foreignkey')
                batch_op.drop_column('project_id')

    # 2. Drop company columns from businesses
    if 'businesses' in existing_tables:
        biz_cols = [c['name'] for c in inspector.get_columns('businesses')]
        with op.batch_alter_table('businesses', schema=None) as batch_op:
            for col in ['registered_office_address', 'contact_phone', 'contact_email', 'gstin', 'pan_number', 'entity_type', 'registration_number']:
                if col in biz_cols:
                    batch_op.drop_column(col)

    # 1. Drop projects table
    if 'projects' in existing_tables:
        with op.batch_alter_table('projects', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_projects_status'))
            batch_op.drop_index(batch_op.f('ix_projects_business_id'))
            batch_op.drop_index(batch_op.f('ix_projects_id'))
        op.drop_table('projects')
