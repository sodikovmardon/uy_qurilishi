import math
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.serializers import (
    AuthSerializer,
    CalculateSerializer,
    ProjectCreateSerializer,
    ProjectSerializer,
    SignupSerializer,
)
from house_calc.models import CalculationProject
from house_calc.services import save_project


def _calculate_materials(area: int, rooms: int) -> dict:
    perimeter = math.sqrt(area) * 4
    wall_area = perimeter * 3 * 0.85
    bricks = round(wall_area * 400)
    cement = round((bricks / 1000) * 0.5, 1)
    sand = round(cement * 3, 1)

    if area >= 2600 or rooms >= 14:
        storeys = 3
    elif area >= 900 or rooms >= 8:
        storeys = 2
    else:
        storeys = 1

    return {'bricks': bricks, 'cement': cement, 'sand': sand, 'storeys': storeys}


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
    projects = CalculationProject.objects.all().order_by('-created_at')
    page = int(request.GET.get('page', 1))
    per_page = 12
    start = (page - 1) * per_page
    end = start + per_page
    data = ProjectSerializer(projects[start:end], many=True).data
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
        user_name=serializer.validated_data.get('user_name', ''),
        source=CalculationProject.SOURCE_WEB,
    )
    return Response(ProjectSerializer(project).data, status=201)


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
    except CalculationProject.DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    data = ProjectSerializer(project).data
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
@permission_classes([AllowAny])
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
    return Response(ProjectSerializer(project).data)


@extend_schema(
    request=SignupSerializer,
    responses={201: OpenApiExample('User', value={'id': 1, 'name': 'Abdulla', 'phone': '+998901234567'})},
    summary='Ro\'yxatdan o\'tish',
    description='Yangi foydalanuvchi yaratadi va avtomatik kiritadi',
)
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if User.objects.filter(username=serializer.validated_data['phone']).exists():
        return Response({'error': 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan'}, status=400)

    user = User.objects.create_user(
        username=serializer.validated_data['phone'],
        password=serializer.validated_data['password'],
        first_name=serializer.validated_data['name'],
    )
    login(request, user)
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
def auth_login(request):
    serializer = AuthSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        request,
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )
    if user is None:
        return Response({'error': 'Telefon raqam yoki parol noto\'g\'ri'}, status=401)
    login(request, user)
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
def auth_logout(request):
    logout(request)
    return Response({'ok': True})


@extend_schema(
    summary='Auth holati',
    description='Joriy foydalanuvchining autentifikatsiya holatini qaytaradi',
)
@api_view(['GET'])
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
