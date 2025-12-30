
/* --- Global Variables --- */
let map, directionsService;
let rendererArray = [],
  currentRoutes = [],
  lastDirectionsResult = null;
let userMarker = null,
  crimeMarkers = [],
  feedbackMarkers = [];
let allFeedbacks = [];
const socket = io("http://localhost:5000");

/* --- Config --- */
const routeColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];
const crimeConfig = {
  theft: { color: "#f59e0b" },
  robbery: { color: "#ef4444" },
  assault: { color: "#ef4444" },
  accident: { color: "#FF5722" },
  harassment: { color: "#E91E63" },
  default: { color: "#64748b" },
};

const feedbackConfig = {
    'accident': { icon: '🚨', color: '#F44336', label: 'Accident' },
    'construction': { icon: '🚧', color: '#FFC107', label: 'Construction' },
    'pothole': { icon: '🕳️', color: '#FF9800', label: 'Pothole' },
    'flood': { icon: '🌊', color: '#2196F3', label: 'Flood' },
    'traffic': { icon: '🚦', color: '#9C27B0', label: 'Traffic' },
    'danger': { icon: '⚠️', color: '#FF0000', label: 'Danger' },
    'other': { icon: '❓', color: '#757575', label: 'Other' }
};

/* --- 1. Map Initialization --- */
window.initMap = function () {
  console.log("🗺️ Map Starting...");
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 17.385, lng: 78.4867 },
    zoom: 12,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    zoomControl: false,
    styles: [],
  });
  directionsService = new google.maps.DirectionsService();
  initializeSocketIO();
  fetchFeedbackForRoute();
};

function initializeSocketIO() {
  socket.on("connect", () => console.log("🔌 Connected to Server"));
  socket.on("new_feedback", (data) => {
    allFeedbacks.unshift(data);
    updateFeedbackListUI();
    addFeedbackMarker(data);
  });
  socket.on("data_cleared", () => {
    allFeedbacks = [];
    clearFeedback();
    clearCrimeVisualization();
    updateFeedbackListUI();
    alert("System data cleared remotely.");
  });
}

/* --- 2. Route Logic --- */
window.findRoutes = function () {
  const source = document.getElementById("source").value;
  const destination = document.getElementById("destination").value;

  if (!source || !destination) return alert("Please enter locations");

  startLoadingAnimation();

  directionsService.route(
    {
      origin: source,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
    },
    (result, status) => {
      if (status === "OK") {
        lastDirectionsResult = result;
        sendToBackendForAnalysis(source, destination);
      } else {
        stopLoadingAnimation();
        alert("Routes not found. Please try different locations.");
      }
    }
  );
};

function sendToBackendForAnalysis(source, destination) {
  fetch("http://localhost:5000/get-routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  })
    .then((res) => res.json())
    .then((data) => {
      stopLoadingAnimation();

      if (data.error) {
        console.error("Backend Error:", data.error);
        alert("Server Error: " + data.error);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        currentRoutes = data;
        displayRouteCards(data);
        selectRoute(0);
      } else {
        alert("No route analysis data returned.");
      }
    })
    .catch((err) => {
      stopLoadingAnimation();
      console.error(err);
      alert(
        "Cannot connect to backend (http://localhost:5000). Ensure 'python app.py' is running."
      );
    });
}

/* --- 3. UI Display (UPDATED) --- */
function displayRouteCards(routes) {
  const container = document.getElementById("routes-list");
  if (!container) return;
  container.innerHTML = "";

  routes.forEach((route, index) => {
    let scoreColor = "#10b981";
    let scoreText = "SAFE"; // Standard safe label
    const score = route.safety_score || 0;

    // Simplified Logic for Labels
    if (score < 70) {
      scoreColor = "#f59e0b";
      scoreText = "MODERATE";
    }
    if (score < 40) {
      scoreColor = "#ef4444";
      scoreText = "UNSAFE";
    }

    const card = document.createElement("div");
    card.className = `route-card`;
    card.onclick = () => selectRoute(index);

    // --- ADDED TEXT LABELS TO BADGES ---
    card.innerHTML = `
            <div class="score-box" style="background: ${scoreColor}">
                <span class="score-val">${score}</span>
                <span class="score-txt">${scoreText}</span>
            </div>
            <div class="route-info">
                <h4>Route ${index + 1}</h4>
                <div class="route-meta">
                    <span><i class="fa-regular fa-clock"></i> ${
                      route.duration
                    }</span>
                    <span><i class="fa-solid fa-ruler"></i> ${
                      route.distance
                    }</span>
                </div>
                <div class="route-badges">
                    <span class="badge"><i class="fa-solid fa-hospital"></i> ${
                      route.hospital_count || 0
                    } Hospitals</span>
                    <span class="badge"><i class="fa-solid fa-user-shield"></i> ${
                      route.police_count || 0
                    } Police Stn</span>
                    <span class="badge"><i class="fa-solid fa-lightbulb"></i> ${
                      route.street_light_score || 0
                    }% Lights</span>
                </div>
            </div>
        `;
    container.appendChild(card);
  });
}

window.selectRoute = function (index) {
  document.querySelectorAll(".route-card").forEach((c, i) => {
    if (i === index) c.classList.add("selected");
    else c.classList.remove("selected");
  });
  renderAllRoutes(index);
  if (currentRoutes[index]) {
    showCrimeIncidents(currentRoutes[index].crime_incidents);
  }
};

function renderAllRoutes(selectedIndex) {
  rendererArray.forEach((r) => r.setMap(null));
  rendererArray = [];

  if (!lastDirectionsResult) return;

  lastDirectionsResult.routes.forEach((route, index) => {
    const isSelected = index === selectedIndex;
    const renderer = new google.maps.DirectionsRenderer({
      map: map,
      directions: lastDirectionsResult,
      routeIndex: index,
      suppressMarkers: isSelected,
      polylineOptions: {
        strokeColor: isSelected
          ? routeColors[index % routeColors.length]
          : "#94a3b8",
        strokeOpacity: isSelected ? 1.0 : 0.4,
        strokeWeight: isSelected ? 6 : 4,
        zIndex: isSelected ? 100 : 1,
      },
    });
    rendererArray.push(renderer);
  });
}

/* --- 4. Helpers --- */
window.getCurrentLocationForInput = function () {
  if (!navigator.geolocation) return alert("Geolocation not supported.");

  const btn = document.querySelector(".locate-me-btn");
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const crd = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ location: crd }, (results, status) => {
        btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
        if (status === "OK" && results[0]) {
          document.getElementById("source").value =
            results[0].formatted_address;
        } else {
          document.getElementById("source").value = `${crd.lat.toFixed(
            5
          )}, ${crd.lng.toFixed(5)}`;
        }
        map.setCenter(crd);
        map.setZoom(16);
      });
    },
    (err) => {
      btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
      alert("Location access denied.");
    },
    { enableHighAccuracy: true }
  );
};

