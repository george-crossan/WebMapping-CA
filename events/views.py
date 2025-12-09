# Django Core Imports
from django.shortcuts import render
from django.http import JsonResponse
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Count

# Django GIS Imports
from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.db.models.functions import Distance

# Django REST Framework Imports
from rest_framework import generics
from rest_framework.decorators import api_view
from rest_framework.response import Response

# Local App Imports
from .models import Event, SearchSession, PolygonAnalysis
from .serializers import EventSerializer, EventListSerializer

# Third-Party Imports
import requests
import json
import traceback
import logging
import time

logger = logging.getLogger(__name__)

class EventListCreateView(generics.ListCreateAPIView):
    queryset = Event.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return EventListSerializer
        return EventSerializer

class EventDetailView(generics.ListAPIView):
    queryset = Event.objects.all().order_by('-start_date')
    serializer_class = EventSerializer

@login_required
@api_view(['GET'])
def get_events_for_day(request, date_str):
    """Return events for a specific day with optional city/venue filters."""
    if not date_str:
        return Response({'error': 'Date parameter is required'}, status=400)

    # Optional filters
    filter_city = request.GET.get('city')
    filter_venue = request.GET.get('venue')

    api_key = settings.TICKETMASTER_API_KEY
    url = (
        f"https://app.ticketmaster.com/discovery/v2/events.json"
        f"?apikey={api_key}"
        f"&startDateTime={date_str}T00:00:00Z"
        f"&endDateTime={date_str}T23:59:59Z"
        f"&countryCode=IE"
    )

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        raw_events = data.get('_embedded', {}).get('events', [])

        events = []
        for event in raw_events:
            event_info = {
                'name': event.get('name'),
                'url': event.get('url'),
                'start_date': event.get('dates', {}).get('start', {}).get('dateTime'),
                'venue': '',
                'city': '',
                'country': '',
                'latitude': None,
                'longitude': None,
            }

            # Extract venue info
            venues = event.get('_embedded', {}).get('venues', [])
            if venues:
                venue = venues[0]
                event_info['venue'] = venue.get('name', '')
                event_info['city'] = venue.get('city', {}).get('name', '')
                event_info['country'] = venue.get('country', {}).get('name', '')
                event_info['latitude'] = venue.get('location', {}).get('latitude')
                event_info['longitude'] = venue.get('location', {}).get('longitude')

            # Apply city filter
            if filter_city and event_info['city'].lower() != filter_city.lower():
                continue

            # Apply venue filter
            if filter_venue and filter_venue.lower() not in event_info['venue'].lower():
                continue

            events.append(event_info)

        return Response(events)

    except requests.RequestException as e:
        return Response({'error': str(e)}, status=400)


@login_required
@api_view(['GET'])
def events_geojson(request):
    """Return events data in GeoJSON format for Leaflet"""
    events = Event.objects.all()

    features = []
    for event_data in events:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(event_data.longitude), float(event_data.latitude)]
            },
            "properties": {
                "id": event_data.id,
                "name": event_data.name,
                "venue": event_data.venue,
                "city": event_data.city,
                "country": event_data.country,
                "start_date": event_data.start_date.isoformat(),
                "url": event_data.url,
            }
        })

    return JsonResponse({
        "type": "FeatureCollection",
        "features": features
    }, safe=False)



def get_weather(request, event_id):
    """Fetch weather data for a specific event from OpenWeatherMap API"""
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return JsonResponse({'error': 'Event not found'}, status=404)

    api_key = settings.OPENWEATHERMAP_API_KEY
    url = f"https://api.openweathermap.org/data/2.5/weather"

    params = {
        'lat': event.latitude,
        'lon': event.longitude,
        'appid': api_key,
        'units': 'metric'  # Use metric units
    }

    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        weather_data = response.json()

        # Extract relevant information
        result = {
            'event': event.name,
            'city': event.city,
            'temperature': weather_data['main']['temp'],
            'feels_like': weather_data['main']['feels_like'],
            'humidity': weather_data['main']['humidity'],
            'pressure': weather_data['main']['pressure'],
            'wind_speed': weather_data['wind']['speed'],
            'description': weather_data['weather'][0]['description'],
            'icon': weather_data['weather'][0]['icon'],
        }

        return JsonResponse(result)

    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': f'API request failed: {str(e)}'}, status=500)
    except KeyError as e:
        return JsonResponse({'error': f'Unexpected API response format: {str(e)}'}, status=500)

