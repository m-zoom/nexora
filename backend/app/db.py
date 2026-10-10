from __future__ import annotations

import os

from sqlalchemy import Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL") or "sqlite:///./nexora.db"
    # Railway hands out postgres:// URLs; SQLAlchemy wants the driver named.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


engine = create_engine(_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    price: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(32), index=True)
    image: Mapped[str] = mapped_column(String(255))
    tags: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "category": self.category,
            "image": self.image,
            "description": self.description,
        }


def get_db():
    with SessionLocal() as db:
        yield db


def init_db() -> None:
    from .catalog import seed

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed(db)
