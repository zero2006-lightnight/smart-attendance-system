# Smart Attendance System

## What This Is

An AI-powered attendance tracking system that uses facial recognition to automatically log employee/student attendance in real-time. Built with Python FastAPI backend and React/Tailwind frontend using 2026 Dark Glassmorphism design.

## Core Value

Automatic, real-time attendance tracking via face recognition — eliminating manual sign-ins and proxy attendance.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Real-time face detection using OpenCV
- [ ] 128-d face encoding matching with face_recognition library
- [ ] Anti-spoofing (liveness detection) to prevent photo/video attacks
- [ ] Automated CSV report generation
- [ ] React/Tailwind frontend with Dark Glassmorphism UI
- [ ] RESTful API via FastAPI

### Out of Scope

- [Mobile app] — Web-first approach, mobile later
- [Cloud deployment] — Local deployment only for v1
- [Biometric other than face] — Focus solely on facial recognition

## Context

- **Tech Stack**: Python FastAPI, OpenCV, face_recognition, React, Tailwind CSS
- **Design Style**: 2026 Dark Glassmorphism (12px blur, #050505 bg, Neon-Green #39FF14 accents)
- **Environment**: Existing code present in directory

## Constraints

- **[Security]**: Anti-spoofing required — prevent photo/video spoofing attacks
- **[Accuracy]**: Must handle multiple faces, varying lighting conditions
- **[Performance]**: Real-time processing (< 500ms per recognition)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Face recognition over QR/biometric | Touchless, automated, user-friendly | — Pending |
| FastAPI over Flask | Modern, async, better Swagger docs | — Pending |
| Dark Glassmorphism UI | Modern aesthetic, reduced eye strain | — Pending |

---
*Last updated: 2026-04-06 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
