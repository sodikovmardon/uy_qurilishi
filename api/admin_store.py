"""
Store-owner admin API — separate auth (StoreOwner session) from the public
storefront. Handles product CRUD, bulk stock, bulk price, dashboard, orders.

Auth model: a dedicated StoreOwner table with its own session flag
('store_owner_id'), completely separate from the site's public user sessions.
"""
from django.contrib.auth.hashers import check_password
from django.core.files.storage import default_storage
from django.db.models import Q
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

import re

from house_calc.models import (
    LOW_STOCK_THRESHOLD,
    Product,
    ProductOrder,
    StoreOwner,
)

from api.images import ImageError, reorder_keys, save_uploads, to_absolute
from api.security import (
    AuthThrottle,
    OrdersThrottle,
    StoreAdminThrottle,
    clear_failed_logins,
    csrf_protected,
    login_blocked,
    mark_failed_login,
)
from api.store import StoreProductSerializer


def _current_owner(request):
    owner_id = request.session.get('store_owner_id')
    if not owner_id:
        return None
    return StoreOwner.objects.filter(pk=owner_id).first()


def _owner_required(request):
    owner = _current_owner(request)
    if owner is None:
        return None, Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    return owner, None


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
@csrf_protected
def admin_login(request):
    username = str(request.data.get('username', '')).strip()
    password = str(request.data.get('password', ''))
    if login_blocked(username, request):
        return Response({'error': 'Ko\'p marta xato urinish. 15 daqiqadan keyin qayta urinib ko\'ring'}, status=429)
    owner = StoreOwner.objects.filter(username=username).first()
    if owner is None or not check_password(password, owner.password_hash):
        mark_failed_login(username, request)
        return Response({'error': 'Login yoki parol noto\'g\'ri'}, status=400)
    clear_failed_logins(username, request)
    request.session['store_owner_id'] = owner.pk
    return Response({
        'id': owner.pk,
        'username': owner.username,
        'name': owner.name or owner.username,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_protected
def admin_logout(request):
    request.session.pop('store_owner_id', None)
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def admin_status(request):
    owner = _current_owner(request)
    if owner is None:
        return Response({'authenticated': False, 'owner': None})
    return Response({
        'authenticated': True,
        'owner': {'id': owner.pk, 'username': owner.username, 'name': owner.name or owner.username},
    })


# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
def admin_dashboard(request):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)

    products = Product.objects.all()
    total = products.count()
    in_stock = products.filter(stock_quantity__gt=LOW_STOCK_THRESHOLD).count()
    low_stock = products.filter(stock_quantity__gt=0, stock_quantity__lte=LOW_STOCK_THRESHOLD).count()
    out_of_stock = products.filter(stock_quantity=0).count()
    orders = ProductOrder.objects.count()

    low_stock_list = [
        {
            'id': p.pk,
            'name': p.name,
            'category': p.category,
            'stock_quantity': p.stock_quantity,
            'status': p.stock_status,
        }
        for p in products.filter(stock_quantity__lte=LOW_STOCK_THRESHOLD)[:10]
    ]

    recent = StoreProductSerializer(
        products.order_by('-last_updated')[:10], many=True, context={'request': request}
    ).data

    return Response({
        'totals': {
            'total': total,
            'in_stock': in_stock,
            'low_stock': low_stock,
            'out_of_stock': out_of_stock,
            'orders': orders,
        },
        'low_stock_threshold': LOW_STOCK_THRESHOLD,
        'low_stock': low_stock_list,
        'recent': recent,
    })


# --------------------------------------------------------------------------
# Products CRUD
# --------------------------------------------------------------------------

def _product_payload(request, product: Product) -> Product:
    data = request.data
    text = lambda *keys: next((str(data.get(k, '')).strip() for k in keys if data.get(k)), '')
    product.name = text('name') or product.name
    product.category = text('category') or product.category
    product.unit = text('unit') or product.unit
    product.sku = text('sku')
    product.description = text('description')
    try:
        price = int(float(text('price')))
        if price >= 0:
            product.price = price
    except (TypeError, ValueError):
        pass
    try:
        qty = int(text('stock_quantity', 'quantity'))
        if qty >= 0:
            product.stock_quantity = qty
    except (TypeError, ValueError):
        pass
    image = data.get('image') or request.FILES.get('image')
    if image:
        # Validate the file is really an image before storing (magic bytes).
        try:
            from PIL import Image as PILImage
            pil = PILImage.open(image)
            pil.verify()
            image.seek(0)
        except Exception:
            raise ValueError('Yaroqli rasm fayli emas')
        product.image = image
    return product


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
@csrf_protected
def admin_products(request):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)

    if request.method == 'POST':
        product = Product()
        try:
            _product_payload(request, product)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        if not product.name:
            return Response({'error': 'Mahsulot nomi kiritilishi shart'}, status=400)
        product.save()
        return Response(StoreProductSerializer(product, context={'request': request}).data, status=201)

    qs = Product.objects.all()
    search = request.GET.get('search', '').strip()
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))
    category = request.GET.get('category', '').strip()
    if category:
        qs = qs.filter(category=category)
    data = StoreProductSerializer(qs.order_by('-last_updated'), many=True, context={'request': request}).data
    return Response(data)


