from django.urls import path

from api import views

urlpatterns = [
    path('calculate/', views.calculate, name='api_calculate'),
    path('projects/', views.project_list, name='api_project_list'),
    path('projects/create/', views.project_create, name='api_project_create'),
    path('projects/<int:pk>/', views.project_detail, name='api_project_detail'),
    path('projects/<int:pk>/update/', views.project_update, name='api_project_update'),
    path('auth/signup/', views.auth_signup, name='api_signup'),
    path('auth/login/', views.auth_login, name='api_login'),
    path('auth/logout/', views.auth_logout, name='api_logout'),
    path('auth/status/', views.auth_status, name='api_auth_status'),
    path('dashboard/', views.dashboard, name='api_dashboard'),
]
