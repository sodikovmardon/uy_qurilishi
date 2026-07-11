from django.urls import path

from house_calc import views

app_name = 'house_calc'

urlpatterns = [
    path('', views.react_app, name='home'),
    path('django-home', views.home, name='django_home'),
    path('projects/', views.project_list, name='project_list'),
    path('projects/<int:pk>/details/', views.project_detail, name='project_detail'),
    path('projects/<int:pk>/pdf/', views.project_pdf, name='project_pdf'),
    path('projects/<int:pk>/preview/', views.project_preview, name='project_preview'),
    path('create/', views.project_create, name='project_create'),
    path('products/<int:pk>/preview/', views.product_preview, name='product_preview'),
]