@login_required
def map_view(request):
    """Render the main map page"""

    return render(request, 'events/map.html')

@login_required
def map_search_view(request):
    return render(request, 'search/map.html')

@login_required
def event_list(request):
    """Display list of all events"""

    events = Event.objects.all().order_by("name")
    print(events)

    return render(request, "search/event_list.html", {"events": events})

@login_required
@api_view(['GET'])
def event_search(request):
    """Search events by name or city"""
    query = request.GET.get('q', '')
    if query:
        events = Event.objects.filter(
            models.Q(name__icontains=query) |
            models.Q(city_iconations=query)
        )
    else:
        events = Event.objects.all()
   
    serializer = EventListSerializer(events, many=True)
    return Response(serializer.data)

@login_required
@api_view(['POST'])
def find_nearest_events(request):
    """
    Find the 10 nearest events to a given point
    POST /api/events/nearest/
    Body: {"lat": 53.3498, "lng": -6.2603}
    """
    try:
        print("DEBUG: Method =", request.method)
        print("DEBUG: Raw body =", request.body)

        data = json.loads(request.body.decode('utf-8'))
        print("DEBUG: Parsed data =", data)

        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        data = request.data
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))

        print("line 103")
        # Validate coordinates
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return Response({
                'error': 'Invalid coordinates. Lat must be -90 to 90, lng must be -180 to 180'
            }, status=400)
        
        # Create a point from coordinates (PostGIS uses lng, lat order)
        search_point = Point(lng, lat, srid=4326)

        # Query for nearest 10 events using PostGIS distance calculation
        nearest_events = Event.objects.annotate(
            distance=Distance('location', search_point)
        ).order_by('distance')[:10]

        # Serialize results
        results = []
        for i, event in enumerate(nearest_events, 1):
            results.append({
                'rank': i,
                'id': event.id,
                'name': event.name,
                'country': event.country,
                'city': event.city,
                'coordinates': {
                    'lat': event.latitude,
                    'lng': event.longitude
                },
                'distance_km': round(event.distance.km, 2),
                'distance_miles': round(event.distance.mi, 2),
                'venue': event.venue,
                'start_date': event.start_date,
                'url': event.url,
            })
        return Response({
            'search_point': {'lat': lat, 'lng': lng},
            'total_found': len(results),
            'nearest_events': results
        })
    
    except (ValueError, TypeError) as e:
        return Response({
            'error': f'Invalid input: {str(e)}'
        }, status=400)
    
    except Exception as e:
        traceback.print_exc()
        return Response({
            'error': f'Server error: {str(e)}'
        }, status=500)


@login_required
@api_view(['POST'])
def events_within_radius(request):
    """
    Find all events within a specified radius
    POST /api/events/radius
    Body: {"lat": 53.3498, "lng": -6.2603, "radius_km": 100}
    """

    try:
        data = request.data
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        radius_km = float(data.get('radius_km', 100))  # Default 100km
       
        # Validate inputs
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return Response({'error': 'Invalid coordinates'}, status=400)
       
        if radius_km <= 0 or radius_km > 20000:  # Max ~half Earth circumference
            return Response({'error': 'Radius must be between 0 and 20000 km'}, status=400)
       
        search_point = Point(lng, lat, srid=4326)
        
        # Use PostGIS distance filter
        from django.contrib.gis.measure import Distance as D
        events_in_radius = Event.objects.filter(
            location__distance_lte=(search_point, D(km=radius_km))
        ).annotate(
            distance=Distance('location', search_point)
        ).order_by('distance')
       
        results = []
        for event in events_in_radius:
            results.append({
                'id': event.id,
                'name': event.name,
                'country': event.country,
                'city': event.city,
                'coordinates': {
                    'lat': event.latitude,
                    'lng': event.longitude
                },
                'distance_km': round(event.distance.km, 2),
                'distance_miles': round(event.distance.mi, 2),
                'venue': event.venue,
                'start_date': event.start_date,
                'url': event.url,
            })
        
        return Response({
            'search_point': {'lat': lat, 'lng': lng},
            'radius_km': radius_km,
            'total_found': len(results),
            'events': results
        })
    
    except (ValueError, TypeError) as e:
        return Response({
            'error': f'Invalid input: {str(e)}'
        }, status=400)
    
    except Exception as e:
        return Response({
            'error': f'Server error: {str(e)}'
        }, status=500)
    
