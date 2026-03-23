# SafeRoute-AI — Project Summary

> An AI-powered intelligent navigation system that prioritizes user safety by analyzing crime data, emergency services, and community reports to recommend the safest routes.

---

## Overview

SafeRoute is a hackathon project focused on women's safety and community-driven protection. It generates safety-scored route alternatives using real-time data, AI reasoning, and crowd-sourced incident reports — all visualized on an interactive map.

**Live Deployment:**
- User App: `https://saferoute-frontend.onrender.com/`
- Admin Dashboard: `https://saferoute-frontend.onrender.com/admin`

---

## Project Structure

```
safeRoute-AI/
├── backend/
│   ├── app.py              # Flask API — core backend logic (~2,100 lines)
│   └── saferoute.db        # SQLite database (SOS alerts + community reports)
├── frontend/
│   ├── index.html          # Landing page
│   ├── app.html            # Main user interface
│   ├── admin.html          # Admin dashboard
│   ├── main.js             # Core JavaScript logic (~1,930 lines)
│   ├── style.css           # Styling with dark mode support (~680 lines)
│   └── config.js           # Environment-aware backend URL config
├── .env.example            # Environment variables template
├── requirements.txt        # Python dependencies
├── render.yaml             # Render.com multi-service deployment config
├── Procfile                # Heroku deployment config
└── README.md               # Project documentation
```

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.8+ / Flask 2.3.3 | REST API server |
| Flask-SocketIO + Eventlet | Real-time WebSocket communication |
| SQLite3 | Persistent storage for alerts and reports |
| Groq AI (llama-3.3-70b-versatile) | AI explanations, narration, forecasting |
| Google Directions API v2 | Route planning and polyline encoding |
| Google Places API | Finding real hospitals, police stations, POIs |

### Frontend
| Technology | Purpose |
|---|---|
| Vanilla JavaScript | No-framework approach, lightweight |
| Google Maps JavaScript API v3 | Interactive map, HeatmapLayer, DirectionsRenderer |
| Socket.IO Client 4.7.5 | Real-time SOS and report broadcasting |
| Web Speech Synthesis API | Browser-native text-to-speech narration |
| FontAwesome 6.4.0 | UI icons |

### Deployment
- **Render.com** — two services: Python API + Static frontend (primary)
- **Heroku** — alternative via Procfile

---

## Core Features

### 1. AI-Powered Route Safety Analysis
- Analyzes 3 alternative routes using crime data, lighting, and emergency services proximity
- Each route receives a **safety score (0–100)** with color coding:
  - **Green (≥75):** SAFE
  - **Amber (60–74):** MODERATE
  - **Red (<60):** UNSAFE
- Safety scoring breakdown:
  - Crime Incident Analysis — 40%
  - Emergency Services Proximity — 30%
  - Infrastructure Quality (lighting, road) — 20%
  - Community Reports — 10%
  - Time-of-day modifiers (e.g., –20 at 11PM, +8 at 7AM)

### 2. AI Safety Explainer
- Calls Groq AI to generate a 3–4 sentence plain-language explanation of why a route is safe or risky
- Specific to the selected route's crime data and POI context

### 3. AI Route Narrator (Text-to-Speech)
- Groq AI generates a spoken safety briefing with turn-by-turn context
- Delivered via Web Speech Synthesis API
- Falls back to client-side text generation if AI is unavailable

### 4. Predictive Safety Forecast
- Time-slot safety scores for: **7AM / 2PM / 8PM / 11PM**
- Visual bar charts with "NOW" badge on the current time slot
- Optional Groq AI narrative insight about time-based risk patterns

### 5. Danger Heatmap
- Toggle-able crime heatmap overlay using Google Maps `HeatmapLayer`
- Intensity color scale: Yellow → Orange → Red → Deep Red
- Populated from community reports and SOS alert locations
- Auto-refreshes when new reports are submitted

### 6. Emergency SOS System
- Large SOS button with a **5-second countdown** (cancellable) to prevent accidental triggers
- On confirmation:
  - Saves alert to database with GPS coordinates and user name
  - Broadcasts to admin dashboard in real-time via Socket.IO
  - Calls Google Places API + Groq AI to suggest nearby hospitals, police stations, and hotels
  - Falls back to generic emergency numbers if APIs fail

### 7. Community Safety Reports
- Users can report: Accident, Suspicious Activity, Harassment, Theft, Traffic, Road Damage
- Reports are plotted on the map with color-coded markers
- Feed directly into the danger heatmap

### 8. Live Location Awareness
- "Locate Me" button auto-fills source with current GPS coordinates
- Animated blue drop-pin marker with address popup
- Address reverse-geocoded from coordinates