window.sendEmergencyAlert = function() {
    if(!confirm("⚠️ Are you sure you want to send an SOS Alert?\n\nThis will broadcast your exact location to emergency responders and get AI-powered emergency assistance suggestions.")) {
        return;
    }
    
    // Show loading state
    const modal = document.getElementById('sos-modal');
    const originalContent = modal.querySelector('.modal-body').innerHTML;
    modal.querySelector('.modal-body').innerHTML = `
        <div style="text-align:center; padding:40px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:3rem; color:var(--danger);"></i>
            <h3 style="margin-top:20px;">Getting Your Location...</h3>
            <p style="color:#666;">AI is preparing emergency assistance...</p>
        </div>
    `;
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        alert("❌ Geolocation is not supported by your browser.\n\nPlease use a modern browser or enable location services.");
        modal.querySelector('.modal-body').innerHTML = originalContent;
        return;
    }
    
    console.log("🚨 SOS: Requesting location...");
    
    // Get current position with high accuracy
    navigator.geolocation.getCurrentPosition(
        // Success callback
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            console.log("✅ Location obtained:", {lat, lng, accuracy});
            console.log(`📍 Your coordinates: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
            
            // Validate coordinates
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                throw new Error('Invalid coordinates received');
            }
            
            // Update loading message
            modal.querySelector('.modal-body').innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <i class="fa-solid fa-robot fa-spin" style="font-size:3rem; color:var(--primary);"></i>
                    <h3 style="margin-top:20px;">AI Analyzing Emergency Services...</h3>
                    <p style="color:#666;">Finding nearby hospitals, police, and safe places...</p>
                </div>
            `;
            
            try {
                console.log('📡 Sending SOS to backend...');
                console.log('📍 Coordinates:', { lat, lng, accuracy });
                
                // Send to backend
                const response = await fetch('http://localhost:5000/send-alert', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        lat: lat,
                        lng: lng,
                        accuracy: accuracy
                    })
                });
                
                console.log('📨 Response status:', response.status);
                console.log('📨 Response ok:', response.ok);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                console.log('📦 Full response from backend:', data);
                console.log('🤖 Emergency suggestions in response:', data.emergency_suggestions);
                
                if (response.ok) {
                    console.log("✅ SOS Alert sent successfully:", data);
                    console.log("🤖 Emergency suggestions received:", data.emergency_suggestions);
                    
                    if (!data.emergency_suggestions) {
                        console.error('⚠️ WARNING: No emergency_suggestions in response!');
                        console.error('Full backend response:', JSON.stringify(data, null, 2));
                        
                        // Show fallback message
                        modal.querySelector('.modal-body').innerHTML = `
                            <div style="text-align:center; padding:20px;">
                                <div style="background:#d4edda; color:#155724; padding:15px; border-radius:8px; margin-bottom:20px;">
                                    <h3>🚨 SOS ALERT SENT!</h3>
                                    <p>Alert ID: ${data.alert_id}<br>
                                    Time: ${data.timestamp}</p>
                                </div>
                                <p>Emergency services have been notified.</p>
                                <button onclick="closeModal(null, 'sos-modal')" class="primary-btn">Close</button>
                            </div>
                        `;
                        return;
                    }
                    
                    // CRITICAL: Keep modal open and display AI suggestions
                    console.log("📋 About to call displayEmergencySuggestions...");
                    console.log("📋 Parameters:", {
                        suggestions: data.emergency_suggestions,
                        alertId: data.alert_id,
                        lat: lat,
                        lng: lng,
                        timestamp: data.timestamp
                    });
                    
                    try {
                        displayEmergencySuggestions(data.emergency_suggestions, data.alert_id, lat, lng, data.timestamp);
                        console.log("✅ displayEmergencySuggestions called successfully");
                    } catch (displayError) {
                        console.error("❌ Error in displayEmergencySuggestions:", displayError);
                        alert(`❌ Error displaying emergency services: ${displayError.message}`);
                    }
                    
                } else {
                    throw new Error(data.error || 'Failed to send SOS');
                }
                
            } catch (error) {
                console.error("❌ Error sending SOS:", error);
                modal.querySelector('.modal-body').innerHTML = originalContent;
                alert(`❌ Error sending SOS alert:\n\n${error.message}\n\nPlease check:\n- Internet connection\n- Backend server is running (python app.py)\n- Backend is accessible at localhost:5000`);
            }
        },
        
        // Error callback
        (error) => {
            console.error("❌ Geolocation error:", error);
            modal.querySelector('.modal-body').innerHTML = originalContent;
            
            let errorMessage = "Unable to get your location.\n\n";
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "❌ Location permission denied.\n\nPlease:\n1. Click the location icon in your browser's address bar\n2. Allow location access for this site\n3. Try again";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "❌ Location information unavailable.\n\nPlease check your device's location services.";
                    break;
                case error.TIMEOUT:
                    errorMessage += "❌ Location request timed out.\n\nPlease try again.";
                    break;
                default:
                    errorMessage += "❌ An unknown error occurred.\n\nError: " + error.message;
            }
            
            alert(errorMessage);
        },
        
        // Options for high accuracy
        {
            enableHighAccuracy: true,  // Use GPS if available
            timeout: 10000,            // Wait up to 10 seconds
            maximumAge: 0              // Don't use cached position
        }
    );
};

