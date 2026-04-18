from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    site: Mapped[str] = mapped_column(String(100), index=True)
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    title: Mapped[str] = mapped_column(String(500))
    condition: Mapped[str] = mapped_column(String(20), default="new", index=True)
    seller: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