@login_required
def index_view(request):
    """Main page with application overview"""
    total_events = Event.objects.count()
    total_cities = Event.objects.values('city').distinct().count()

    context = {
        'total_events': total_events,
        'total_cities': total_cities,
    }

    return render(request, 'polygon/index.html', context)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def polygon_search(request):
    """
    API endpoint for polygon-based spatial search of events.

    Accepts a polygon defined by coordinates and returns all events within that polygon.
    Includes performance monitoring and analytics tracking.
    """
    start_time = time.time()

    try:
        # Parse request data
        data = json.loads(request.body)
        # Support both the old format and GeoJSON format
        if 'coordinates' in data:
            coordinates = data['coordinates']
        elif 'polygon' in data and 'coordinates' in data['polygon']:
            # GeoJSON uses polygon["coordinates"][0]
            coordinates = data['polygon']['coordinates'][0]
        else:
            coordinates = []


        if not coordinates or len(coordinates) < 3:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid polygon coordinates. At least 3 points required.',
                'error_code': 'INVALID_COORDINATES'
            }, status=400)

        # Validate coordinates format
        for coord in coordinates:
            if not isinstance(coord, list) or len(coord) != 2:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Each coordinate must be [longitude, latitude].',
                    'error_code': 'INVALID_COORDINATE_FORMAT'
                }, status=400)

            # Basic coordinate validation
            lng, lat = coord
            if not (-180 <= lng <= 180) or not (-90 <= lat <= 90):
                return JsonResponse({
                    'status': 'error',
                    'message': f'Invalid coordinate values: longitude={lng}, latitude={lat}',
                    'error_code': 'COORDINATE_OUT_OF_BOUNDS'
                }, status=400)

        # Ensure polygon is closed
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])

        # Create PostGIS polygon
        try:
            polygon = Polygon(coordinates, srid=4326)
        except Exception as e:
            logger.error(f"Failed to create polygon: {e}")
            return JsonResponse({
                'status': 'error',
                'message': 'Failed to create valid polygon from coordinates.',
                'error_code': 'POLYGON_CREATION_FAILED'
            }, status=400)

        # Perform spatial query
        query_start = time.time()
        events_within = Event.objects.filter(
            location__within=polygon
        ).select_related().order_by('-start_date')

        # Execute query and measure performance
        events_list = list(events_within)
        query_duration = (time.time() - query_start) * 1000  # milliseconds

        # Calculate statistics
        total_events = len(events_list)
        # Build response data
        events_data = []
        for event in events_list:
            events_data.append({
                'id': event.id,
                'name': event.name,
                'country': event.country,
                'city': event.city,
                'venue': event.venue,
                'start_date': event.start_date,
                'url': event.url,
                'latitude': float(event.latitude) if event.latitude else None,
                'longitude': float(event.longitude) if event.longitude else None,
            })

        # Create GeoJSON response
        geojson = {
            "type": "FeatureCollection",
            "features": [event.to_geojson_feature() for event in events_list]
        }

        # Calculate polygon area (approximate)
        try:
            # Transform to appropriate projection for area calculation
            polygon_area_km2 = polygon.transform(3857, clone=True).area / 1000000  # Convert m² to km²
        except Exception as e:
            logger.warning(f"Failed to calculate polygon area: {e}")
            polygon_area_km2 = None

        features = []
        for event in events_list:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [event.longitude, event.latitude]
                },
                "properties": event
            })

        execution_time_ms = int((time.time() - start_time) * 1000)

        # Track analysis for analytics
        try:
            session_id = request.session.session_key or f"anon_{request.META.get('REMOTE_ADDR', 'unknown')}"

            analysis = PolygonAnalysis.objects.create(
                session_id=session_id,
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                ip_address=request.META.get('REMOTE_ADDR'),
                polygon_coordinates=coordinates,
                polygon_area_km2=polygon_area_km2,
                events_count=total_events,
                events_found=[event.id for event in events_list],
                query_duration_ms=int(query_duration),
                centroid_latitude=polygon.centroid.y,
                centroid_longitude=polygon.centroid.x,
                analysis_type='polygon'
            )

            # Update or create search session
            session, created = SearchSession.objects.get_or_create(
                session_id=session_id,
                defaults={
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'ip_address': request.META.get('REMOTE_ADDR'),
                }
            )
            session.update_metrics()

        except Exception as e:
            logger.error(f"Failed to save analysis tracking: {e}")
            # Continue with response even if tracking fails

        total_time = (time.time() - start_time) * 1000  # milliseconds

        # Build successful response
        response = {
            'status': 'success',
            'timestamp': timezone.now().isoformat(),
            'events_found': total_events,
            'polygon_area_km2': round(polygon_area_km2, 2) if polygon_area_km2 else None,
            'query_time_ms': round(query_duration, 2),
            'total_time_ms': round(total_time, 2),
            'events': events_data,              
            'geojson': geojson,                 
            'statistics': {}                    
}


        logger.info(f"Polygon search completed: {total_events} events found in {total_time:.2f}ms")
        return JsonResponse(response)

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON in request body.',
            'error_code': 'INVALID_JSON'
        }, status=400)

    except Exception as e:
        logger.error(f"Unexpected error in polygon_search: {e}", exc_info=True)
        return JsonResponse({
            'status': 'error',
            'message': 'Internal server error occurred.',
            'error_code': 'INTERNAL_ERROR'
        }, status=500)
    
