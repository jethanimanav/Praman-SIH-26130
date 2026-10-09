"""phase3_phase4_readiness_notifications_radar

Revision ID: e4f5a6b7c8d9
Revises: c2d4918e77a1
Create Date: 2026-10-09 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'c2d4918e77a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Create notifications table if not already present
    if 'notifications' not in existing_tables:
        op.create_table(
            'notifications',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('event_type', sa.String(length=100), nullable=False),
            sa.Column('severity', sa.String(length=50), nullable=False, server_default='INFO'),
            sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('0')),
            sa.Column('entity_type', sa.String(length=100), nullable=True),
            sa.Column('entity_id', sa.String(length=100), nullable=True),
            sa.Column('action_url', sa.String(length=255), nullable=True),
            sa.Column('idempotency_key', sa.String(length=255), nullable=True),
            sa.Column('data_status', sa.String(length=50), nullable=False, server_default='DEMO'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('read_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('notifications', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_notifications_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_notifications_user_id'), ['user_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_notifications_event_type'), ['event_type'], unique=False)
            batch_op.create_index(batch_op.f('ix_notifications_is_read'), ['is_read'], unique=False)
            batch_op.create_index(batch_op.f('ix_notifications_idempotency_key'), ['idempotency_key'], unique=True)

    # 2. Create regulatory_sources table if not already present
    if 'regulatory_sources' not in existing_tables:
        op.create_table(
            'regulatory_sources',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('source_code', sa.String(length=100), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('issuing_authority', sa.String(length=255), nullable=False),
            sa.Column('official_url', sa.String(length=500), nullable=True),
            sa.Column('source_type', sa.String(length=100), nullable=False, server_default='CIRCULAR'),
            sa.Column('verification_status', sa.String(length=50), nullable=False, server_default='DEMO'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('last_checked_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('regulatory_sources', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_regulatory_sources_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_regulatory_sources_source_code'), ['source_code'], unique=True)

    # 3. Create regulatory_change_records table if not already present
    if 'regulatory_change_records' not in existing_tables:
        op.create_table(
            'regulatory_change_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('change_code', sa.String(length=100), nullable=False),
            sa.Column('source_id', sa.Integer(), nullable=True),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('summary', sa.Text(), nullable=False),
            sa.Column('gazette_or_order_ref', sa.String(length=255), nullable=True),
            sa.Column('publication_date', sa.DateTime(), nullable=True),
            sa.Column('effective_date', sa.DateTime(), nullable=True),
            sa.Column('verification_status', sa.String(length=50), nullable=False, server_default='DEMO'),
            sa.Column('target_sector', sa.String(length=100), nullable=True, server_default='all'),
            sa.Column('affected_topics', sa.JSON(), nullable=False),
            sa.Column('matching_conditions', sa.JSON(), nullable=False),
            sa.Column('impact_summary', sa.Text(), nullable=False),
            sa.Column('recommended_action', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['source_id'], ['regulatory_sources.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('regulatory_change_records', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_regulatory_change_records_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_regulatory_change_records_change_code'), ['change_code'], unique=True)
            batch_op.create_index(batch_op.f('ix_regulatory_change_records_source_id'), ['source_id'], unique=False)

    # 4. Create project_impact_assessments table if not already present
    if 'project_impact_assessments' not in existing_tables:
        op.create_table(
            'project_impact_assessments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('change_id', sa.Integer(), nullable=False),
            sa.Column('impact_level', sa.String(length=50), nullable=False, server_default='POTENTIALLY_AFFECTED'),
            sa.Column('explanation', sa.Text(), nullable=False),
            sa.Column('matched_attributes', sa.JSON(), nullable=False),
            sa.Column('review_status', sa.String(length=50), nullable=False, server_default='PENDING_REVIEW'),
            sa.Column('reviewed_by_id', sa.Integer(), nullable=True),
            sa.Column('review_notes', sa.Text(), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['change_id'], ['regulatory_change_records.id'], ),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
            sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('project_impact_assessments', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_project_impact_assessments_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_project_impact_assessments_project_id'), ['project_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_project_impact_assessments_change_id'), ['change_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_project_impact_assessments_impact_level'), ['impact_level'], unique=False)
            batch_op.create_index(batch_op.f('ix_project_impact_assessments_review_status'), ['review_status'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 4. Drop project_impact_assessments
    if 'project_impact_assessments' in existing_tables:
        with op.batch_alter_table('project_impact_assessments', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_project_impact_assessments_review_status'))
            batch_op.drop_index(batch_op.f('ix_project_impact_assessments_impact_level'))
            batch_op.drop_index(batch_op.f('ix_project_impact_assessments_change_id'))
            batch_op.drop_index(batch_op.f('ix_project_impact_assessments_project_id'))
            batch_op.drop_index(batch_op.f('ix_project_impact_assessments_id'))
        op.drop_table('project_impact_assessments')

    # 3. Drop regulatory_change_records
    if 'regulatory_change_records' in existing_tables:
        with op.batch_alter_table('regulatory_change_records', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_regulatory_change_records_source_id'))
            batch_op.drop_index(batch_op.f('ix_regulatory_change_records_change_code'))
            batch_op.drop_index(batch_op.f('ix_regulatory_change_records_id'))
        op.drop_table('regulatory_change_records')

    # 2. Drop regulatory_sources
    if 'regulatory_sources' in existing_tables:
        with op.batch_alter_table('regulatory_sources', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_regulatory_sources_source_code'))
            batch_op.drop_index(batch_op.f('ix_regulatory_sources_id'))
        op.drop_table('regulatory_sources')

    # 1. Drop notifications
    if 'notifications' in existing_tables:
        with op.batch_alter_table('notifications', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_notifications_idempotency_key'))
            batch_op.drop_index(batch_op.f('ix_notifications_is_read'))
            batch_op.drop_index(batch_op.f('ix_notifications_event_type'))
            batch_op.drop_index(batch_op.f('ix_notifications_user_id'))
            batch_op.drop_index(batch_op.f('ix_notifications_id'))
        op.drop_table('notifications')
