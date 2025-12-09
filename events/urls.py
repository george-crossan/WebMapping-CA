from django.urls import path
from . import views

app_name = 'events'

urlpatterns = [
    path("", views.map_view, name="map"),
    path("search/map", views.map_search_view, name='map_search_view'),
    path("search/list", views.event_list, name='event_list'),
    path("search/polygon", views.index_view, name="index_view"),
    path("api/geojson/", views.events_geojson, name="events-geojson"),
    path("api/events/", views.EventListCreateView.as_view(), name="get-events"),
    path("api/<int:pk>/", views.EventDetailView.as_view(), name="events-detail"),
    path("api/search/", views.event_search, name="event-search"),
    path("api/nearest/", views.find_nearest_events, name="find_nearest_events"),
    path("api/radius/", views.events_within_radius, name="events_within_radius"),
    path("api/weather/<int:event_id>/", views.get_weather, name="get_weather"),
    path("api/events/day/<str:date_str>/", views.get_events_for_day, name="get_events_for_day"),
    path("api/polygon/", views.polygon_search, name="polygon_search"),
    path("api/distance/", views.distance_search, name="distance_search"),
    ]