// Event Mapper - Main JavaScript functionality
let map;
let eventMarkers = L.layerGroup();
let allEventsData = [];

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function () {
    initializeMap();
    loadEventsForDate(new Date().toISOString().split('T')[0]); // Load today's events on initial load
    setupEventListeners();

    if (document.getElementById("proximity-enabled")) {
        console.log("ProximitySearch ENABLED for this map");
        window.proximitySearch = new ProximitySearch(window.map);
    } else {
        console.log("ProximitySearch DISABLED on this page");
    }
});

function initializeMap() {
    // Initialize the map - Center on Ireland as default
    map = L.map('map').setView([54.5, 15.2], 4); // Changed to Ireland center
    
    // Make map globally accessible
    window.map = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Add the markers layer group to map
    eventMarkers.addTo(map);


    // Add map click event for adding new events
    map.on('click', function (e) {
        const { lat, lng } = e.latlng;
        document.getElementById('event-lat').value = lat.toFixed(6);
        document.getElementById('event-lng').value = lng.toFixed(6);
        // Show add event modal
        const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
        modal.show();
    });
}

function loadEventsData() {
    console.log('Loading events...');
    showLoading(true);
    // Try the geojson endpoint first
    fetch('api/geojson/')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Raw API response:', data);
            console.log('Data type:', typeof data);
            console.log('Data keys:', Object.keys(data || {}));
            // Handle different response formats
            if (data && data.features && Array.isArray(data.features)) {
                // Valid GeoJSON format
                console.log('Valid GeoJSON received with', data.features.length, 'features');
                allEventsData = data.features;
                displayEventsOnMap(allEventsData);
                updateEventsCount(allEventsData.length);
                console.log(`Successfully loaded ${allEventsData.length} events`);
            } else if (data && data.error) {
                // API returned an error
                throw new Error(`API Error: ${data.error}`);
            } else if (Array.isArray(data)) {
                // API returned array of events, convert to GeoJSON
                console.log('Converting array to GeoJSON format');
                const geojsonFeatures = data.map(eventData => ({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [parseFloat(eventData.longitude || 0), parseFloat(eventData.latitude || 0)]
                    },
                    properties: eventData
                }));
                allEventsData = geojsonFeatures;
                displayEventsOnMap(allEventsData);
                updateEventsCount(allEventsData.length);
                console.log(`Successfully converted and loaded ${allEventsData.length} events`);
            } else {
                // Unexpected format, try the regular API endpoint
                console.warn('Unexpected API response format, trying regular endpoint');
                return loadEventsDataFromRegularAPI();
            }
        })
        .catch(error => {
            console.error('Error with geojson endpoint:', error);
            // Fallback to regular API
            return loadEventsDataFromRegularAPI();
        })
        .finally(() => {
            showLoading(false);
        });
}

