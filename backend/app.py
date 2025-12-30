import eventlet
eventlet.monkey_patch()  # MUST be FIRST

import requests
import polyline
import random
import sqlite3
import json
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from math import radians, cos, sin, asin, sqrt
import traceback

# Gemini AI imports
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("⚠️ Gemini AI not available. Install with: pip install google-generativeai")

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

API_KEY = "AIzaSyDshT7uMl6hfy_sXU3YJbHcJmn2IPA1cY4"

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyDAa1KJkZpJFeSKG-3tRfWC0jwWW-9r7_M')  # Updated API key
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    try:
        # Try different model names
        model = genai.GenerativeModel('gemini-1.5-pro')
        print("✅ Gemini AI configured successfully with gemini-1.5-pro")
    except:
        try:
            model = genai.GenerativeModel('gemini-pro')
            print("✅ Gemini AI configured successfully with gemini-pro")
        except:
            try:
                model = genai.GenerativeModel('models/gemini-pro')
                print("✅ Gemini AI configured successfully with models/gemini-pro")
            except:
                model = None
                print("⚠️ Could not configure any Gemini model")
else:
    model = None
    print("⚠️ Gemini AI not configured")

# Crime Database for Route Analysis
CRIME_DATABASE = {
    'theft': {'severity': 'medium', 'icon': '💼', 'color': '#FF9800', 'description': 'Property theft or pickpocketing incident', 'recommendation': 'Keep valuables secure and be aware of surroundings', 'peak_hours': [18, 22], 'common_areas': ['markets', 'crowded places', 'public transport']},
    'robbery': {'severity': 'high', 'icon': '⚡', 'color': '#F44336', 'description': 'Armed robbery or mugging reported', 'recommendation': 'Avoid isolated areas, especially at night', 'peak_hours': [20, 4], 'common_areas': ['alleys', 'parks', 'quiet streets']},
    'vandalism': {'severity': 'low', 'icon': '🔨', 'color': '#9C27B0', 'description': 'Property damage or graffiti', 'recommendation': 'Well-lit areas are generally safer', 'peak_hours': [22, 2], 'common_areas': ['commercial areas', 'public property']},
    'assault': {'severity': 'high', 'icon': '⚠️', 'color': '#FF0000', 'description': 'Physical assault or battery', 'recommendation': 'Travel in groups when possible', 'peak_hours': [21, 3], 'common_areas': ['bars', 'nightlife areas', 'dark streets']},
    'burglary': {'severity': 'medium', 'icon': '🏠', 'color': '#795548', 'description': 'Home or vehicle break-in', 'recommendation': 'Secure your vehicle and belongings', 'peak_hours': [0, 5], 'common_areas': ['residential areas', 'parking lots']},
    'harassment': {'severity': 'medium', 'icon': '🚫', 'color': '#E91E63', 'description': 'Verbal or physical harassment', 'recommendation': 'Stay in public, well-populated areas', 'peak_hours': [17, 23], 'common_areas': ['public transport', 'streets', 'parks']},
    'accident': {'severity': 'medium', 'icon': '🚨', 'color': '#FF5722', 'description': 'Traffic or pedestrian accident', 'recommendation': 'Exercise caution when crossing streets', 'peak_hours': [8, 10, 17, 19], 'common_areas': ['intersections', 'main roads']},
    'fraud': {'severity': 'low', 'icon': '💳', 'color': '#3F51B5', 'description': 'Scam or fraudulent activity', 'recommendation': 'Be cautious with strangers offering help', 'peak_hours': [10, 18], 'common_areas': ['tourist areas', 'markets']}
}

def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in kilometers"""
    from math import radians, cos, sin, asin, sqrt
    R = 6371000  # Earth radius in meters
    dLat = radians(lat2 - lat1)
    dLon = radians(lng2 - lng1)
    a = sin(dLat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon / 2)**2
    return R * 2 * asin(sqrt(a)) / 1000  # Convert to km

def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points on the earth (specified in decimal degrees)"""
    R = 6371000  # Earth radius in meters
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    a = sin(dLat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon / 2)**2
    return R * 2 * asin(sqrt(a))  # Return in meters

