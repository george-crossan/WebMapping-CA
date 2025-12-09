import requests
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.conf import settings
from events.models import Event

TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events"

class Command(BaseCommand):
    help = "Load events data from Ticketmaster API into the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--country", 
            default="IE", 
            help="Country code (default: IE)")
        parser.add_argument(
            "--clear", 
            action="store_true", 
            help="Clear existing cities before loading")

    def handle(self, *args, **options):
        key = settings.TICKETMASTER_API_KEY
        country = options["country"]

        if options["clear"]:
            self.stdout.write('Clearing existing cities...')
            Event.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('✓ Existing cities cleared'))

        self.stdout.write('Loading events data...')

        response = requests.get(TICKETMASTER_URL, params={"apikey": key, "countryCode": country, "size": 100})
        data = response.json()
        events = data.get("_embedded", {}).get("events", [])

        created_count = 0
        updated_count = 0
        
        for event_data in events:
            
            # Venue name is found in '_embedded': {'venues': [{'name':<venue name>}]}
            venues = event_data.get('_embedded', {}).get('venues', [])

            if not venues or 'location' not in venues[0]:
                continue

            venue = venues[0]
            loc = venue['location']

            point = Point(float(loc['longitude']), float(loc['latitude']), srid=4326)

            event, created = Event.objects.update_or_create(
                name=event_data["name"],
                defaults={
                    "venue": venue.get("name", ""),
                    "city": venue.get("city", {}).get("name", ""),
                    "country": venue.get("country", {}).get("name", ""),
                    "start_date": event_data["dates"]["start"]["dateTime"],
                    "url": event_data["url"],
                    "location": point,
                }
            )

            if created:
                created_count += 1
                self.stdout.write(f'  ✓ Created: {event}')
            else:
                updated_count += 1
                self.stdout.write(f'  ↻ Updated: {event}')

        self.stdout.write(
            self.style.SUCCESS(
                f'\nData loading complete!\n'
                f'Created: {created_count} events\n'
                f'Updated: {updated_count} events\n'
                f'Total: {Event.objects.count()} events in database'
            )
        )
