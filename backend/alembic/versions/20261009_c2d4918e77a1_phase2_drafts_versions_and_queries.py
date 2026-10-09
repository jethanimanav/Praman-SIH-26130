"""phase2_drafts_versions_and_queries

Revision ID: c2d4918e77a1
Revises: b1e354a991f2
Create Date: 2026-10-09 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d4918e77a1'
down_revision: Union[str, None] = 'b1e354a991f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Add form_data and version to applications table if not already present
    if 'applications' in existing_tables:
        app_cols = [c['name'] for c in inspector.get_columns('applications')]
        with op.batch_alter_table('applications', schema=None) as batch_op:
            if 'form_data' not in app_cols:
                batch_op.add_column(sa.Column('form_data', sa.JSON(), nullable=True))
            if 'version' not in app_cols:
                batch_op.add_column(sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')))

    # 2. Create application_versions table if not already present
    if 'application_versions' not in existing_tables:
        op.create_table(
            'application_versions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('application_id', sa.Integer(), nullable=False),
            sa.Column('version_number', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('form_data', sa.JSON(), nullable=True),
            sa.Column('snapshot', sa.JSON(), nullable=False),
            sa.Column('change_summary', sa.Text(), nullable=True),
            sa.Column('source', sa.String(length=100), nullable=False, server_default='api'),
            sa.Column('created_by_id', sa.Integer(), nullable=True),
            sa.Column('created_by_email', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('application_versions', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_application_versions_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_application_versions_application_id'), ['application_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_application_versions_version_number'), ['version_number'], unique=False)

    # 3. Create department_queries table if not already present
    if 'department_queries' not in existing_tables:
        op.create_table(
            'department_queries',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('application_id', sa.Integer(), nullable=False),
            sa.Column('business_id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=True),
            sa.Column('approval_step_id', sa.Integer(), nullable=True),
            sa.Column('query_code', sa.String(length=50), nullable=False),
            sa.Column('subject', sa.String(length=255), nullable=False),
            sa.Column('query_details', sa.Text(), nullable=False),
            sa.Column('department', sa.String(length=255), nullable=False),
            sa.Column('issued_by_id', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='OPEN'),
            sa.Column('data_status', sa.String(length=50), nullable=False, server_default='DEMO'),
            sa.Column('deadline_at', sa.DateTime(), nullable=True),
            sa.Column('resolved_at', sa.DateTime(), nullable=True),
            sa.Column('resolved_by_id', sa.Integer(), nullable=True),
            sa.Column('resolution_note', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ),
            sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
            sa.ForeignKeyConstraint(['approval_step_id'], ['approval_steps.id'], ),
            sa.ForeignKeyConstraint(['issued_by_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('department_queries', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_department_queries_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_department_queries_application_id'), ['application_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_department_queries_business_id'), ['business_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_department_queries_project_id'), ['project_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_department_queries_status'), ['status'], unique=False)
            batch_op.create_index(batch_op.f('ix_department_queries_query_code'), ['query_code'], unique=True)

    # 4. Create query_messages table if not already present
    if 'query_messages' not in existing_tables:
        op.create_table(
            'query_messages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('query_id', sa.Integer(), nullable=False),
            sa.Column('sender_id', sa.Integer(), nullable=False),
            sa.Column('sender_role', sa.String(length=50), nullable=False),
            sa.Column('message_text', sa.Text(), nullable=False),
            sa.Column('attachment_document_ids', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['query_id'], ['department_queries.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('query_messages', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_query_messages_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_query_messages_query_id'), ['query_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 4. Drop query_messages
    if 'query_messages' in existing_tables:
        with op.batch_alter_table('query_messages', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_query_messages_query_id'))
            batch_op.drop_index(batch_op.f('ix_query_messages_id'))
        op.drop_table('query_messages')

    # 3. Drop department_queries
    if 'department_queries' in existing_tables:
        with op.batch_alter_table('department_queries', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_department_queries_query_code'))
            batch_op.drop_index(batch_op.f('ix_department_queries_status'))
            batch_op.drop_index(batch_op.f('ix_department_queries_project_id'))
            batch_op.drop_index(batch_op.f('ix_department_queries_business_id'))
            batch_op.drop_index(batch_op.f('ix_department_queries_application_id'))
            batch_op.drop_index(batch_op.f('ix_department_queries_id'))
        op.drop_table('department_queries')

    # 2. Drop application_versions
    if 'application_versions' in existing_tables:
        with op.batch_alter_table('application_versions', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_application_versions_version_number'))
            batch_op.drop_index(batch_op.f('ix_application_versions_application_id'))
            batch_op.drop_index(batch_op.f('ix_application_versions_id'))
        op.drop_table('application_versions')

    # 1. Drop version and form_data columns from applications
    if 'applications' in existing_tables:
        app_cols = [c['name'] for c in inspector.get_columns('applications')]
        with op.batch_alter_table('applications', schema=None) as batch_op:
            if 'version' in app_cols:
                batch_op.drop_column('version')
            if 'form_data' in app_cols:
                batch_op.drop_column('form_data')
