from house_calc.models import CalculationProject
from house_calc.pdf import build_project_pdf_bytes
from house_calc.image_renderer import ensure_project_preview
from house_calc.utils import calculate_materials
from house_calc.layout_utils import estimate_storeys
from house_calc.ai_advisor import generate_house_advice
import json


def save_project(
    area,
    source,
    user_name='',
    telegram_id=None,
    rooms=1,
    bathrooms=1,
    has_pool=False,
    has_garage=False,
    has_terrace=False,
    features=None,
    ai_summary=None,
):
    result = calculate_materials(area)
    floor_count = estimate_storeys(area, rooms)
    if features is None:
        features = []
    # Derive the tag list from booleans + a modern-villa heuristic so existing
    # callers (bot, web) automatically get the richer material breakdown.
    derived = list(features)
    if has_pool and 'pool' not in derived:
        derived.append('pool')
    if has_garage and 'garage' not in derived:
        derived.append('garage')
    if has_terrace and 'terrace' not in derived:
        derived.append('terrace')
    if area >= 300 and rooms >= 8:
        for tag in ('modern_facade', 'garden'):
            if tag not in derived:
                derived.append(tag)
    if ai_summary is None:
        ai_advice = generate_house_advice(area, rooms, bathrooms, has_pool, has_garage, has_terrace, floor_count)
        ai_summary = json.dumps(ai_advice) if isinstance(ai_advice, dict) else ai_advice
    return CalculationProject.objects.create(
        area=result['area'],
        bricks=result['bricks'],
        cement=result['cement'],
        sand=result['sand'],
        rooms=rooms,
        bathrooms=bathrooms,
        has_pool=has_pool,
        has_garage=has_garage,
        has_terrace=has_terrace,
        features=derived,
        ai_summary=ai_summary,
        source=source,
        user_name=user_name,
        telegram_id=telegram_id,
    )


def get_latest_project(source=None, telegram_id=None):
    queryset = CalculationProject.objects.all()
    if source:
        queryset = queryset.filter(source=source)
    if telegram_id is not None:
        queryset = queryset.filter(telegram_id=telegram_id)
    return queryset.first()


def build_project_pdf(project):
    preview_path, _ = ensure_project_preview(project)
    image_bytes = preview_path.read_bytes() if preview_path.exists() else None
    return build_project_pdf_bytes(
        project_id=project.pk,
        area=project.area,
        bricks=project.bricks,
        cement=project.cement,
        sand=project.sand,
        rooms=project.rooms,
        bathrooms=project.bathrooms,
        has_pool=project.has_pool,
        has_garage=project.has_garage,
        has_terrace=project.has_terrace,
        ai_summary=project.ai_summary,
        source_label=project.get_source_display(),
        user_name=project.user_name,
        created_at_text=project.created_at.strftime('%Y-%m-%d %H:%M'),
        image_bytes=image_bytes,
    )
