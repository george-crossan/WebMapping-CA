# Advanced Web Mapping Labs - Solutions

This repository contains a web mapping application for my Advanced Web Mapping module at TU Dublin

# 📝 Overview

This demonstrates what I have learned throughout this module, including Django, PostGIS, and modern web technologies.

# 🔭 Technologies Used
    Backend: Django 4.2.7 with PostGIS
    Database: PostgreSQL with PostGIS extension
    Frontend: HTML5, CSS3, JavaScript (ES6+)
    Mapping: Leaflet.js
    APIs: Django REST Framework
    Styling: Bootstrap 5
    Data Format: GeoJSON


# Features:
    Data Import from Ticketmaster Discovery API
    Basic events spatial model
    Simple map visualization
    Data import commands 

# Database Schema:
## Model: Event
Spatial model that represents an event with geolocatin and metadata like venue, date, and URL

| Field Name | Type | Description |
| --- | ----------- | --- |
| id | AutoField (PK) | Primary Key added by django automatically |
| name | CharField | Event Name |
| venue | CharField | Venue name |
| city | CharField | City of event |
| country | CharField | Country of events |
| start_date | DateTimeField | Event start date and time |
| url | URLField | Official event URL |
| location | PointField | Geographic coordinates (longitude, latitude) |

# 🔧 Setup

##  Requirements
    Python 3.8+
    Git
    Docker

## Local Deployment

### Clone the repository:
    git clone https://github.com/george-crossan/WebMapping-CA1.git
    cd WebMapping-CA1

### Set up virtual environment:
    python -m venv venv
    venv\Scripts\activate

### Install dependencies:
    pip install -r requirements.txt

### Start up database (PostgreSQL with PostGIS):
    docker run -d --name CA-db -e POSTGRES_DB=CA_db -e POSTGRES_USER=CA_user -e POSTGRES_PASSWORD=CA123 -p 5434:5432 postgis/postgis

### Run migrations:
    python manage.py migrate

### Import Ticketmaster Data
First you'll need to register to the [Ticketmaster developer website](https://developer.ticketmaster.com) and generate an API key.

You'll also need to generate a secret key using the command:

    python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

Then add these keys to a new file named .env:

    TICKETMASTER_API_KEY='your_key_here'
    SECRET_KEY='your_key_here'

Then you can run:

    python manage.py load_events --clear --country IE   

### Start Server:    
    python manage.py runserver

You can now access the app from [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

# 🌐 API Endpoints
## Events API

    GET /api/events/ - List all events
    GET /api/geojson/ - Events GeoJson