@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
@csrf_protected
def admin_product_detail(request, pk):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Mahsulot topilmadi'}, status=404)

    if request.method == 'DELETE':
        product.delete()
        return Response({'ok': True})

    try:
        _product_payload(request, product)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=400)
    product.save()
    return Response(StoreProductSerializer(product, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
@csrf_protected
def admin_stock_bulk(request):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    updates = request.data.get('updates') or []
    updated = 0
    for item in updates:
        try:
            product = Product.objects.get(pk=int(item['id']))
            qty = int(item['quantity'])
            if qty >= 0:
                product.stock_quantity = qty
                product.save(update_fields=['stock_quantity', 'last_updated'])
                updated += 1
        except (KeyError, TypeError, ValueError, Product.DoesNotExist):
            continue
    return Response({'updated': updated})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
@csrf_protected
def admin_price_bulk(request):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    try:
        percent = float(request.data.get('percent', 0))
    except (TypeError, ValueError):
        return Response({'error': 'Foiz noto\'g\'ri'}, status=400)

    category = str(request.data.get('category', '')).strip()
    qs = Product.objects.all()
    if category and category.lower() != 'all':
        qs = qs.filter(category=category)

    factor = 1 + percent / 100
    updated = 0
    for product in qs:
        product.price = max(0, round(float(product.price) * factor))
        product.save(update_fields=['price', 'last_updated'])
        updated += 1
    return Response({'updated': updated})


# --------------------------------------------------------------------------
# Product images (gallery: 1 primary + up to 5 more)
# --------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
@csrf_protected
def admin_product_images_upload(request, pk):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Mahsulot topilmadi'}, status=404)
    try:
        keys = save_uploads(request.FILES.getlist('images'), 'products', product.images)
    except ImageError as exc:
        return Response({'error': str(exc)}, status=400)
    product.images = keys
    # Real photos uploaded by the owner replace seed demo imagery.
    product.image_source = 'upload' if keys else product.image_source
    product.save(update_fields=['images', 'image_source'])
    return Response({'images': [to_absolute(request, key) for key in keys]})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
@csrf_protected
def admin_product_images_reorder(request, pk):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Mahsulot topilmadi'}, status=404)
    resolved = reorder_keys(request.data.get('images'), product.images)
    for key in product.images:
        if key not in resolved:
            try:
                if not key.startswith(('http://', 'https://')) and default_storage.exists(key):
                    default_storage.delete(key)
            except Exception:
                pass
    product.images = resolved
    product.save(update_fields=['images'])
    return Response({'images': [to_absolute(request, key) for key in resolved]})


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
def admin_categories(request):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    names = Product.objects.order_by('category').values_list('category', flat=True).distinct()
    return Response(list(names))


# --------------------------------------------------------------------------
# Orders
# --------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StoreAdminThrottle])
def admin_orders(request):
    if _current_owner(request) is None:
        return Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    orders = [
        {
            'id': o.pk,
            'product_id': o.product_id,
            'product': o.product.name,
            'quantity': o.quantity,
            'customer_name': o.customer_name,
            'phone': o.phone,
            'note': o.note,
            'created_at': o.created_at.isoformat(),
        }
        for o in ProductOrder.objects.select_related('product')[:50]
    ]
    return Response(orders)


@extend_schema(summary='Buyurtma yaratish', description='Do\'kondan buyurtma (kontakt asosida)')
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OrdersThrottle])
@csrf_protected
def create_order(request):
    try:
        product = Product.objects.get(pk=int(request.data.get('product_id')))
    except (TypeError, ValueError, Product.DoesNotExist):
        return Response({'error': 'Mahsulot topilmadi'}, status=404)

    phone = str(request.data.get('phone', '')).strip()
    # Normalize: keep digits, +, space, dashes. Cap length to prevent abuse.
    phone = re.sub(r'[^\d+() -]', '', phone)
    if not phone:
        return Response({'error': 'Telefon raqami kiritilishi shart'}, status=400)
    if len(phone) > 30:
        return Response({'error': 'Telefon raqami juda uzun'}, status=400)

    try:
        quantity = max(1, min(int(request.data.get('quantity', 1)), 9999))
    except (TypeError, ValueError):
        quantity = 1

    order = ProductOrder.objects.create(
        product=product,
        quantity=quantity,
        customer_name=str(request.data.get('name', '')).strip(),
        phone=phone,
        note=str(request.data.get('note', '')).strip(),
    )
    return Response({
        'ok': True,
        'id': order.pk,
        'product': product.name,
        'quantity': quantity,
        'total': int(product.price) * quantity,
    }, status=201)
