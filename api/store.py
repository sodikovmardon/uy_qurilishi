"""
Public read-only store API (v1) consumed by external partner apps.

Endpoints:
    GET /api/v1/products          — list (filters: category, search, in_stock)
    GET /api/v1/products/<id>/    — single product
    GET /api/v1/categories/       — available categories

Field naming is snake_case throughout. Responses are JSON. The API is
rate-limited (120 req/min per IP) and optionally gated by an X-API-Key
header once at least one ApiClient key has been issued.
"""
from django.db.models import Count, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from api.security import StoreThrottle

from house_calc.models import ApiClient, Product

from api.images import to_absolute


# --------------------------------------------------------------------------
# Serializer
# --------------------------------------------------------------------------

class StoreProductSerializer(serializers.ModelSerializer):
    price = serializers.IntegerField()
    stock_status = serializers.CharField(read_only=True)
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'category', 'unit', 'price', 'stock_quantity',
            'stock_status', 'image_url', 'images', 'description', 'sku', 'last_updated',
        ]

    def get_images(self, obj) -> list[str]:
        request = self.context.get('request')
        return [to_absolute(request, url) for url in obj.images]

    def get_image_url(self, obj) -> str | None:
        if obj.images:
            return self.get_images(obj)[0]
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


# --------------------------------------------------------------------------
# API-key gate (optional: only enforced once keys have been issued)
# --------------------------------------------------------------------------

def api_key_valid(request) -> bool:
    if not ApiClient.objects.filter(is_active=True).exists():
        return True  # no keys issued yet -> open access
    key = request.headers.get('X-API-Key', '')
    return bool(key) and ApiClient.objects.filter(key=key, is_active=True).exists()


# --------------------------------------------------------------------------
# Views
# --------------------------------------------------------------------------

@extend_schema(
    summary='Mahsulotlar ro\'yxati',
    description='Barcha mahsulotlar. Filtrlar: ?category=G\'isht, ?search=silikat, ?in_stock=true',
    parameters=[
        OpenApiParameter(name='category', description='Kategoriya bo\'yicha filtr'),
        OpenApiParameter(name='search', description='Nom yoki tavsif bo\'yicha qidiruv'),
        OpenApiParameter(name='in_stock', description='Faqat omborda borlar (true/false)'),
    ],
)
@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StoreThrottle])
def store_products(request):
    if not api_key_valid(request):
        return Response({'error': 'Yaroqsiz API kaliti'}, status=401)

    qs = Product.objects.all()

    category = request.GET.get('category', '').strip()
    if category:
        qs = qs.filter(category__iexact=category)

    search = request.GET.get('search', '').strip()
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

    in_stock = request.GET.get('in_stock', '').strip().lower()
    if in_stock in ('1', 'true', 'yes', 'ha'):
        qs = qs.filter(stock_quantity__gt=0)

    data = StoreProductSerializer(qs, many=True, context={'request': request}).data
    return Response(data)


@extend_schema(summary='Bitta mahsulot', description='Mahsulot to\'liq ma\'lumotlari')
@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StoreThrottle])
def store_product_detail(request, pk):
    if not api_key_valid(request):
        return Response({'error': 'Yaroqsiz API kaliti'}, status=401)
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Mahsulot topilmadi'}, status=404)
    data = StoreProductSerializer(product, context={'request': request}).data
    return Response(data)


@extend_schema(summary='Kategoriyalar', description='Mavjud kategoriyalar va soni')
@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StoreThrottle])
def store_categories(request):
    if not api_key_valid(request):
        return Response({'error': 'Yaroqsiz API kaliti'}, status=401)
    rows = (
        Product.objects.values('category')
        .annotate(product_count=Count('id'))
        .order_by('category')
    )
    return Response(list(rows))
