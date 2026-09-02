from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

import json
import logging

logger = logging.getLogger('api.auth')

from api.drawings import (
    DrawingError,
    build_zip,
    delete_drawing_files,
    drawing_entries,
    resolve_drawings,
    upload_drawings,
)
from api.images import ImageError, reorder_keys, save_uploads, to_absolute
from api.materials import calculate_materials as _calculate_materials
from api.security import (
    AuthThrottle,
    CalcThrottle,
    ChatThrottle,
    FilesThrottle,
    SignupThrottle,
    clear_failed_logins,
    csrf_protected,
    login_blocked,
    mark_failed_login,
    validate_password_policy,
)
from api.serializers import (
    AuthSerializer,
    CalculateSerializer,
    ProjectCreateSerializer,
    ProjectSerializer,
    SignupSerializer,
)
from house_calc.models import CalculationProject
from house_calc.services import save_project
from api.chat import chat


@extend_schema(
    request=CalculateSerializer,
    responses={200: OpenApiExample('Result', value={'bricks': 44694, 'cement': 22.3, 'sand': 66.9, 'storeys': 1})},
    summary='Materiallarni hisoblash',
    description='Uy maydoni va xonalar soni bo\'yicha g\'isht, sement, qum miqdorini hisoblaydi',
)
@api_view(['POST'])
@permission_classes([AllowAny])
def calculate(request):
    serializer = CalculateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = _calculate_materials(
        serializer.validated_data['area'],
        serializer.validated_data['rooms'],
    )
    return Response(result)


@extend_schema(
    summary='Loyihalar ro\'yxati',
    description='Barcha loyihalarni sahifalab olish (har sahifada 12 ta)',
    parameters=[OpenApiExample('page', value=1, description='Sahifa raqami')],
)
@api_view(['GET'])
@permission_classes([AllowAny])
def project_list(request):
    projects = CalculationProject.objects.filter(status='approved').order_by('-created_at')
    page = int(request.GET.get('page', 1))
    per_page = 12
    start = (page - 1) * per_page
    end = start + per_page
    data = ProjectSerializer(projects[start:end], many=True, context={'request': request}).data
    return Response({
        'results': data,
        'total': projects.count(),
        'page': page,
    })