function displayEmergencySuggestions(suggestions, alertId, lat, lng, timestamp) {
    console.log('🚀 displayEmergencySuggestions CALLED');
    console.log('📦 Suggestions:', suggestions);
    
    // CLOSE the original SOS modal
    const sosModal = document.getElementById('sos-modal');
    sosModal.classList.remove('active');
    console.log('✅ Original SOS modal closed');
    
    // OPEN the new emergency suggestions modal
    const emergencyModal = document.getElementById('emergency-suggestions-modal');
    const emergencyBody = document.getElementById('emergency-suggestions-body');
    
    console.log('📋 Emergency modal element:', emergencyModal);
    
    if (!emergencyModal) {
        console.error('❌ Emergency modal element not found!');
        alert('❌ ERROR: Emergency modal not found in DOM!');
        return;
    }
    
    if (!emergencyBody) {
        console.error('❌ Emergency body element not found!');
        alert('❌ ERROR: Emergency body not found in DOM!');
        return;
    }
    
    if (!suggestions) {
        // Fallback if no suggestions
        emergencyBody.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="background:#d4edda; color:#155724; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <h3>🚨 SOS ALERT SENT!</h3>
                    <p>Alert ID: ${alertId}<br>
                    Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                    Time: ${timestamp}</p>
                </div>
                <p>Emergency services have been notified.</p>
                <button onclick="closeEmergencySuggestionsModal()" class="primary-btn">Close</button>
            </div>
        `;
        emergencyModal.classList.add('active');
        emergencyModal.style.display = 'flex';
        return;
    }
    
    // Create comprehensive emergency suggestions display
    let suggestionsHTML = `
        <div style="max-height:70vh; overflow-y:auto;">
            <div style="background:#d4edda; color:#155724; padding:15px; border-radius:8px; margin-bottom:15px; text-align:center; border:2px solid #28a745;">
                <h3 style="margin:0 0 10px 0;">✅ SOS ALERT SENT SUCCESSFULLY!</h3>
                <p style="margin:0; font-size:12px;">Alert ID: ${alertId} | Time: ${timestamp}</p>
                <p style="margin:5px 0 0 0; font-size:12px;">📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
            </div>
            
            <div style="background:#fff3cd; color:#856404; padding:15px; border-radius:6px; margin-bottom:20px; border-left:4px solid #ffc107;">
                <h4 style="margin:0 0 8px 0; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-robot"></i> AI Emergency Assistance
                </h4>
                <p style="margin:0; font-size:13px; line-height:1.5;">
                    Click <strong>"Call"</strong> to contact emergency services or <strong>"Navigate"</strong> to get directions from your location.
                    <strong>Select the most appropriate option for your situation.</strong>
                </p>
            </div>
    `;
    
    // Hospitals
    if (suggestions.hospitals && suggestions.hospitals.length > 0) {
        suggestionsHTML += `
            <div class="emergency-section">
                <h4 style="color:#dc3545; margin:0 0 10px 0;"><i class="fa-solid fa-hospital"></i> Nearby Hospitals</h4>
        `;
        suggestions.hospitals.forEach(hospital => {
            suggestionsHTML += `
                <div class="emergency-item">
                    <div style="font-weight:600; color:#dc3545;">${hospital.name}</div>
                    <div style="font-size:12px; color:#666; margin:2px 0;">${hospital.address}</div>
                    <div style="font-size:12px; margin:5px 0;">
                        <span style="color:#28a745;">📞 ${hospital.phone}</span>
                        <span style="margin-left:10px; color:#6c757d;">📍 ${hospital.distance}</span>
                    </div>
                    ${hospital.specialties ? `<div style="font-size:11px; color:#007bff; margin-top:3px;">${hospital.specialties.join(', ')}</div>` : ''}
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <button onclick="callEmergencyService('${hospital.phone.replace(/'/g, "\\'")}');" 
                                style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-phone"></i> Call
                        </button>
                        <button onclick="navigateToEmergencyService('${hospital.name.replace(/'/g, "\\'")}', '${hospital.address.replace(/'/g, "\\'")}', ${lat}, ${lng});" 
                                style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-route"></i> Navigate
                        </button>
                    </div>
                </div>
            `;
        });
        suggestionsHTML += `</div>`;
    }
    
    // Police Stations
    if (suggestions.police_stations && suggestions.police_stations.length > 0) {
        suggestionsHTML += `
            <div class="emergency-section">
                <h4 style="color:#007bff; margin:0 0 10px 0;"><i class="fa-solid fa-shield-halved"></i> Police Stations</h4>
        `;
        suggestions.police_stations.forEach(police => {
            suggestionsHTML += `
                <div class="emergency-item">
                    <div style="font-weight:600; color:#007bff;">${police.name}</div>
                    <div style="font-size:12px; color:#666; margin:2px 0;">${police.address}</div>
                    <div style="font-size:12px; margin:5px 0;">
                        <span style="color:#28a745;">📞 ${police.phone}</span>
                        <span style="margin-left:10px; color:#6c757d;">📍 ${police.distance}</span>
                    </div>
                    <div style="font-size:11px; color:#007bff; margin-top:3px;">${police.type}</div>
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <button onclick="callEmergencyService('${police.phone.replace(/'/g, "\\'")}');" 
                                style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-phone"></i> Call
                        </button>
                        <button onclick="navigateToEmergencyService('${police.name.replace(/'/g, "\\'")}', '${police.address.replace(/'/g, "\\'")}', ${lat}, ${lng});" 
                                style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-route"></i> Navigate
                        </button>
                    </div>
                </div>
            `;
        });
        suggestionsHTML += `</div>`;
    }
    
    // Mechanics
    if (suggestions.mechanics && suggestions.mechanics.length > 0) {
        suggestionsHTML += `
            <div class="emergency-section">
                <h4 style="color:#fd7e14; margin:0 0 10px 0;"><i class="fa-solid fa-wrench"></i> Emergency Mechanics</h4>
        `;
        suggestions.mechanics.forEach(mechanic => {
            suggestionsHTML += `
                <div class="emergency-item">
                    <div style="font-weight:600; color:#fd7e14;">${mechanic.name}</div>
                    <div style="font-size:12px; color:#666; margin:2px 0;">${mechanic.address}</div>
                    <div style="font-size:12px; margin:5px 0;">
                        <span style="color:#28a745;">📞 ${mechanic.phone}</span>
                        <span style="margin-left:10px; color:#6c757d;">📍 ${mechanic.distance}</span>
                    </div>
                    ${mechanic.services ? `<div style="font-size:11px; color:#fd7e14; margin-top:3px;">${mechanic.services.join(', ')}</div>` : ''}
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <button onclick="callEmergencyService('${mechanic.phone.replace(/'/g, "\\'")}');" 
                                style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-phone"></i> Call
                        </button>
                        <button onclick="navigateToEmergencyService('${mechanic.name.replace(/'/g, "\\'")}', '${mechanic.address.replace(/'/g, "\\'")}', ${lat}, ${lng});" 
                                style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-route"></i> Navigate
                        </button>
                    </div>
                </div>
            `;
        });
        suggestionsHTML += `</div>`;
    }
    
    // Hotels/Safe Places
    if (suggestions.hotels_restrooms && suggestions.hotels_restrooms.length > 0) {
        suggestionsHTML += `
            <div class="emergency-section">
                <h4 style="color:#6f42c1; margin:0 0 10px 0;"><i class="fa-solid fa-bed"></i> Safe Places & Rest Areas</h4>
        `;
        suggestions.hotels_restrooms.forEach(place => {
            suggestionsHTML += `
                <div class="emergency-item">
                    <div style="font-weight:600; color:#6f42c1;">${place.name}</div>
                    <div style="font-size:12px; color:#666; margin:2px 0;">${place.address}</div>
                    <div style="font-size:12px; margin:5px 0;">
                        <span style="color:#28a745;">📞 ${place.phone}</span>
                        <span style="margin-left:10px; color:#6c757d;">📍 ${place.distance}</span>
                    </div>
                    ${place.amenities ? `<div style="font-size:11px; color:#6f42c1; margin-top:3px;">${place.amenities.join(', ')}</div>` : ''}
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <button onclick="callEmergencyService('${place.phone.replace(/'/g, "\\'")}');" 
                                style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-phone"></i> Call
                        </button>
                        <button onclick="navigateToEmergencyService('${place.name.replace(/'/g, "\\'")}', '${place.address.replace(/'/g, "\\'")}', ${lat}, ${lng});" 
                                style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                            <i class="fa-solid fa-route"></i> Navigate
                        </button>
                    </div>
                </div>
            `;
        });
        suggestionsHTML += `</div>`;
    }
    
    // Emergency Tips
    if (suggestions.emergency_tips && suggestions.emergency_tips.length > 0) {
        suggestionsHTML += `
            <div class="emergency-section">
                <h4 style="color:#20c997; margin:0 0 10px 0;"><i class="fa-solid fa-lightbulb"></i> Immediate Safety Tips</h4>
                <ul style="margin:0; padding-left:20px; font-size:13px; color:#495057;">
        `;
        suggestions.emergency_tips.forEach(tip => {
            suggestionsHTML += `<li style="margin-bottom:5px;">${tip}</li>`;
        });
        suggestionsHTML += `</ul></div>`;
    }
    
    suggestionsHTML += `
            <div style="text-align:center; margin-top:25px; padding:20px 15px 15px 15px; border-top:2px solid #dee2e6; background:#f8f9fa; border-radius:0 0 8px 8px;">
                <p style="margin:0 0 12px 0; font-size:13px; color:#666; font-weight:600;">
                    📋 Use "Call" or "Navigate" buttons above for immediate assistance
                </p>
                <button onclick="closeEmergencySuggestionsModal()" class="primary-btn" style="padding:14px 30px; font-size:16px; font-weight:700;">
                    <i class="fa-solid fa-check"></i> I've Reviewed - Close Window
                </button>
            </div>
        </div>
    `;
    
    emergencyBody.innerHTML = suggestionsHTML;
    
    // Show the modal
    emergencyModal.classList.add('active');
    emergencyModal.style.display = 'flex';
    
    console.log('✅ Emergency suggestions displayed in modal');
    console.log('📊 Modal state:', {
        isActive: emergencyModal.classList.contains('active'),
        display: emergencyModal.style.display,
        computedDisplay: window.getComputedStyle(emergencyModal).display
    });
}

// Close function for emergency suggestions modal
window.closeEmergencySuggestionsModal = function() {
    console.log('🚪 Closing emergency suggestions modal');
    const emergencyModal = document.getElementById('emergency-suggestions-modal');
    emergencyModal.classList.remove('active');
    emergencyModal.style.display = 'none';
    
    // Reset the SOS modal to original state
    const sosModal = document.getElementById('sos-modal');
    sosModal.querySelector('.modal-body').innerHTML = `
        <p>This will broadcast your live location to all admins immediately.</p>
        <div class="pulse-container">
            <button onclick="sendEmergencyAlert()" class="big-sos-btn">SOS</button>
        </div>
        <p class="sos-note">Only use in case of real emergency.<br>Your IP and Location will be tracked.</p>
    `;
    
    console.log('✅ Emergency suggestions modal closed');
};

// Special close function for SOS modal to handle the prevent-close attribute
window.closeSosModal = function() {
    console.log('🚪 closeSosModal called - user clicked review button');
    
    const modal = document.getElementById('sos-modal');
    
    // Disconnect the mutation observer
    if (modal._suggestionObserver) {
        modal._suggestionObserver.disconnect();
        console.log('👁️ MutationObserver disconnected');
    }
    
    modal.removeAttribute('data-prevent-close');
    modal.removeAttribute('data-showing-suggestions');
    
    // Remove inline styles
    modal.style.display = '';
    modal.style.opacity = '';
    modal.style.visibility = '';
    
    // Restore original onclick behavior
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal(e, 'sos-modal');
        }
    };
    
    // Reset modal content to original
    modal.querySelector('.modal-body').innerHTML = `
        <p>This will broadcast your live location to all admins immediately.</p>
        <div class="pulse-container">
            <button onclick="sendEmergencyAlert()" class="big-sos-btn">SOS</button>
        </div>
        <p class="sos-note">Only use in case of real emergency.<br>Your IP and Location will be tracked.</p>
    `;
    
    modal.classList.remove('active');
    
    console.log('✅ SOS Modal closed and reset');
};

// Safe close for header button - checks if AI suggestions are showing
window.closeSosModalSafe = function() {
    const modal = document.getElementById('sos-modal');
    
    if (modal.getAttribute('data-prevent-close') === 'true') {
        const confirmClose = confirm('⚠️ Emergency assistance information is displayed.\n\nAre you sure you want to close without reviewing the emergency services?\n\nClick OK to close, Cancel to review information.');
        if (confirmClose) {
            closeSosModal();
        }
    } else {
        closeModal(null, 'sos-modal');
    }
};

window.submitFeedback = async function(event) {
    const type = document.getElementById('feedback-type').value;
    const desc = document.getElementById('feedback-desc').value.trim();
   
    if (!desc) {
        alert('⚠️ Please add a description for your report.');
        return;
    }
   
    if (!navigator.geolocation) {
        alert('❌ GPS is required for location reporting. Please enable it in your browser settings.');
        return;
    }
   
    // Show loading state
    const submitBtn = event ? event.target : null;
    let originalText = '';
    if (submitBtn) {
        originalText = submitBtn.textContent;
        submitBtn.textContent = '📡 Sending...';
        submitBtn.disabled = true;
    }
   
    try {
        const position = await getPosition();
       
        const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
       
        const response = await fetch('http://localhost:5000/post-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat: coords.lat,
                lng: coords.lng,
                type: type,
                description: desc
            })
        });
       
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
       
        const data = await response.json();
       
        // Close modal and reset
        closeModal(null, 'community-modal');
        document.getElementById('feedback-desc').value = '';
       
        // Show success notification
        showMapNotification(`✅ Report #${data.id} submitted successfully!`, '#10b981');
       
        // Show detailed alert
        alert(
            `✅ Feedback Submitted Successfully!\n\n` +
            `Report ID: ${data.id}\n` +
            `Type: ${feedbackConfig[type].label}\n` +
            `Location: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}\n\n` +
            `Thank you for helping keep the community safe! 🙏`
        );
       
    } catch (error) {
        console.error('Feedback Submit Error:', error);
       
        // Handle different error types
        if (error.code === 1) {
            alert('❌ Location Permission Denied\n\nPlease enable location access in your browser settings and try again.');
        } else if (error.code === 2) {
            alert('❌ Location Unavailable\n\nPlease check:\n• GPS is enabled\n• You have internet connection\n• Location services are working');
        } else if (error.code === 3) {
            alert('⏱️ Location Request Timed Out\n\nPlease try again. Make sure you have a clear GPS signal.');
        } else {
            // Offer manual coordinate entry as fallback
            const useManual = confirm(
                '❌ Could not get your location automatically.\n\n' +
                'Would you like to enter coordinates manually?\n\n' +
                'Click OK to enter coordinates, or Cancel to abort.'
            );
           
            if (useManual) {
                const manualCoords = prompt(
                    'Enter your location coordinates (lat,lng):\n\n' +
                    'Example: 17.3850,78.4867\n\n' +
                    'Or leave empty to cancel.'
                );
               
                if (manualCoords && manualCoords.trim()) {
                    const [lat, lng] = manualCoords.split(',').map(coord => parseFloat(coord.trim()));
                   
                    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        try {
                            const manualResponse = await fetch('http://localhost:5000/post-feedback', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lat, lng, type, description: desc })
                            });
                           
                            if (manualResponse.ok) {
                                const data = await manualResponse.json();
                                closeModal(null, 'community-modal');
                                document.getElementById('feedback-desc').value = '';
                                showMapNotification(`✅ Report #${data.id} submitted!`, '#10b981');
                                alert(`✅ Feedback #${data.id} submitted manually!\n\nThank you for your report.`);
                            } else {
                                throw new Error('Manual submission failed');
                            }
                        } catch (manualError) {
                            alert('❌ Failed to submit feedback manually.\n\nPlease try again or contact support.');
                        }
                    } else {
                        alert('❌ Invalid Coordinates\n\nPlease use format: latitude,longitude\nExample: 17.3850,78.4867');
                    }
                }
            }
        }
    } finally {
        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
};

