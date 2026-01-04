/* --- Global Variables --- */
let map, directionsService;
let rendererArray = [], currentRoutes = [], lastDirectionsResult = null;
let userMarker = null, crimeMarkers = [], feedbackMarkers = [];
let hospitalMarkers = [], policeMarkers = []; // Markers for hospitals and police stations
let allFeedbacks = [];
const socket = io(window.BACKEND_URL);

/* --- Secure Google Maps API Loader --- */
async function loadGoogleMapsAPI() {
    try {
        console.log('🔐 Loading Google Maps API securely...');
        console.log('🌐 Backend URL:', window.BACKEND_URL);
        
        // Get API key from backend securely
        const response = await fetch(`${window.BACKEND_URL}/get-maps-config`);
        
        if (!response.ok) {
            throw new Error(`Backend responded with status ${response.status}`);
        }
        
        const config = await response.json();
        console.log('📦 Config received:', config ? 'OK' : 'Empty');
        
        if (!config || !config.google_maps_api_key) {
            throw new Error('Google Maps API key not available from backend');
        }
        
        console.log('🔑 API key received (length:', config.google_maps_api_key.length, ')');
        
        // Load Google Maps API dynamically
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.google_maps_api_key}&libraries=places,visualization,geometry&callback=initMap`;
        script.async = true;
        script.defer = true;
        
        // Add error handling
        script.onerror = () => {
            console.error('❌ Failed to load Google Maps API script');
            alert('Failed to load Google Maps. Please check:\n1. Internet connection\n2. Google Maps API key is valid\n3. Browser console for details');
        };
        
        // Add timeout check
        let timeoutId = setTimeout(() => {
            if (!window.google || !window.google.maps) {
                console.error('❌ Google Maps API load timeout');
                alert('Google Maps API is taking too long to load. Please refresh the page.');
            }
        }, 10000); // 10 second timeout
        
        script.onload = () => {
            clearTimeout(timeoutId);
            console.log('✅ Google Maps API script loaded successfully');
        };
        
        document.head.appendChild(script);
        console.log('📝 Google Maps API script tag added to page');
        
    } catch (error) {
        console.error('❌ Error loading Google Maps API:', error);
        alert(`Failed to load Google Maps configuration:\n${error.message}\n\nPlease check:\n1. Backend server is running\n2. Backend URL is correct: ${window.BACKEND_URL}\n3. Browser console for details`);
    }
}

// Load Google Maps API when page loads
document.addEventListener('DOMContentLoaded', loadGoogleMapsAPI);

/* --- ✅ NEW: Safety-Based Color System --- */
const getSafetyColor = (safetyScore) => {
  if (safetyScore >= 75) return "#10b981";  // Green - Safe
  if (safetyScore >= 60) return "#f59e0b";  // Yellow/Orange - Moderate
  return "#ef4444";  // Red - Unsafe
};

const getSafetyLabel = (safetyScore) => {
  if (safetyScore >= 75) return { text: "SAFE", color: "#10b981" };
  if (safetyScore >= 60) return { text: "MODERATE", color: "#f59e0b" };
  return { text: "UNSAFE", color: "#ef4444" };
};

/* --- Config --- */
const routeColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];
const crimeConfig = {
  theft: { color: "#f59e0b" },
  robbery: { color: "#ef4444" },
  assault: { color: "#ef4444" },
  accident: { color: "#FF5722" },
  harassment: { color: "#E91E63" },
  default: { color: "#64748b" }
};

const feedbackConfig = {
    accident: { icon: "fa-solid fa-car-crash", color: "#F44336", label: "Accident" },
    construction: { icon: "fa-solid fa-road-barrier", color: "#FFC107", label: "Construction" },
    pothole: { icon: "fa-solid fa-road", color: "#FF9800", label: "Pothole" },
    flood: { icon: "fa-solid fa-water", color: "#2196F3", label: "Flood" },
    traffic: { icon: "fa-solid fa-traffic-light", color: "#9C27B0", label: "Traffic" },
    danger: { icon: "fa-solid fa-triangle-exclamation", color: "#FF0000", label: "Danger" },
    harassment: { icon: "fa-solid fa-ban", color: "#E91E63", label: "Harassment" },
    theft: { icon: "fa-solid fa-mask", color: "#795548", label: "Theft" },
    other: { icon: "fa-solid fa-question", color: "#757575", label: "Other" }
};

/* --- 1. Map Initialization --- */
window.initMap = function () {
  try {
    console.log("🗺️ Map Starting...");
    console.log('🎨 Safety Color System:');
    console.log('   ✅ Green: Score >= 75 (SAFE)');
    console.log('   ⚠️ Yellow: Score 60-74 (MODERATE)');
    console.log('   ❌ Red: Score < 60 (UNSAFE)');
    
    const mapElement = document.getElementById("map");
    if (!mapElement) {
      console.error("❌ Map element not found!");
      alert("Map container not found. Please refresh the page.");
      return;
    }
    
    map = new google.maps.Map(mapElement, {
      center: { lat: 17.385, lng: 78.4867 },
      zoom: 12,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: false,
      styles: []
    });
    
    console.log("✅ Map initialized successfully");
    directionsService = new google.maps.DirectionsService();
    initializeSocketIO();
    fetchFeedbackForRoute();
  } catch (error) {
    console.error("❌ Error initializing map:", error);
    alert("Failed to initialize map. Please check the console for details.");
  }
};

function initializeSocketIO() {
  socket.on("connect", () => {
    console.log("🔌 Connected to Server");
    console.log("🆔 Socket ID:", socket.id);
  });
  socket.on("disconnect", () => {
    console.log("🔌 Disconnected from Server");
  });
  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error);
  });
  socket.on("new_feedback", (data) => {
    console.log("💬 New feedback received:", data);
    allFeedbacks.unshift(data);
    updateFeedbackListUI();
    addFeedbackMarker(data);
  });
    socket.on("data_cleared", (data) => {
    console.log('🗑️ Data cleared event received:', data);
    allFeedbacks = [];
    clearFeedback();
    clearCrimeVisualization();
    clearHospitalsAndPolice(); // Clear hospital and police markers
    updateFeedbackListUI();
    
    // Clear displayed routes
    rendererArray.forEach((r) => r.setMap(null));
    rendererArray = [];
    currentRoutes = [];
    
    // Clear route cards
    const container = document.getElementById("routes-list");
    if (container) container.innerHTML = "";
    
    console.log('✅ Local data cleared successfully');
    
    if (data && data.sos_deleted !== undefined && data.feedback_deleted !== undefined) {
      alert(`🗑️ Data cleared: ${data.sos_deleted} alerts & ${data.feedback_deleted} reports deleted`);
    } else {
      alert("🗑️ System data cleared.");
    }
  });
}

/* --- 2. Route Logic --- */
window.findRoutes = function () {
  const source = document.getElementById("source").value;
  const destination = document.getElementById("destination").value;

  if (!source || !destination) return alert("Please enter locations");

  startLoadingAnimation();

  directionsService.route({
      origin: source,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true
    }, (result, status) => {
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
  console.log(`🔍 Sending route request to backend: ${source} → ${destination}`);
  
  fetch(`${window.BACKEND_URL}/get-routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination })
  })
    .then((res) => res.json())
    .then((data) => {
      stopLoadingAnimation();

      if (data.error) {
        console.error("Backend Error:", data.error);
        alert("Server Error: " + data.error);
        return;
      }

      console.log(`📊 Backend returned ${data.length} routes:`);
      data.forEach((route, index) => {
        console.log(`   Route ${index + 1}: ${route.summary || 'Unknown'} - Safety: ${route.safety_score}`);
      });

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
      alert(`Cannot connect to backend (${window.BACKEND_URL}). Ensure backend server is running.`);
    });
}

