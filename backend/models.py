from sqlalchemy import Column, Integer, String, DateTime, Boolean, LargeBinary
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    password_hash = Column(String)
    is_admin = Column(Boolean, default=False)
    face_encoding = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    verified = Column(Boolean, default=False)