function loadEventsForDate(dateStr) {
    console.log(`Loading events for date: ${dateStr}`);
    showLoading(true);

    fetch(`/api/events/day/${dateStr}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to load events for selected date");
            }
            console.log('Date-specific API response status:', response.status);
            return response.json();
        })
        .then(data => {
            let events = [];

            if (Array.isArray(data)) {
                // API returned a raw array
                events = data;
            } else if (data.events && Array.isArray(data.events)) {
                // API returned { events: [...] }
                events = data.events;
            } else if (data._embedded && Array.isArray(data._embedded.events)) {
                // Ticketmaster-style structure
                events = data._embedded.events;
}

            // Convert them to GeoJSON the same way your map script expects
            const geojsonFeatures = events.map(ev => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [parseFloat(ev.longitude), parseFloat(ev.latitude)]
                },
                properties: ev
            }));

            allEventsData = geojsonFeatures;

            displayEventsOnMap(allEventsData);
            updateEventsCount(allEventsData.length);
        })
        .catch(err => {
            console.error(err);
            showAlert("Error loading events for that date.", "danger");
        })
        .finally(() => {
            showLoading(false);
        });
}


function loadEventsDataFromRegularAPI() {
    console.log('Trying regular API endpoint...');
    return fetch('/api/events/')
        .then(response => {
            console.log('Regular API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Regular API response:', data);
            let eventsArray;
            // Handle different response formats
            if (Array.isArray(data)) {
                // Direct array response
                eventsArray = data;
            } else {
                throw new Error('Unexpected response format from regular API');
            }
            // Convert to GeoJSON format
            const geojsonFeatures = eventsArray.map(eventData => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [parseFloat(eventData.longitude || 0), parseFloat(eventData.latitude || 0)]
                },
                properties: eventData
            }));
            allEventsData = geojsonFeatures;
            displayEventsOnMap(allEventsData);
            updateEventsCount(allEventsData.length);
            console.log(`Successfully loaded ${allEventsData.length} events from regular API`);
        })
        .catch(error => {
            console.error('Error loading events from both endpoints:', error);
            // Show specific error messages
            if (error.message.includes('404')) {
                showAlert('API endpoints not found. Please check your URLs configuration.', 'danger');
            } else if (error.message.includes('500')) {
                showAlert('Server error. Please check your API views and database.', 'danger');
            } else if (error.message.includes('Failed to fetch')) {
                showAlert('Network error. Please check if the server is running.', 'danger');
            } else {
                showAlert(`Error loading events: ${error.message}`, 'danger');
            }
        });
}

function displayEventsOnMap(eventsData) {
    // Clear existing markers
    eventMarkers.clearLayers();
    eventsData.forEach(eventData => {
        try {
            // Fix: Access coordinates from geometry.coordinates
            const { geometry, properties } = eventData;
            console.log(properties)
            console.log(geometry)
            if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
                console.warn('Invalid geometry for event:', properties?.name || 'Unknown');
                return;
            }
            const [lng, lat] = geometry.coordinates;
            // Validate coordinates
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                console.warn('Invalid coordinates for event:', properties?.name, lat, lng);
                return;
            }
            // Create custom icon
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: #007bff; border-radius: 50%; width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [20,20],
                iconAnchor: [10,10]
            });
            // Create marker
            const marker = L.marker([lat, lng], { icon: customIcon })
                .bindPopup(createPopupContent(properties, geometry), {
                    maxWidth: 300,
                    className: 'custom-popup'
                });
            // Add click event to show detailed info
            marker.on('click', function () {
                showEventInfo(properties, geometry);
            });
            // Store event data with marker for reference
            marker.eventData = properties;
            eventMarkers.addLayer(marker);
        } catch (error) {
            console.error('Error creating marker for event:', eventData, error);
        }
    });
    // Fit map to show all markers if events exist
    if (eventsData.length > 0) {
        try {
            const group = new L.featureGroup(eventMarkers.getLayers());
            if (group.getLayers().length > 0) {
                map.fitBounds(group.getBounds().pad(0.1));
            }
        } catch (error) {
            console.error('Error fitting bounds:', error);
        }
    }
}

function createPopupContent(eventData, geometry) {
    // Safely handle missing properties
    const name = eventData.name || 'Unknown Event';
    const venue = eventData.venue || 'Unknown Venue';
    const city = eventData.city || 'Unknown City';
    const country = eventData.country || 'Unknown Country';
    const latitude = geometry.coordinates[0] || 'Unknown';
    const longitude = geometry.coordinates[1] || 'Unknown';
    return `
        <div class="event-popup">
            <h6>${name}, ${city}</h6>
            <div class="event-popup-info">
                <span class="venue">👥 Venue: ${venue}</span>
                <span class="country">🌍 Country: ${country}</span>
                ${eventData.start_date ? `<span>📅 Date: ${eventData.start_date}</span>` : ''}
                ${eventData.area_km2 ? `<span>📏 Area: ${eventData.area_km2} km²</span>` : ''}
                <span class="coordinates">📍 ${latitude}, ${longitude}</span>
                ${eventData.url ? `<div style="margin-top: 8px; font-style: italic;"><a href="${eventData.url}">Click Here to view</a></div>` : ''}
            </div>
            <div class="popup-buttons">
                <button class="btn btn-sm btn-primary" onclick="zoomToEvent(${eventData.id})">Zoom</button>
                <button class="btn btn-sm btn-info" onclick="showEventDetails(${eventData.id})">Details</button>
            </div>
        </div>
    `;
}

function performSearch() {
    const query = document.getElementById('event-search').value.trim();
    if (!query) {
        displayEventsOnMap(allEventsData);
        updateEventsCount(allEventsData.length);
        return;
    }
    showLoading(true);
    fetch(`/api/search/?q=${encodeURIComponent(query)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Search response:', data);
            let filteredEvents;
            if (Array.isArray(data)) {
                // If search returns array of event objects, convert to GeoJSON
                filteredEvents = data.map(eventData => ({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [parseFloat(eventData.longitude || 0), parseFloat(eventData.latitude || 0)]
                    },
                    properties: eventData
                }));
            } else if (data.features && Array.isArray(data.features)) {
                // If search returns GeoJSON
                filteredEvents = data.features;
            } else {
                // Filter from existing data as fallback
                filteredEvents = allEventsData.filter(eventData =>
                    eventData.properties.name.toLowerCase().includes(query.toLowerCase()) ||
                    eventData.properties.city.toLowerCase().includes(query.toLowerCase())
                );
            }
            displayEventsOnMap(filteredEvents);
            updateEventsCount(filteredEvents.length);
            if (filteredEvents.length === 0) {
                showAlert('No events found matching your search.', 'info');
            }
        })
        .catch(error => {
            console.error('Error searching events:', error);
            // Fallback to client-side search
            const filteredEvents = allEventsData.filter(eventData =>
                eventData.properties.name.toLowerCase().includes(query.toLowerCase()) ||
                eventData.properties.city.toLowerCase().includes(query.toLowerCase())
            );
            displayEventsOnMap(filteredEvents);
            updateEventsCount(filteredEvents.length);
            if (filteredEvents.length === 0) {
                showAlert('No events found matching your search.', 'info');
            } else {
                showAlert('Search performed offline due to connection issues.', 'warning');
            }
        })
        .finally(() => {
            showLoading(false);
        });
}

