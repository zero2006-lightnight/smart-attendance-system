# Smart Attendance System

A React interface and FastAPI prototype for account management, face enrollment, and attendance workflows.

## Overview

The backend uses SQLite and exposes authentication, user-management, face-enrollment, and attendance endpoints. Face detection uses OpenCV Haar cascades; matching uses a simplified image-derived descriptor and should be treated as a prototype, not as a validated biometric system.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite, OpenCV
- **Frontend:** React, TypeScript, Vite

## Getting Started

Start the backend from its directory:

```bash
cd backend
python -m venv .venv
```

Activate the environment, install dependencies, and run the API:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

In another terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend currently targets a hosted API URL. To use the local backend, update `API_BASE_URL` in `frontend/src/services/api.ts` to `http://localhost:8000/api`.

## Security Note

The backend currently has a hard-coded JWT signing default. Replace it with a secret loaded from environment configuration before deployment, and rotate any value used by a deployed instance.

## Author

Pasupuleti Neeraj

[GitHub](https://github.com/zero2006-lightnight) | [LinkedIn](https://www.linkedin.com/in/pasupuleti-neeraj-b0698a3a7)