def generate_realistic_crime_incidents(route_points, area_type="Urban"):
    """
    Generate crime incidents distributed AROUND the route, not on it.
    Creates a more realistic scatter pattern within a radius of the route.
    """
    if not route_points:
        return []
    
    incidents = []
    
    # Adjust crime density based on area type
    crime_density = {
        "Urban": random.randint(4, 10),
        "Main Road": random.randint(3, 7),
        "Residential": random.randint(2, 6),
        "Industrial": random.randint(5, 12),
        "Commercial": random.randint(6, 14)
    }.get(area_type, random.randint(4, 8))
    
    # Build weighted crime types list based on severity
    crime_types = []
    for crime_type, data in CRIME_DATABASE.items():
        weight = 3 if data['severity'] == 'high' else 2 if data['severity'] == 'medium' else 1
        crime_types.extend([crime_type] * weight)
    
    # Distribute crimes around the route with realistic scatter
    for _ in range(crime_density):
        crime_type = random.choice(crime_types)
        data = CRIME_DATABASE[crime_type]
        
        # Select a random point along the route
        point_idx = random.randint(0, len(route_points) - 1)
        base_lat, base_lng = route_points[point_idx]
        
        # Calculate offset distance (50m to 300m from route)
        offset_distance_km = random.uniform(0.05, 0.3)  # 50m to 300m
        
        # Random angle for circular distribution around the point
        angle = random.uniform(0, 360)
        angle_rad = radians(angle)
        
        # Convert distance to approximate lat/lng offset
        lat_offset = (offset_distance_km / 111.0) * cos(angle_rad)
        lng_offset = (offset_distance_km / (111.0 * cos(radians(base_lat)))) * sin(angle_rad)
        
        # Apply offset to create scattered distribution
        incident_lat = base_lat + lat_offset
        incident_lng = base_lng + lng_offset
        
        # Add some additional random micro-variation for natural clustering
        incident_lat += random.uniform(-0.0005, 0.0005)  # ~50m variation
        incident_lng += random.uniform(-0.0005, 0.0005)
        
        # Create incident with realistic timestamp
        hours_ago = random.randint(1, 48)
        incident_time = datetime.now() - timedelta(hours=hours_ago)
        
        incident = {
            'type': crime_type,
            'severity': data['severity'],
            'lat': incident_lat,
            'lng': incident_lng,
            'time': incident_time.isoformat(),
            'description': data['description'],
            'icon': data['icon'],
            'color': data['color'],
            'recommendation': data['recommendation'],
            'hours_ago': hours_ago,
            'distance_from_route': round(offset_distance_km * 1000)  # in meters
        }
        
        incidents.append(incident)
    
    # Sort by severity and time for better visualization
    severity_order = {'high': 0, 'medium': 1, 'low': 2}
    incidents.sort(key=lambda x: (severity_order[x['severity']], x['hours_ago']))
    
    return incidents

def estimate_street_light_score(route_points, area_type):
    """Estimate street lighting quality based on area type and time"""
    base_scores = {"Main Road": 85, "Commercial": 90, "Urban": 75, "Residential": 70, "Industrial": 60}
    base_score = base_scores.get(area_type, 75)
    current_hour = datetime.now().hour
    time_factor = 0.8 if 18 <= current_hour <= 23 or 0 <= current_hour <= 6 else 1.0
    variation = random.uniform(-10, 5)
    final_score = base_score * time_factor + variation
    return max(40, min(100, round(final_score)))

def calculate_crime_risk_score(incidents, route_points):
    """Calculate overall crime risk score for the route"""
    if not incidents or not route_points:
        return 0
    high_risk = sum(1 for i in incidents if i['severity'] == 'high')
    medium_risk = sum(1 for i in incidents if i['severity'] == 'medium')
    low_risk = sum(1 for i in incidents if i['severity'] == 'low')
    route_length = len(route_points)
    close_incidents = 0
    sample_points = route_points[:min(50, route_length)]
    for incident in incidents:
        if any(haversine(incident['lat'], incident['lng'], pt[0], pt[1]) < 100 for pt in sample_points):
            close_incidents += 1
    risk_score = (high_risk * 30 + medium_risk * 15 + low_risk * 5 + close_incidents * 10)
    return min(100, risk_score)

def calculate_final_safety_score(hospitals, police, lights, crime_risk, distance_km):
    """Calculate final safety score based on all factors"""
    hospital_score = min(hospitals * 15, 30)
    police_score = min(police * 15, 30)
    light_score = lights
    crime_penalty = max(0, 100 - crime_risk) * 0.4
    distance_penalty = max(0, 100 - (distance_km * 10)) * 0.2
    total = hospital_score + police_score + light_score * 0.3 + crime_penalty + distance_penalty
    return max(0, min(100, round(total)))

def get_safety_counts(polyline_encoded):
    """Generate safety amenity counts and locations"""
    hospitals = random.randint(1, 5)
    police = random.randint(0, 3)
    locations = {
        "hospitals": [{"lat": 17.3850 + random.uniform(-0.01, 0.01), "lng": 78.4867 + random.uniform(-0.01, 0.01)} for _ in range(hospitals)],
        "police": [{"lat": 17.3850 + random.uniform(-0.01, 0.01), "lng": 78.4867 + random.uniform(-0.01, 0.01)} for _ in range(police)]
    }
    return {"hospitals": hospitals, "police": police}, locations

def generate_safety_warnings(crime_incidents, amenities, light_score):
    """Generate safety warnings based on route analysis"""
    warnings = []
    high_crimes = [c for c in crime_incidents if c["severity"] == "high"]
    if high_crimes:
        warnings.append(f"⚠️ {len(high_crimes)} high-risk incidents reported")
    if amenities["hospitals"] == 0:
        warnings.append("🏥 No hospitals on this route")
    elif amenities["hospitals"] < 2:
        warnings.append("🏥 Limited hospital access")
    if amenities["police"] == 0:
        warnings.append("👮 No police stations nearby")
    if light_score < 60:
        warnings.append("🌙 Poor street lighting")
    elif light_score < 75:
        warnings.append("💡 Moderate lighting conditions")
    current_hour = datetime.now().hour
    if 20 <= current_hour <= 23 or 0 <= current_hour <= 6:
        if len(high_crimes) > 0 or light_score < 70:
            warnings.append("🌃 Higher risk at night - extra caution advised")
    return warnings[:3]

