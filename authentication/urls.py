from django.urls import path
from . import views

app_name = 'authentication'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.custom_logout_view, name='logout'),
    path('signup/', views.SignUpView.as_view(), name='signup'),
    path('profile/', views.profile_view, name='profile'),
]