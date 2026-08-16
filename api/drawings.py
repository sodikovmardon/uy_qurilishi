"""Technical drawings for projects (PDF / hi-res images / CAD source files).

Drawings live on each CalculationProject in an ordered JSONField
`technical_drawings`. Each entry:

    {
        "type": "fasad" | "plan" | "kesim" | "kommunikatsiya" | "fundament",
        "subtype": "" | "elektr" | "vodoprovod",     # kommunikatsiya only
        "title": "…",                                # human label (may be empty)
        "file_url": "projects/drawings/<uuid>.<ext>",# storage key of the file
        "preview_url": "projects/drawings/previews/<uuid>.png",  # PDF page-1 thumb ("" for images/CAD)
        "file_ext": "pdf|jpg|png|webp|dwg|dxf",
        "floor_number": null | int,                  # floor plans only
        "uploaded_date": "YYYY-MM-DD",
    }

Storage is Django's default storage (local media/ in dev, S3 once AWS_* are
set). PDF first-page thumbnails are rendered with poppler's pdftoppm when
available; images and CAD sources render their own file icon client-side.
"""
import io
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from urllib.parse import urlparse

from django.core.files.storage import default_storage

from api.images import to_absolute

# Allowed drawing types + their public labels (mirrored client-side).
DRAWING_TYPES = {
    'fasad': 'Fasad chizmasi',
    'plan': 'Qavat rejasi',
    'kesim': 'Kesim chizmasi',
    'kommunikatsiya': 'Kommunikatsiya sxemasi',
    'fundament': 'Fundament rejasi',
}
COMMUNICATION_SUBTYPES = {'elektr': 'Elektr sxemasi', 'vodoprovod': 'Suv ta’minoti sxemasi'}

IMAGE_EXTS = {'jpg', 'png', 'webp'}
CAD_EXTS = {'dwg', 'dxf'}
PDF_EXTS = {'pdf'}
ALLOWED_EXTS = IMAGE_EXTS | CAD_EXTS | PDF_EXTS

IMAGE_MAX_BYTES = 5 * 1024 * 1024
PDF_MAX_BYTES = 20 * 1024 * 1024
CAD_MAX_BYTES = 30 * 1024 * 1024
MAX_DRAWINGS = 40

_EXT_FROM_TYPE = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
}

_ACCEPTED_CTYPES = {
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/x-dwg', 'application/dwg', 'image/vnd.dwg',
    'application/x-dxf', 'application/dxf', 'application/octet-stream',
}


class DrawingError(Exception):
    """Invalid drawing upload; message is user-facing (Uzbek)."""


def extension_of(filename: str) -> str:
    return (filename.rsplit('.', 1)[-1] or '').lower()


def make_entry(**kwargs) -> dict:
    return {
        'type': kwargs.get('type', 'plan'),
        'subtype': kwargs.get('subtype', ''),
        'title': kwargs.get('title', ''),
        'file_url': kwargs.get('file_url', ''),
        'preview_url': kwargs.get('preview_url', ''),
        'file_ext': kwargs.get('file_ext', ''),
        'floor_number': kwargs.get('floor_number'),
        'uploaded_date': kwargs.get('uploaded_date', ''),
    }


def _save_file(f, ext: str) -> str:
    key = default_storage.save(f'projects/drawings/{uuid.uuid4().hex[:16]}.{ext}', f)
    return key


