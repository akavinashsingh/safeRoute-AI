# 🛡️ SafeRoute - AI-Powered Safety Navigation

> **Hackathon Project**: Empowering safer journeys through AI-driven route analysis and real-time community alerts.

SafeRoute is an intelligent navigation system that prioritizes user safety by analyzing crime data, emergency services availability, and community reports to recommend the safest routes. Built during a hackathon with a focus on women's safety and community-driven protection.

## 🌟 Features

### 🤖 AI-Powered Safety Analysis
- **Multi-AI Provider Support**: Groq AI + Google Gemini for comprehensive analysis
- **Smart Route Scoring**: AI evaluates routes based on crime incidents, lighting, and emergency services
- **Real-time Risk Assessment**: Dynamic safety scores using multiple data sources
- **Emergency Service Integration**: Google Places API integration for real hospital/police locations

### 🚨 Emergency Response System
- **SOS Alert Broadcasting**: Instant emergency alerts to admin dashboard
- **Multi-AI Emergency Assistant**: Groq + Gemini AI provide nearby emergency services and safety tips
- **Live Location Sharing**: Real-time GPS tracking for emergency situations

### 👥 Community Safety Network
- **Crowd-sourced Reports**: Users can report incidents, suspicious activities, and hazards
- **Real-time Incident Mapping**: Live visualization of community-reported safety concerns
- **Collaborative Safety**: Community-driven approach to route safety

### 📱 User Experience
- **Interactive Safety Dashboard**: Visual route comparison with safety metrics
- **Night Mode Support**: Enhanced visibility for different lighting conditions
- **Mobile-Responsive Design**: Optimized for all devices and screen sizes

## 🏗️ Architecture

```
SafeRoute/
├── backend/                 # Flask API Server
│   ├── app.py              # Main application with AI integration
│   └── saferoute.db        # SQLite database
├── frontend/               # Static Web Application
│   ├── index.html          # Main user interface
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
# Serve frontend files on localhost:8000 or open index.html directly
```

### 5. Access Application
- **Main App**: `http://localhost:5000` or open `frontend/index.html`
- **Admin Dashboard**: `frontend/admin.html`

## 🔧 API Endpoints

### Route Analysis
```http
POST /get-routes
Content-Type: application/json

{
  "source": "Starting Location",
  "destination": "Destination Location"
}
```

### Emergency Alerts
```http
POST /send-alert
Content-Type: application/json

{
  "lat": 17.3850,
  "lng": 78.4867
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

### Multi-AI Provider Support
SafeRoute supports multiple AI providers for enhanced reliability and performance:

### Groq AI Assistant
- **Model**: Llama-3.1-8b-instant
- **Strengths**: Ultra-fast inference, unlimited usage
- **Purpose**: Emergency service recommendations and safety tips
- **Speed**: ~100ms response time

### Google Gemini AI
- **Model**: Gemini-1.5-flash / Gemini-1.5-pro
- **Strengths**: Advanced reasoning, multimodal capabilities
- **Purpose**: Complex safety analysis and contextual recommendations
- **Features**: Image analysis for route conditions

### Fallback System
1. **Primary**: Groq AI (fastest response)
2. **Secondary**: Google Gemini (advanced analysis)
3. **Tertiary**: Google Places API (real location data)
4. **Fallback**: Generic emergency suggestions

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
- **Multi-AI Integration**: Groq AI + Google Gemini for intelligent analysis
- **Google Places API**: Real-world location data

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Google Maps JavaScript API**: Interactive mapping
- **Socket.IO Client**: Real-time updates
- **Modern CSS**: Responsive design with dark mode

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

**Built for**: GDGoC x MREM - TechSprint Hackathon  
**Theme**: Women's Safety & Community Protection  
**Duration**:   
**Team**: Thrivers  

### Hackathon Achievements
- ✅ Multi-AI powered safety analysis (Groq + Gemini)
- ✅ Real-time emergency response system
- ✅ Community-driven safety network
- ✅ Mobile-responsive design
- ✅ Production-ready deployment

## 🔮 Future Enhancements

- [ ] Machine learning model for predictive safety analysis
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