---

## Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/get-routes` | Route analysis with safety scores, crime incidents, POIs |
| POST | `/explain-route` | Groq AI safety explanation for a specific route |
| POST | `/narrate-route` | Groq AI voice narration script for a route |
| POST | `/predict-safety` | Time-slot safety forecasts (7AM/2PM/8PM/11PM) |
| POST | `/send-alert` | SOS broadcast — saves to DB, emits to admin |
| GET | `/get-all-alerts` | Retrieve SOS alerts (filterable by status) |
| PUT | `/update-alert/<id>` | Mark an SOS alert as resolved |
| POST | `/post-feedback` | Submit a community incident report |
| GET | `/get-feedback` | Retrieve all community reports |
| POST | `/clear-all-data` | Admin: wipe all alerts and feedback |
| GET | `/get-maps-config` | Secure Google Maps API key delivery to frontend |

---

## Database Schema

### `sos_alerts`
```sql
CREATE TABLE sos_alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    timestamp   DATETIME NOT NULL,
    status      TEXT DEFAULT 'PENDING',
    user_name   TEXT DEFAULT 'Anonymous'
)
```

### `route_feedback`
```sql
CREATE TABLE route_feedback (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    lat             REAL,
    lng             REAL,
    type            TEXT,   -- accident, danger, harassment, theft, traffic, pothole
    description     TEXT,
    timestamp       DATETIME NOT NULL,
    route_polyline  TEXT,
    user_name       TEXT DEFAULT 'Anonymous'
)
```

---

## AI Integration & Fallback Chain

The system uses a layered fallback chain to ensure reliability:

```
1. Groq AI (llama-3.3-70b-versatile)     ← Primary: fast, intelligent
2. Google Places API                      ← Real location data
3. Client-side calculation                ← Offline safety score estimation
4. Hardcoded helpline numbers             ← Final fallback (always available)
```

For route narration specifically:
```
1. Groq AI text generation + Web Speech Synthesis
2. Client-side text generation + Web Speech Synthesis
```

---

## Admin Dashboard

- Live SOS alert feed (Pending + Resolved tabs)
- Community reports tab
- Statistics: pending SOS count, total reports, resolved issues
- "Mark as Resolved" action per alert
- Map link button to view alert location
- Data wipe functionality
- All updates received via Socket.IO in real-time

---

## Security

- API keys stored in `.env`, never hardcoded or committed
- Google Maps API key served securely from backend (not exposed in frontend source)
- SQL injection prevention via parameterized queries
- CORS configured for allowed origins only
- SOS confirmation countdown prevents accidental emergency broadcasts
- User names stored locally in `localStorage`, shared only during SOS

---

## Crime Data Model

8 simulated crime types with severity weighting:

| Type | Severity | Peak Hours |
|---|---|---|
| Assault | High | Late night |
| Robbery | High | Evening, night |
| Harassment | Medium | Evening |
| Theft | Medium | Daytime |
| Vandalism | Low | Night |
| Burglary | High | Night |
| Accident | Medium | Rush hours |
| Fraud | Low | Daytime |

Incidents are synthetically scattered within 50–300m of route points for demonstration.

---

## UI/UX Highlights

- **Welcome modal** — captures user name on first visit (used in emergencies)
- **Dark mode** — full dark theme toggle
- **Mobile responsive** — hamburger menu, sidebar overlay, touch-friendly
- **Route comparison cards** — side-by-side safety stats for all 3 routes
- **Emergency helplines panel** — Police (100), Ambulance (102), SOS (112), Women Helpline (1091)
- **Safety tips modal** — accessible in-app guidance

---

## Recent Development Highlights

| Commit | Feature Added |
|---|---|
| `13088ad` | AI safety explainer, route narrator, predictive forecast, heatmap, emergency improvements |
| `e68c243` | Predictive safety forecast (4 time slots) with Groq AI insights |
| `cfa3d77` | AI route narration with browser TTS fallback |
| `55082f6` | Danger heatmap with toggle button and legend |
| `c2f9783` | Safety-based route coloring (Green / Amber / Red) |
| `5375bdb` | User name collection for SOS and community reports |
| `b149db9` | Landing page + renamed main app to app.html |
| `09331dd` | Mobile responsive design + hamburger menu |

---

## Environment Variables

```env
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
PORT=5000
FLASK_ENV=development
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:8000
```

---

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py

# Frontend — serve with any static server
cd frontend
python -m http.server 8000
# Open http://localhost:8000
```

---

*Built for a hackathon with focus on women's safety and community-driven urban navigation.*