def render_pdf_preview(pdf_key: str) -> str:
    """Render the first page of a PDF to a PNG stored next to it.

    Uses poppler-utils (pdftoppm) for rasterization, falls back to
    ghostscript, and returns an empty string when no renderer is available
    (the client then shows a generic file card instead).
    """
    pdftoppm = shutil.which('pdftoppm')
    gs = shutil.which('gs')
    renderer = None
    if pdftoppm:
        renderer = 'pdftoppm'
    elif gs:
        renderer = 'gs'
    if renderer is None:
        return ''

    # Stream the source PDF into a temp file (works with both local disk and
    # S3 backends; default_storage.path() is not supported by S3).
    tmp = tempfile.TemporaryDirectory()
    try:
        src_path = os.path.join(tmp.name, 'source.pdf')
        with default_storage.open(pdf_key, 'rb') as src, open(src_path, 'wb') as out:
            shutil.copyfileobj(src, out)
        out_stem = os.path.join(tmp.name, uuid.uuid4().hex[:16])
        # pdftoppm appends ".png" to the given base; gs takes an explicit name.
        png_path = out_stem + '.png'
        if renderer == 'pdftoppm':
            args = ['pdftoppm', '-f', '1', '-l', '1', '-r', '90', '-png', '-singlefile', src_path, out_stem]
        else:
            args = ['gs', '-q', '-dSAFER', '-dNOPAUSE', '-dBATCH', '-sDEVICE=png16m',
                    '-r', '90', '-dFirstPage=1', '-dLastPage=1',
                    f'-sOutputFile={png_path}', src_path]
        proc = subprocess.run(args, capture_output=True, timeout=120)
        if proc.returncode != 0 or not os.path.exists(png_path):
            return ''
        with open(png_path, 'rb') as fh:
            return default_storage.save(
                f'projects/drawings/previews/{uuid.uuid4().hex[:16]}.png',
                fh,
            )
    except Exception:
        return ''
    finally:
        tmp.cleanup()


def _valid_entry_type(value: str) -> str:
    value = (value or '').strip()
    if value not in DRAWING_TYPES:
        raise DrawingError('Chizma turi noto\'g\'ri')
    return value


def _valid_subtype(value: str, drawing_type: str) -> str:
    value = (value or '').strip()
    if not value:
        return ''
    if drawing_type != 'kommunikatsiya' or value not in COMMUNICATION_SUBTYPES:
        raise DrawingError('Kommunikatsiya turi noto\'g\'ri')
    return value


def _valid_floor(value, drawing_type: str):
    if value is None or value == '':
        return None
    try:
        floor = int(value)
    except (TypeError, ValueError):
        raise DrawingError('Qavat raqami noto\'g\'ri')
    if drawing_type != 'plan':
        return None
    if floor < 0 or floor > 50:
        raise DrawingError('Qavat raqami 0–50 oralig\'ida bo\'lishi kerak')
    return floor


def upload_drawings(project, files, types, titles, floors, subtypes) -> list:
    """Validate + persist uploaded drawing files, appending entries.

    `files` is a list of UploadedFile; `types`/`titles`/`floors`/`subtypes`
    are parallel lists aligned by index (may be shorter — missing values
    default to '').
    """
    files = [f for f in files or [] if getattr(f, 'name', '')]
    if not files:
        raise DrawingError('Hech qanday fayl yuklanmadi')

    entries = list(project.technical_drawings)
    if len(entries) + len(files) > MAX_DRAWINGS:
        raise DrawingError(f'Maksimal {MAX_DRAWINGS} ta chizma yuklash mumkin')

    # Validate everything first so a bad file never leaves orphans on disk.
    validated = []
    for i, f in enumerate(files):
        ext = extension_of(f.name)
        if ext not in ALLOWED_EXTS:
            raise DrawingError('Faqat PDF, JPG, PNG, WebP, DWG yoki DXF fayllar qabul qilinadi')
        if ext in IMAGE_EXTS and f.size > IMAGE_MAX_BYTES:
            raise DrawingError('Rasm hajmi 5 MB dan oshmasligi kerak')
        if ext in PDF_EXTS and f.size > PDF_MAX_BYTES:
            raise DrawingError('PDF hajmi 20 MB dan oshmasligi kerak')
        if ext in CAD_EXTS and f.size > CAD_MAX_BYTES:
            raise DrawingError('CAD fayl hajmi 30 MB dan oshmasligi kerak')
        if ext in IMAGE_EXTS:
            try:
                from PIL import Image
                image = Image.open(f)
                image.verify()
                f.seek(0)
            except Exception:
                raise DrawingError('Yaroqli rasm fayli emas')
        if ext in PDF_EXTS:
            head = f.read(5)
            f.seek(0)
            if head != b'%PDF-':
                raise DrawingError('Yaroqli PDF fayl emas')

        drawing_type = _valid_entry_type(types[i] if i < len(types) else '')
        entry = make_entry(
            type=drawing_type,
            subtype=_valid_subtype(subtypes[i] if i < len(subtypes) else '', drawing_type),
            title=(titles[i] if i < len(titles) else '').strip()[:200],
            floor_number=_valid_floor(floors[i] if i < len(floors) else None, drawing_type),
            file_ext=ext,
            uploaded_date=project.created_at.date().isoformat(),
        )
        validated.append((f, ext, entry))

    for f, ext, entry in validated:
        key = _save_file(f, ext)
        entry['file_url'] = key
        if ext in PDF_EXTS:
            entry['preview_url'] = render_pdf_preview(key)
        entries.append(entry)

    project.technical_drawings = entries
    project.save(update_fields=['technical_drawings'])
    return entries


