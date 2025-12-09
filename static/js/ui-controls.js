/**
 * UI Controls Module
 * Manages user interface updates and interactions
 */
window.UIControls = (function() {

    /**
     * Initialize UI controls
     */
    function initialize() {
        console.log('UI Controls initialized');
    }

    /**
     * Show loading indicator
     */
    function showLoading() {
        const loadingElement = document.getElementById('loadingIndicator');
        const statusElement = document.getElementById('searchStatus');

        if (loadingElement) {
            loadingElement.style.display = 'block';
        }

        if (statusElement) {
            statusElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    <strong>Searching for events within your polygon...</strong>
                </div>
            `;
            statusElement.className = 'alert alert-info';
        }
    }

    /**
     * Hide loading indicator
     */
    function hideLoading() {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    /**
     * Display search results in the UI
     */
    function displaySearchResults(results) {
        updateAnalysisSummary({
            total_events: results.events_found,
            execution_time_ms: results.query_time_ms,
            polygon_area_km2: results.polygon_area_km2,
            statistics: results.statistics
        });

        updateEventsList(results.events);
        showSuccessStatus(results.events_found);
    }



    /**
     * Update analysis summary statistics
     */
    function updateAnalysisSummary(analysis) {
        const summaryElement = document.getElementById('analysisSummary');
        if (summaryElement) {
            summaryElement.style.display = 'block';
            summaryElement.classList.add('fade-in');
        }

        // Prevent UI breaks on null or undefined
        const total = analysis.total_events ?? 0;
        const area = analysis.polygon_area_km2 ?? 0;

        updateElementText('totalEvents', total.toLocaleString());
        updateElementText('polygonArea', area.toLocaleString());
    }


    /**
     * Update events list
     */
    function updateEventsList(events) {
        const eventsContainer = document.getElementById('eventsContainer');
        const eventsList = document.getElementById('eventsList');

        if (!eventsList) return;

        // Show container
        if (eventsContainer) {
            eventsContainer.style.display = 'block';
        }

        // Clear existing list
        eventsList.innerHTML = '';

        // Add events to list
        events.forEach(function(event, index) {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item event-item';
            listItem.style.animationDelay = (index * 50) + 'ms';

            listItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${event.name}</h6>
                        <p class="mb-1 text-muted">${event.city}</p>
                        <small class="text-muted">${event.venue}</small>
                    </div>
                </div>
            `;

            // Add click handler to focus on event location
            listItem.addEventListener('click', function() {
                focusOnEvent(event);
            });

            eventsList.appendChild(listItem);
        });
    }

    /**
     * Focus map on specific event location
     */
    function focusOnEvent(event) {
        const map = window.AdvancedMapping.getMap();
        if (map) {
            map.setView([event.latitude, event.longitude], 12);
        }
    }

    /**
     * Show success status
     */
    function showSuccessStatus(eventCount) {
        const statusElement = document.getElementById('searchStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>✅ Search Complete!</strong> Found ${eventCount} events within your polygon.
                ${eventCount === 0 ? 'Try drawing a larger polygon or in a different area.' : 'Click on events in the list to focus the map.'}
            `;
            statusElement.className = 'alert alert-success';
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        const statusElement = document.getElementById('searchStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>❌ Error:</strong> ${message}
            `;
            statusElement.className = 'alert alert-danger';
        }
    }

    /**
     * Clear all results
     */
    function clearResults() {
        // Hide containers
        const summaryElement = document.getElementById('analysisSummary');
        const eventsContainer = document.getElementById('eventsContainer');

        if (summaryElement) {
            summaryElement.style.display = 'none';
        }

        if (eventsContainer) {
            eventsContainer.style.display = 'none';
        }

        // Reset status
        const statusElement = document.getElementById('searchStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>Instructions:</strong> Use the polygon tool in the map toolbar to draw a shape. Events within your polygon will appear here.
            `;
            statusElement.className = 'alert alert-info';
        }
    }

    /**
     * Update element text content
     */
    function updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    // Public API
    return {
        initialize: initialize,
        showLoading: showLoading,
        hideLoading: hideLoading,
        displaySearchResults: displaySearchResults,
        showError: showError,
        clearResults: clearResults
    };
})();