function showEventInfo(eventData, geometry) {
    const infoPanel = document.getElementById('event-info');
    const infoContent = document.getElementById('event-info-content');
    if (!infoPanel || !infoContent) {
        console.warn('Event info panel elements not found');
        return;
    }
    // Safely handle missing properties
    const name = eventData.name || 'Unknown Event';
    const city = eventData.city || 'Unknown City';
    const country = eventData.country || 'Unknown Country';
    const venue = eventData.venue || 'Unknown Venue';
    const date = eventData.start_date || 'Unknown Date';
    const latitude = geometry.coordinates[0] || 0;
    const longitude = geometry.coordinates[1] || 0;
    infoContent.innerHTML = `
        <div class="row">
            <div class="col-12">
                <h5 class="text-primary">${name}, ${city}</h5>
            </div>
        </div>
        <div class="event-info-grid">
            <div class="info-item">
                <label>Venue</label>
                <div class="value">${venue}</div>
            </div>

            <div class="info-item">
                <label>Coordinates</label>
                <div class="value">${parseFloat(latitude).toFixed(6)}, ${parseFloat(longitude).toFixed(6)}</div>
            </div>
        </div>
        ${eventData.description ? `
            <div class="mt-3">
                <label><strong>Description</strong></label>
                <div class="value">${eventData.description}</div>
            </div>
        ` : ''}
        <div class="mt-3">
            <button class="btn btn-primary btn-sm me-2" onclick="zoomToEvent(${eventData.id})">Zoom to Event</button>
            <button class="btn btn-outline-secondary btn-sm" onclick="copyCoordinates('${latitude}', '${longitude}')">Copy Coordinates</button>
        </div>
    `;
    infoPanel.style.display = 'block';
    infoPanel.scrollIntoView({ behavior: 'smooth' });
}

