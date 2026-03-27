import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crystallization_jobs.id"), nullable=False)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    module_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    entity_count: Mapped[int | None] = mapped_column(Integer)
    dominant_type: Mapped[str | None] = mapped_column(String(255))
    purity_score: Mapped[float | None] = mapped_column(Float)
    type_distribution: Mapped[dict | None] = mapped_column(JSONB)
    anchor_entities: Mapped[dict | None] = mapped_column(JSONB)
    internal_density: Mapped[float | None] = mapped_column(Float)
    confidence: Mapped[str | None] = mapped_column(String(20))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    entities: Mapped[list["ModuleEntity"]] = relationship(back_populates="module")


class ModuleEntity(Base):
    __tablename__ = "module_entities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(500), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(255), nullable=False)
    attributes: Mapped[dict | None] = mapped_column(JSONB)
    centrality_score: Mapped[float | None] = mapped_column(Float)

    module: Mapped[Module] = relationship(back_populates="entities")


class HiddenConnection(Base):
    __tablename__ = "hidden_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crystallization_jobs.id"), nullable=False)
    source_entity: Mapped[str] = mapped_column(String(500), nullable=False)
    target_entity: Mapped[str] = mapped_column(String(500), nullable=False)
    source_module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    target_module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    has_direct_edge: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)
    validated: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    source_module: Mapped[Module] = relationship(foreign_keys=[source_module_id])
    target_module: Mapped[Module] = relationship(foreign_keys=[target_module_id])


class ModuleRelationship(Base):
    __tablename__ = "module_relationships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    target_module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    connection_strength: Mapped[float | None] = mapped_column(Float)
    shared_entity_count: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    source_module: Mapped[Module] = relationship(foreign_keys=[source_module_id])
    target_module: Mapped[Module] = relationship(foreign_keys=[target_module_id])