def _storage_path(url: str) -> str:
    return urlparse(url).path.lstrip('/')


def resolve_drawings(submitted: list, stored: list) -> list:
    """Map a client-submitted list of drawing dicts (absolute URLs) back to
    storage keys, preserving order. Entries not submitted are dropped; the
    caller is responsible for deleting their files.
    """
    resolved = []
    for item in submitted or []:
        file_url = str(item.get('file_url', ''))
        if not file_url:
            continue
        target = _storage_path(file_url)
        for entry in stored:
            if _storage_path(default_storage.url(entry['file_url'])) == target:
                new_entry = dict(entry)
                new_entry['type'] = _valid_entry_type(item.get('type', entry['type']))
                new_entry['subtype'] = _valid_subtype(item.get('subtype', entry['subtype']), new_entry['type'])
                new_entry['title'] = str(item.get('title', entry.get('title', ''))).strip()[:200]
                new_entry['floor_number'] = _valid_floor(item.get('floor_number', entry.get('floor_number')), new_entry['type'])
                resolved.append(new_entry)
                break
    return resolved


def delete_drawing_files(entry: dict) -> None:
    """Best-effort removal of a drawing's file + preview from storage."""
    for key in (entry.get('file_url'), entry.get('preview_url')):
        if not key:
            continue
        try:
            if not key.startswith(('http://', 'https://')) and default_storage.exists(key):
                default_storage.delete(key)
        except Exception:
            pass


def drawing_entries(request, project) -> list:
    """Serialized drawing list with absolute URLs for the client."""
    return [
        {
            'type': e.get('type', 'plan'),
            'subtype': e.get('subtype', ''),
            'title': e.get('title', ''),
            'file_url': to_absolute(request, e['file_url']),
            'preview_url': to_absolute(request, e['preview_url']) if e.get('preview_url') else '',
            'file_ext': e.get('file_ext', ''),
            'floor_number': e.get('floor_number'),
            'uploaded_date': e.get('uploaded_date', ''),
        }
        for e in project.technical_drawings
    ]


def build_zip(project) -> io.BytesIO:
    """Bundle all drawing files (not previews) into an in-memory ZIP."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        for idx, entry in enumerate(project.technical_drawings):
            key = entry.get('file_url', '')
            if not key:
                continue
            if key.startswith(('http://', 'https://')):
                continue
            try:
                arcname = f'{project.pk:05d}-{idx + 1:02d}-{os.path.basename(key)}'
                with default_storage.open(key, 'rb') as fh:
                    archive.writestr(arcname, fh.read())
            except Exception:
                continue
    buffer.seek(0)
    return buffer