function setupEventListeners() {
    // Search functionality
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('event-search');
    const clearSearchBtn = document.getElementById('clear-search');
    const refreshBtn = document.getElementById('refresh-map');
    const closeInfoBtn = document.getElementById('close-info');
    const addEventBtn = document.getElementById('add-event-btn');
    const saveEventBtn = document.getElementById('save-event');
    const dateFilterInput = document.getElementById('date-filter');
    const cityFilter = document.getElementById('city-filter');
    const venueFilter = document.getElementById('venue-filter');

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function () {
            if (searchInput) {
                searchInput.value = '';
            }
            displayEventsOnMap(allEventsData);
            updateEventsCount(allEventsData.length);
        });
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadEventsData);
    }
    if (closeInfoBtn) {
        closeInfoBtn.addEventListener('click', function () {
            const infoPanel = document.getElementById('event-info');
            if (infoPanel) {
                infoPanel.style.display = 'none';
            }
        });
    }
    if (addEventBtn) {
        addEventBtn.addEventListener('click', function () {
            const modalElement = document.getElementById('addEventModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            }
        });
    }
    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', saveNewEvent);
    }
    if (dateFilterInput) {
        dateFilterInput.addEventListener('change', function () {
            console.log('Date filter changed');
            const selectedDate = dateFilterInput.value;
            if (selectedDate) {
                loadEventsForDate(selectedDate);
            } else {
                displayEventsOnMap(allEventsData);
                updateEventsCount(allEventsData.length);
            }
        });
    }
    if (cityFilter) {
        cityFilter.addEventListener('change', function () {
            applyFilters();
        });
    }
    if (venueFilter) {
        venueFilter.addEventListener('change', function () {
            applyFilters();
        });
    }
}

function applyFilters() {
    const dateVal = document.getElementById('date-filter')?.value || '';
    const cityVal = document.getElementById('city-filter')?.value || '';
    const venueVal = document.getElementById('venue-filter')?.value || '';

    let filtered = [...allEventsData];

    // Filter by date
    if (dateVal) {
        filtered = filtered.filter(ev =>
            ev.start_date && ev.start_date.startsWith(dateVal)
        );
    }

    // Filter by city
    if (cityVal) {
        filtered = filtered.filter(ev =>
            ev.city && ev.city.toLowerCase() === cityVal.toLowerCase()
        );
    }

    // Filter by venue
    if (venueVal) {
        filtered = filtered.filter(ev =>
            ev.venue && ev.venue.toLowerCase().includes(venueVal.toLowerCase())
        );
    }
    
    displayEventsOnMap(filtered);
    updateEventsCount(filtered.length);
}


function saveNewEvent() {
    const nameInput = document.getElementById('event-name');
    const countryInput = document.getElementById('event-country');
    const cityInput = document.getElementById('event-city');
    const venueInput = document.getElementById('event-venue');
    const latInput = document.getElementById('event-lat');
    const lngInput = document.getElementById('event-lng');
    const dateInput = document.getElementById('event-start-date');
    const urlInput = document.getElementById('event-url');
    if (!nameInput || !countryInput || !cityInput || !venueInput || !latInput || !lngInput || !dateInput || !urlInput) {
        showAlert('Required form elements not found.', 'danger');
        return;
    }
    const formData = {
        name: nameInput.value.trim(),
        country: countryInput.value.trim(),
        city: cityInput.value.trim(),
        venue: venueInput.value.trim(),
        latitude: parseFloat(latInput.value),
        longitude: parseFloat(lngInput.value),
        date: dateInput?.value ? parseInt(dateInput.value) : null,
        url: urlInput.value.trim(),
    };
    // Validation
    if (!formData.name || !formData.country || !formData.city || !formData.venue|| isNaN(formData.latitude) || isNaN(formData.longitude)) {
        showAlert('Please fill in all required fields with valid values.', 'warning');
        return;
    }
    if (formData.latitude < -90 || formData.latitude > 90 || formData.longitude < -180 || formData.longitude > 180) {
        showAlert('Please enter valid coordinates (latitude: -90 to 90, longitude: -180 to 180).', 'warning');
        return;
    }
    if (formData.url && !isValidUrl(formData.url)) {
        showAlert('Please enter a valid website URL (e.g., https://example.com).', 'warning');
        return;
    }

    fetch('/api/events/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(formData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            showAlert('Event added successfully!', 'success');
            // Close modal
            const modalElement = document.getElementById('addEventModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }
            }
            // Reset form
            const form = document.getElementById('add-event-form');
            if (form) {
                form.reset();
            }
            // Reload events
            loadEventsData();
        })
        .catch(error => {
            console.error('Error saving event:', error);
            showAlert('Error saving event. Please try again.', 'danger');
        });
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}


