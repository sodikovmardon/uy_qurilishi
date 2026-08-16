"""
Calculator ↔ partner-store integration layer.

The material calculator ("Uy Loyiha Studio") shows live prices and stock
availability from the partner hardware store ("Xo'jalik mollari do'koni")
instead of generic defaults. This module is the app's OWN backend proxy:

    GET  /api/calc/store-prices/   → store product catalog as StoreProduct[]
    POST /api/calc/inquiry/        → bundle-order (inquiry) for calculator materials

Why a proxy? So the store's API key (if the store starts requiring one) stays
server-side — the browser only ever talks to this same-origin endpoint. If a
second hardware store is added later, add another proxy view here that forwards
to that store's public API with its key, and add a source entry in
frontend/src/lib/storeApi.ts.
"""
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from house_calc.models import Product, ProductOrder

from api.security import CalcThrottle, OrdersThrottle, csrf_protected
from api.store import StoreProductSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def store_prices(request):
    """Catalog snapshot for the calculator. Always fresh from the DB (the
    frontend applies its own short-lived cache)."""
    products = Product.objects.all().order_by('category', 'name')
    data = StoreProductSerializer(products, many=True, context={'request': request}).data
    return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OrdersThrottle])
@csrf_protected
def inquiry(request):
    """Accept one bundled inquiry for many materials and create a ProductOrder
    per item, so the store owner sees every requested material in the admin
    orders panel."""
    name = str(request.data.get('name', '')).strip()[:100]
    phone = str(request.data.get('phone', '')).strip()
    note = str(request.data.get('note', '')).strip()[:500]
    if not phone:
        return Response({'error': 'Telefon raqami kiritilishi shart'}, status=400)

    items = request.data.get('items') or []
    if not isinstance(items, list) or not items:
        return Response({'error': 'Mahsulotlar ro\'yxati kiritilishi shart'}, status=400)
    if len(items) > 100:
        return Response({'error': 'Mahsulotlar ro\'yxati juda katta'}, status=400)

    created = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            product = Product.objects.get(pk=int(item.get('product_id')))
        except (TypeError, ValueError, Product.DoesNotExist):
            continue
        try:
            qty = max(1, int(item.get('quantity', 1)))
        except (TypeError, ValueError):
            qty = 1
        order = ProductOrder.objects.create(
            product=product,
            quantity=qty,
            customer_name=name,
            phone=phone,
            note=note,
        )
        created.append({'id': order.pk, 'product': product.name, 'quantity': qty})

    if not created:
        return Response({'error': 'Hech qanday mahsulot topilmadi'}, status=404)
    return Response({'ok': True, 'count': len(created), 'items': created}, status=201)
