from django.urls import path

from api import views
from api import admin_store
from api import store
from api import calc

urlpatterns = [
    path('calculate/', views.calculate, name='api_calculate'),
    path('projects/', views.project_list, name='api_project_list'),
    path('projects/create/', views.project_create, name='api_project_create'),
    path('projects/<int:pk>/', views.project_detail, name='api_project_detail'),
    path('projects/<int:pk>/update/', views.project_update, name='api_project_update'),
    path('projects/<int:pk>/images/', views.project_images_upload, name='api_project_images_upload'),
    path('projects/<int:pk>/images/reorder/', views.project_images_reorder, name='api_project_images_reorder'),
    path('projects/<int:pk>/drawings/', views.project_drawings_upload, name='api_project_drawings_upload'),
    path('projects/<int:pk>/drawings/update/', views.project_drawings_update, name='api_project_drawings_update'),
    path('projects/<int:pk>/drawings/zip/', views.project_drawings_zip, name='api_project_drawings_zip'),
    path('auth/signup/', views.auth_signup, name='api_signup'),
    path('auth/login/', views.auth_login, name='api_login'),
    path('auth/logout/', views.auth_logout, name='api_logout'),
    path('auth/status/', views.auth_status, name='api_auth_status'),
    path('dashboard/', views.dashboard, name='api_dashboard'),
    path('chat/', views.chat, name='api_chat'),

    # Public store API (v1) — consumed by external partner apps.
    path('v1/products/', store.store_products, name='store_products'),
    path('v1/products/<int:pk>/', store.store_product_detail, name='store_product_detail'),
    path('v1/categories/', store.store_categories, name='store_categories'),

    # Store-owner admin API.
    path('admin/auth/login/', admin_store.admin_login, name='store_admin_login'),
    path('admin/auth/logout/', admin_store.admin_logout, name='store_admin_logout'),
    path('admin/auth/status/', admin_store.admin_status, name='store_admin_status'),
    path('admin/dashboard/', admin_store.admin_dashboard, name='store_admin_dashboard'),
    path('admin/products/', admin_store.admin_products, name='store_admin_products'),
    path('admin/products/<int:pk>/', admin_store.admin_product_detail, name='store_admin_product_detail'),
    path('admin/products/<int:pk>/images/', admin_store.admin_product_images_upload, name='store_admin_product_images_upload'),
    path('admin/products/<int:pk>/images/reorder/', admin_store.admin_product_images_reorder, name='store_admin_product_images_reorder'),
    path('admin/stock/bulk/', admin_store.admin_stock_bulk, name='store_admin_stock_bulk'),
    path('admin/price/bulk/', admin_store.admin_price_bulk, name='store_admin_price_bulk'),
    path('admin/categories/', admin_store.admin_categories, name='store_admin_categories'),
    path('admin/orders/', admin_store.admin_orders, name='store_admin_orders'),

    # Storefront orders (public contact-based form).
    path('orders/create/', admin_store.create_order, name='store_order_create'),

    # Calculator ↔ store integration (backend proxy keeps store keys server-side).
    path('calc/store-prices/', calc.store_prices, name='calc_store_prices'),
    path('calc/inquiry/', calc.inquiry, name='calc_inquiry'),
]