// Utility functions
function zoomToEvent(eventId) {
    const eventData = allEventsData.find(c => c.properties.id === parseInt(eventId));
    if (eventData && eventData.geometry && eventData.geometry.coordinates) {
        const [lng, lat] = eventData.geometry.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 12);
        }
    }
}

function showEventDetails(eventId) {
    const eventData = allEventsData.find(c => c.properties.id === parseInt(eventId));
    if (eventData) {
        showEventInfo(eventData.properties);
    }
}

function copyCoordinates(lat, lng) {
    const coords = `${lat}, ${lng}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(coords).then(() => {
            showAlert('Coordinates copied to clipboard!', 'info');
        }).catch(() => {
            showAlert('Failed to copy coordinates to clipboard.', 'warning');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = coords;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showAlert('Coordinates copied to clipboard!', 'info');
        } catch (err) {
            showAlert('Failed to copy coordinates to clipboard.', 'warning');
        }



        document.body.removeChild(textArea);
    }
}

function updateEventsCount(count) {
    const countElement = document.getElementById('event-count');
    if (countElement) {
        countElement.textContent = `${count} events loaded`;
    }
}

function showLoading(show) {
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        if (show) {
            searchBtn.innerHTML = '<span class="loading"></span> Loading...';
            searchBtn.disabled = true;
        } else {
            searchBtn.innerHTML = '🔍 Search';
            searchBtn.disabled = false;
        }
    }
}

function showAlert(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function getCsrfToken() {
    // Try multiple methods to get CSRF token
    // Method 1: From cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return value;
        }
    }
    // Method 2: From meta tag
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    // Method 3: From form input
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrfInput) {
        return csrfInput.value;
    }
    console.warn('CSRF token not found');
    return '';
}


class ProximitySearch {

    constructor(map) {
        this.map = map;
        this.searchMarker = null;
        this.nearestEventsLayer = L.layerGroup().addTo(this.map);
        this.radiusCircle = null;
        this.isProximityMode = false;
        this.initializeProximityFeatures();
    }

    initializeProximityFeatures() {
        // Add proximity search toggle button
        this.addProximityControls();
        // Add click handler for proximity search
        this.map.on('click', (e) => {
            if (this.isProximityMode) {
                this.performProximitySearch(e.latlng.lat, e.latlng.lng);
            }
        });
    }


    addProximityControls() {
        // Add toggle button to existing controls
        const proximityToggle = document.createElement('button');
        proximityToggle.id = 'proximity-toggle';
        proximityToggle.className = 'btn btn-outline-primary';
        proximityToggle.innerHTML = '📍 Proximity Search';
        proximityToggle.onclick = () => this.toggleProximityMode();
        // Add to existing control panel
        const controlPanel = document.querySelector('.map-controls') || document.body;
        controlPanel.appendChild(proximityToggle);
        // Add radius input
        const radiusInput = document.createElement('input');
        radiusInput.id = 'radius-input';
        radiusInput.type = 'number';
        radiusInput.value = '100';
        radiusInput.placeholder = 'Radius (km)';
        radiusInput.className = 'form-control d-none';
        radiusInput.style.width = '120px';
        radiusInput.style.display = 'inline-block';
        radiusInput.style.marginLeft = '10px';
        controlPanel.appendChild(radiusInput);
    }


    toggleProximityMode() {
        this.isProximityMode = !this.isProximityMode;
        const toggleBtn = document.getElementById('proximity-toggle');
        const radiusInput = document.getElementById('radius-input');
        if (this.isProximityMode) {
            toggleBtn.innerHTML = 'Exit Proximity';
            toggleBtn.className = 'btn btn-danger';
            radiusInput.classList.remove('d-none');
            this.map.getContainer().style.cursor = 'crosshair';
            showAlert('Click anywhere on the map to find nearest events', 'info');
        } else {
            toggleBtn.innerHTML = 'Proximity Search';
            toggleBtn.className = 'btn btn-outline-primary';
            radiusInput.classList.add('d-none');
            this.map.getContainer().style.cursor = '';
            this.clearProximityResults();
        }
    }


    async performProximitySearch(lat, lng) {
        // Clear previous results
        this.clearProximityResults();
        // Add search marker
        this.searchMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            })
        }).addTo(this.map);

        this.searchMarker.bindPopup(`
            <strong>Search Point</strong><br>
            Lat: ${lat.toFixed(6)}<br>
            Lng: ${lng.toFixed(6)}
        `).openPopup();

        // Show loading
        showLoading(true);

        try {
            const response = await fetch('/api/nearest/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ lat, lng })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.displayNearestEvents(data.nearest_events);
            this.updateResultsPanel(data);
        } catch (error) {
            console.error('Error finding nearest events:', error);
            showAlert('Error performing proximity search. Please try again.', 'danger');
        } finally {
            showLoading(false);
        }
    }


    displayNearestEvents(eventsData) {
        eventsData.forEach((eventData, index) => {
            const marker = L.marker([eventData.coordinates.lat, eventData.coordinates.lng], {
                icon: this.getNumberedIcon(eventData.rank)
            });
            const popupContent = `
                <div class="event-popup proximity-result">
                    <h6>#${eventData.rank} ${eventData.name}</h6>
                    <p><strong>Country:</strong> ${eventData.country}</p>
                    <p><strong>Population:</strong> ${eventData.population.toLocaleString()}</p>
                    <p><strong>Distance:</strong> ${eventData.distance_km} km (${eventData.distance_miles} mi)</p>
                    ${eventData.founded_year ? `<p><strong>Founded:</strong> ${eventData.founded_year}</p>` : ''}
                    ${eventData.description ? `<p><em>${eventData.description}</em></p>` : ''}
                    <button class="btn btn-sm btn-primary" onclick="proximitySearch.zoomToEvent(${eventData.coordinates.lat}, ${eventData.coordinates.lng})">
                        Zoom Here
                    </button>
                </div>
            `;
            marker.bindPopup(popupContent);
            this.nearestEventsLayer.addLayer(marker);
        });
        // Fit map to show search point and results
        if (eventsData.length > 0) {
            const group = new L.featureGroup([
                this.searchMarker,
                ...this.nearestEventsLayer.getLayers()
            ]);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }


    getNumberedIcon(number) {
        return L.divIcon({
            className: 'numbered-marker',
            html: `<div class="marker-number">${number}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }


    updateResultsPanel(data) {
        // Create or update results panel
        let resultsPanel = document.getElementById('proximity-results');
        if (!resultsPanel) {
            resultsPanel = document.createElement('div');
            resultsPanel.id = 'proximity-results';
            resultsPanel.className = 'proximity-results-panel';
            document.body.appendChild(resultsPanel);
        }
        resultsPanel.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5>Nearest Cities Results</h5>
                    <button type="button" class="btn-close" onclick="proximitySearch.clearProximityResults()"></button>
                </div>
                <div class="card-body">
                    <p><strong>Search Point:</strong> ${data.search_point.lat.toFixed(4)}, ${data.search_point.lng.toFixed(4)}</p>
                    <p><strong>Cities Found:</strong> ${data.total_found}</p>
                    <div class="results-list">
                        ${data.nearest_events.map(eventData => `
                            <div class="result-item" onclick="proximitySearch.zoomToeventData(${eventData.coordinates.lat}, ${eventData.coordinates.lng})">
                                <strong>#${eventData.rank} ${eventData.name}, ${eventData.city}, ${eventData.venue}</strong><br>
                                <small>${eventData.distance_km} km away • Date: ${eventData.start_date}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        resultsPanel.style.display = 'block';
    }


    zoomToEvent(lat, lng) {
        this.map.setView([lat, lng], 12);
    }


    clearProximityResults() {
        if (this.searchMarker) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }
        this.nearestEventsLayer.clearLayers();
        if (this.radiusCircle) {
            this.map.removeLayer(this.radiusCircle);
            this.radiusCircle = null;
        }
        const resultsPanel = document.getElementById('proximity-results');
        if (resultsPanel) {
            resultsPanel.style.display = 'none';
        }
    }
}
