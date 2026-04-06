from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import database
import models
import pickle
import numpy as np
from PIL import Image
import io

# Password hashing - using bcrypt directly with proper truncation
import bcrypt

# Face recognition
try:
    import face_recognition
except ImportError:
    face_recognition = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    """Hash password - truncate to 72 bytes for bcrypt compatibility"""
    truncated = password.encode("utf-8")[:72]
    return bcrypt.hashpw(truncated, bcrypt.gensalt()).decode("utf-8")


# JWT configuration
SECRET_KEY = "smart-attendance-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Security
security = HTTPBearer()


# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str


# Admin user management models
class UserCreateAdmin(BaseModel):
    email: EmailStr
    name: str
    password: Optional[str] = None
    role: Optional[str] = "user"


def create_access_token(data: dict):
    """Create JWT token"""
    to_encode = data.copy()
    # Convert sub to string for jose compatibility
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    """Hash password - truncate to 72 bytes for bcrypt compatibility"""
    truncated = password.encode("utf-8")[:72]
    return bcrypt.hashpw(truncated, bcrypt.gensalt()).decode("utf-8")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(database.get_db),
) -> models.User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Require admin role"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# FastAPI app
app = FastAPI(
    title="Smart Attendance API", description="AI-powered attendance tracking system"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include database tables creation
database.Base.metadata.create_all(bind=database.engine)


# Routes
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Smart Attendance API"}


@app.post("/api/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(database.get_db)):
    """Register a new user"""
    # Check if user exists
    existing_user = (
        db.query(models.User).filter(models.User.email == user_data.email).first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Hash password and create user
    hashed_password = get_password_hash(user_data.password)
    new_user = models.User(
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.name,
        role="user",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id, email=new_user.email, name=new_user.name, role=new_user.role
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(database.get_db)):
    """Login and get access token"""
    # Find user
    user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.id, "email": user.email})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
    )


# ==================== ADMIN USER MANAGEMENT ====================


class UserListResponse(BaseModel):
    users: list[UserResponse]


@app.post("/api/admin/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreateAdmin,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    """Create a new user (admin only)"""
    # Check if email exists
    existing = (
        db.query(models.User).filter(models.User.email == user_data.email).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    hashed_password = get_password_hash(user_data.password or "changeme123")
    new_user = models.User(
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.name,
        role=user_data.role or "user",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        role=new_user.role,
    )


@app.get("/api/admin/users", response_model=UserListResponse)
async def list_users(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    """List all users (admin only)"""
    users = db.query(models.User).all()
    return UserListResponse(
        users=[
            UserResponse(id=u.id, email=u.email, name=u.name, role=u.role)
            for u in users
        ]
    )


@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    """Delete a user (admin only)"""
    # Cannot delete yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}


# ==================== FACE ENROLLMENT ====================


@app.post("/api/users/face-enroll")
async def enroll_face(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """Enroll face encoding for the current user"""
    if face_recognition is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face recognition library not available",
        )

    # Read and process image
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Convert to RGB (face_recognition expects RGB)
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Convert to numpy array
        image_array = np.array(image)

        # Get face encodings
        encodings = face_recognition.face_encodings(image_array)

        if not encodings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No face detected in the image. Please upload a clear photo of your face.",
            )

        if len(encodings) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple faces detected. Please upload an image with only one face.",
            )

        # Store encoding as pickle
        encoding_data = pickle.dumps(encodings[0])
        current_user.face_encoding = encoding_data
        db.commit()

        return {
            "message": "Face enrolled successfully",
            "user_id": current_user.id,
            "name": current_user.name,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