/* --- Visual Helpers --- */
function updateFeedbackListUI() {
    const list = document.getElementById("feedback-list");
   
    if (!allFeedbacks || allFeedbacks.length === 0) {
        list.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #999;">
                <div style="font-size: 48px; margin-bottom: 15px;">💬</div>
                <h3 style="margin: 0 0 10px 0; color: #666;">No Recent Reports</h3>
                <p style="margin: 0; font-size: 14px;">Community reports will appear here</p>
            </div>
        `;
        return;
    }
   
    list.innerHTML = allFeedbacks.slice(0, 10).map(fb => {
        const config = feedbackConfig[fb.type] || feedbackConfig.other;
        const timeAgo = getTimeAgo(new Date(fb.time));
       
        return `
            <div class="feedback-item" style="cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.background='#f8f9fa'; this.style.transform='translateX(5px)';"
                 onmouseout="this.style.background='white'; this.style.transform='translateX(0)';"
                 onclick="focusOnFeedback(${fb.lat}, ${fb.lng})">
                <div style="display: flex; align-items: start; gap: 12px; padding: 12px; border-bottom: 1px solid #eee;">
                    <span style="font-size: 24px; color: ${config.color};">${config.icon}</span>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-weight: 600; color: ${config.color};">${config.label}</span>
                            <span style="font-size: 11px; color: #999;">${timeAgo}</span>
                        </div>
                        <div style="font-size: 13px; color: #666; line-height: 1.4; margin-bottom: 5px;">
                            ${fb.description || 'Issue reported'}
                        </div>
                        <div style="font-size: 11px; color: #999;">
                            📍 ${fb.lat.toFixed(4)}, ${fb.lng.toFixed(4)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showCrimeIncidents(incidents) {
  clearCrimeVisualization();
  if (!incidents) return;
  const infoWindow = new google.maps.InfoWindow({ minWidth: 200 });
  incidents.forEach((inc) => {
    const config = crimeConfig[inc.type] || crimeConfig.default;
    const marker = new google.maps.Marker({
      position: { lat: inc.lat, lng: inc.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: config.color,
        fillOpacity: 0.9,
        strokeColor: "white",
        strokeWeight: 1,
      },
    });
    marker.addListener("mouseover", () => {
      infoWindow.setContent(
        `<div style="padding:5px"><b>${inc.type.toUpperCase()}</b><br>${
          inc.description
        }</div>`
      );
      infoWindow.open(map, marker);
    });
    crimeMarkers.push({ marker });
  });
}

function clearCrimeVisualization() {
  crimeMarkers.forEach((m) => m.marker.setMap(null));
  crimeMarkers = [];
}

function clearFeedback() {
    feedbackMarkers.forEach(item => {
        if (item.marker) item.marker.setMap(null);
        if (item.infoWindow) item.infoWindow.close();
    });
    feedbackMarkers = [];
}

function addFeedbackMarker(fb) {
    const config = feedbackConfig[fb.type] || feedbackConfig.other;
   
    // Custom SVG pin marker (from Version 1)
    const svgMarker = {
        path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
        fillColor: config.color,
        fillOpacity: 0.9,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
        scale: 1.2,
        anchor: new google.maps.Point(0, 0)
    };
   
    const marker = new google.maps.Marker({
        position: { lat: fb.lat, lng: fb.lng },
        map: map,
        icon: svgMarker,
        title: `${config.icon} ${config.label}: ${fb.description}`,
        zIndex: 200
    });
   
    // Detailed info window (from Version 1)
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 12px; max-width: 250px; font-family: 'Segoe UI', sans-serif;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <span style="font-size: 24px;">${config.icon}</span>
                    <div>
                        <div style="font-weight: bold; color: ${config.color}; font-size: 15px;">
                            COMMUNITY REPORT
                        </div>
                        <div style="font-size: 11px; padding: 2px 6px; background: ${config.color}; color: white; border-radius: 3px; display: inline-block; margin-top: 3px;">
                            ${config.label.toUpperCase()}
                        </div>
                    </div>
                </div>
                <div style="font-size: 13px; margin-bottom: 8px; color: #333; line-height: 1.4;">
                    <strong>Report:</strong><br>
                    ${fb.description || 'No description provided'}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    <strong>📅 Reported:</strong> ${new Date(fb.time).toLocaleString()}
                </div>
                <div style="font-size: 12px; color: #555; padding: 8px; background: #fff8e1; border-radius: 5px; border-left: 3px solid ${config.color};">
                    <strong>💬 From Community</strong><br>
                    Help others stay safe by reporting hazards
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 8px; text-align: center;">
                    📍 ${fb.lat.toFixed(6)}, ${fb.lng.toFixed(6)}
                </div>
            </div>
        `
    });
   
    // Enhanced hover behavior (from Version 1)
    marker.addListener("mouseover", () => {
        infoWindow.open(map, marker);
    });
   
    marker.addListener("mouseout", () => {
        setTimeout(() => {
            if (!marker.clicked) {
                infoWindow.close();
            }
        }, 500);
    });
   
    marker.addListener("click", () => {
        marker.clicked = true;
        infoWindow.open(map, marker);
    });
   
    feedbackMarkers.push({ marker, infoWindow });
}

window.focusOnFeedback = function(lat, lng) {
    map.panTo({ lat, lng });
    map.setZoom(16);
   
    // Optional: Show notification
    showMapNotification('📍 Viewing community report', '#2196F3');
};

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
   
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function showMapNotification(message, color = '#4CAF50') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
        font-family: 'Segoe UI', sans-serif;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
   
    // Add animation keyframes if not exists
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
   
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}
function startLoadingAnimation() {
  document.getElementById("loading").style.display = "block";
}
function stopLoadingAnimation() {
  document.getElementById("loading").style.display = "none";
}

/* Modal Logic */
window.openModal = function (id) {
  const modal = document.getElementById(id);
  modal.classList.add("active");
  
  // Add click handler for SOS modal overlay
  if (id === 'sos-modal') {
    modal.onclick = function(e) {
      if (e.target === modal && modal.getAttribute('data-prevent-close') !== 'true') {
        closeModal(e, id);
      } else if (e.target === modal && modal.getAttribute('data-prevent-close') === 'true') {
        e.stopPropagation();
        alert('⚠️ Please review the emergency assistance information.\n\nClick "I\'ve Reviewed - Close Window" button to dismiss.');
      }
    };
  } else {
    modal.onclick = function(e) {
      if (e.target === modal) {
        closeModal(e, id);
      }
    };
  }
  
  if (id === "community-modal") updateFeedbackListUI();
};

window.closeModal = function (e, id) {
  const modal = document.getElementById(id);
  
  console.log('🚪 closeModal called for:', id);
  console.log('🔒 Prevent close?', modal?.getAttribute('data-prevent-close'));
  
  // CRITICAL: Check if modal has prevent-close attribute (for SOS with AI suggestions)
  if (modal && modal.getAttribute('data-prevent-close') === 'true') {
    console.log('⛔ Modal close BLOCKED - AI suggestions are showing');
    e?.stopPropagation();
    e?.preventDefault();
    
    // Show alert to user if they try to close
    if (e && (e.target.id === id || e.target.classList.contains('close-btn'))) {
      alert('⚠️ Please review the emergency assistance information before closing.\n\nClick "I\'ve Reviewed - Close Window" button at the bottom to dismiss.');
    }
    return false;
  }
  
  console.log('✅ Closing modal:', id);
  
  if (!e || e.target.id === id || e.target.classList.contains("close-btn")) {
    modal.classList.remove("active");
  }
};
window.fetchFeedbackForRoute = function () {
  fetch("http://localhost:5000/get-feedback")
    .then((r) => r.json())
    .then((d) => {
      allFeedbacks = d;
      clearFeedback();
      d.forEach(fb => addFeedbackMarker(fb));
      updateFeedbackListUI();
    })
    .catch((e) => console.log(e));
};
window.clearAllData = function () {
  if (confirm("Clear All Data?"))
    fetch("http://localhost:5000/clear-all-data", {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE_ALL_DATA" }),
    });
};
window.toggleNightMode = function () {
  document.body.classList.toggle("night-mode");
};

window.testGeminiAI = async function() {
    const testBtn = event.target;
    const originalText = testBtn.innerHTML;
    
    try {
        testBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Testing...';
        testBtn.disabled = true;
        
        const response = await fetch('http://localhost:5000/test-gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: 17.3850, lng: 78.4867 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('🤖 Gemini AI Test Result:', data);
            alert(`🤖 Gemini AI Test Successful!\n\nFound:\n• ${data.suggestions.hospitals?.length || 0} Hospitals\n• ${data.suggestions.police_stations?.length || 0} Police Stations\n• ${data.suggestions.mechanics?.length || 0} Mechanics\n• ${data.suggestions.hotels_restrooms?.length || 0} Safe Places\n\nCheck console for full details.`);
        } else {
            throw new Error(data.message || 'Test failed');
        }
        
    } catch (error) {
        console.error('❌ Gemini AI Test Error:', error);
        alert(`❌ Gemini AI Test Failed:\n\n${error.message}\n\nThis might be because:\n• Gemini API key is not configured\n• Backend server is not running\n• Network connectivity issues\n\nCheck GEMINI_SETUP.md for setup instructions.`);
    } finally {
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
    }
};

// Test function to directly show emergency modal
window.testEmergencyModal = function() {
    console.log('🧪 Testing emergency modal directly...');
    
    const modal = document.getElementById('emergency-suggestions-modal');
    const body = document.getElementById('emergency-suggestions-body');
    
    if (!modal) {
        alert('❌ Emergency modal not found!');
        return;
    }
    
    // Create test suggestions
    const testSuggestions = {
        hospitals: [
            { name: "Test Hospital 1", address: "123 Test St", phone: "102", distance: "2km", specialties: ["Emergency"] },
            { name: "Test Hospital 2", address: "456 Test Ave", phone: "108", distance: "3km", specialties: ["Trauma"] }
        ],
        police_stations: [
            { name: "Test Police Station", address: "789 Test Rd", phone: "100", distance: "1km", type: "Local Police" }
        ],
        mechanics: [
            { name: "Test Mechanic", address: "321 Test Blvd", phone: "1073", distance: "4km", services: ["24/7", "Towing"] }
        ],
        hotels_restrooms: [
            { name: "Test Hotel", address: "654 Test Lane", phone: "112", distance: "2.5km", amenities: ["Safe Space", "24/7"] }
        ],
        emergency_tips: [
            "This is a test tip 1",
            "This is a test tip 2",
            "This is a test tip 3"
        ]
    };
    
    console.log('📋 Calling displayEmergencySuggestions with test data...');
    displayEmergencySuggestions(testSuggestions, 999, 17.3850, 78.4867, new Date().toISOString());
    console.log('✅ Function called');
};

// Test function to debug navigation
window.testNavigation = function() {
    console.log('🧪 Testing navigation function...');
    
    // Test with sample data
    const testServiceName = "Apollo Hospital";
    const testServiceAddress = "Near 17.3850, 78.4867";
    const testUserLat = 17.3850;
    const testUserLng = 78.4867;
    
    console.log('📍 Test parameters:', {
        serviceName: testServiceName,
        serviceAddress: testServiceAddress,
        userLat: testUserLat,
        userLng: testUserLng
    });
    
    // Check if required objects exist
    console.log('🔍 Checking required objects:');
    console.log('- window.google:', !!window.google);
    console.log('- google.maps:', !!window.google?.maps);
    console.log('- map object:', !!map);
    console.log('- directionsService:', !!directionsService);
    console.log('- rendererArray:', !!rendererArray);
    
    // Test the navigation function
    navigateToEmergencyService(testServiceName, testServiceAddress, testUserLat, testUserLng);
};

// Navigation and Call Functions for Emergency Services
window.callEmergencyService = function(phoneNumber) {
    console.log(`📞 Calling emergency service: ${phoneNumber}`);
    
    // Clean phone number (remove any non-numeric characters except +)
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // Show confirmation dialog
    const confirmed = confirm(`📞 Call Emergency Service?\n\nNumber: ${phoneNumber}\n\nThis will open your phone's dialer.`);
    
    if (confirmed) {
        // Try to initiate call
        try {
            window.open(`tel:${cleanNumber}`, '_self');
            
            // Show success notification
            showMapNotification(`📞 Calling ${phoneNumber}...`, '#28a745');
            
            // Log the call attempt
            console.log(`✅ Call initiated to: ${phoneNumber}`);
            
        } catch (error) {
            console.error('❌ Error initiating call:', error);
            
            // Fallback: copy number to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(cleanNumber).then(() => {
                    alert(`📞 Could not open dialer.\n\nPhone number copied to clipboard: ${phoneNumber}\n\nPlease dial manually.`);
                }).catch(() => {
                    alert(`📞 Could not open dialer.\n\nPlease dial: ${phoneNumber}`);
                });
            } else {
                alert(`📞 Could not open dialer.\n\nPlease dial: ${phoneNumber}`);
            }
        }
    }
};