/* --- 3. ✅ UPDATED: UI Display with Safety Colors --- */
function displayRouteCards(routes) {
  const container = document.getElementById("routes-list");
  if (!container) return;
  container.innerHTML = "";

  console.log(`📊 Displaying ${routes.length} route cards with safety colors:`);

  routes.forEach((route, index) => {
    const score = route.safety_score || 0;
    
    // ✅ Get safety-based color and label
    const safetyInfo = getSafetyLabel(score);
    const scoreColor = safetyInfo.color;
    const scoreText = safetyInfo.text;
    
    console.log(`📊 Route ${index + 1}: Score ${score} → ${scoreText} (${scoreColor})`);

    const card = document.createElement("div");
    card.className = "route-card";
    card.onclick = () => selectRoute(index);

    card.innerHTML = `
      <div class="score-box" style="background: ${scoreColor}">
        <span class="score-val">${score}</span>
        <span class="score-txt">${scoreText}</span>
      </div>
      <div class="route-info">
        <h4>Route ${index + 1}</h4>
        <div class="route-meta">
          <span><i class="fa-regular fa-clock"></i> ${route.duration}</span>
          <span><i class="fa-solid fa-ruler"></i> ${route.distance}</span>
        </div>
        <div class="route-badges">
          <span class="badge"><i class="fa-solid fa-hospital"></i> ${route.hospital_count || 0} Hospitals</span>
          <span class="badge"><i class="fa-solid fa-user-shield"></i> ${route.police_count || 0} Police Stn</span>
          <span class="badge"><i class="fa-solid fa-lightbulb"></i> ${route.street_light_score || 0}% Lights</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  console.log(`✅ All ${routes.length} route cards displayed with safety colors`);
}

window.selectRoute = function (index) {
  document.querySelectorAll(".route-card").forEach((c, i) => {
    if (i === index) c.classList.add("selected");
    else c.classList.remove("selected");
  });
  renderAllRoutes(index);
  if (currentRoutes[index]) {
    showCrimeIncidents(currentRoutes[index].crime_incidents);
    // Show hospitals and police stations for selected route
    showHospitalsAndPolice(currentRoutes[index]);
  }
  
  // Auto-close sidebar on mobile after route selection
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
};

/* --- ✅ UPDATED: Route Rendering with Safety Colors --- */
function renderAllRoutes(selectedIndex) {
  rendererArray.forEach((r) => r.setMap(null));
  rendererArray = [];
  
  // Clear hospital and police markers when switching routes
  clearHospitalsAndPolice();

  if (!lastDirectionsResult) return;

  // Handle both real Google routes and synthetic routes
  const totalRoutes = Math.max(lastDirectionsResult.routes.length, currentRoutes.length);
  
  for (let index = 0; index < totalRoutes; index++) {
    const isSelected = index === selectedIndex;
    const hasGoogleRoute = index < lastDirectionsResult.routes.length;
    const hasRouteData = index < currentRoutes.length;
    
    // ✅ Get safety-based color for ALL routes (not just selected)
    let routeColor = "#94a3b8"; // Default gray fallback
    
    if (hasRouteData && currentRoutes[index]) {
      const safetyScore = currentRoutes[index].safety_score || 0;
      routeColor = getSafetyColor(safetyScore);
      
      console.log(`🎨 Rendering Route ${index + 1}:`);
      console.log(`   Safety Score: ${safetyScore}`);
      console.log(`   Route Color: ${routeColor}`);
      console.log(`   Selected: ${isSelected ? 'YES' : 'NO'}`);
      console.log(`   Has Google Route: ${hasGoogleRoute ? 'YES' : 'NO (Synthetic)'}`);
      console.log(`   Status: ${safetyScore >= 75 ? 'SAFE ✅' : safetyScore >= 60 ? 'MODERATE ⚠️' : 'UNSAFE ❌'}`);
    } else {
      console.log(`⚠️ Route ${index + 1}: No safety data available, using gray`);
    }

    if (hasGoogleRoute) {
      // Use Google's DirectionsRenderer for real routes
      const renderer = new google.maps.DirectionsRenderer({
        map: map,
        directions: lastDirectionsResult,
        routeIndex: index,
        suppressMarkers: isSelected,
        polylineOptions: {
          strokeColor: routeColor,
          strokeOpacity: isSelected ? 1.0 : 0.6,
          strokeWeight: isSelected ? 6 : 4,
          zIndex: isSelected ? 100 : 10 + index
        }
      });
      rendererArray.push(renderer);
    } else if (hasRouteData && currentRoutes[index] && currentRoutes[index].polyline) {
      // Create custom polyline for synthetic routes
      console.log(`🔄 Creating custom polyline for synthetic Route ${index + 1}`);
      
      try {
        // Use Google's geometry library to decode polyline
        const routePoints = google.maps.geometry.encoding.decodePath(currentRoutes[index].polyline);
        
        const customPolyline = new google.maps.Polyline({
          path: routePoints,
          geodesic: true,
          strokeColor: routeColor,
          strokeOpacity: isSelected ? 1.0 : 0.6,
          strokeWeight: isSelected ? 6 : 4,
          zIndex: isSelected ? 100 : 10 + index,
          map: map
        });
        
        // Add click handler to select this route
        customPolyline.addListener('click', () => {
          selectRoute(index);
        });
        
        // Store in rendererArray for cleanup (wrap in object to match DirectionsRenderer interface)
        rendererArray.push({
          setMap: (mapInstance) => customPolyline.setMap(mapInstance)
        });
        
        console.log(`✅ Custom polyline created for Route ${index + 1} with ${routePoints.length} points`);
        
      } catch (error) {
        console.error(`❌ Error creating custom polyline for Route ${index + 1}:`, error);
      }
    }
  }
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
          document.getElementById("source").value = results[0].formatted_address;
        } else {
          document.getElementById("source").value = `${crd.lat.toFixed(5)}, ${crd.lng.toFixed(5)}`;
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

/* --- 5. SOS Emergency Alert --- */
window.sendEmergencyAlert = function() {
    if(!confirm("⚠️ Send SOS Alert? Your location will be broadcast to emergency responders.")) {
        return;
    }
    
    const modal = document.getElementById('sos-modal');
    const originalContent = modal.querySelector('.modal-body').innerHTML;
    modal.querySelector('.modal-body').innerHTML = `
        <div style="text-align:center; padding:40px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:3rem; color:var(--danger);"></i>
            <h3 style="margin-top:20px;">Getting Your Location...</h3>
            <p style="color:#666;">AI is preparing emergency assistance...</p>
        </div>
    `;
    
    if (!navigator.geolocation) {
        alert("❌ Geolocation is not supported by your browser.");
        modal.querySelector('.modal-body').innerHTML = originalContent;
        return;
    }
    
    console.log("🚨 SOS: Requesting location...");
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            console.log("✅ Location obtained:", {lat, lng, accuracy});
            
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                throw new Error('Invalid coordinates received');
            }
            
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
                console.log('👤 User Name:', getUserName());
                console.log('🌐 Backend URL:', `${window.BACKEND_URL}/send-alert`);
                console.log('🌐 Current page URL:', window.location.href);
                
                // Add timeout and better error handling
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                
                const response = await fetch(`${window.BACKEND_URL}/send-alert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        lat: lat, 
                        lng: lng, 
                        accuracy: accuracy,
                        user_name: getUserName() // Include user name
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                console.log('📨 Response status:', response.status);
                console.log('📨 Response ok:', response.ok);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ HTTP Error Response:', errorText);
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                }
                
                const data = await response.json();
                console.log('📦 Full response from backend:', data);
                
                if (response.ok) {
                    console.log("✅ SOS Alert sent successfully:", data);
                    
                    // Show simple success alert
                    alert(`🚨 SOS Alert Sent!\nAlert ID: ${data.alert_id}\nEmergency services notified`);
                    
                    // Enhanced check for emergency suggestions
                    if (!data.emergency_suggestions) {
                        console.error('⚠️ WARNING: No emergency_suggestions in response!');
                        console.error('📦 Full response structure:', Object.keys(data));
                        
                        modal.querySelector('.modal-body').innerHTML = `
                            <div style="text-align:center; padding:20px;">
                                <div style="background:#d4edda; color:#155724; padding:15px; border-radius:8px; margin-bottom:20px;">
                                    <h3>🚨 SOS ALERT SENT!</h3>
                                    <p>Alert ID: ${data.alert_id}<br>Time: ${data.timestamp}</p>
                                </div>
                                <div style="background:#fff3cd; color:#856404; padding:15px; border-radius:6px; margin-bottom:15px;">
                                    <p><strong>⚠️ Emergency services data not available</strong></p>
                                    <p>Your alert has been sent to emergency responders.</p>
                                    <p><strong>Call 112 for immediate assistance</strong></p>
                                </div>
                                <button onclick="closeModal(null, 'sos-modal')" class="primary-btn">Close</button>
                            </div>
                        `;
                        return;
                    }
                    
                    console.log("📋 About to call displayEmergencySuggestions...");
                    console.log("📊 Emergency suggestions structure:", Object.keys(data.emergency_suggestions));
                    console.log("📊 Hospitals count:", data.emergency_suggestions.hospitals?.length || 0);
                    console.log("📊 Police count:", data.emergency_suggestions.police_stations?.length || 0);
                    
                    try {
                        displayEmergencySuggestions(data.emergency_suggestions, data.alert_id, lat, lng, data.timestamp);
                        console.log("✅ displayEmergencySuggestions called successfully");
                    } catch (displayError) {
                        console.error("❌ Error in displayEmergencySuggestions:", displayError);
                        console.error("❌ Error stack:", displayError.stack);
                        alert(`❌ Error displaying emergency services: ${displayError.message}`);
                    }
                } else {
                    throw new Error(data.error || 'Failed to send SOS');
                }
                
            } catch (error) {
                console.error("❌ Error sending SOS:", error);
                console.error("❌ Error type:", error.name);
                console.error("❌ Error message:", error.message);
                modal.querySelector('.modal-body').innerHTML = originalContent;
                
                let errorMessage = `❌ Error sending SOS alert: ${error.message}`;
                
                // Provide specific error messages based on error type
                if (error.name === 'AbortError') {
                    errorMessage += `\\n\\n⏱️ Request timed out after 30 seconds.\\n\\nPlease check:\\n- Internet connection\\n- Backend server is running\\n- No firewall blocking the connection`;
                } else if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
                    errorMessage = `❌ Connection failed to backend server.\\n\\n🔗 This usually means:\\n- Backend server is not running\\n- CORS policy blocking the request\\n- Network connectivity issues\\n\\n🛠️ Solutions:\\n1. Make sure backend is running\\n2. Check if ${window.BACKEND_URL} is accessible\\n3. Try refreshing the page\\n4. Check browser console for more details`;
                } else if (error.message.includes('NetworkError')) {
                    errorMessage += `\\n\\n🌐 Network error occurred.\\n\\nPlease check your internet connection and try again.`;
                } else {
                    errorMessage += `\\n\\nPlease check:\\n- Internet connection\\n- Backend server is running\\n- Backend is accessible at ${window.BACKEND_URL}`;
                }
                
                alert(errorMessage);
            }
        },
        (error) => {
            console.error("❌ Geolocation error:", error);
            modal.querySelector('.modal-body').innerHTML = originalContent;
            
            let errorMessage = "Unable to get your location.";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += " Location permission denied.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += " Location information unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage += " Location request timed out.";
                    break;
                default:
                    errorMessage += " Error: " + error.message;
            }
            alert(errorMessage);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

