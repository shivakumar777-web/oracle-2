"""Initial migration - create research_threads table

Revision ID: 0001
Revises:
Create Date: 2025-03-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create research_threads table for production."""
    op.create_table(
        "research_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_sub", sa.String(length=255), nullable=True, index=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column(
            "settings_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "result_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    
    # Create index for user queries
    op.create_index(
        "ix_research_threads_user_sub_created",
        "research_threads",
        ["user_sub", "created_at"],
        unique=False,
    )
    
    # Create index for updated_at (for sorting)
    op.create_index(
        "ix_research_threads_updated_at",
        "research_threads",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop research_threads table."""
    op.drop_index("ix_research_threads_updated_at", table_name="research_threads")
    op.drop_index("ix_research_threads_user_sub_created", table_name="research_threads")
    op.drop_table("research_threads")
