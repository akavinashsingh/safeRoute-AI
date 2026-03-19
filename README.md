# 🛡️ SafeRoute - AI-Powered Safety Navigation

> **Hackathon Project**: Empowering safer journeys through AI-driven route analysis and real-time community alerts.

## 🚀 Live Demo

**Try SafeRoute now - No installation required!**

| 🌐 **User App** | 👨‍💼 **Admin Dashboard** |
|:---:|:---:|
| [![Launch App](https://img.shields.io/badge/🚀_Launch_SafeRoute-4CAF50?style=for-the-badge&logo=googlemaps&logoColor=white)](https://saferoute-frontend.onrender.com/) | [![Admin Panel](https://img.shields.io/badge/👨‍💼_Admin_Panel-FF5722?style=for-the-badge&logo=dashboard&logoColor=white)](https://saferoute-frontend.onrender.com/admin) |
| Main navigation interface | Monitor SOS alerts & community reports |

**🔗 Direct Links:**
- **User Interface**: https://saferoute-frontend.onrender.com/
- **Admin Dashboard**: https://saferoute-frontend.onrender.com/admin

---

SafeRoute is an intelligent navigation system that prioritizes user safety by analyzing crime data, emergency services availability, and community reports to recommend the safest routes. Built during a hackathon with a focus on women's safety and community-driven protection.

## 🌟 Features

### 🤖 AI-Powered Safety Analysis
- **Multi-AI Provider Support**: Groq AI (llama-3.3-70b-versatile) for comprehensive analysis
- **Smart Route Scoring**: AI evaluates routes based on crime incidents, lighting, and emergency services
- **Real-time Risk Assessment**: Dynamic safety scores using multiple data sources
- **Emergency Service Integration**: Google Places API integration for real hospital/police/petrol/hotel locations
- **Evenly Distributed POI Markers**: Hospitals, police stations, petrol pumps, and hotels are spatially distributed along each route using position-band sampling — not clustered at start/end

### 🧠 AI Route Intelligence (New)
- **AI Safety Explainer**: One-click Groq AI analysis of any route explaining why it is safe or risky in plain language (3–4 sentences)
- **AI Route Narrator**: Text-to-speech narration of your selected route with turn-by-turn safety briefing; uses Groq for a personalized briefing, falls back to browser Speech Synthesis
- **Predictive Safety Score**: Bar chart showing safety forecasts for 7AM / 2PM / 8PM / 11PM with a "NOW" badge on the current time slot — powered by time-of-day + day-of-week scoring with optional Groq AI insight

### 🔥 Danger Heatmap (New)
- **Crime Heatmap Overlay**: Toggle a live danger heatmap built from community reports and SOS alerts directly on the map
- **Color-Coded Intensity**: Yellow → Orange → Red → Deep Red gradient representing danger density
- **Auto-Refresh**: Heatmap updates automatically when new community reports are submitted

### 🚨 Emergency Response System
- **SOS Alert Broadcasting**: Instant emergency alerts to admin dashboard via Socket.IO
- **Countdown SOS with Cancel**: 5-second confirmation window prevents accidental triggers
- **AI Emergency Assistant**: Groq AI provides nearby emergency services and personalized safety tips on SOS trigger
- **Live Location Sharing**: Real-time GPS tracking with current address shown on map

### 📍 Location Awareness (New)
- **Current Location Marker**: Animated blue drop-pin shows your detected location on the map with address in an info popup
- **Locate Me Button**: Instantly fills the source field with your current location for route planning

### 👥 Community Safety Network
- **Crowd-sourced Reports**: Users can report accidents, suspicious activity, harassment, theft, traffic, and road damage
- **Real-time Incident Mapping**: Live visualization of community-reported safety concerns
- **Heatmap Integration**: Community reports directly feed the danger heatmap

### 📱 User Experience
- **Interactive Safety Dashboard**: Visual route comparison with safety scores, distance, duration, and AI features per route
- **Safety-Color-Coded Routes**: Green / Amber / Red polylines on map based on safety score
- **Night Mode Support**: Full dark mode for comfortable night navigation
- **Mobile-Responsive Design**: Hamburger navigation and sidebar overlay for all screen sizes
- **Personalized Experience**: Name capture on first visit used in SOS alerts and AI narration

## 🏗️ Architecture

```
SafeRoute/
├── backend/                 # Flask API Server
│   ├── app.py              # Main application with AI integration
│   └── saferoute.db        # SQLite database
├── frontend/               # Static Web Application
│   ├── index.html          # Landing page (default)
│   ├── app.html            # Main user interface
│   ├── admin.html          # Admin dashboard
│   ├── main.js             # Core JavaScript functionality
│   ├── style.css           # Modern UI styling
│   └── config.js           # Environment configuration
├── requirements.txt        # Python dependencies
├── render.yaml            # Deployment configuration
└── Procfile              # Heroku deployment
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Google Maps API Key
- AI API Keys (optional, for enhanced AI features):
  - Groq AI API Key
  - Google Gemini API Key

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/saferoute.git
cd saferoute
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run Application
```bash
# Start backend server
python backend/app.py

# Open frontend (in another terminal)
# Serve frontend files on localhost:8000 or open index.html (landing) or app.html (main app) directly
```

### 5. Access Application
- **Main App**: `http://localhost:5000` or open `frontend/app.html`
- **Admin Dashboard**: `frontend/admin.html`

## 🔧 API Endpoints

### Route Analysis
```http
POST /get-routes
Content-Type: application/json

{
  "source": "Starting Location",
  "destination": "Destination Location",
  "frontend_routes": [{ "polyline": "<encoded_polyline>" }]
}
```

### AI Safety Explainer
```http
POST /explain-route
Content-Type: application/json

{
  "route": { "safety_score": 82, "distance": "12.3 km", ... }
}
```

### AI Route Narrator
```http
POST /narrate-route
Content-Type: application/json

{
  "route": { ... },
  "route_num": 1,
  "user_name": "Priya"
}
```

### Predictive Safety Score
```http
POST /predict-safety
Content-Type: application/json

{
  "route": { "safety_score": 82, ... }
}
```
Returns scores for 7AM / 2PM / 8PM / 11PM slots with optional Groq AI one-line insight.

### Emergency Alerts
```http
POST /send-alert
Content-Type: application/json

{
  "lat": 17.3850,
  "lng": 78.4867,
  "user_name": "Priya"
}
```

### Community Reports
```http
POST /post-feedback
Content-Type: application/json

{
  "lat": 17.3850,
  "lng": 78.4867,
  "type": "harassment",
  "description": "Incident description"
}
```

## 🤖 AI Integration

### Groq AI — Core Intelligence
- **Model**: `llama-3.3-70b-versatile`
- **Use Cases**:
  - Route safety explanation (3–4 sentence human-readable analysis)
  - Voice narration script generation (time-of-day aware)
  - Predictive safety one-line insight per route
  - Emergency SOS AI assistant (nearest hospitals, police, actionable advice)
- **Speed**: ~500ms average response
- **Fallback**: All AI features have client-side fallbacks — app is fully functional without Groq

### Fallback System
1. **Primary**: Groq AI (`llama-3.3-70b-versatile`)
2. **Secondary**: Google Places API (real location data for POI markers)
3. **Tertiary**: Client-side calculation (safety scores, narration text, forecast bars)
4. **Final**: Generic emergency suggestions with helpline numbers

## 🎯 Safety Scoring Algorithm

SafeRoute calculates safety scores using multiple factors:

1. **Crime Incident Analysis** (40%)
   - Historical crime data simulation
   - Incident severity weighting
   - Proximity to route calculation

2. **Emergency Services Availability** (30%)
   - Hospital proximity and count
   - Police station accessibility
   - Response time estimation

3. **Infrastructure Quality** (20%)
   - Street lighting assessment
   - Road condition evaluation
   - Public transport availability

4. **Community Reports** (10%)
   - Real-time incident reports
   - User-generated safety alerts
   - Crowd-sourced hazard mapping

### 🔮 Predictive Safety Scoring (New)

Time-of-day and day-of-week adjustments applied to base score:

| Time Slot | Modifier |
|-----------|----------|
| 7 AM | +8 (morning commute, safer) |
| 2 PM | +5 (daytime, peak safety) |
| 8 PM | −10 (evening, higher risk) |
| 11 PM | −20 (night, highest risk) |

Weekend penalty: −3 points. Groq AI adds a one-sentence contextual insight per forecast.

## 🌐 Deployment

### Render.com (Recommended)
```yaml
# render.yaml configuration included
# Automatic deployment from GitHub
```

### Manual Deployment
```bash
# Set environment variables
export PORT=5000
export GROQ_API_KEY=your_key
export GOOGLE_MAPS_API_KEY=your_key

# Run production server
python backend/app.py
```

## 🛠️ Technology Stack

### Backend
- **Flask**: Web framework with CORS support
- **Flask-SocketIO**: Real-time WebSocket communication
- **SQLite**: Lightweight database for alerts and feedback
- **Groq AI SDK**: `llama-3.3-70b-versatile` for route explanation, narration, and prediction
- **Google Directions API**: Multi-route planning with polyline encoding
- **Google Places API (New)**: Real hospital, police, petrol pump, and hotel locations along routes

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Google Maps JavaScript API**: Interactive mapping with HeatmapLayer, DirectionsRenderer, custom SVG markers
- **Web Speech Synthesis API**: Browser-native TTS for route narration
- **Socket.IO Client**: Real-time SOS and community report updates
- **Modern CSS**: Responsive design with dark mode, animated route cards, forecast bars

### Deployment
- **Render.com**: Primary hosting platform
- **Heroku**: Alternative deployment option
- **Static Hosting**: Frontend can be served separately

## 🔒 Security Features

- **API Key Protection**: Secure environment variable management
- **CORS Configuration**: Proper cross-origin request handling
- **Input Validation**: Sanitized user inputs and SQL injection prevention
- **Rate Limiting**: Built-in protection against abuse
- **Emergency Verification**: Confirmation tokens for sensitive operations

## 📊 Database Schema

### SOS Alerts
```sql
CREATE TABLE sos_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    status TEXT DEFAULT 'PENDING'
);
```

### Community Feedback
```sql
CREATE TABLE route_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lng REAL,
    type TEXT,
    description TEXT,
    timestamp DATETIME NOT NULL,
    route_polyline TEXT
);
```

## 🎨 UI/UX Features

- **Animated Logo**: Dynamic slogan rotation
- **Safety Color Coding**: Intuitive visual safety indicators
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Eye-friendly night navigation
- **Real-time Updates**: Live incident and alert notifications

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🏆 Hackathon Context

**Built for**:  Hackathon  
**Theme**: Women's Safety & Community Protection  
**Duration**:   
**Team**: Thrivers  

### Hackathon Achievements
- ✅ AI-powered safety analysis with Groq (llama-3.3-70b-versatile)
- ✅ AI Safety Explainer — plain-language route risk analysis
- ✅ AI Route Narrator — voice narration with Groq + Speech Synthesis fallback
- ✅ Predictive Safety Score — time-of-day forecast with bar chart UI
- ✅ Danger Heatmap Overlay — community-fed live crime heatmap
- ✅ Real-time SOS emergency response system
- ✅ Evenly distributed POI markers (hospitals, police, petrol, hotels) along routes
- ✅ Safety-color-coded route polylines (Green / Amber / Red)
- ✅ Live user location marker with animated drop-pin
- ✅ Community-driven safety network with real-time Socket.IO updates
- ✅ Mobile-responsive design with hamburger navigation
- ✅ Production-ready deployment on Render.com

## 🔮 Future Enhancements

- [ ] Fake incoming call feature for discreet SOS escape
- [ ] Shake-to-SOS via device motion sensor
- [ ] Trusted contacts auto-alert via WhatsApp/SMS deep links
- [ ] Journey Guard Mode — auto-SOS if user doesn't check in by ETA
- [ ] Live SOS tracking shareable link for trusted contacts
- [ ] Machine learning model for predictive safety analysis using real crime datasets
- [ ] Integration with local law enforcement APIs
- [ ] Wearable device compatibility (smartwatch alerts)
- [ ] Multi-language support for global accessibility
- [ ] Advanced analytics dashboard for city planners
- [ ] Integration with ride-sharing platforms

## 📞 Emergency Numbers

  
**India**: 100 (Police), 102 (Ambulance), 1091 (Women Helpline)  
  

## 🙏 Acknowledgments

- **Groq AI** for providing fast, unlimited AI inference
- **Google Gemini** for advanced AI reasoning capabilities
- **Google Maps Platform** for comprehensive location services
- **Open Source Community** for inspiration and tools
- **Hackathon Organizers** for the opportunity to build for social impact

---

**⚠️ Disclaimer**: This is a hackathon prototype. While functional, it should not be used as the sole source for emergency situations. Always contact local emergency services directly in case of real emergencies.

**🛡️ SafeRoute - Because every journey should be a safe journey.**
