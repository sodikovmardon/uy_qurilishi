"""Image upload helpers shared by project and store-product endpoints.

Files are stored through Django's default storage — the local git-ignored
media/ directory in development, Amazon S3 once AWS_* env vars are set. Each
entity keeps an ordered JSONField `images` of storage keys (or absolute remote
URLs); the first entry is always the primary image.

Security notes:
- Files are validated by *content* (Pillow detects the format from magic
  bytes), never by the client-claimed MIME type or file extension.
- Every accepted image is re-encoded and re-saved, which strips EXIF/embedded
  metadata and any trailing payload from a polyglot file.
- Size and count are capped before anything is written to storage.
"""
import io
import uuid
from urllib.parse import urlparse

from django.core.files.storage import default_storage

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_BYTES = 5 * 1024 * 1024
MAX_FILES = 6

_EXT = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}
_FORMAT_MIME = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}


class ImageError(Exception):
    """Raised for invalid uploads; message is user-facing (Uzbek)."""


def storage_path_of(url: str) -> str:
    """Normalize an absolute URL down to a comparable storage path."""
    return urlparse(url).path.lstrip('/')


def to_absolute(request, value: str) -> str:
    """Expand a storage key into an absolute public URL.

    Remote URLs (http/https, e.g. seeded placeholder imagery) pass through
    unchanged.
    """
    if value.startswith(('http://', 'https://')):
        return value
    url = default_storage.url(value)
    return request.build_absolute_uri(url) if request else url


def resolve_key(url: str, keys: list[str]) -> str | None:
    """Map a client-supplied absolute URL back onto a stored storage key."""
    path = storage_path_of(url)
    for key in keys:
        if storage_path_of(default_storage.url(key)) == path:
            return key
    return None


def _reencode(f, fmt: str):
    """Re-encode an opened image in-memory, stripping all metadata."""
    from PIL import Image, ImageOps

    image = Image.open(f)
    image.load()

    # Normalize color profile/mode and drop EXIF by converting.
    if image.mode in ('RGBA', 'LA', 'P'):
        if fmt == 'JPEG':
            image = image.convert('RGB')
    else:
        image = ImageOps.exif_transpose(image).convert(
            'RGB' if fmt == 'JPEG' else image.mode
        )

    out = io.BytesIO()
    save_kwargs = {'format': fmt}
    if fmt == 'JPEG':
        save_kwargs.update({'quality': 88, 'progressive': True})
    elif fmt == 'WEBP':
        save_kwargs.update({'quality': 88})
    else:
        save_kwargs.update({'optimize': True})
    image.save(out, **save_kwargs)
    out.seek(0)
    return out, _FORMAT_MIME[fmt]


def _validate_image(f):
    """Return (fmt, mime) if `f` is a genuine supported image, else raise.

    Format is detected from the file content via Pillow's magic-byte sniffing,
    so renaming a payload to .jpg is rejected.
    """
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(f) as image:
            fmt = image.format
        f.seek(0)
    except (UnidentifiedImageError, OSError, ValueError):
        raise ImageError('Yaroqli rasm fayli emas')

    if fmt not in _EXT:
        raise ImageError('Faqat JPG, PNG yoki WebP rasmlar qabul qilinadi')
    return fmt, _FORMAT_MIME[fmt]


def save_uploads(files, subdir: str, existing_keys: list[str]) -> list[str]:
    """Validate and persist uploaded files, returning the new ordered keys.

    Existing keys are preserved at the front so the primary stays the primary.
    Files are re-encoded (metadata stripped) before storage.
    """
    keys = list(existing_keys)
    files = [f for f in files or [] if getattr(f, 'name', '')]
    if not files:
        return keys

    # Validate everything first so a bad file doesn't leave orphans on disk.
    validated = []
    for f in files:
        if f.size > MAX_BYTES:
            raise ImageError('Rasm hajmi 5 MB dan oshmasligi kerak')
        if len(keys) + len(validated) >= MAX_FILES:
            raise ImageError(f'Maksimal {MAX_FILES} ta rasm yuklash mumkin')
        fmt, _ = _validate_image(f)
        validated.append((f, fmt))

    for f, fmt in validated:
        data, _ = _reencode(f, fmt)
        key = default_storage.save(f'{subdir}/{uuid.uuid4().hex[:12]}.{_EXT[fmt]}', data)
        keys.append(key)
    return keys


def reorder_keys(submitted: list, stored: list[str]) -> list[str]:
    """Resolve a client-supplied ordered URL list into storage keys.

    Anything submitted that isn't a known key is dropped; anything stored that
    isn't submitted is considered removed (used by reorder + delete in one
    call).
    """
    resolved: list[str] = []
    for url in submitted or []:
        key = resolve_key(str(url), stored)
        if key is not None and key not in resolved:
            resolved.append(key)
    return resolved
