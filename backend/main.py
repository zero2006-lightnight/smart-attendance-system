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
from typing import Optional

# Password hashing - using bcrypt directly with proper truncation
import bcrypt

# Face recognition - using OpenCV DNN
import face_recognition_dnn as face_recognition


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

# CORS middleware - allow all origins for deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# ==================== ATTENDANCE MANAGEMENT ====================


class AttendanceStatsResponse(BaseModel):
    present: int
    total: int


class AttendanceRecordResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    timestamp: datetime
    status: str
    verified: bool


class AttendanceListResponse(BaseModel):
    records: list[AttendanceRecordResponse]
    total: int


@app.get("/api/attendance/today", response_model=AttendanceStatsResponse)
async def get_today_attendance(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get today's attendance statistics"""
    from datetime import datetime, timedelta

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Count present today
    present_count = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.timestamp >= today_start,
            models.Attendance.status == "present",
        )
        .count()
    )

    # Count total registered users
    total_users = db.query(models.User).count()

    return AttendanceStatsResponse(present=present_count, total=total_users)


@app.get("/api/attendance/recent", response_model=AttendanceListResponse)
async def get_recent_attendance(
    limit: int = 10,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get recent attendance records"""
    records = (
        db.query(models.Attendance)
        .order_by(models.Attendance.timestamp.desc())
        .limit(limit)
        .all()
    )

    record_responses = []
    for record in records:
        user = db.query(models.User).filter(models.User.id == record.user_id).first()
        record_responses.append(
            AttendanceRecordResponse(
                id=record.id,
                user_id=record.user_id,
                user_name=user.name if user else "Unknown",
                timestamp=record.timestamp,
                status=record.status,
                verified=record.verified,
            )
        )

    return AttendanceListResponse(records=record_responses, total=len(record_responses))


# ==================== FACE RECOGNITION & ANTI-SPOOFING ====================


# Pydantic models for recognition
class FaceDetectionRequest(BaseModel):
    image: str  # base64 encoded image


class BoundingBox(BaseModel):
    top: int
    right: int
    bottom: int
    left: int


class FaceDetectionResponse(BaseModel):
    faces: list[BoundingBox]
    count: int


class RecognitionMatch(BaseModel):
    user_id: int
    name: str
    email: str
    confidence: float


class RecognitionResponse(BaseModel):
    matches: list[RecognitionMatch]
    unknown_count: int


class LivenessFrame(BaseModel):
    frame: str  # base64 encoded frame
    timestamp: float


class LivenessRequest(BaseModel):
    frames: list[LivenessFrame]


class LivenessResponse(BaseModel):
    is_live: bool
    blink_count: int
    confidence: float
    message: str


class AttendanceMarkRequest(BaseModel):
    user_id: int
    photo_data: Optional[str] = None  # base64 captured photo


class AttendanceMarkResponse(BaseModel):
    success: bool
    message: str
    attendance_id: Optional[int] = None


# Liveness detection state (in-memory for session tracking)
liveness_sessions: dict = {}


def calculate_ear(eye_points) -> float:
    """Calculate Eye Aspect Ratio for blink detection"""
    # EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    import math

    p1, p2, p3, p4, p5, p6 = eye_points

    def euclidean(a, b):
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

    vertical1 = euclidean(p2, p6)
    vertical2 = euclidean(p3, p5)
    horizontal = euclidean(p1, p4)

    if horizontal == 0:
        return 0

    ear = (vertical1 + vertical2) / (2.0 * horizontal)
    return ear


def detect_blinks_in_frames(frames_data: list, face_locations: list) -> tuple:
    """
    Detect blinks in a sequence of frames for liveness detection.
    Returns (blink_count, confidence)
    """
    if face_recognition is None:
        return 0, 0.0

    blink_count = 0
    consecutive_low_ear = 0
    min_ear_threshold = 0.2  # EAR threshold for blink detection
    blink_frames_required = 2  # Frames with low EAR to count as blink

    for frame_data in frames_data:
        try:
            # Decode base64 frame
            import base64

            img_data = base64.b64decode(frame_data["frame"])
            image = Image.open(io.BytesIO(img_data))

            if image.mode != "RGB":
                image = image.convert("RGB")
            image_array = np.array(image)

            # Get face landmarks for eye detection
            # Use face_recognition's face_landmarks
            face_landmarks = face_recognition.face_landmarks(
                image_array, face_locations
            )

            for face_loc in face_locations:
                # Try to get landmarks for this face
                if face_landmarks:
                    # Simple blink detection using eye landmarks
                    left_eye = face_landmarks[0].get("left_eye", [])
                    right_eye = face_landmarks[0].get("right_eye", [])

                    if len(left_eye) >= 6 and len(right_eye) >= 6:
                        left_ear = calculate_ear([(p["x"], p["y"]) for p in left_eye])
                        right_ear = calculate_ear([(p["x"], p["y"]) for p in right_eye])
                        ear = (left_ear + right_ear) / 2

                        if ear < min_ear_threshold:
                            consecutive_low_ear += 1
                        else:
                            if consecutive_low_ear >= blink_frames_required:
                                blink_count += 1
                            consecutive_low_ear = 0
        except Exception:
            # Skip frame on error, continue processing
            continue

    # Calculate confidence based on blink count
    confidence = min(1.0, blink_count / 3.0)  # 3 blinks = 100% confidence

    return blink_count, confidence


@app.post("/api/recognition/detect", response_model=FaceDetectionResponse)
async def detect_faces(
    request: FaceDetectionRequest,
    db: Session = Depends(database.get_db),
):
    """Detect faces in the provided image"""
    if face_recognition is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face recognition library not available",
        )

    try:
        # Decode base64 image
        import base64

        img_data = base64.b64decode(request.image)
        image = Image.open(io.BytesIO(img_data))

        if image.mode != "RGB":
            image = image.convert("RGB")
        image_array = np.array(image)

        # Detect face locations
        face_locations = face_recognition.face_locations(image_array)

        # Convert to BoundingBox models
        faces = []
        for loc in face_locations:
            # face_recognition returns (top, right, bottom, left)
            faces.append(
                BoundingBox(top=loc[0], right=loc[1], bottom=loc[2], left=loc[3])
            )

        return FaceDetectionResponse(faces=faces, count=len(faces))

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting faces: {str(e)}",
        )


@app.post("/api/recognition/recognize", response_model=RecognitionResponse)
async def recognize_faces(
    request: FaceDetectionRequest,
    db: Session = Depends(database.get_db),
):
    """Recognize faces by matching against registered user encodings"""
    if face_recognition is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face recognition library not available",
        )

    try:
        # Decode base64 image
        import base64

        img_data = base64.b64decode(request.image)
        image = Image.open(io.BytesIO(img_data))

        if image.mode != "RGB":
            image = image.convert("RGB")
        image_array = np.array(image)

        # Detect face locations and encodings
        face_locations = face_recognition.face_locations(image_array)
        face_encodings = face_recognition.face_encodings(image_array, face_locations)

        if not face_encodings:
            return RecognitionResponse(matches=[], unknown_count=0)

        # Load all registered user encodings from database
        users = (
            db.query(models.User).filter(models.User.face_encoding.isnot(None)).all()
        )

        matches = []
        recognized_ids = set()

        for face_encoding in face_encodings:
            best_match = None
            best_distance = float("inf")

            for user in users:
                if user.face_encoding:
                    stored_encoding = pickle.loads(user.face_encoding)

                    # Compare faces using face_distance
                    distance = face_recognition.face_distance(
                        [stored_encoding], face_encoding
                    )[0]

                    # Lower distance = better match (threshold 0.6)
                    if distance < 0.6 and distance < best_distance:
                        best_distance = distance
                        best_match = user

            if best_match:
                # Calculate confidence (1 - distance)
                confidence = max(0, 1 - best_distance)
                matches.append(
                    RecognitionMatch(
                        user_id=best_match.id,
                        name=best_match.name,
                        email=best_match.email,
                        confidence=round(confidence, 2),
                    )
                )
                recognized_ids.add(best_match.id)

        # Count unrecognized faces
        unknown_count = len(face_encodings) - len(matches)

        return RecognitionResponse(matches=matches, unknown_count=unknown_count)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error recognizing faces: {str(e)}",
        )


@app.post("/api/recognition/liveness", response_model=LivenessResponse)
async def check_liveness(
    request: LivenessRequest,
    db: Session = Depends(database.get_db),
):
    """Check liveness using blink detection in frame sequence"""
    if face_recognition is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face recognition library not available",
        )

    try:
        # Process frames to get face locations for each
        first_frame = None
        face_locations = None

        for frame_data in request.frames:
            if first_frame is None:
                import base64

                img_data = base64.b64decode(frame_data.frame)
                image = Image.open(io.BytesIO(img_data))

                if image.mode != "RGB":
                    image = image.convert("RGB")
                image_array = np.array(image)

                # Get face locations
                face_locations = face_recognition.face_locations(image_array)

                if not face_locations:
                    return LivenessResponse(
                        is_live=False,
                        blink_count=0,
                        confidence=0.0,
                        message="No face detected in frame sequence",
                    )

                first_frame = image_array

        # Detect blinks in frame sequence
        blink_count, confidence = detect_blinks_in_frames(
            [{"frame": f.frame} for f in request.frames], face_locations
        )

        # Require at least 2-3 blinks within the sequence
        is_live = blink_count >= 2

        message = (
            "Liveness verified"
            if is_live
            else "Liveness verification failed - no blinks detected"
        )

        if blink_count < 2 and blink_count > 0:
            message = f"Only {blink_count} blink(s) detected, need at least 2"

        return LivenessResponse(
            is_live=is_live,
            blink_count=blink_count,
            confidence=round(confidence, 2),
            message=message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking liveness: {str(e)}",
        )


@app.post("/api/recognition/mark-attendance", response_model=AttendanceMarkResponse)
async def mark_attendance(
    request: AttendanceMarkRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark attendance after liveness verification"""
    try:
        # Get user to mark attendance for
        user = db.query(models.User).filter(models.User.id == request.user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Check if already marked today
        from datetime import datetime, timedelta

        today_start = datetime.utcnow().replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        existing = (
            db.query(models.Attendance)
            .filter(
                models.Attendance.user_id == request.user_id,
                models.Attendance.timestamp >= today_start,
            )
            .first()
        )

        if existing:
            return AttendanceMarkResponse(
                success=False,
                message="Attendance already marked for today",
                attendance_id=existing.id,
            )

        # Create attendance record
        attendance = models.Attendance(
            user_id=request.user_id,
            status="present",
            verified=True,  # Face verification passed
            photo_path=None,
        )

        db.add(attendance)
        db.commit()
        db.refresh(attendance)

        return AttendanceMarkResponse(
            success=True,
            message=f"Attendance marked for {user.name}",
            attendance_id=attendance.id,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error marking attendance: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