function displayEmergencySuggestions(suggestions, alertId, lat, lng, timestamp) {
    console.log('🚀 displayEmergencySuggestions CALLED');
    console.log('📦 Suggestions:', suggestions);
    console.log('📋 Alert ID:', alertId);
    console.log('📍 Location:', lat, lng);
    console.log('⏰ Timestamp:', timestamp);
    
    try {
        // Close the original SOS modal
        const sosModal = document.getElementById('sos-modal');
        if (sosModal) {
            sosModal.classList.remove('active');
            console.log('✅ Original SOS modal closed');
        }
        
        // Open the emergency suggestions modal
        const emergencyModal = document.getElementById('emergency-suggestions-modal');
        const emergencyBody = document.getElementById('emergency-suggestions-body');
        
        console.log('🔍 Emergency modal element:', emergencyModal);
        console.log('🔍 Emergency body element:', emergencyBody);
        console.log('🔍 Modal computed style:', window.getComputedStyle(emergencyModal));
        
        if (!emergencyModal || !emergencyBody) {
            console.error('❌ Emergency modal elements not found!');
            console.error('Available elements with emergency in ID:', 
                Array.from(document.querySelectorAll('[id*="emergency"]')).map(el => el.id));
            alert('❌ ERROR: Emergency modal not found in DOM!');
            return;
        }
        
        // Validate suggestions
        if (!suggestions || typeof suggestions !== 'object') {
            console.warn('⚠️ Invalid suggestions data:', suggestions);
            emergencyBody.innerHTML = `
                <div style="padding:20px; text-align:center;">
                    <h3>🚨 SOS ALERT SENT!</h3>
                    <p>Alert ID: ${alertId}</p>
                    <p>Emergency services have been notified.</p>
                    <button onclick="closeEmergencySuggestionsModal()" class="primary-btn">Close</button>
                </div>
            `;
            emergencyModal.classList.add('active');
            emergencyModal.style.display = 'flex';
            return;
        }
        
        console.log('🔨 Building emergency suggestions HTML...');
        console.log('📊 Data breakdown:', {
            hospitals: suggestions.hospitals?.length || 0,
            police: suggestions.police_stations?.length || 0,
            mechanics: suggestions.mechanics?.length || 0,
            safePlace: suggestions.hotels_restrooms?.length || 0,
            tips: suggestions.emergency_tips?.length || 0
        });
        
        let suggestionsHTML = `
            <div style="max-height:70vh; overflow-y:auto; padding:20px;">
                <div style="background:#d4edda; color:#155724; padding:15px; border-radius:8px; margin-bottom:15px; text-align:center;">
                    <h3>✅ SOS ALERT SENT SUCCESSFULLY!</h3>
                    <p>Alert ID: ${alertId} | Time: ${timestamp}</p>
                    <p>📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                </div>
                
                <div style="background:#fff3cd; color:#856404; padding:15px; border-radius:6px; margin-bottom:20px;">
                    <h4><i class="fa-solid fa-robot"></i> AI Emergency Assistance</h4>
                    <p>Click <strong>"Call"</strong> or <strong>"Navigate"</strong> buttons below for immediate assistance.</p>
                </div>
        `;
        
        // Add hospitals
        if (suggestions.hospitals && suggestions.hospitals.length > 0) {
            suggestionsHTML += `<h4 style="color:#dc3545; margin:20px 0 10px 0;"><i class="fa-solid fa-hospital"></i> Nearby Hospitals (${suggestions.hospitals.length})</h4>`;
            suggestions.hospitals.forEach(hospital => {
                suggestionsHTML += `
                    <div style="border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:8px; background:#fff;">
                        <div style="font-weight:600; color:#dc3545; font-size:16px;">${hospital.name}</div>
                        <div style="font-size:13px; color:#666; margin:5px 0;">${hospital.address}</div>
                        <div style="font-size:13px; margin:8px 0;">
                            <span style="color:#28a745; font-weight:600;">📞 ${hospital.phone}</span>
                            <span style="margin-left:15px; color:#6c757d;">📍 ${hospital.distance}</span>
                        </div>
                        ${hospital.specialties ? `<div style="font-size:12px; color:#007bff; margin:5px 0;">🏥 ${hospital.specialties.join(', ')}</div>` : ''}
                        <div style="margin-top:12px; display:flex; gap:10px;">
                            <button onclick="callEmergencyService('${hospital.phone.replace(/'/g, "\\'")}');" 
                                    style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-phone"></i> Call Now
                            </button>
                            <button onclick="navigateToEmergencyService('${hospital.name.replace(/'/g, "\\'")}', ${hospital.lat || lat}, ${hospital.lng || lng}, ${lat}, ${lng});" 
                                    style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-route"></i> Navigate
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        // Add police stations
        if (suggestions.police_stations && suggestions.police_stations.length > 0) {
            suggestionsHTML += `<h4 style="color:#007bff; margin:20px 0 10px 0;"><i class="fa-solid fa-shield-halved"></i> Police Stations (${suggestions.police_stations.length})</h4>`;
            suggestions.police_stations.forEach(police => {
                suggestionsHTML += `
                    <div style="border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:8px; background:#fff;">
                        <div style="font-weight:600; color:#007bff; font-size:16px;">${police.name}</div>
                        <div style="font-size:13px; color:#666; margin:5px 0;">${police.address}</div>
                        <div style="font-size:13px; margin:8px 0;">
                            <span style="color:#28a745; font-weight:600;">📞 ${police.phone}</span>
                            <span style="margin-left:15px; color:#6c757d;">📍 ${police.distance}</span>
                        </div>
                        <div style="font-size:12px; color:#007bff; margin:5px 0;">👮 ${police.type}</div>
                        <div style="margin-top:12px; display:flex; gap:10px;">
                            <button onclick="callEmergencyService('${police.phone.replace(/'/g, "\\'")}');" 
                                    style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-phone"></i> Call Now
                            </button>
                            <button onclick="navigateToEmergencyService('${police.name.replace(/'/g, "\\'")}', ${police.lat || lat}, ${police.lng || lng}, ${lat}, ${lng});" 
                                    style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-route"></i> Navigate
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        // Add mechanics
        if (suggestions.mechanics && suggestions.mechanics.length > 0) {
            suggestionsHTML += `<h4 style="color:#fd7e14; margin:20px 0 10px 0;"><i class="fa-solid fa-wrench"></i> Emergency Mechanics (${suggestions.mechanics.length})</h4>`;
            suggestions.mechanics.forEach(mechanic => {
                suggestionsHTML += `
                    <div style="border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:8px; background:#fff;">
                        <div style="font-weight:600; color:#fd7e14; font-size:16px;">${mechanic.name}</div>
                        <div style="font-size:13px; color:#666; margin:5px 0;">${mechanic.address}</div>
                        <div style="font-size:13px; margin:8px 0;">
                            <span style="color:#28a745; font-weight:600;">📞 ${mechanic.phone}</span>
                            <span style="margin-left:15px; color:#6c757d;">📍 ${mechanic.distance}</span>
                        </div>
                        ${mechanic.services ? `<div style="font-size:12px; color:#fd7e14; margin:5px 0;">🔧 ${mechanic.services.join(', ')}</div>` : ''}
                        <div style="margin-top:12px; display:flex; gap:10px;">
                            <button onclick="callEmergencyService('${mechanic.phone.replace(/'/g, "\\'")}');" 
                                    style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-phone"></i> Call Now
                            </button>
                            <button onclick="navigateToEmergencyService('${mechanic.name.replace(/'/g, "\\'")}', ${mechanic.lat || lat}, ${mechanic.lng || lng}, ${lat}, ${lng});" 
                                    style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-route"></i> Navigate
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        // Add safe places
        if (suggestions.hotels_restrooms && suggestions.hotels_restrooms.length > 0) {
            suggestionsHTML += `<h4 style="color:#6f42c1; margin:20px 0 10px 0;"><i class="fa-solid fa-bed"></i> Safe Places (${suggestions.hotels_restrooms.length})</h4>`;
            suggestions.hotels_restrooms.forEach(place => {
                suggestionsHTML += `
                    <div style="border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:8px; background:#fff;">
                        <div style="font-weight:600; color:#6f42c1; font-size:16px;">${place.name}</div>
                        <div style="font-size:13px; color:#666; margin:5px 0;">${place.address}</div>
                        <div style="font-size:13px; margin:8px 0;">
                            <span style="color:#28a745; font-weight:600;">📞 ${place.phone}</span>
                            <span style="margin-left:15px; color:#6c757d;">📍 ${place.distance}</span>
                        </div>
                        ${place.amenities ? `<div style="font-size:12px; color:#6f42c1; margin:5px 0;">🏨 ${place.amenities.join(', ')}</div>` : ''}
                        <div style="margin-top:12px; display:flex; gap:10px;">
                            <button onclick="callEmergencyService('${place.phone.replace(/'/g, "\\'")}');" 
                                    style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-phone"></i> Call Now
                            </button>
                            <button onclick="navigateToEmergencyService('${place.name.replace(/'/g, "\\'")}', ${place.lat || lat}, ${place.lng || lng}, ${lat}, ${lng});" 
                                    style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:5px; font-size:12px; cursor:pointer; font-weight:600;">
                                <i class="fa-solid fa-route"></i> Navigate
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        // Add emergency tips
        if (suggestions.emergency_tips && suggestions.emergency_tips.length > 0) {
            suggestionsHTML += `
                <h4 style="color:#20c997; margin:20px 0 10px 0;"><i class="fa-solid fa-lightbulb"></i> Emergency Safety Tips</h4>
                <div style="background:#e8f5e8; padding:15px; border-radius:8px; border-left:4px solid #20c997;">
                    <ul style="margin:0; padding-left:20px; font-size:14px; color:#495057; line-height:1.6;">
            `;
            suggestions.emergency_tips.forEach(tip => {
                suggestionsHTML += `<li style="margin-bottom:8px;">${tip}</li>`;
            });
            suggestionsHTML += `</ul></div>`;
        }
        
        suggestionsHTML += `
                <div style="text-align:center; margin-top:25px; padding:20px; border-top:2px solid #dee2e6; background:#f8f9fa;">
                    <p style="margin:0 0 15px 0; font-size:14px; color:#666; font-weight:600;">
                        📋 Emergency services found and ready to assist
                    </p>
                    <button onclick="closeEmergencySuggestionsModal()" class="primary-btn" style="padding:12px 25px; font-size:16px; font-weight:600;">
                        <i class="fa-solid fa-check"></i> Close Emergency Assistance
                    </button>
                </div>
            </div>
        `;
        
        console.log('📝 Setting modal content...');
        emergencyBody.innerHTML = suggestionsHTML;
        
        // Show the modal with enhanced visibility
        console.log('👁️ Showing emergency modal...');
        emergencyModal.classList.add('active');
        emergencyModal.style.display = 'flex';
        emergencyModal.style.zIndex = '99999';
        emergencyModal.style.position = 'fixed';
        emergencyModal.style.top = '0';
        emergencyModal.style.left = '0';
        emergencyModal.style.width = '100%';
        emergencyModal.style.height = '100%';
        
        // Add click handler to close modal when clicking outside
        emergencyModal.onclick = function(event) {
            if (event.target === emergencyModal) {
                closeEmergencySuggestionsModal();
            }
        };
        
        // Force scroll to top
        emergencyBody.scrollTop = 0;
        
        console.log('✅ Emergency suggestions displayed successfully');
        console.log('📊 Modal state:', {
            isActive: emergencyModal.classList.contains('active'),
            display: emergencyModal.style.display,
            zIndex: emergencyModal.style.zIndex
        });
        
    } catch (error) {
        console.error('❌ Error in displayEmergencySuggestions:', error);
        console.error('❌ Error stack:', error.stack);
        alert(`❌ Error displaying emergency services: ${error.message}\\n\\nPlease check the browser console for details.`);
    }
}

window.closeEmergencySuggestionsModal = function() {
    console.log('🚪 Closing emergency suggestions modal');
    const emergencyModal = document.getElementById('emergency-suggestions-modal');
    emergencyModal.classList.remove('active');
    emergencyModal.style.display = 'none';
    console.log('✅ Emergency suggestions modal closed');
};

window.callEmergencyService = function(phoneNumber) {
    console.log(`📞 Calling emergency service: ${phoneNumber}`);
    const confirmed = confirm(`📞 Call Emergency Service?\\n\\nNumber: ${phoneNumber}\\n\\nThis will open your phone's dialer.`);
    if (confirmed) {
        try {
            window.open(`tel:${phoneNumber}`, '_self');
            console.log(`✅ Call initiated to: ${phoneNumber}`);
        } catch (error) {
            console.error('❌ Error initiating call:', error);
            alert(`📞 Could not open dialer. Please dial: ${phoneNumber}`);
        }
    }
};

window.navigateToEmergencyService = function(serviceName, serviceLat, serviceLng, userLat, userLng) {
    console.log(`🗺️ Navigating to: ${serviceName}`);
    console.log(`📍 Service GPS: ${serviceLat}, ${serviceLng}`);
    console.log(`📍 User GPS: ${userLat}, ${userLng}`);
    
    const confirmed = confirm(`🗺️ Navigate to Emergency Service?\\n\\n${serviceName}\\n\\nThis will show directions on the map using exact GPS coordinates.`);
    
    if (confirmed) {
        try {
            closeEmergencySuggestionsModal();
            
            if (!directionsService) {
                directionsService = new google.maps.DirectionsService();
            }
            
            // ✅ FIX: Use exact GPS coordinates instead of address
            const request = {
                origin: new google.maps.LatLng(userLat, userLng),
                destination: new google.maps.LatLng(serviceLat, serviceLng),  // ✅ GPS COORDINATES
                travelMode: google.maps.TravelMode.DRIVING
            };
            
            directionsService.route(request, (result, status) => {
                if (status === 'OK') {
                    if (rendererArray) {
                        rendererArray.forEach(renderer => renderer.setMap(null));
                        rendererArray = [];
                    }
                    
                    const emergencyRenderer = new google.maps.DirectionsRenderer({
                        map: map,
                        directions: result,
                        polylineOptions: {
                            strokeColor: '#dc3545',
                            strokeOpacity: 1.0,
                            strokeWeight: 6
                        }
                    });
                    
                    rendererArray = [emergencyRenderer];
                    map.fitBounds(result.routes[0].bounds);
                    
                    console.log(`✅ Navigation set up for ${serviceName}`);
                    console.log(`📏 Distance: ${result.routes[0].legs[0].distance.text}`);
                    console.log(`⏱️ Duration: ${result.routes[0].legs[0].duration.text}`);
                } else {
                    console.error('❌ Directions request failed:', status);
                    // Fallback: Open in Google Maps app with GPS coordinates
                    const googleMapsUrl = `https://maps.google.com/maps?saddr=${userLat},${userLng}&daddr=${serviceLat},${serviceLng}`;
                    alert(`⚠️ Unable to show route in map.\\nOpening Google Maps...`);
                    window.open(googleMapsUrl, '_blank');
                }
            });
            
        } catch (error) {
            console.error('❌ Navigation error:', error);
            alert(`❌ Navigation Error: ${error.message}`);
        }
    }
};

/* --- 6. Community Feedback --- */
window.submitFeedback = async function() {
    const type = document.getElementById('feedback-type').value;
    const desc = document.getElementById('feedback-desc').value.trim();
   
    if (!desc) {
        alert('⚠️ Please add a description for your report.');
        return;
    }
   
    if (!navigator.geolocation) {
        alert('❌ GPS is required for location reporting.');
        return;
    }
   
    try {
        const position = await getPosition();
        const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
       
        const response = await fetch(`${window.BACKEND_URL}/post-feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat: coords.lat,
                lng: coords.lng,
                type: type,
                description: desc,
                user_name: getUserName() // Include user name
            })
        });
        
        console.log('📡 Feedback sent with user name:', getUserName());
       
        if (response.ok) {
            const data = await response.json();
            closeModal(null, 'community-modal');
            document.getElementById('feedback-desc').value = '';
            alert(`✅ Feedback #${data.id} submitted successfully!`);
        } else {
            throw new Error('Failed to submit feedback');
        }
       
    } catch (error) {
        console.error('Feedback Submit Error:', error);
        alert('❌ Could not submit feedback. Please try again.');
    }
};

function getPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

/* --- 7. Visual Helpers --- */
function updateFeedbackListUI() {
    const list = document.getElementById("feedback-list");
   
    if (!allFeedbacks || allFeedbacks.length === 0) {
        list.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #999;">
                <h3>No Recent Reports</h3>
                <p>Community reports will appear here</p>
            </div>
        `;
        return;
    }
   
    list.innerHTML = allFeedbacks.slice(0, 10).map(fb => {
        const config = feedbackConfig[fb.type] || feedbackConfig.other;
        return `
            <div class="feedback-item" onclick="focusOnFeedback(${fb.lat}, ${fb.lng})">
                <div style="display: flex; gap: 12px; padding: 12px;">
                    <span style="font-size: 18px; color: ${config.color};"><i class="${config.icon}"></i></span>
                    <div>
                        <div style="font-weight: 600; color: ${config.color};">${config.label}</div>
                        <div style="font-size: 13px; color: #666;">${fb.description || 'Issue reported'}</div>
                        <div style="font-size: 11px; color: #999;"><i class="fa-solid fa-location-dot"></i> ${fb.lat.toFixed(4)}, ${fb.lng.toFixed(4)}</div>
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
        strokeWeight: 1
      }
    });
    
    marker.addListener("mouseover", () => {
      infoWindow.setContent(`<div><b>${inc.type.toUpperCase()}</b><br>${inc.description}</div>`);
      infoWindow.open(map, marker);
    });
    
    crimeMarkers.push({ marker });
  });
}

