from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(default="INR")
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )

    __table_args__ = (
        Index("ix_price_history_listing_scraped", "listing_id", "scraped_at"),
    )