@login_required
@api_view(['POST'])
def distance_search(request):
    """
    API endpoint for distance-based (radius) search around a point.
    Alternative to polygon search for circular area analysis.
    """
    try:
        # Parse request data
        data = json.loads(request.body)
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        radius_km = data.get('radius_km', 10)  # Default 10km radius

        if latitude is None or longitude is None:
            return JsonResponse({
                'status': 'error',
                'message': 'Latitude and longitude are required.'
            }, status=400)

        # Validate coordinates
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid coordinate values.'
            }, status=400)

        # Validate radius
        if not (0 < radius_km <= 1000):  # Max 1000km radius
            return JsonResponse({
                'status': 'error',
                'message': 'Radius must be between 0 and 1000 kilometers.'
            }, status=400)

        from django.contrib.gis.geos import Point
        from django.contrib.gis.measure import Distance

        # Create point and search within radius
        center_point = Point(longitude, latitude, srid=4326)

        events_within = Event.objects.filter(
            location__distance_lte=(center_point, Distance(km=radius_km)),
            is_active=True
        ).order_by('-population')

        # Build response
        events_data = []
        for event in events_within:
            # Calculate actual distance
            distance_km = event.location.distance(center_point) * 111  # Approximate conversion

            events_data.append({
                'id': event.id,
                'name': event.name,
                'country': event.country,
                'city': event.city,
                'venue': event.venue,
                'start_date': event.start_date,
                'url': event.url,
                'latitude': event.latitude,
                'longitude': event.longitude,
                'distance_km': round(distance_km, 2)
            })

        response = {
            'status': 'success',
            'center_point': {'latitude': latitude, 'longitude': longitude},
            'radius_km': radius_km,
            'events_found': len(events_data),
            'events_data': events_data
        }

        return JsonResponse(response)

    except Exception as e:
        logger.error(f"Error in distance_search: {e}", exc_info=True)
        return JsonResponse({
            'status': 'error',
            'message': 'Distance search failed.'
        }, status=500)