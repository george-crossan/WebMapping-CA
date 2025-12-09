from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.urls import reverse_lazy
from django.views.generic import CreateView
from django.contrib.auth.decorators import login_required
from .forms import LoginForm, SignUpForm


class CustomLoginView(LoginView):
    """Custom login view using our custom form."""
    form_class = LoginForm
    template_name = 'authentication/login.html'
    redirect_authenticated_user = True

    def form_valid(self, form):
        """Add success message on login."""
        messages.success(self.request, f'Welcome back, {form.get_user().username}!')
        return super().form_valid(form)

    def form_invalid(self, form):
        """Add error message on login failure."""
        messages.error(self.request, 'Invalid username or password.')
        return super().form_invalid(form)


class SignUpView(CreateView):
    """User registration view."""
    form_class = SignUpForm
    template_name = 'authentication/signup.html'
    success_url = reverse_lazy('authentication:login')

    def form_valid(self, form):
        """Auto-login after successful registration."""
        response = super().form_valid(form)
        user = form.save()
        login(self.request, user)
        messages.success(self.request, f'Welcome, {user.username}! Your account has been created.')
        return redirect('events:map')

    def form_invalid(self, form):
        """Add error message on registration failure."""
        messages.error(self.request, 'Please correct the errors below.')
        return super().form_invalid(form)


def custom_logout_view(request):
    """Custom logout view with success message."""
    username = request.user.username if request.user.is_authenticated else 'User'
    logout(request)
    messages.success(request, f'Goodbye, {username}! You have been logged out.')
    return redirect('events:map')


@login_required
def profile_view(request):
    """User profile view showing user information."""
    return render(request, 'authentication/profile.html')


def home_view(request):
    """Authentication home page showing login/signup options or user info."""
    if request.user.is_authenticated:
        return render(request, 'authentication/dashboard.html')
    return render(request, 'authentication/home.html')