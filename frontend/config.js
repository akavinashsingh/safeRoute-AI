// Auto-detect backend URL based on environment
function getBackendUrl() {
    // Check if we're running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    
    // For production, use the deployed backend URL
    // This will be updated automatically when deployed
    return 'https://saferoute-backend-4b81.onrender.com';
}

// Export the backend URL
window.BACKEND_URL = getBackendUrl();

console.log('🌐 Backend URL configured:', window.BACKEND_URL);