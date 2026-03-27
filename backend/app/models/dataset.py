import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="uploading")  # uploading/profiling/ready/crystallizing/complete
    entity_count: Mapped[int | None] = mapped_column(Integer)
    edge_count: Mapped[int | None] = mapped_column(Integer)
    density: Mapped[float | None] = mapped_column(Float)
    raw_storage_path: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"), onupdate=datetime.utcnow)

    entity_types: Mapped[list["EntityType"]] = relationship(back_populates="dataset")
    relationship_types: Mapped[list["RelationshipType"]] = relationship(back_populates="dataset")
    ingestion_logs: Mapped[list["IngestionLog"]] = relationship(back_populates="dataset")


class EntityType(Base):
    __tablename__ = "entity_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    count: Mapped[int | None] = mapped_column(Integer)
    attributes: Mapped[dict | None] = mapped_column(JSONB)

    dataset: Mapped[Dataset] = relationship(back_populates="entity_types")


class RelationshipType(Base):
    __tablename__ = "relationship_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entity_types.id"), nullable=False)
    target_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entity_types.id"), nullable=False)
    count: Mapped[int | None] = mapped_column(Integer)

    dataset: Mapped[Dataset] = relationship(back_populates="relationship_types")
    source_type: Mapped[EntityType] = relationship(foreign_keys=[source_type_id])
    target_type: Mapped[EntityType] = relationship(foreign_keys=[target_type_id])


class IngestionLog(Base):
    __tablename__ = "ingestion_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB)
    performed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    dataset: Mapped[Dataset] = relationship(back_populates="ingestion_logs")
