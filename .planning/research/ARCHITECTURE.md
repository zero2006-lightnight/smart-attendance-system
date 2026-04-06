# Architecture Patterns

**Domain:** Facial Recognition Attendance System
**Researched:** April 2026
**Confidence:** MEDIUM

## Recommended Architecture

A facial recognition attendance system follows a pipeline architecture with four primary layers: **Capture → Processing → Recognition → Storage**. The system operates as a web application where the frontend captures face images via webcam and sends them to the backend for processing, while the database stores student records and attendance logs.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│   API Backend   │────▶│  Face Engine    │────▶│   Database      │
│  (Webcam/Camera)│     │  (Django/FastAPI)│     │ (face_recognition)│    │  (SQLite/PG)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │                       │
   Face Capture           Request/Response        Encodings DB           Student Records
   Canvas Frame           Session Auth            Comparison             Attendance Logs
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Frontend (Web Client)** | Camera access, frame capture, user interface for login/dashboard/attendance | API Backend |
| **API Backend Server** | HTTP request handling, session management, business logic orchestration | Frontend, Face Engine, Database |
| **Face Recognition Engine** | Face detection, encoding generation, face comparison, matching | Database (reads known encodings), API Backend |
| **Database Layer** | Persistent storage of students, encodings, attendance records, user accounts | Face Engine (read), API Backend (read/write) |
| **Admin Interface** | CRUD operations for students, face image upload, attendance reports | Database, API Backend |
| **File Storage** | Face images stored on disk (MEDIA_ROOT) | Face Engine (reads images), Admin Interface (uploads) |

### Data Flow

**1. Registration Flow (Admin adds student):**
```
Admin Interface → Upload Face Image → API Backend → Store in File Storage 
→ Update Database (Student record + image path)
```

**2. Attendance Session Initialization:**
```
API Backend Request → Load Students from Database → Read Face Images from Storage 
→ Generate 128-dim Encodings → Cache in Memory (known_encodings[])
```

**3. Real-time Recognition Flow:**
```
Frontend (Webcam) → Capture Frame → Convert to Base64 → POST to /detect/ 
→ API Backend → Decode Image → face_recognition.face_locations() 
→ face_recognition.face_encodings() → compare_faces() against cached encodings 
→ Match found → Mark Attendance in Database → Return Result to Frontend
```

**4. Reporting Flow:**
```
Dashboard Request → API Backend → Query Attendance Records → Aggregate Statistics 
→ Return to Frontend Display
```

## Patterns to Follow

### Pattern 1: Encoding Caching

**What:** Pre-compute face encodings at session start and cache in memory rather than computing on every frame.

**When:** During active attendance taking when multiple faces need to be matched quickly.

**Example:**
```python
# Load and encode all registered faces once per session
known_encodings = []
known_ids = []
for student in students:
    image = face_recognition.load_image_file(student.face_image.path)
    encodings = face_recognition.face_encodings(image)
    if encodings:
        known_encodings.append(encodings[0])
        known_ids.append(student.id)

# Later: Compare against cached encodings
matches = face_recognition.compare_faces(known_encodings, encoding_to_check)
```

**Why:** Face encoding is computationally expensive (200-500ms per image). Caching reduces latency from seconds to milliseconds per recognition.

### Pattern 2: Stateless API with Session Auth

**What:** RESTful endpoints for all operations; session-based authentication for web clients.

**When:** Standard web application with Django/FastAPI backend.

**Why:** Clean separation between frontend and backend enables future mobile app integration without architectural changes.

### Pattern 3: Database-First Design

**What:** Define data models before implementing business logic. Use ORM for all database interactions.

**When:** Any Django-based implementation.

**Why:** The relational structure (ClassRoom → Subject → Student → Attendance) is fundamental to the domain. Changing models mid-development causes significant refactoring.

### Pattern 4: Local Processing (No External APIs)

**What:** All face recognition runs locally on the server using libraries like dlib/face_recognition or OpenCV.

**When:** Privacy-sensitive educational institutions, low-latency requirements, no internet dependency.

