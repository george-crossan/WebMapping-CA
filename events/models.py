from django.contrib.gis.db import models
from django.contrib.gis.geos import Point


class Event(models.Model):
    name = models.CharField(max_length=200)
    venue = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    start_date = models.DateTimeField()
    url = models.URLField()


    # Spatial field
    location = models.PointField(srid=4326, help_text="Geographic coordinates")
    
    def save(self, *args, **kwargs):
            # Automatically create Point from lat/lng when saving
            if self.latitude and self.longitude:
                self.location = Point(float(self.longitude), float(self.latitude))
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.city}"
    
    @property
    def latitude(self):
        return self.location.y if self.location else None
    
    @property
    def longitude(self):
        return self.location.x if self.location else None
    
    @property 
    def coordinates(self):
        return [float(self.latitude), float(self.longitude)]

    class Meta:
        verbose_name_plural = "events"
        ordering = ["start_date"]
        indexes = [models.Index(fields=["country", "city"])]