window.navigateToEmergencyService = function(serviceName, serviceAddress, userLat, userLng) {
    console.log(`🗺️ Navigating to: ${serviceName} at ${serviceAddress}`);
    console.log(`📍 User location: ${userLat}, ${userLng}`);
    
    // Show confirmation dialog
    const confirmed = confirm(`🗺️ Navigate to Emergency Service?\n\n${serviceName}\n${serviceAddress}\n\nThis will close the emergency modal and show directions on the map.`);
    
    if (confirmed) {
        try {
            // Close the emergency suggestions modal
            closeEmergencySuggestionsModal();
            
            // Show loading notification
            showMapNotification(`🗺️ Getting directions to ${serviceName}...`, '#007bff');
            
            // Check if Google Maps and directionsService are available
            if (!window.google || !window.google.maps) {
                throw new Error('Google Maps not loaded');
            }
            
            if (!directionsService) {
                console.log('🔄 Creating new DirectionsService...');
                directionsService = new google.maps.DirectionsService();
            }
            
            // Create request for directions
            const request = {
                origin: new google.maps.LatLng(userLat, userLng),
                destination: serviceAddress,
                travelMode: google.maps.TravelMode.DRIVING,
                unitSystem: google.maps.UnitSystem.METRIC,
                avoidHighways: false,
                avoidTolls: false
            };
            
            console.log('📍 Directions request:', request);
            
            // Get directions
            directionsService.route(request, (result, status) => {
                console.log(`📊 Directions API response: ${status}`);
                
                if (status === 'OK' || status === google.maps.DirectionsStatus.OK) {
                    console.log('✅ Directions received:', result);
                    
                    // Clear existing route renderers
                    if (rendererArray && rendererArray.length > 0) {
                        rendererArray.forEach(renderer => {
                            if (renderer && renderer.setMap) {
                                renderer.setMap(null);
                            }
                        });
                        rendererArray = [];
                    }
                    
                    // Create new directions renderer for emergency route
                    const emergencyRenderer = new google.maps.DirectionsRenderer({
                        map: map,
                        directions: result,
                        suppressMarkers: false,
                        polylineOptions: {
                            strokeColor: '#dc3545', // Red color for emergency route
                            strokeOpacity: 1.0,
                            strokeWeight: 6,
                            zIndex: 1000
                        }
                    });
                    
                    // Add to renderer array
                    if (!rendererArray) {
                        rendererArray = [];
                    }
                    rendererArray.push(emergencyRenderer);
                    
                    // Get route information
                    const route = result.routes[0];
                    const leg = route.legs[0];
                    
                    // Show success notification with route info
                    showMapNotification(
                        `✅ Route to ${serviceName}: ${leg.distance.text}, ${leg.duration.text}`, 
                        '#28a745'
                    );
                    
                    // Create info window for destination
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div style="padding:10px; font-family:Arial,sans-serif; max-width:250px;">
                                <h4 style="margin:0 0 8px 0; color:#dc3545;">🚨 ${serviceName}</h4>
                                <p style="margin:0 0 5px 0; font-size:13px;">${serviceAddress}</p>
                                <div style="font-size:12px; color:#666; margin:8px 0;">
                                    <strong>Distance:</strong> ${leg.distance.text}<br>
                                    <strong>Duration:</strong> ${leg.duration.text}
                                </div>
                                <div style="margin-top:10px;">
                                    <button onclick="window.open('https://maps.google.com/maps?daddr=${encodeURIComponent(serviceAddress)}', '_blank')" 
                                            style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer;">
                                        <i class="fa-solid fa-external-link-alt"></i> Open in Google Maps
                                    </button>
                                </div>
                            </div>
                        `
                    });
                    
                    // Show info window at destination
                    const destinationLatLng = leg.end_location;
                    infoWindow.setPosition(destinationLatLng);
                    infoWindow.open(map);
                    
                    // Fit map to show entire route
                    map.fitBounds(result.routes[0].bounds);
                    
                    console.log(`✅ Navigation set up for ${serviceName}`);
                    
                } else {
                    console.error('❌ Directions request failed:', status);
                    
                    // Handle different error types
                    let errorMessage = '';
                    let fallbackAddress = serviceAddress;
                    
                    if (status === 'NOT_FOUND') {
                        errorMessage = `❌ Could not find directions to the exact address.\n\nAddress: ${serviceAddress}\n\nWould you like to try navigating to the general area instead?`;
                        
                        // Try to extract a more general location for fallback
                        if (serviceAddress.includes('Hyderabad') || serviceAddress.includes('Telangana')) {
                            fallbackAddress = serviceAddress;
                        } else {
                            // Use service name + city as fallback
                            fallbackAddress = `${serviceName}, Hyderabad, Telangana, India`;
                        }
                    } else if (status === 'ZERO_RESULTS') {
                        errorMessage = `❌ No route found to ${serviceName}.\n\nWould you like to open Google Maps for alternative directions?`;
                    } else if (status === 'OVER_QUERY_LIMIT') {
                        errorMessage = `❌ Navigation service temporarily unavailable.\n\nWould you like to open Google Maps instead?`;
                    } else {
                        errorMessage = `❌ Navigation error: ${status}\n\nWould you like to open Google Maps for directions?`;
                    }
                    
                    const fallbackConfirmed = confirm(errorMessage);
                    
                    if (fallbackConfirmed) {
                        // Try different Google Maps URL formats for better success
                        let googleMapsUrl;
                        
                        if (status === 'NOT_FOUND') {
                            // Try searching by name first, then coordinates
                            googleMapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(serviceName + ', Hyderabad')}&saddr=${userLat},${userLng}`;
                        } else {
                            // Standard directions URL
                            googleMapsUrl = `https://maps.google.com/maps?saddr=${userLat},${userLng}&daddr=${encodeURIComponent(fallbackAddress)}`;
                        }
                        
                        console.log('🗺️ Opening Google Maps:', googleMapsUrl);
                        window.open(googleMapsUrl, '_blank');
                        showMapNotification(`🗺️ Opened ${serviceName} in Google Maps`, '#007bff');
                    } else {
                        showMapNotification(`❌ Navigation cancelled for ${serviceName}`, '#6c757d');
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Navigation error:', error);
            
            // Show error details
            alert(`❌ Navigation Error: ${error.message}\n\nTrying Google Maps fallback...`);
            
            // Ultimate fallback: Open Google Maps directly
            try {
                const googleMapsUrl = `https://maps.google.com/maps?saddr=${userLat},${userLng}&daddr=${encodeURIComponent(serviceAddress)}`;
                window.open(googleMapsUrl, '_blank');
                showMapNotification(`🗺️ Opened ${serviceName} in Google Maps`, '#007bff');
            } catch (fallbackError) {
                console.error('❌ Google Maps fallback failed:', fallbackError);
                alert(`❌ All navigation methods failed.\n\nPlease manually navigate to:\n${serviceName}\n${serviceAddress}`);
            }
        }
    }
};