def get_nearby_places_with_google_api(lat, lng):
    """
    Use Google Places API (New) to find real nearby emergency services for ANY location worldwide
    """
    try:
        print(f"🌐 Searching for emergency services near {lat}, {lng} using Google Places API (New)")
        
        url = "https://places.googleapis.com/v1/places:searchNearby"
        
        headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.internationalPhoneNumber,places.types'
        }
        
        # Search for hospitals
        hospitals = []
        print(f"🏥 Searching for hospitals within 10km...")
        
        hospital_data = {
            "includedTypes": ["hospital"],
            "maxResultCount": 10,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 5000.0  # Reduced to 5km for closer results
                }
            },
            "rankPreference": "DISTANCE"  # Prioritize closest results
        }
        
        response = requests.post(url, json=hospital_data, headers=headers, timeout=10)
        print(f"🔍 Google Places API Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            places = result.get('places', [])
            print(f"📊 Google Places API returned {len(places)} hospitals")
            
            # Calculate distances and sort by proximity
            hospitals_with_distance = []
            for place in places:
                try:
                    name = place.get('displayName', {}).get('text', 'Unknown Hospital')
                    address = place.get('formattedAddress', 'Address not available')
                    phone = place.get('internationalPhoneNumber', 'Emergency: 112')
                    rating = place.get('rating', 0)
                    
                    # Calculate distance
                    place_lat = place.get('location', {}).get('latitude')
                    place_lng = place.get('location', {}).get('longitude')
                    
                    if place_lat and place_lng:
                        distance = calculate_distance(lat, lng, place_lat, place_lng)
                        distance_str = f"{distance:.1f} km"
                        
                        # Determine specialties based on types
                        specialties = ["Emergency"]
                        place_types = place.get('types', [])
                        if 'hospital' in place_types:
                            specialties.append("General Medicine")
                        if 'doctor' in place_types:
                            specialties.append("Medical Care")
                        
                        hospitals_with_distance.append({
                            "name": name,
                            "address": address,
                            "phone": phone,
                            "distance": distance_str,
                            "distance_km": distance,
                            "specialties": specialties,
                            "rating": rating
                        })
                        
                except Exception as e:
                    print(f"⚠️ Error processing hospital: {e}")
                    continue
            
            # Sort by distance and take top 5 closest
            hospitals_with_distance.sort(key=lambda x: x['distance_km'])
            hospitals = hospitals_with_distance[:5]
            
            # Remove distance_km from final output
            for hospital in hospitals:
                del hospital['distance_km']
                print(f"✅ Added hospital: {hospital['name']} - {hospital['distance']}")
                
        else:
            print(f"❌ Google Places API HTTP error: {response.status_code}")
            print(f"Response: {response.text}")
        
        # Search for police stations
        police_stations = []
        print(f"👮 Searching for police stations within 8km...")
        
        police_data = {
            "includedTypes": ["police"],
            "maxResultCount": 5,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 3000.0  # Reduced to 3km for closer results
                }
            },
            "rankPreference": "DISTANCE"  # Prioritize closest results
        }
        
        response = requests.post(url, json=police_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            places = result.get('places', [])
            print(f"📊 Google Places API returned {len(places)} police stations")
            
            for place in places[:3]:  # Get top 3 police stations
                try:
                    name = place.get('displayName', {}).get('text', 'Police Station')
                    address = place.get('formattedAddress', 'Address not available')
                    phone = place.get('internationalPhoneNumber', 'Emergency: 100')
                    
                    # Calculate distance
                    place_lat = place.get('location', {}).get('latitude')
                    place_lng = place.get('location', {}).get('longitude')
                    
                    if place_lat and place_lng:
                        distance = calculate_distance(lat, lng, place_lat, place_lng)
                        distance_str = f"{distance:.1f} km"
                    else:
                        distance_str = "Distance unknown"
                    
                    police_stations.append({
                        "name": name,
                        "address": address,
                        "phone": phone,
                        "distance": distance_str,
                        "type": "Local Police"
                    })
                    
                    print(f"✅ Added police station: {name} - {distance_str}")
                    
                except Exception as e:
                    print(f"⚠️ Error processing police station: {e}")
                    continue
        else:
            print(f"⚠️ No police stations found or API error")
        
        # Search for gas stations (as mechanics alternative)
        mechanics = []
        print(f"⛽ Searching for gas stations within 8km...")
        
        gas_data = {
            "includedTypes": ["gas_station"],
            "maxResultCount": 5,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 3000.0  # Reduced to 3km for closer results
                }
            },
            "rankPreference": "DISTANCE"  # Prioritize closest results
        }
        
        response = requests.post(url, json=gas_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            places = result.get('places', [])
            print(f"📊 Google Places API returned {len(places)} gas stations")
            
            for place in places[:3]:  # Get top 3 gas stations
                try:
                    name = place.get('displayName', {}).get('text', 'Gas Station')
                    address = place.get('formattedAddress', 'Address not available')
                    phone = place.get('internationalPhoneNumber', 'Roadside: 1073')
                    
                    # Calculate distance
                    place_lat = place.get('location', {}).get('latitude')
                    place_lng = place.get('location', {}).get('longitude')
                    
                    if place_lat and place_lng:
                        distance = calculate_distance(lat, lng, place_lat, place_lng)
                        distance_str = f"{distance:.1f} km"
                    else:
                        distance_str = "Distance unknown"
                    
                    mechanics.append({
                        "name": name,
                        "address": address,
                        "phone": phone,
                        "distance": distance_str,
                        "services": ["Fuel", "Basic Repairs", "Emergency Service"]
                    })
                    
                    print(f"✅ Added gas station: {name} - {distance_str}")
                    
                except Exception as e:
                    print(f"⚠️ Error processing gas station: {e}")
                    continue
        else:
            print(f"⚠️ No gas stations found or API error")
        
        # Search for lodging (hotels)
        hotels = []
        print(f"🏨 Searching for hotels within 8km...")
        
        hotel_data = {
            "includedTypes": ["lodging"],
            "maxResultCount": 5,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 3000.0  # Reduced to 3km for closer results
                }
            },
            "rankPreference": "DISTANCE"  # Prioritize closest results
        }
        
        response = requests.post(url, json=hotel_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            places = result.get('places', [])
            print(f"📊 Google Places API returned {len(places)} hotels")
            
            for place in places[:3]:  # Get top 3 hotels
                try:
                    name = place.get('displayName', {}).get('text', 'Hotel')
                    address = place.get('formattedAddress', 'Address not available')
                    phone = place.get('internationalPhoneNumber', 'Emergency: 112')
                    
                    # Calculate distance
                    place_lat = place.get('location', {}).get('latitude')
                    place_lng = place.get('location', {}).get('longitude')
                    
                    if place_lat and place_lng:
                        distance = calculate_distance(lat, lng, place_lat, place_lng)
                        distance_str = f"{distance:.1f} km"
                    else:
                        distance_str = "Distance unknown"
                    
                    hotels.append({
                        "name": name,
                        "address": address,
                        "phone": phone,
                        "distance": distance_str,
                        "amenities": ["Safe Space", "Reception", "Restrooms", "Security"]
                    })
                    
                    print(f"✅ Added hotel: {name} - {distance_str}")
                    
                except Exception as e:
                    print(f"⚠️ Error processing hotel: {e}")
                    continue
        else:
            print(f"⚠️ No hotels found or API error")
        
        # Return the real places data if we found at least some services
        if hospitals or police_stations or mechanics or hotels:
            print(f"✅ Google Places API found: {len(hospitals)} hospitals, {len(police_stations)} police, {len(mechanics)} mechanics, {len(hotels)} safe places")
            return {
                "hospitals": hospitals,
                "police_stations": police_stations,
                "mechanics": mechanics,
                "hotels_restrooms": hotels,
                "emergency_tips": [
                    "Stay calm and move to a well-lit, populated area immediately",
                    "Call 100 for police, 102 for ambulance, or 112 for general emergency",
                    "Share your live location with trusted contacts using WhatsApp or Google Maps",
                    "If you feel unsafe, enter the nearest shop, hotel, or public building",
                    "Keep your phone charged and emergency numbers readily accessible",
                    "Trust your instinsts - if something feels wrong, seek help immediately"
                ]
            }
        else:
            print(f"⚠️ Google Places API found no emergency services")
            return None
            
    except Exception as e:
        print(f"❌ Error fetching places from Google API: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_emergency_suggestions_with_ai(lat, lng):
    """
    Use Gemini AI to find nearby emergency services and provide safety suggestions
    """
    if not GEMINI_AVAILABLE or not model:
        return get_fallback_emergency_suggestions(lat, lng)
    
    try:
        # Create a comprehensive prompt for Gemini AI
        prompt = f"""
        EMERGENCY ASSISTANCE REQUEST - IMMEDIATE RESPONSE NEEDED
        
        Location: {lat}, {lng} (Latitude, Longitude)
        
        CRITICAL: Find the ABSOLUTE CLOSEST emergency services to these exact coordinates. 
        Distance is the TOP PRIORITY - I need the nearest possible services.
        
        Please provide ONLY the closest services within 2km radius if possible:
        
        1. HOSPITALS (3 CLOSEST ONLY):
        - Name, address, phone number, EXACT distance in km, specialties
        - SORT BY DISTANCE - closest first
        
        2. POLICE STATIONS (2 CLOSEST ONLY):
        - Name, address, phone number, EXACT distance in km, type
        - SORT BY DISTANCE - closest first
        
        3. EMERGENCY MECHANICS/GAS STATIONS (2 CLOSEST ONLY):
        - Name, address, phone number, EXACT distance in km, services
        - SORT BY DISTANCE - closest first
        
        4. SAFE PLACES/HOTELS (2 CLOSEST ONLY):
        - Name, address, phone number, EXACT distance in km, amenities
        - SORT BY DISTANCE - closest first
        
        5. IMMEDIATE SAFETY TIPS (3 tips):
        - Context-aware safety advice for this specific location
        
        Please respond in this EXACT JSON format:
        {{
            "hospitals": [
                {{"name": "Hospital Name", "address": "Full Address", "phone": "Phone", "distance": "X.X km", "specialties": ["Emergency", "Trauma"]}}
            ],
            "police_stations": [
                {{"name": "Station Name", "address": "Full Address", "phone": "Phone", "distance": "X.X km", "type": "Local Police"}}
            ],
            "mechanics": [
                {{"name": "Mechanic Name", "address": "Full Address", "phone": "Phone", "distance": "X.X km", "services": ["24/7", "Towing"]}}
            ],
            "hotels_restrooms": [
                {{"name": "Place Name", "address": "Full Address", "phone": "Phone", "distance": "X.X km", "amenities": ["Safe Space", "Restrooms"]}}
            ],
            "emergency_tips": [
                "Tip 1",
                "Tip 2", 
                "Tip 3"
            ]
        }}
        
        CRITICAL REQUIREMENTS:
        - Use REAL places near the coordinates {lat}, {lng}
        - Calculate EXACT distances from {lat}, {lng}
        - SORT ALL results by distance (closest first)
        - Include actual phone numbers when possible
        - Prioritize services within 2km radius
        - If no services within 2km, expand to 5km maximum
        """
        
        print(f"🤖 Sending emergency request to Gemini AI for location: {lat}, {lng}")
        
        # Generate response from Gemini with timeout handling
        try:
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            print(f"🤖 Gemini AI Raw Response: {response_text[:500]}...")
        except Exception as gemini_error:
            print(f"❌ Gemini AI generation failed: {gemini_error}")
            return get_fallback_emergency_suggestions(lat, lng)
        
        # Try to parse JSON from response
        try:
            # Clean up the response - remove markdown formatting if present
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            suggestions = json.loads(response_text)
            
            # Validate the structure
            required_keys = ['hospitals', 'police_stations', 'mechanics', 'hotels_restrooms', 'emergency_tips']
            for key in required_keys:
                if key not in suggestions:
                    suggestions[key] = []
            
            print(f"✅ Gemini AI suggestions parsed successfully")
            print(f"📊 Found: {len(suggestions.get('hospitals', []))} hospitals, {len(suggestions.get('police_stations', []))} police stations")
            
            return suggestions
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"Raw response: {response_text}")
            return get_fallback_emergency_suggestions(lat, lng)
            
    except Exception as e:
        print(f"❌ Gemini AI Error: {e}")
        traceback.print_exc()
        return get_fallback_emergency_suggestions(lat, lng)

def get_fallback_emergency_suggestions(lat, lng):
    """
    Fallback emergency suggestions when Gemini AI is not available
    Prioritizes Google Places API (New) for dynamic location-based results
    """
    print(f"🔄 Using fallback emergency suggestions for {lat}, {lng}")
    
    # ALWAYS try Google Places API (New) first for any location
    print(f"🌐 Attempting to find real nearby places using Google Places API (New)...")
    try:
        places_suggestions = get_nearby_places_with_google_api(lat, lng)
        if places_suggestions and places_suggestions.get('hospitals') and len(places_suggestions.get('hospitals', [])) > 0:
            print(f"✅ Found real nearby places using Google Places API (New)")
            print(f"📊 Found {len(places_suggestions.get('hospitals', []))} hospitals from Google Places")
            return places_suggestions
        else:
            print(f"⚠️ Google Places API (New) returned no hospitals or failed")
    except Exception as e:
        print(f"⚠️ Google Places API (New) failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    # Generic fallback
    return {
        "hospitals": [
            {
                "name": f"Nearest Hospital",
                "address": f"Hospital near {lat:.4f}, {lng:.4f}",
                "phone": "Emergency: 112",
                "distance": "2.5 km",
                "specialties": ["Emergency", "Trauma", "General Medicine"]
            }
        ],
        "police_stations": [
            {
                "name": f"Local Police Station",
                "address": f"Police Station near {lat:.4f}, {lng:.4f}",
                "phone": "Emergency: 100",
                "distance": "1.8 km",
                "type": "Local Police"
            }
        ],
        "mechanics": [
            {
                "name": f"24/7 Auto Service",
                "address": f"Auto Service near {lat:.4f}, {lng:.4f}",
                "phone": "Roadside: 1073",
                "distance": "1.5 km",
                "services": ["24/7 Service", "Towing", "Emergency Repairs", "Battery Jump"]
            }
        ],
        "hotels_restrooms": [
            {
                "name": f"Safe Haven Hotel",
                "address": f"Hotel near {lat:.4f}, {lng:.4f}",
                "phone": "Emergency: 112",
                "distance": "2.1 km",
                "amenities": ["24/7 Reception", "Safe Space", "Clean Restrooms", "Security"]
            }
        ],
        "emergency_tips": [
            "Stay calm and move to a well-lit, populated area immediately",
            "Call 100 for police, 102 for ambulance, or 112 for general emergency",
            "Share your live location with trusted contacts using WhatsApp or Google Maps",
            "If you feel unsafe, enter the nearest shop, hotel, or public building",
            "Keep your phone charged and emergency numbers readily accessible",
            "Trust your instincts - if something feels wrong, seek help immediately"
        ]
    }

# Database Initialization
def init_db():
    conn = sqlite3.connect('saferoute.db')
    c = conn.cursor()
   
    # Create SOS alerts table with timestamp column
    c.execute('''CREATE TABLE IF NOT EXISTS sos_alerts
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  lat REAL NOT NULL,
                  lng REAL NOT NULL,
                  timestamp DATETIME NOT NULL,
                  status TEXT DEFAULT 'PENDING')''')
   
    # Create feedback table with timestamp column
    c.execute('''CREATE TABLE IF NOT EXISTS route_feedback
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  lat REAL,
                  lng REAL,
                  type TEXT,
                  description TEXT,
                  timestamp DATETIME NOT NULL,
                  route_polyline TEXT)''')
   
    conn.commit()
    conn.close()
    print("✅ Database initialized with proper timestamp columns")

init_db()

@app.route("/send-alert", methods=["POST", "OPTIONS"])
def send_alert():
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
        
    try:
        data = request.json
        lat, lng = data.get("lat"), data.get("lng")
        if not lat or not lng:
            return jsonify({"error": "Lat/Lng required"}), 400
       
        # Get current timestamp
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
       
        conn = sqlite3.connect('saferoute.db')
        c = conn.cursor()
        c.execute("INSERT INTO sos_alerts (lat, lng, timestamp, status) VALUES (?, ?, ?, 'PENDING')",
                  (lat, lng, current_time))
        alert_id = c.lastrowid
        conn.commit()
        conn.close()

        # Enhanced logging
        print(f"\n{'='*50}")
        print(f"🚨 SOS ALERT RECEIVED")
        print(f"   ID: {alert_id}")
        print(f"   Location: ({lat}, {lng})")
        print(f"   Time: {current_time}")
        print(f"   Database: ✅ Saved")
        print(f"   Broadcasting to: 'admin' room")
        
        # 🤖 GET AI EMERGENCY SUGGESTIONS
        print(f"🤖 Requesting AI emergency assistance...")
        emergency_suggestions = get_emergency_suggestions_with_ai(lat, lng)
        print(f"✅ AI suggestions generated")
       
        # Emit to all connected admin clients with proper timestamp
        socketio.emit('new_sos_alert', {
            'id': alert_id,
            'lat': lat,
            'lng': lng,
            'time': current_time,
            'status': 'PENDING'
        }, room='admin')
       
        print(f"🚨 SOS Logged: ID={alert_id}, Location=({lat}, {lng}) at {current_time}")
        
        # Return response with AI suggestions
        return jsonify({
            "status": "success",
            "message": "SOS received by Admin Panel",
            "alert_id": alert_id,
            "timestamp": current_time,
            "emergency_suggestions": emergency_suggestions  # 🤖 AI SUGGESTIONS INCLUDED
        }), 200
    except Exception as e:
        print(f"SOS Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/get-all-alerts", methods=["GET"])
def get_all_alerts():
    try:
        status_filter = request.args.get('status', None)
        conn = sqlite3.connect('saferoute.db')
        c = conn.cursor()
       
        if status_filter:
            c.execute("SELECT id, lat, lng, timestamp, status FROM sos_alerts WHERE status = ? ORDER BY timestamp DESC",
                      (status_filter,))
        else:
            c.execute("SELECT id, lat, lng, timestamp, status FROM sos_alerts ORDER BY timestamp DESC")
       
        alerts = []
        for row in c.fetchall():
            alerts.append({
                "id": row[0],
                "lat": row[1],
                "lng": row[2],
                "time": row[3],  # This is the actual timestamp from database
                "status": row[4]
            })
       
        conn.close()
        print(f"📊 Retrieved {len(alerts)} SOS alerts")
        return jsonify(alerts)
    except Exception as e:
        print(f"Get Alerts Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/update-alert/<int:alert_id>", methods=["PUT"])
def update_alert(alert_id):
    try:
        data = request.json or {}
        status = data.get('status', 'RESOLVED')
        conn = sqlite3.connect('saferoute.db')
        c = conn.cursor()
        c.execute("UPDATE sos_alerts SET status = ? WHERE id = ?", (status, alert_id))
        if c.rowcount == 0:
            conn.close()
            return jsonify({"error": "Alert not found"}), 404
        conn.commit()
        conn.close()
        
        # Emit update to admin clients
        socketio.emit('alert_updated', {
            'id': alert_id,
            'status': status
        }, room='admin')
        
        print(f"✅ Alert {alert_id} updated to '{status}'")
        return jsonify({"status": "updated", "alert_id": alert_id})
    except Exception as e:
        print(f"Update Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get-routes", methods=["POST", "OPTIONS"])
def get_routes():
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
        
    try:
        data = request.json
        source = data.get("source")
        destination = data.get("destination")
        if not source or not destination:
            return jsonify({"error": "Source and destination required"}), 400
        
        if source.lower() == "demo":
            source = "17.3850,78.4867"
        if destination.lower() == "demo":
            destination = "17.4401,78.3489"
        
        directions_url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {"origin": source, "destination": destination, "alternatives": "true", "key": API_KEY}
        response = requests.get(directions_url, params=params).json()
        
        if response.get("status") != "OK":
            return jsonify({"error": f"Directions failed: {response.get('status')}"}), 400
        
        routes_data = []
        for route_idx, route in enumerate(response.get("routes", [])):
            leg = route["legs"][0]
            polyline_str = route["overview_polyline"]["points"]
            route_points = polyline.decode(polyline_str)
            distance_km = leg["distance"]["value"] / 1000
            area_type = "Main Road" if "highway" in route.get("summary", "").lower() else "Urban"
            
            # Generate safety data
            amenities, locations = get_safety_counts(polyline_str)
            crime_incidents = generate_realistic_crime_incidents(route_points, area_type)
            street_light_score = estimate_street_light_score(route_points, area_type)
            crime_score = calculate_crime_risk_score(crime_incidents, route_points)
            safety_score = calculate_final_safety_score(amenities["hospitals"], amenities["police"], street_light_score, crime_score, distance_km)
            
            route_data = {
                "distance": leg["distance"]["text"],
                "duration": leg["duration"]["text"],
                "distance_meters": leg["distance"]["value"],
                "duration_seconds": leg["duration"]["value"],
                "polyline": polyline_str,
                "hospital_count": amenities["hospitals"],
                "police_count": amenities["police"],
                "crime_incidents": crime_incidents,
                "hospital_locations": locations.get("hospitals", []),
                "police_locations": locations.get("police", []),
                "area_type": area_type,
                "street_light_score": street_light_score,
                "crime_score": crime_score,
                "safety_score": safety_score,
                "summary": route.get("summary", ""),
                "warnings": generate_safety_warnings(crime_incidents, amenities, street_light_score),
                "index": route_idx
            }
            routes_data.append(route_data)
        
        routes_data.sort(key=lambda x: x["safety_score"], reverse=True)
        return jsonify(routes_data)
    except Exception as e:
        print(f"Server Error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

@app.route("/post-feedback", methods=["POST", "OPTIONS"])
def post_feedback():
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
        
    try:
        if request.is_json:
            data = request.json
        else:
            data = request.form.to_dict()
       
        if not data:
            return jsonify({"error": "No data received"}), 400
       
        lat = data.get("lat")
        lng = data.get("lng")
        ftype = data.get("type")
        desc = data.get("description", "")
        polyline_str = data.get("route_polyline", "")
       
        if lat:
            try:
                lat = float(lat)
            except:
                return jsonify({"error": "Invalid latitude format"}), 400
       
        if lng:
            try:
                lng = float(lng)
            except:
                return jsonify({"error": "Invalid longitude format"}), 400
       
        if not lat or not lng or not ftype:
            return jsonify({"error": "Latitude, Longitude, and Type are required"}), 400
       
        # Get current timestamp
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
       
        conn = sqlite3.connect('saferoute.db')
        c = conn.cursor()
        c.execute("INSERT INTO route_feedback (lat, lng, type, description, route_polyline, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                  (lat, lng, ftype, desc, polyline_str, current_time))
        feedback_id = c.lastrowid
        conn.commit()
        conn.close()
       
        feedback_data = {
            'id': feedback_id,
            'lat': lat,
            'lng': lng,
            'type': ftype,
            'description': desc,
            'time': current_time
        }
       
        # Emit to all map clients (for real-time map updates)
        socketio.emit('new_feedback', feedback_data, room='global')
       
        # Emit to admin clients (for admin dashboard)
        socketio.emit('new_community_feedback', feedback_data, room='admin')
       
        print(f"💬 Feedback #{feedback_id}: {ftype} at ({lat:.4f}, {lng:.4f}) - {desc[:50]}... at {current_time}")
        return jsonify({
            "status": "success",
            "id": feedback_id,
            "timestamp": current_time
        }), 200
    except Exception as e:
        print(f"Feedback Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/get-feedback", methods=["GET"])
def get_feedback():
    try:
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        radius = request.args.get('radius', 5000, type=int)
       
        conn = sqlite3.connect('saferoute.db')
        c = conn.cursor()
        c.execute("SELECT id, lat, lng, type, description, timestamp FROM route_feedback ORDER BY timestamp DESC LIMIT 100")
        rows = c.fetchall()
       
        feedbacks = []
        for row in rows:
            if row[1] is not None and row[2] is not None:
                feedbacks.append({
                    "id": row[0],
                    "lat": row[1],
                    "lng": row[2],
                    "type": row[3],
                    "description": row[4],
                    "time": row[5]
                })
       
        conn.close()
       
        print(f"💬 Retrieved {len(feedbacks)} feedback items")
        return jsonify(feedbacks)
    except Exception as e:
        print(f"Feedback Fetch Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/clear-all-data", methods=["POST", "OPTIONS"])
def clear_all_data():
    """Clear all SOS alerts and community feedback from database"""
    
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    
    try:
        # Require confirmation token
        data = request.get_json(force=True, silent=True)
        
        if data is None:
            print("⚠️ No JSON data received")
            return jsonify({"error": "No data received"}), 400
        
        confirmation = data.get('confirm')
        print(f"🔐 Confirmation received: {confirmation}")
        
        if confirmation != 'DELETE_ALL_DATA':
            return jsonify({"error": "Confirmation token required"}), 400
        
        # Connect to database
        conn = sqlite3.connect('saferoute.db')
        c = conn.cursor()
        
        # Get counts before deletion
        try:
            c.execute("SELECT COUNT(*) FROM sos_alerts")
            sos_count = c.fetchone()[0]
        except:
            sos_count = 0
        
        try:
            c.execute("SELECT COUNT(*) FROM route_feedback")
            feedback_count = c.fetchone()[0]
        except:
            feedback_count = 0
        
        print(f"📊 Found {sos_count} SOS alerts and {feedback_count} feedback items to delete")
        
        # Delete all data
        try:
            c.execute("DELETE FROM sos_alerts")
            print("✅ SOS alerts deleted")
        except Exception as e:
            print(f"⚠️ Error deleting SOS alerts: {e}")
        
        try:
            c.execute("DELETE FROM route_feedback")
            print("✅ Feedback deleted")
        except Exception as e:
            print(f"⚠️ Error deleting feedback: {e}")
        
        # Reset auto-increment counters (handle if they don't exist)
        try:
            c.execute("DELETE FROM sqlite_sequence WHERE name='sos_alerts'")
            c.execute("DELETE FROM sqlite_sequence WHERE name='route_feedback'")
            print("✅ Auto-increment counters reset")
        except Exception as e:
            print(f"⚠️ Could not reset counters (might not exist): {e}")
        
        # Commit changes
        conn.commit()
        conn.close()
        print("✅ Database changes committed")
        
        # Prepare response
        result = {
            "status": "success",
            "message": "All data cleared successfully",
            "sos_deleted": sos_count,
            "feedback_deleted": feedback_count,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"🗑️ ALL DATA CLEARED: {sos_count} SOS alerts, {feedback_count} feedback items")
        
        # Emit socket event in background (don't block response)
        def emit_clear_event():
            try:
                socketio.emit('data_cleared', {
                    'sos_deleted': sos_count,
                    'feedback_deleted': feedback_count,
                    'timestamp': datetime.now().isoformat()
                }, broadcast=True)
                print("📡 Socket event emitted")
            except Exception as socket_err:
                print(f"⚠️ Socket emit warning: {socket_err}")
        
        # Use eventlet to emit in background
        try:
            eventlet.spawn(emit_clear_event)
        except:
            # If eventlet spawn fails, try direct emit
            try:
                socketio.emit('data_cleared', {
                    'sos_deleted': sos_count,
                    'feedback_deleted': feedback_count,
                    'timestamp': datetime.now().isoformat()
                }, broadcast=True)
            except Exception as e:
                print(f"⚠️ Could not emit socket event: {e}")
        
        return jsonify(result), 200
        
    except sqlite3.Error as db_err:
        print(f"❌ Database Error: {db_err}")
        print(traceback.format_exc())
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
        
    except ValueError as val_err:
        print(f"❌ Value Error: {val_err}")
        return jsonify({"error": f"Invalid request: {str(val_err)}"}), 400
        
    except Exception as e:
        print(f"❌ Clear Data Error: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route("/test-gemini", methods=["POST", "OPTIONS"])
def test_gemini():
    """Test endpoint for Gemini AI functionality"""
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
        
    try:
        data = request.json
        lat = data.get("lat")
        lng = data.get("lng")
        
        # Require actual coordinates - no hardcoded fallbacks
        if not lat or not lng:
            return jsonify({
                "status": "error",
                "message": "Latitude and longitude are required",
                "gemini_available": GEMINI_AVAILABLE,
                "model_configured": model is not None
            }), 400
        
        print(f"🧪 Testing Gemini AI with coordinates: {lat}, {lng}")
        
        # List available models for debugging
        if GEMINI_AVAILABLE and GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                models = genai.list_models()
                print("📋 Available Gemini models:")
                for m in models:
                    print(f"   - {m.name}")
            except Exception as e:
                print(f"⚠️ Could not list models: {e}")
        
        suggestions = get_emergency_suggestions_with_ai(lat, lng)
        
        return jsonify({
            "status": "success",
            "message": "Gemini AI test completed",
            "gemini_available": GEMINI_AVAILABLE,
            "model_configured": model is not None,
            "suggestions": suggestions
        }), 200
        
    except Exception as e:
        print(f"❌ Gemini Test Error: {e}")
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e),
            "gemini_available": GEMINI_AVAILABLE,
            "model_configured": model is not None
        }), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "service": "SafeRoute API", "timestamp": datetime.now().isoformat()})

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    print(f"\n{'🟢'*20}")
    print(f"📌 NEW CLIENT CONNECTED")
    print(f"   Client ID: {request.sid}")
    print(f"   Status: ✅ Connected to SafeRoute server")
    print(f"{'🟢'*20}\n")
    emit('status', {'msg': 'Connected to SafeRoute server'})

@socketio.on('join_admin')
def handle_join_admin():
    from flask_socketio import join_room
    join_room('admin')
    print(f"\n{'🔵'*20}")
    print(f"👨‍💼 ADMIN CLIENT CONNECTED")
    print(f"   Client ID: {request.sid}")
    print(f"   Room: 'admin'")
    print(f"   Status: ✅ Joined successfully")
    print(f"{'🔵'*20}\n")
    emit('status', {'msg': 'Joined admin room'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f"\n{'🔴'*20}")
    print(f"📌 CLIENT DISCONNECTED")
    print(f"   Client ID: {request.sid}")
    print(f"{'🔴'*20}\n")

if __name__ == "__main__":
    print("🛡️ SafeRoute Backend Starting...")
    print("🚨 SOS Alert System: Active")
    print("🤖 AI Emergency Assistant: Active")
    print("🌐 Google Places API (New): Active")
    print("🌐 API Running on: http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)