@extend_schema(
    request=ProjectCreateSerializer,
    responses={201: ProjectSerializer},
    summary='Yangi loyiha yaratish',
    description='Yangi qurilish loyihasini yaratadi va materiallarni avtomatik hisoblaydi',
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
@csrf_protected
def project_create(request):
    serializer = ProjectCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    project = save_project(
        area=serializer.validated_data['area'],
        rooms=serializer.validated_data['rooms'],
        bathrooms=serializer.validated_data['bathrooms'],
        has_pool=serializer.validated_data['has_pool'],
        has_garage=serializer.validated_data['has_garage'],
        has_terrace=serializer.validated_data['has_terrace'],
        features=serializer.validated_data.get('features', []),
        user_name=serializer.validated_data.get('user_name', ''),
        source=CalculationProject.SOURCE_WEB,
    )
    return Response(ProjectSerializer(project, context={'request': request}).data, status=201)


@extend_schema(
    responses={200: ProjectSerializer},
    summary='Loyiha detali',
    description='Bitta loyiha haqida to\'liq ma\'lumot (AI tavsiya bilan)',
)
@api_view(['GET'])
@permission_classes([AllowAny])
def project_detail(request, pk):
    try:
        project = CalculationProject.objects.get(pk=pk)
        if project.status != 'approved':
            raise CalculationProject.DoesNotExist
    except CalculationProject.DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    data = ProjectSerializer(project, context={'request': request}).data
    data['ai_summary'] = project.ai_summary or ''
    data['storeys'] = _calculate_materials(project.area, project.rooms)['storeys']
    return Response(data)


@extend_schema(
    request=ProjectCreateSerializer,
    responses={200: ProjectSerializer},
    summary='Loyihani yangilash',
    description='Mavjud loyiha ma\'lumotlarini yangilaydi',
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@throttle_classes([FilesThrottle])
@csrf_protected
def project_update(request, pk):
    try:
        project = CalculationProject.objects.get(pk=pk)
    except CalculationProject.DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    serializer = ProjectCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for field, value in serializer.validated_data.items():
        setattr(project, field, value)
    project.save()
    return Response(ProjectSerializer(project, context={'request': request}).data)


@extend_schema(
    summary='Loyiha rasmlarini yuklash',
    description='Multipart "images" maydonidagi fayllarni yuklaydi. JPG/PNG/WebP, har biri 5 MB gacha, jami 6 ta.',
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([FilesThrottle])
@csrf_protected
def project_images_upload(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    try:
        keys = save_uploads(request.FILES.getlist('images'), 'projects', project.images)
    except ImageError as exc:
        return Response({'error': str(exc)}, status=400)
    project.images = keys
    project.save(update_fields=['images'])
    return Response({'images': [to_absolute(request, key) for key in keys]})


@extend_schema(
    summary='Loyiha rasmlarini qayta tartiblash / o\'chirish',
    description='JSON {"images": [url, ...]} — yangi tartib (birinchisi asosiy). Ro\'yxatda qolmagan rasmlar o\'chiriladi.',
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([FilesThrottle])
@csrf_protected
def project_images_reorder(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    resolved = reorder_keys(request.data.get('images'), project.images)
    for key in project.images:
        if key not in resolved:
            try:
                if not key.startswith(('http://', 'https://')) and default_storage.exists(key):
                    default_storage.delete(key)
            except Exception:
                pass
    project.images = resolved
    project.save(update_fields=['images'])
    return Response({'images': [to_absolute(request, key) for key in resolved]})


@extend_schema(
    summary='Loyiha texnik chizmalarini yuklash',
    description=(
        'Multipart: "files" maydonidagi fayllar + "meta" (JSON massiv, har bir fayl uchun '
        '{type, title, floor_number, subtype}). Qabul qilinadi: PDF, JPG, PNG, WebP, DWG, DXF. '
        'PDF uchun birinchi sahifa eskizi avtomatik yaratiladi.'
    ),
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([FilesThrottle])
@csrf_protected
def project_drawings_upload(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    try:
        meta = json.loads(request.POST.get('meta', '[]') or '[]')
    except ValueError:
        return Response({'error': 'Meta ma\'lumot noto\'g\'ri'}, status=400)

    types = [str(m.get('type', '')) for m in meta]
    titles = [str(m.get('title', '')) for m in meta]
    floors = [m.get('floor_number', None) for m in meta]
    subtypes = [str(m.get('subtype', '')) for m in meta]

    try:
        upload_drawings(project, request.FILES.getlist('files'), types, titles, floors, subtypes)
    except DrawingError as exc:
        return Response({'error': str(exc)}, status=400)
    return Response({'drawings': drawing_entries(request, project)})


@extend_schema(
    summary='Chizmalarni tartiblash / o\'chirish',
    description='JSON {"drawings": [...]} — yangi to\'liq ro\'yxat (URL-lar). Ro\'yxatda qolmagan chizmalar o\'chiriladi.',
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([FilesThrottle])
@csrf_protected
def project_drawings_update(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    try:
        resolved = resolve_drawings(request.data.get('drawings'), project.technical_drawings)
    except DrawingError as exc:
        return Response({'error': str(exc)}, status=400)
    for entry in project.technical_drawings:
        if entry not in resolved:
            delete_drawing_files(entry)
    project.technical_drawings = resolved
    project.save(update_fields=['technical_drawings'])
    return Response({'drawings': drawing_entries(request, project)})


@extend_schema(
    summary='Barcha chizmalarni ZIP yuklab olish',
    description='Loyihaning barcha texnik chizmalarini bitta ZIP arxivda qaytaradi.',
)
@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([FilesThrottle])
def project_drawings_zip(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    buffer = build_zip(project)
    response = HttpResponse(buffer.read(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="loyiha-{project.pk}-chizmalar.zip"'
    return response


@extend_schema(
    request=SignupSerializer,
    responses={201: OpenApiExample('User', value={'id': 1, 'name': 'Abdulla', 'phone': '+998901234567'})},
    summary='Ro\'yxatdan o\'tish',
    description='Yangi foydalanuvchi yaratadi va avtomatik kiritadi',
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupThrottle])
@csrf_protected
def auth_signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    phone = serializer.validated_data['phone']
    password = serializer.validated_data['password']

    password_error = validate_password_policy(password, username=phone)
    if password_error:
        logger.warning(
            'auth.signup.reject.weak_password',
            extra={'phone': phone, 'reason': 'weak_password'},
        )
        return Response({'error': password_error}, status=400)

    if User.objects.filter(username=phone).exists():
        logger.warning(
            'auth.signup.reject.duplicate',
            extra={'phone': phone, 'reason': 'duplicate_phone'},
        )
        return Response(
            {'error': 'Bu telefon raqami allaqachon ro\'yxatdan o\'tgan'},
            status=409,
        )

    try:
        user = User.objects.create_user(
            username=phone,
            password=password,
            first_name=serializer.validated_data['name'],
        )
        login(request, user)
    except Exception:
        logger.exception('auth.signup.error', extra={'phone': phone})
        return Response(
            {'error': 'Xatolik yuz berdi, birozdan so\'ng qaytadan urinib ko\'ring'},
            status=500,
        )

    logger.info('auth.signup.success', extra={'user_id': user.id, 'phone': phone})
    return Response({
        'id': user.id,
        'name': user.first_name,
        'phone': user.username,
    }, status=201)


@extend_schema(
    request=AuthSerializer,
    responses={200: OpenApiExample('User', value={'id': 1, 'name': 'Abdulla', 'phone': '+998901234567'})},
    summary='Tizimga kirish',
    description='Telefon raqam va parol orqali tizimga kiradi',
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
@csrf_protected
def auth_login(request):
    serializer = AuthSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data['username']

    if login_blocked(username, request):
        logger.warning(
            'auth.login.reject.lockout',
            extra={'username': username, 'reason': 'lockout'},
        )
        return Response(
            {'error': 'Ko\'p marta xato urinish. 15 daqiqadan keyin qayta urinib ko\'ring'},
            status=429,
        )

    try:
        user = authenticate(
            request,
            username=username,
            password=serializer.validated_data['password'],
        )
    except Exception:
        logger.exception('auth.login.error.backend', extra={'username': username})
        return Response(
            {'error': 'Xatolik yuz berdi, birozdan so\'ng qaytadan urinib ko\'ring'},
            status=500,
        )

    if user is None:
        mark_failed_login(username, request)
        logger.warning(
            'auth.login.reject.bad_credentials',
            extra={'username': username, 'reason': 'bad_credentials'},
        )
        return Response({'error': 'Telefon raqam yoki parol noto\'g\'ri'}, status=401)

    clear_failed_logins(username, request)
    try:
        login(request, user)
    except Exception:
        logger.exception('auth.login.error.session', extra={'username': username})
        return Response(
            {'error': 'Xatolik yuz berdi, birozdan so\'ng qaytadan urinib ko\'ring'},
            status=500,
        )

    logger.info('auth.login.success', extra={'user_id': user.id, 'username': username})
    return Response({
        'id': user.id,
        'name': user.first_name,
        'phone': user.username,
    })


@extend_schema(
    summary='Tizimdan chiqish',
    description='Joriy foydalanuvchini tizimdan chiqaradi',
)
@api_view(['POST'])
@csrf_protected
def auth_logout(request):
    logout(request)
    return Response({'ok': True})


import requests as _http_requests

GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'


@extend_schema(
    summary='Google orqali kirish',
    description='Google ID tokenini tasdiqlab tizimga kiradi yoki yangi hisob yaratadi',
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
@csrf_protected
def auth_google(request):
    id_token = request.data.get('credential')
    if not id_token:
        return Response({'error': 'Google token topilmadi'}, status=400)

    try:
        resp = _http_requests.get(
            GOOGLE_TOKENINFO_URL,
            params={'id_token': id_token},
            timeout=5,
        )
        if resp.status_code != 200:
            return Response({'error': 'Google token yaroqsiz'}, status=401)
        claims = resp.json()
    except Exception:
        return Response({'error': 'Google bilan bog\'lanib bo\'lmadi'}, status=502)

    email = claims.get('email')
    google_name = claims.get('name', '')
    picture = claims.get('picture', '')

    if not email:
        logger.warning('auth.google.reject.no_email', extra={'reason': 'no_email'})
        return Response({'error': 'Google hisobida email topilmadi'}, status=401)

    username = f'google:{email}'

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'first_name': google_name or email.split('@')[0],
            'email': email,
        },
    )
    if created:
        user.set_unusable_password()
        user.save()

    login(request, user)
    logger.info(
        'auth.google.success',
        extra={'user_id': user.id, 'email': email, 'created': created},
    )
    return Response({
        'id': user.id,
        'name': user.first_name,
        'phone': user.username,
        'email': email,
        'picture': picture,
        'created': created,
    })


@extend_schema(
    summary='Auth holati',
    description='Joriy foydalanuvchining autentifikatsiya holatini qaytaradi',
)
@api_view(['GET'])
@ensure_csrf_cookie
def auth_status(request):
    if request.user.is_authenticated:
        return Response({
            'authenticated': True,
            'user': {
                'id': request.user.id,
                'name': request.user.first_name,
                'phone': request.user.username,
            },
        })
    return Response({'authenticated': False, 'user': None})


@extend_schema(
    summary='Dashboard statistikasi',
    description='Loyihalar soni, web/bot loyihalar va AI yordamida yaratilgan loyihalar soni',
)
@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard(request):
    total = CalculationProject.objects.count()
    web_count = CalculationProject.objects.filter(
        source=CalculationProject.SOURCE_WEB
    ).count()
    bot_count = CalculationProject.objects.filter(
        source=CalculationProject.SOURCE_BOT
    ).count()
    ai_count = CalculationProject.objects.filter(
        ai_summary__isnull=False
    ).exclude(ai_summary='').count()
    return Response({
        'total_projects': total,
        'web_projects': web_count,
        'bot_projects': bot_count,
        'ai_assisted': ai_count,
    })
