from pathlib import Path

from django.conf import settings
from django.core.paginator import Paginator
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic import ListView

from house_calc.forms import CalculationForm
from house_calc.image_renderer import ensure_project_preview, ensure_product_preview
from house_calc.layout_utils import planning_note, summarize_room_program
from house_calc.models import CalculationProject, Product
from house_calc.services import build_project_pdf, save_project


def react_app(request):
    index_path = Path(settings.BASE_DIR) / 'house_calc' / 'static' / 'react' / 'index.html'
    try:
        content = index_path.read_text(encoding='utf-8')
    except FileNotFoundError:
        return HttpResponse('Frontend not built. Run: npm run build', status=500)
    return HttpResponse(content, content_type='text/html; charset=utf-8')


@ensure_csrf_cookie
def home(request):
    if request.method == 'POST':
        form = CalculationForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            project = save_project(
                area=data['area'],
                source=CalculationProject.SOURCE_WEB,
                user_name=data['user_name'],
                rooms=data['rooms'],
                bathrooms=data['bathrooms'],
                has_pool=data['has_pool'],
                has_garage=data['has_garage'],
                has_terrace=data['has_terrace'],
            )
            return redirect(f"{reverse('house_calc:home')}?project={project.pk}&created=1")
    else:
        form = CalculationForm()

    recent_projects = list(CalculationProject.objects.all()[:12])
    selected_project_id = request.GET.get('project')
    selected_project = None
    if selected_project_id:
        selected_project = get_object_or_404(CalculationProject, pk=selected_project_id)
    elif recent_projects:
        selected_project = recent_projects[0]

    context = {
        'form': form,
        'project_created': request.GET.get('created') == '1',
        'selected_project': selected_project,
        'selected_program': (
            summarize_room_program(
                selected_project.rooms,
                selected_project.bathrooms,
                selected_project.has_garage,
                selected_project.has_terrace,
            )
            if selected_project
            else ''
        ),
        'selected_note': (
            planning_note(
                selected_project.area,
                selected_project.rooms,
                selected_project.bathrooms,
            )
            if selected_project
            else ''
        ),
        'recent_projects': recent_projects,
        'total_projects': CalculationProject.objects.count(),
        'web_projects': CalculationProject.objects.filter(
            source=CalculationProject.SOURCE_WEB
        ).count(),
    }
    return render(request, 'house_calc/index.html', context)


def project_pdf(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    pdf_bytes = build_project_pdf(project)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="house-project-{project.pk}.pdf"'
    return response


def project_detail(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    preview_path, _ = ensure_project_preview(project)
    context = {
        'project': project,
        'preview_url': reverse('house_calc:project_preview', args=[project.pk]),
        'selected_program': summarize_room_program(
            project.rooms,
            project.bathrooms,
            project.has_garage,
            project.has_terrace,
        ),
        'selected_note': planning_note(
            project.area,
            project.rooms,
            project.bathrooms,
        ),
    }
    return render(request, 'house_calc/project_detail.html', context)


def project_preview(request, pk):
    project = get_object_or_404(CalculationProject, pk=pk)
    preview_path, _ = ensure_project_preview(project)
    return FileResponse(preview_path.open('rb'), content_type='image/png')


def product_preview(request, pk):
    product = get_object_or_404(Product, pk=pk)
    preview_path, _ = ensure_product_preview(product)
    return FileResponse(preview_path.open('rb'), content_type='image/png')


def project_list(request):
    projects_list = CalculationProject.objects.all().order_by('-created_at')
    paginator = Paginator(projects_list, 12)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    context = {
        'projects': page_obj.object_list,
        'page_obj': page_obj,
        'total_projects': CalculationProject.objects.count(),
    }
    return render(request, 'house_calc/project_list.html', context)


@ensure_csrf_cookie
def project_create(request):
    if request.method == 'POST':
        form = CalculationForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            project = save_project(
                area=data['area'],
                source=CalculationProject.SOURCE_WEB,
                user_name=data['user_name'],
                rooms=data['rooms'],
                bathrooms=data['bathrooms'],
                has_pool=data['has_pool'],
                has_garage=data['has_garage'],
                has_terrace=data['has_terrace'],
            )
            return redirect('house_calc:project_detail', pk=project.pk)
    else:
        form = CalculationForm()

    context = {
        'form': form,
    }
    return render(request, 'house_calc/project_wizard.html', context)
