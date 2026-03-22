# CampusVoice

## AI-Powered Campus Complaint Management System

A web application for students and faculty to raise and track campus complaints with AI verification.

## Features

- OTP based authentication
- AI image verification (YOLOv8 + CLIP)
- Campus geofencing
- Gamification system
- Real time complaint tracking
- Analytics dashboard
- Push notifications
- 7 day resolution deadline tracking

## Tech Stack

- Frontend: React, TypeScript, TailwindCSS
- Backend: Node.js, Express, TypeScript
- AI Backend: Python, FastAPI, YOLOv8, CLIP
- Database: Firebase Firestore
- Image Storage: Cloudinary
- AI Verification: Anthropic Claude API

## Setup

### Prerequisites

- Node.js v18+
- Python 3.10+
- Firebase project
- Cloudinary account

### Run the app

Terminal 1 - Backend:
```
cd backend && npm run dev
```

Terminal 2 - Frontend:
```
npm run dev
```

Terminal 3 - Python AI:
```
cd python-backend && python main.py
```

Open http://localhost:8080