**Why:** Student face data is sensitive. Local processing ensures data never leaves the institution's infrastructure. Also eliminates API costs and downtime risk.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Real-time Video Streaming to Server

**What:** Streaming video frames to backend for continuous processing.

**Why bad:** Massive bandwidth consumption, server becomes bottleneck, latency issues.
**Instead:** Capture frames client-side, send individual frames as base64 or blob for processing.

### Anti-Pattern 2: Storing Raw Face Images for Matching

**What:** Comparing faces by re-encoding images on every request.

**Why bad:** Encoding 128-dimensional vectors takes 200-500ms per image. With 500 students, each recognition takes minutes.
**Instead:** Pre-compute encodings once, store as numpy arrays or serialized bytes in database. Compare against stored encodings.

### Anti-Pattern 3: Embedding Face Logic in Views

**What:** Putting face recognition code directly in Django views or API endpoints.

**Why bad:** Views become unwieldy, testing becomes difficult, code is not reusable.
**Instead:** Create dedicated `ai/face_ai.py` module with clear functions: `encode_face()`, `compare_faces()`, `register_face()`.

### Anti-Pattern 4: No Liveness Detection

**What:** Accepting any image as valid input without verifying the person is physically present.

**Why bad:** Vulnerable to photo spoofing attacks (someone holding up a printed photo of a registered student).
**Instead:** Implement liveness detection (blink detection, random prompt challenges) before accepting face for recognition.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Encoding Cache** | Fits in RAM easily (~12.8KB per encoding) | Requires optimization, consider Redis | Distributed encoding cache, sharding |
| **Database** | SQLite adequate | PostgreSQL required | PostgreSQL with read replicas |
| **Face Recognition Latency** | <500ms (all in memory) | ~2-5 seconds (batch processing) | Async processing queue (Celery) |
| **Concurrent Sessions** | Single process handles | Multiple workers (Gunicorn/uWSGI) | Load balancer + multiple app instances |
| **Storage (Images)** | <1GB | ~10-50GB | CDN + object storage (S3) |

## Build Order Recommendations

Based on component dependencies:

**Phase 1: Data Layer (Foundation)**
- Database schema (User, Student, ClassRoom, Subject, Attendance)
- File storage setup (MEDIA_ROOT)
- Django admin interface for data management
- *Why first:* All other components depend on stored data

**Phase 2: Face Registration (Admin Workflow)**
- Upload face images via admin
- Encoding generation and storage
- Student registration workflow
- *Why second:* Must have registered faces before attendance can work

**Phase 3: Attendance Taking (Core Feature)**
- Frontend webcam integration
- Frame capture and API submission
- Face matching logic
- Attendance record creation
- *Why third:* This is the primary value proposition

**Phase 4: Dashboard & Reporting (User Value)**
- Attendance statistics display
- Export functionality
- Real-time metrics
- *Why fourth:* Requires attendance data to exist first

**Phase 5: Security Hardening (Production)**
- Liveness detection
- Rate limiting on recognition endpoints
- Audit logging
- *Why last:* Not required for MVP but essential for deployment

## Sources

- Minhaj Ahmad, "I Built an AI-Powered Attendance System with Django and Face Recognition" (Feb 2026) — [Medium](https://medium.com/@minhajahmad0100/i-built-an-ai-powered-attendance-system-with-django-and-face-recognition-heres-how-it-works-727b4550f453)
- ITSourceCode, "Component Diagram for Face Recognition System" (2022) — [itsourcecode.com](https://itsourcecode.com/uml/component-diagram-for-face-recognition-system/)
- Research papers on facial recognition attendance architectures (2024-2025) — Multiple academic sources on system design patterns

## Notes

- Architecture assumes Python-based backend (Django or FastAPI) as this is the most common implementation pattern for educational institution attendance systems
- Face recognition library choice: `face_recognition` (dlib-based) is most accessible; alternatives include OpenCV + custom models or cloud APIs (AWS Rekognition, Azure Face)
- Mobile app integration not covered in base architecture but can be added via REST API layer in Phase 4+