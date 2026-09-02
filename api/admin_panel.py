"""
Admin Panel API — server-side role checks on every request.
Uses Django's built-in User.is_staff as the admin gate.
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Q, Count
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from house_calc.models import (
    AuditLog, CalculationProject, Product, ProductOrder, SiteSettings, AdminNotification
)


def _admin_required(request):
    """Server-side admin check. Returns (user, None) or (None, Response)."""
    if not request.user.is_authenticated:
        return None, Response({'error': 'Avtorizatsiya talab qilinadi'}, status=401)
    if not request.user.is_staff:
        return None, Response({'error': 'Ruxsat yo\'q'}, status=403)
    return request.user, None


def _log_admin(admin_user, action, target_type, target_id='', details=''):
    """Create an audit log entry."""
    AuditLog.objects.create(
        admin_user=admin_user,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=details,
    )


@api_view(['GET'])
@ensure_csrf_cookie
def admin_auth_status(request):
    """Check if the current user is an admin."""
    if not request.user.is_authenticated:
        return Response({'authenticated': False, 'is_admin': False})
    return Response({
        'authenticated': True,
        'is_admin': request.user.is_staff,
        'user': {
            'id': request.user.pk,
            'name': request.user.get_full_name() or request.user.username,
            'phone': request.user.username,
            'is_staff': request.user.is_staff,
            'is_superuser': request.user.is_superuser,
        },
    })


@api_view(['GET'])
def admin_dashboard(request):
    """Dashboard statistics."""
    admin, err = _admin_required(request)
    if err:
        return err

    now = timezone.now()
    today = now.date()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    users_total = User.objects.count()
    users_today = User.objects.filter(date_joined__date=today).count()
    users_active_week = User.objects.filter(last_login__gte=week_ago).count()

    projects_total = CalculationProject.objects.count()
    projects_pending = CalculationProject.objects.filter(status='pending').count()
    projects_approved = CalculationProject.objects.filter(status='approved').count()
    projects_rejected = CalculationProject.objects.filter(status='rejected').count()
    projects_today = CalculationProject.objects.filter(created_at__date=today).count()

    products_total = Product.objects.count()
    orders_total = ProductOrder.objects.count()

    # Daily signups and projects for the last 30 days
    daily_signups = []
    daily_projects = []
    for i in range(30, -1, -1):
        d = (now - timedelta(days=i)).date()
        daily_signups.append({
            'date': d.isoformat(),
            'count': User.objects.filter(date_joined__date=d).count(),
        })
        daily_projects.append({
            'date': d.isoformat(),
            'count': CalculationProject.objects.filter(created_at__date=d).count(),
        })

    # Notifications requiring attention
    pending_projects = list(
        CalculationProject.objects.filter(status='pending')
        .order_by('-created_at')[:10]
        .values('id', 'user_name', 'area', 'rooms', 'created_at')
    )
    unread_notifications = AdminNotification.objects.filter(is_read=False).count()

    return Response({
        'stats': {
            'users_total': users_total,
            'users_today': users_today,
            'users_active_week': users_active_week,
            'projects_total': projects_total,
            'projects_pending': projects_pending,
            'projects_approved': projects_approved,
            'projects_rejected': projects_rejected,
            'projects_today': projects_today,
            'products_total': products_total,
            'orders_total': orders_total,
        },
        'daily_signups': daily_signups,
        'daily_projects': daily_projects,
        'pending_projects': pending_projects,
        'unread_notifications': unread_notifications,
    })


# --- Projects moderation ---

@api_view(['GET', 'POST'])
def admin_projects(request):
    """List/create projects (admin view)."""
    admin, err = _admin_required(request)
    if err:
        return err

    if request.method == 'GET':
        qs = CalculationProject.objects.all()

        # Filters
        status = request.query_params.get('status', '')
        if status:
            qs = qs.filter(status=status)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(user_name__icontains=search) |
                Q(id__icontains=search)
            )

        sort = request.query_params.get('sort', '-created_at')
        if sort in ('created_at', '-created_at', 'area', '-area', 'status', '-status'):
            qs = qs.order_by(sort)

        page = int(request.query_params.get('page', 1))
        per_page = int(request.query_params.get('per_page', 20))
        total = qs.count()
        start = (page - 1) * per_page
        projects = qs[start:start + per_page]

        return Response({
            'total': total,
            'page': page,
            'per_page': per_page,
            'results': [
                {
                    'id': p.id,
                    'user_name': p.user_name,
                    'area': p.area,
                    'rooms': p.rooms,
                    'bathrooms': p.bathrooms,
                    'status': p.status,
                    'features': p.features,
                    'source': p.source,
                    'created_at': p.created_at.isoformat(),
                    'has_pool': p.has_pool,
                    'has_garage': p.has_garage,
                    'has_terrace': p.has_terrace,
                    'images': p.images[:1] if p.images else [],
                }
                for p in projects
            ],
        })

    # POST = bulk approve/reject
    data = request.data
    action = data.get('action')  # 'approve' or 'reject'
    ids = data.get('ids', [])
    reason = data.get('reason', '')

    if action not in ('approve', 'reject') or not ids:
        return Response({'error': 'Noto\'g\'ri so\'rov'}, status=400)

    updated = CalculationProject.objects.filter(id__in=ids).update(status=action + 'd')
    for pid in ids:
        _log_admin(admin, f'Loyiha #{pid}ni {"tasdiqladi" if action == "approve" else "rad etdi"}', 'project', pid, reason)

    return Response({'updated': updated})


@api_view(['GET', 'PUT', 'DELETE'])
def admin_project_detail(request, pk):
    """View/edit/delete a single project."""
    admin, err = _admin_required(request)
    if err:
        return err

    try:
        project = CalculationProject.objects.get(pk=pk)
    except CalculationProject.DoesNotExist:
        return Response({'error': 'Loyiha topilmadi'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': project.id,
            'user_name': project.user_name,
            'area': project.area,
            'rooms': project.rooms,
            'bathrooms': project.bathrooms,
            'status': project.status,
            'features': project.features,
            'source': project.source,
            'images': project.images,
            'technical_drawings': project.technical_drawings,
            'ai_summary': project.ai_summary,
            'has_pool': project.has_pool,
            'has_garage': project.has_garage,
            'has_terrace': project.has_terrace,
            'created_at': project.created_at.isoformat(),
        })

    if request.method == 'PUT':
        data = request.data
        for field in ('user_name', 'area', 'rooms', 'bathrooms', 'status', 'features', 'has_pool', 'has_garage', 'has_terrace', 'ai_summary'):
            if field in data:
                setattr(project, field, data[field])
        project.save()
        _log_admin(admin, f'Loyiha #{pk}ni tahrirladi', 'project', pk)
        return Response({'ok': True})

    # DELETE
    project.delete()
    _log_admin(admin, f'Loyiha #{pk}ni o\'chirdi', 'project', pk)
    return Response({'ok': True})


# --- Users management ---

@api_view(['GET'])
def admin_users(request):
    """List all users."""
    admin, err = _admin_required(request)
    if err:
        return err

    qs = User.objects.all()

    search = request.query_params.get('search', '').strip()
    if search:
        qs = qs.filter(
            Q(username__icontains=search) |
            Q(first_name__icontains=search)
        )

    status_filter = request.query_params.get('status', '')
    if status_filter == 'active':
        qs = qs.filter(is_active=True)
    elif status_filter == 'suspended':
        qs = qs.filter(is_active=False)
    elif status_filter == 'admin':
        qs = qs.filter(is_staff=True)

    sort = request.query_params.get('sort', '-date_joined')
    if sort in ('date_joined', '-date_joined', 'username', '-username', 'last_login', '-last_login'):
        qs = qs.order_by(sort)

    page = int(request.query_params.get('page', 1))
    per_page = int(request.query_params.get('per_page', 20))
    total = qs.count()
    start = (page - 1) * per_page
    users = qs[start:start + per_page]

    return Response({
        'total': total,
        'page': page,
        'per_page': per_page,
        'results': [
            {
                'id': u.pk,
                'name': u.get_full_name() or u.username,
                'phone': u.username,
                'is_staff': u.is_staff,
                'is_superuser': u.is_superuser,
                'is_active': u.is_active,
                'date_joined': u.date_joined.isoformat(),
                'last_login': u.last_login.isoformat() if u.last_login else None,
                'project_count': CalculationProject.objects.filter(user_name=u.get_full_name()).count(),
            }
            for u in users
        ],
    })


@api_view(['GET', 'PUT'])
def admin_user_detail(request, pk):
    """View/edit a user."""
    admin, err = _admin_required(request)
    if err:
        return err

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'Foydalanuvchi topilmadi'}, status=404)

    if request.method == 'GET':
        projects = list(
            CalculationProject.objects.filter(user_name=user.get_full_name())
            .order_by('-created_at')[:20]
            .values('id', 'area', 'rooms', 'status', 'created_at')
        )
        return Response({
            'id': user.pk,
            'name': user.get_full_name(),
            'phone': user.username,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'is_active': user.is_active,
            'date_joined': user.date_joined.isoformat(),
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'projects': projects,
        })

    # PUT
    data = request.data
    if 'is_active' in data:
        user.is_active = data['is_active']
    if 'is_staff' in data:
        user.is_staff = data['is_staff']
    if 'is_superuser' in data:
        user.is_superuser = data['is_superuser']
    user.save()

    action = 'foydalanuvchini faolsizlantirdi' if not user.is_active else 'foydalanuvchini faollashtirdi'
    if 'is_staff' in data:
        action = 'admin huquqini o\'zgartirdi'
    _log_admin(admin, f'{user.get_full_name() or user.username} — {action}', 'user', pk)

    return Response({'ok': True})


@api_view(['DELETE'])
def admin_user_delete(request, pk):
    """Delete a user."""
    admin, err = _admin_required(request)
    if err:
        return err

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'Foydalanuvchi topilmadi'}, status=404)

    name = user.get_full_name() or user.username
    user.delete()
    _log_admin(admin, f'{name}ni o\'chirdi', 'user', pk)
    return Response({'ok': True})


# --- Reviews (placeholder — no Review model yet, but we'll add one) ---
# For now, return empty — reviews will be added when Review model is created.

@api_view(['GET'])
def admin_reviews(request):
    """List reviews (placeholder)."""
    admin, err = _admin_required(request)
    if err:
        return err
    return Response({'total': 0, 'results': []})


# --- Categories & Regions ---

@api_view(['GET'])
def admin_categories(request):
    """List product categories with counts."""
    admin, err = _admin_required(request)
    if err:
        return err

    cats = (
        Product.objects.values('category')
        .annotate(count=Count('id'))
        .order_by('category')
    )
    return Response({
        'results': [
            {'name': c['category'], 'count': c['count']}
            for c in cats
        ]
    })


@api_view(['GET'])
def admin_regions(request):
    """List regions with project counts."""
    admin, err = _admin_required(request)
    if err:
        return err
    # Regions are stored in frontend config, not DB
    # Return basic info for now
    return Response({
        'results': [
            {'name': 'Toshkent', 'code': 'toshkent'},
            {'name': 'Samarqand', 'code': 'samarqand'},
            {'name': 'Buxoro', 'code': 'buxoro'},
            {'name': 'Andijon', 'code': 'andijon'},
            {'name': 'Farg\'ona', 'code': 'fargona'},
            {'name': 'Namangan', 'code': 'namangan'},
            {'name': 'Qashqadaryo', 'code': 'qashqadaryo'},
            {'name': 'Surxondaryo', 'code': 'surxondaryo'},
            {'name': 'Xorazm', 'code': 'xorazm'},
            {'name': 'Navoiy', 'code': 'navoiy'},
            {'name': 'Jizzax', 'code': 'jizzax'},
            {'name': 'Sirdaryo', 'code': 'sirdaryo'},
            {'name': 'Qoraqalpog\'iston', 'code': 'qoraqalpogiston'},
            {'name': 'Toshkent viloyati', 'code': 'toshkent_viloyati'},
        ]
    })


# --- Site Settings ---

@api_view(['GET', 'PUT'])
def admin_settings(request):
    """Get/update site settings."""
    admin, err = _admin_required(request)
    if err:
        return err

    settings = SiteSettings.load()

    if request.method == 'GET':
        return Response({
            'site_name': settings.site_name,
            'tagline': settings.tagline,
            'contact_phone': settings.contact_phone,
            'contact_email': settings.contact_email,
            'maintenance_mode': settings.maintenance_mode,
            'allow_new_projects': settings.allow_new_projects,
            'allow_reviews': settings.allow_reviews,
            'allow_ai_chat': settings.allow_ai_chat,
            'allow_store': settings.allow_store,
            'store_api_url': settings.store_api_url,
            'store_api_key': bool(settings.store_api_key),
            'anthropic_api_key': bool(settings.anthropic_api_key),
            'groq_api_key': bool(settings.groq_api_key),
            'updated_at': settings.updated_at.isoformat(),
        })

    # PUT
    data = request.data
    for field in ('site_name', 'tagline', 'contact_phone', 'contact_email',
                  'maintenance_mode', 'allow_new_projects', 'allow_reviews',
                  'allow_ai_chat', 'allow_store',
                  'store_api_url', 'store_api_key', 'anthropic_api_key', 'groq_api_key'):
        if field in data:
            setattr(settings, field, data[field])
    settings.save()
    _log_admin(admin, 'Sayt sozlamalarini yangiladi', 'setting')
    return Response({'ok': True})


# --- Audit Log ---

@api_view(['GET'])
def admin_audit_log(request):
    """List audit log entries (read-only)."""
    admin, err = _admin_required(request)
    if err:
        return err

    qs = AuditLog.objects.all()

    action_filter = request.query_params.get('action', '')
    if action_filter:
        qs = qs.filter(action__icontains=action_filter)

    admin_filter = request.query_params.get('admin', '')
    if admin_filter:
        qs = qs.filter(admin_user__username__icontains=admin_filter)

    page = int(request.query_params.get('page', 1))
    per_page = int(request.query_params.get('per_page', 30))
    total = qs.count()
    start = (page - 1) * per_page
    logs = qs[start:start + per_page]

    return Response({
        'total': total,
        'page': page,
        'per_page': per_page,
        'results': [
            {
                'id': l.id,
                'admin_name': l.admin_user.get_full_name() if l.admin_user else 'System',
                'action': l.action,
                'target_type': l.target_type,
                'target_id': l.target_id,
                'details': l.details,
                'created_at': l.created_at.isoformat(),
            }
            for l in logs
        ],
    })


# --- Notifications ---

@api_view(['GET'])
def admin_notifications(request):
    """List admin notifications."""
    admin, err = _admin_required(request)
    if err:
        return err

    qs = AdminNotification.objects.all()
    unread_only = request.query_params.get('unread', '')
    if unread_only == 'true':
        qs = qs.filter(is_read=False)

    return Response({
        'results': [
            {
                'id': n.id,
                'type': n.notif_type,
                'title': n.title,
                'target_type': n.target_type,
                'target_id': n.target_id,
                'is_read': n.is_read,
                'created_at': n.created_at.isoformat(),
            }
            for n in qs[:50]
        ]
    })


@api_view(['POST'])
def admin_notifications_mark_read(request):
    """Mark notifications as read."""
    admin, err = _admin_required(request)
    if err:
        return err

    ids = request.data.get('ids', [])
    if ids:
        AdminNotification.objects.filter(id__in=ids).update(is_read=True)
    else:
        AdminNotification.objects.filter(is_read=False).update(is_read=True)

    return Response({'ok': True})
