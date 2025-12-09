/**
 * Advanced Mapping Interface Module
 * Handles Leaflet.js map initialization and polygon drawing functionality
 */
window.AdvancedMapping = (function() {
    let map = null;
    let drawControl = null;
    let drawnItems = null;

    /**
     * Initialize the interactive map with drawing tools
     */
    function initializeMap(containerId) {
        try {
            // Create map instance
            map = L.map(containerId).setView([53.3498, -6.2603], 6); // Centered on Ireland

            // Add base tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            // Initialize drawing controls
            initializeDrawingControls();

            console.log('Map initialized successfully');

        } catch (error) {
            console.error('Failed to initialize map:', error);
            alert('Failed to load the map. Please refresh the page.');
        }
    }

    /**
     * Set up Leaflet.draw controls for polygon drawing
     */
    function initializeDrawingControls() {
        // Create feature group for drawn items
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        // Configure drawing options
        const drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#e1e100',
                        message: '<strong>Error:</strong> Shape edges cannot cross!'
                    },
                    shapeOptions: {
                        color: '#007bff',
                        weight: 3,
                        opacity: 0.8,
                        fillOpacity: 0.2
                    }
                },
                polyline: false,
                rectangle: {
                    shapeOptions: {
                        color: '#007bff',
                        weight: 3,
                        opacity: 0.8,
                        fillOpacity: 0.2
                    }
                },
                circle: false,
                marker: false,
                circlemarker: false
            },
            edit: {
                featureGroup: drawnItems,
                remove: true
            }
        });

        map.addControl(drawControl);

        // Event handlers for drawing
        map.on('draw:created', function(event) {
            const layer = event.layer;
            drawnItems.addLayer(layer);

            // Extract polygon coordinates
            const geoJson = layer.toGeoJSON();
            console.log('Polygon drawn:', geoJson);

            // Trigger spatial analysis
            window.SpatialAnalysis.executeSpatialQuery(geoJson.geometry);
        });

        map.on('draw:deleted', function(event) {
            console.log('Polygon deleted');
            window.UIControls.clearResults();
        });

        map.on('draw:edited', function(event) {
            const layers = event.layers;
            layers.eachLayer(function(layer) {
                const geoJson = layer.toGeoJSON();
                console.log('Polygon edited:', geoJson);
                window.SpatialAnalysis.executeSpatialQuery(geoJson.geometry);
            });
        });
    }

    /**
     * Add events as markers to the map
     */
    function displayEventsOnMap(events) {
        // Clear existing event markers
        map.eachLayer(function(layer) {
            if (layer.options && layer.options.eventMarker) {
                map.removeLayer(layer);
            }
        });

        // Add new event markers
        events.forEach(function(event) {
            const marker = L.marker([event.latitude, event.longitude], {
                eventMarker: true
            }).addTo(map);

            // Create popup with event information
            const popupContent = `
                <div class="event-popup">
                    <h6>${event.name}</h6>
                    <p><strong>City:</strong> ${event.city}</p>
                    <p><strong>Venue:</strong> ${event.venue}</p>
                </div>
            `;

            marker.bindPopup(popupContent);
        });
    }

    /**
     * Get reference to the map instance
     */
    function getMap() {
        return map;
    }

    // Public API
    return {
        initializeMap: initializeMap,
        displayEventsOnMap: displayEventsOnMap,
        getMap: getMap
    };
})();