function clearCrimeVisualization() {
  crimeMarkers.forEach((m) => m.marker.setMap(null));
  crimeMarkers = [];
}

function clearHospitalsAndPolice() {
  hospitalMarkers.forEach((m) => {
    if (m.marker) m.marker.setMap(null);
    if (m.infoWindow) m.infoWindow.close();
  });
  policeMarkers.forEach((m) => {
    if (m.marker) m.marker.setMap(null);
    if (m.infoWindow) m.infoWindow.close();
  });
  hospitalMarkers = [];
  policeMarkers = [];
}

function showHospitalsAndPolice(routeData) {
  // Clear existing markers first
  clearHospitalsAndPolice();
  
  if (!routeData) return;
  
  // Display hospitals
  if (routeData.hospital_locations && routeData.hospital_locations.length > 0) {
    console.log(`🏥 Displaying ${routeData.hospital_locations.length} hospitals on map`);
    
    routeData.hospital_locations.forEach((hospital) => {
      const marker = new google.maps.Marker({
        position: { lat: hospital.lat, lng: hospital.lng },
        map: map,
        title: hospital.name || 'Hospital',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#dc3545', // Red for hospitals
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        label: {
          text: 'H',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 'bold'
        }
      });
      
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 250px;">
            <h4 style="margin: 0 0 8px 0; color: #dc3545; font-size: 16px;">
              <i class="fa-solid fa-hospital"></i> ${hospital.name || 'Hospital'}
            </h4>
            <p style="margin: 4px 0; font-size: 13px; color: #666;">${hospital.address || 'Address not available'}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #28a745; font-weight: 600;">
              <i class="fa-solid fa-phone"></i> ${hospital.phone || 'Emergency: 112'}
            </p>
            ${hospital.distance ? `<p style="margin: 4px 0; font-size: 12px; color: #999;"><i class="fa-solid fa-ruler"></i> ${hospital.distance} from route</p>` : ''}
            <button onclick="navigateToEmergencyService('${(hospital.name || 'Hospital').replace(/'/g, "\\'")}', ${hospital.lat}, ${hospital.lng}, ${map.getCenter().lat()}, ${map.getCenter().lng()});" 
                    style="margin-top: 8px; background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">
              <i class="fa-solid fa-route"></i> Navigate
            </button>
          </div>
        `
      });
      
      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
      
      hospitalMarkers.push({ marker, infoWindow });
    });
  }
  
  // Display police stations
  if (routeData.police_locations && routeData.police_locations.length > 0) {
    console.log(`👮 Displaying ${routeData.police_locations.length} police stations on map`);
    
    routeData.police_locations.forEach((police) => {
      const marker = new google.maps.Marker({
        position: { lat: police.lat, lng: police.lng },
        map: map,
        title: police.name || 'Police Station',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#007bff', // Blue for police
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        label: {
          text: 'P',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 'bold'
        }
      });
      
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 250px;">
            <h4 style="margin: 0 0 8px 0; color: #007bff; font-size: 16px;">
              <i class="fa-solid fa-shield-halved"></i> ${police.name || 'Police Station'}
            </h4>
            <p style="margin: 4px 0; font-size: 13px; color: #666;">${police.address || 'Address not available'}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #28a745; font-weight: 600;">
              <i class="fa-solid fa-phone"></i> ${police.phone || 'Emergency: 100'}
            </p>
            ${police.distance ? `<p style="margin: 4px 0; font-size: 12px; color: #999;"><i class="fa-solid fa-ruler"></i> ${police.distance} from route</p>` : ''}
            <button onclick="navigateToEmergencyService('${(police.name || 'Police Station').replace(/'/g, "\\'")}', ${police.lat}, ${police.lng}, ${map.getCenter().lat()}, ${map.getCenter().lng()});" 
                    style="margin-top: 8px; background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">
              <i class="fa-solid fa-route"></i> Navigate
            </button>
          </div>
        `
      });
      
      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
      
      policeMarkers.push({ marker, infoWindow });
    });
  }
  
  console.log(`✅ Displayed ${hospitalMarkers.length} hospitals and ${policeMarkers.length} police stations`);
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
    
    const marker = new google.maps.Marker({
        position: { lat: fb.lat, lng: fb.lng },
        map: map,
        title: `${config.label}: ${fb.description}`,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: config.color,
            fillOpacity: 0.8,
            strokeColor: "white",
            strokeWeight: 2
        }
    });
   
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 10px;">
                <h4><i class="${config.icon}" style="color: ${config.color};"></i> ${config.label}</h4>
                <p>${fb.description || 'No description'}</p>
                <small><i class="fa-solid fa-location-dot"></i> ${fb.lat.toFixed(6)}, ${fb.lng.toFixed(6)}</small>
            </div>
        `
    });
   
    marker.addListener("click", () => {
        infoWindow.open(map, marker);
    });
   
    feedbackMarkers.push({ marker, infoWindow });
}

window.focusOnFeedback = function(lat, lng) {
    map.panTo({ lat, lng });
    map.setZoom(16);
};

/* --- 8. Loading Animation --- */
function startLoadingAnimation() {
  document.getElementById("loading").style.display = "block";
}

function stopLoadingAnimation() {
  document.getElementById("loading").style.display = "none";
}

/* --- 9. Modal Logic --- */
window.openModal = function (id) {
  const modal = document.getElementById(id);
  modal.classList.add("active");
  
  modal.onclick = function(e) {
    if (e.target === modal) {
      closeModal(e, id);
    }
  };
  
  if (id === "community-modal") updateFeedbackListUI();
};

window.closeModal = function (e, id) {
  const modal = document.getElementById(id);
  
  if (!e || e.target.id === id || e.target.classList.contains("close-btn")) {
    modal.classList.remove("active");
  }
};

/* --- 10. Utility Functions --- */
window.fetchFeedbackForRoute = function () {
  fetch(`${window.BACKEND_URL}/get-feedback`)
    .then((r) => r.json())
    .then((d) => {
      allFeedbacks = d;
      clearFeedback();
      d.forEach(fb => addFeedbackMarker(fb));
      updateFeedbackListUI();
    })
    .catch((e) => console.log(e));
};

window.clearAllData = async function () {
    const confirmed = confirm("🗑️ Permanently delete all SOS alerts and community feedback? This cannot be undone.");
    
    if (confirmed) {
        try {
            console.log('🗑️ Clearing all data...');
            console.log('📡 Sending POST to /clear-all-data endpoint');
            
            const response = await fetch(`${window.BACKEND_URL}/clear-all-data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation: "DELETE_ALL_DATA" })  // ✅ FIX: Use 'confirmation'
            });
            
            console.log('📨 Response status:', response.status);
            console.log('📨 Response ok:', response.ok);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Data cleared successfully:', result);
                
                // Clear local data immediately (don't wait for socket event)
                allFeedbacks = [];
                clearFeedback();
                clearCrimeVisualization();
                clearHospitalsAndPolice(); // Clear hospital and police markers
                updateFeedbackListUI();
                
                // Clear displayed routes
                rendererArray.forEach((r) => r.setMap(null));
                rendererArray = [];
                currentRoutes = [];
                
                // Clear route cards
                const container = document.getElementById("routes-list");
                if (container) container.innerHTML = "";
                
                alert(`✅ All data cleared successfully!\n${result.sos_deleted} alerts & ${result.feedback_deleted} reports deleted`);
                
                console.log('✅ Local UI cleared successfully');
                
            } else {
                const error = await response.json();
                console.error('❌ Clear data failed:', error);
                alert(`❌ Failed to clear data: ${error.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('❌ Clear data error:', error);
            alert(`❌ Error clearing data: ${error.message}\\n\\nPlease check if the backend server is running.`);
        }
    }
};

window.toggleNightMode = function () {
  document.body.classList.toggle("night-mode");
};

window.toggleMobileSidebar = function () {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
  
  // Prevent body scroll when sidebar is open
  if (sidebar.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
};

window.testBackendConnection = async function() {
    console.log('🧪 Testing backend connection...');
    
    try {
        console.log('🌐 Current page URL:', window.location.href);
        console.log('🌐 Testing connection to:', `${window.BACKEND_URL}/ai-status`);
        
        const response = await fetch(`${window.BACKEND_URL}/ai-status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('📨 Response status:', response.status);
        console.log('📨 Response ok:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connection successful!', data);
            alert(`✅ Backend Connection Test Successful!\\n\\nGroq AI: ${data.groq_configured ? 'Available' : 'Not Available'}\\nGoogle Places API: ${data.google_places_available ? 'Available' : 'Not Available'}\\n\\nPrimary AI: ${data.primary_ai}`);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Backend connection test failed:', error);
        
        let errorMessage = `❌ Backend Connection Test Failed:\\n\\n${error.message}`;
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += `\\n\\n🔗 This means the backend server is not accessible.\\n\\n🛠️ Solutions:\\n1. Make sure backend is running\\n2. Check if ${window.BACKEND_URL} is accessible in browser\\n3. Check for CORS or firewall issues\\n4. Try restarting the backend server`;
        }
        
        alert(errorMessage);
    }
};

