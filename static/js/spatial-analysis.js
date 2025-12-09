/**
 * Spatial Analysis Module
 * Handles communication with Django API for spatial queries
 */
window.SpatialAnalysis = (function() {
    let isSearching = false;
    let analysisSession = null;

    /**
     * Initialize spatial analysis functionality
     */
    function initialize() {
        console.log('Spatial Analysis module initialized');
    }

    /**
     * Execute spatial query for polygon
     */
    function executeSpatialQuery(polygon) {
        if (isSearching) {
            console.log('Search already in progress');
            return;
        }

        isSearching = true;
        window.UIControls.showLoading();

        // Start analysis session tracking
        startAnalysisSession(polygon);

        // Prepare request data
        const requestData = {
            polygon: polygon,
            filters: {} // Can be extended with user filters
        };

        // Get CSRF token for Django
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                         getCookie('csrftoken');

        // Make API request
        fetch('/api/polygon/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Spatial query successful:', data);
            processSearchResults(data);
            completeAnalysisSession({
                total_events: data.events_found,
                execution_time_ms: data.query_time_ms
            });
        })
        .catch(error => {
            console.error('Spatial query failed:', error);
            window.UIControls.showError('Failed to search for events: ' + error.message);
        })
        .finally(() => {
            isSearching = false;
            window.UIControls.hideLoading();
        });
    }

    /**
     * Process and display search results
     */
    function processSearchResults(data) {
        console.log('Processing search results:', data);

        // Display events on map
        window.AdvancedMapping.displayEventsOnMap(data.events);

        // Update the UI
        window.UIControls.displaySearchResults({
            events: data.events,
            events_found: data.events_found,
            statistics: data.statistics,
            query_time_ms: data.query_time_ms,
            geojson: data.geojson
        });

        // Analytics logging
        console.log(`Found ${data.events_found} events in ${data.query_time_ms}ms`);
    }



    /**
     * Start tracking analysis session
     */
    function startAnalysisSession(polygon) {
        const searchParams = {
            polygon: polygon,
            timestamp: new Date(),
            userId: generateSessionId()
        };

        analysisSession = {
            id: generateSessionId(),
            startTime: new Date(),
            parameters: searchParams,
            polygonArea: calculatePolygonArea(searchParams.polygon),
            status: 'active'
        };

        console.log('Analysis session started:', analysisSession.id);
    }

    /**
     * Complete analysis session with results
     */
    function completeAnalysisSession(analysisData) {
        if (analysisSession) {
            analysisSession.endTime = new Date();
            analysisSession.duration = analysisSession.endTime - analysisSession.startTime;
            analysisSession.results = analysisData;
            analysisSession.status = 'completed';

            console.log('Analysis session completed:', {
                sessionId: analysisSession.id,
                duration: analysisSession.duration + 'ms',
                eventsFound: analysisData.total_events
            });
        }
    }

    /**
     * Calculate approximate polygon area
     */
    function calculatePolygonArea(polygon) {
        // Simplified area calculation for analytics
        if (polygon.type === 'Polygon' && polygon.coordinates.length > 0) {
            const coords = polygon.coordinates[0];
            let area = 0;

            for (let i = 0; i < coords.length - 1; i++) {
                area += coords[i][0] * coords[i + 1][1];
                area -= coords[i + 1][0] * coords[i][1];
            }

            return Math.abs(area) / 2;
        }
        return 0;
    }

    /**
     * Generate unique session ID
     */
    function generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     * Get CSRF cookie for Django
     */
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Public API
    return {
        initialize: initialize,
        executeSpatialQuery: executeSpatialQuery
    };
})();