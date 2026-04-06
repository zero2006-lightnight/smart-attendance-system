---
phase: 3
plan: 01
subsystem: backend-api
tags: [user-management, face-enrollment, admin, crud]
dependency_graph:
  requires: [02-01]
  provides: [USER-01, USER-02, USER-03, FACE-04]
  affects: [04-01]
tech_stack:
  added: [face_recognition, pickle serialization, admin role-based auth]
  patterns: [Pydantic models for admin endpoints, FormData for file upload]
key_files:
  created:
    - frontend/src/pages/AdminUsers.tsx
    - frontend/src/pages/FaceEnrollment.tsx
  modified:
    - backend/main.py
    - frontend/src/App.tsx
    - frontend/src/pages/Dashboard.tsx
    - frontend/src/services/api.ts
decisions:
  - Admin-only user management endpoints with role verification
  - Face encoding stored as pickle-serialized numpy array in DB
  - Single face validation - reject images with 0 or multiple faces
---

# Phase 3 Plan 01: User Management & Face Enrollment Summary

**Goal:** Admin user management CRUD and face image enrollment for recognition

## One-Liner

Admin user management with CRUD operations and face image upload/encoding pipeline for attendance recognition

## Completed Tasks

| Task | Name | Status | Verification |
|------|------|--------|--------------|
| 1 | Backend - User Management API Endpoints | DONE | Admin endpoints added: POST/GET/DELETE /api/admin/users |
| 2 | Backend - Face Enrollment Endpoint | DONE | Face encoding with face_recognition, pickle storage |
| 3 | Frontend - Admin User Management Page | DONE | User list, add form, delete functionality |
| 4 | Frontend - Face Enrollment Component | DONE | Image upload with preview and validation feedback |
| 5 | Integration - Navigation & Routing | DONE | Sidebar navigation, admin-only route protection |

## Requirements Coverage

- **USER-01:** Admin can add new users to the system with name and email
- **USER-02:** Admin can view list of all registered users
- **USER-03:** Admin can remove users from the system
- **FACE-04:** Users can upload face images that get encoded and stored for recognition

## Implementation Details

### Backend Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/users` | POST | Admin | Create new user |
| `/api/admin/users` | GET | Admin | List all users |
| `/api/admin/users/{user_id}` | DELETE | Admin | Delete user |
| `/api/users/face-enroll` | POST | JWT | Upload face image, encode, store |

### Face Enrollment Process

1. Receive uploaded image (multipart/form-data)
2. Convert to RGB numpy array via PIL
3. Call `face_recognition.face_encodings()` to generate 128-d embedding
4. Validate exactly one face detected
5. Serialize encoding with pickle, store in User.face_encoding column
6. Return success with user info

## Deviations from Plan

None - plan executed as written.

## Stubs / Missing Functionality

- Live camera feed placeholder in Dashboard (will be implemented in Phase 4)
- Attendance stats hardcoded to 0 (will be wired to real data in Phase 5)
- No attendance endpoints yet (Phase 5)

## Commit Hash

`c883785` - feat(03-01): implement user management and face enrollment