console.log("✅ SafeRoute JavaScript with Safety-Based Route Colors loaded successfully");

/* --- User Management --- */
let currentUserName = null;

// Check if user has a saved name, if not show welcome modal
window.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 SafeRoute: Page loaded, checking user name...');
    
    // Check for saved user name
    const savedName = localStorage.getItem('saferoute_user_name');
    
    if (savedName && savedName.trim()) {
        currentUserName = savedName.trim();
        console.log(`👤 Welcome back, ${currentUserName}!`);
        
        // Update navbar to show user name
        updateNavbarWithUserName();
    } else {
        console.log('👤 New user detected, showing welcome modal...');
        // Show welcome modal after a short delay
        setTimeout(() => {
            showWelcomeModal();
        }, 500);
    }
});

function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    // Focus on input field
    const input = document.getElementById('user-name-input');
    setTimeout(() => input.focus(), 300);
    
    // Handle Enter key
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveUserName();
        }
    });
    
    // Prevent closing by clicking outside
    modal.onclick = function(e) {
        e.stopPropagation();
    };
}

window.saveUserName = function() {
    const input = document.getElementById('user-name-input');
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter your name to continue');
        input.focus();
        return;
    }
    
    if (name.length < 2) {
        alert('Please enter a valid name (at least 2 characters)');
        input.focus();
        return;
    }
    
    // Save name locally
    localStorage.setItem('saferoute_user_name', name);
    currentUserName = name;
    
    console.log(`✅ User name saved: ${currentUserName}`);
    
    // Close welcome modal
    const modal = document.getElementById('welcome-modal');
    modal.classList.remove('active');
    modal.style.display = 'none';
    
    // Update navbar
    updateNavbarWithUserName();
    
    // Show success message
    setTimeout(() => {
        alert(`Welcome to SafeRoute, ${currentUserName}! 🛡️\n\nYour safety is our priority. In case of emergency, your name will help responders assist you better.`);
    }, 500);
};

