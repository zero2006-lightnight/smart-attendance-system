from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

db_url = os.getenv("DATABASE_URL", "")
if db_url and not db_url.startswith("sqlite"):
    # Use SQLite file for deployment
    db_url = "attendance.db"
else:
    db_url = "attendance.db"

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_url}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