function updateNavbarWithUserName() {
    if (!currentUserName) return;
    
    // Add user name to navbar
    const navActions = document.querySelector('.nav-actions');
    
    // Remove existing user button if any
    const existingUserBtn = document.querySelector('.user-name-btn');
    if (existingUserBtn) {
        existingUserBtn.remove();
    }
    
    // Create user name button
    const userBtn = document.createElement('button');
    userBtn.className = 'nav-btn user-name-btn';
    userBtn.style.background = 'var(--accent)';
    userBtn.style.color = 'white';
    userBtn.title = 'Change Name';
    userBtn.onclick = changeUserName;
    
    userBtn.innerHTML = `<i class="fa-solid fa-user"></i> <span class="user-name-text">${currentUserName}</span>`;
    
    // Insert before the last button (theme toggle)
    const themeBtn = navActions.querySelector('.icon-only');
    navActions.insertBefore(userBtn, themeBtn);
}

window.changeUserName = function() {
    const newName = prompt(`Change your name:\n\nCurrent: ${currentUserName}`, currentUserName);
    
    if (newName && newName.trim() && newName.trim() !== currentUserName) {
        const trimmedName = newName.trim();
        
        if (trimmedName.length < 2) {
            alert('Please enter a valid name (at least 2 characters)');
            return;
        }
        
        localStorage.setItem('saferoute_user_name', trimmedName);
        currentUserName = trimmedName;
        
        updateNavbarWithUserName();
        alert(`✅ Name updated to: ${currentUserName}`);
        
        console.log(`👤 User name changed to: ${currentUserName}`);
    }
};

function getUserName() {
    return currentUserName || 'Anonymous User';
}