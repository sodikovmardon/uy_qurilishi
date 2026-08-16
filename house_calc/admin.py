import hashlib
import io

from django.contrib import admin
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.html import format_html

from house_calc.models import CalculationProject, Product


admin.site.site_header = 'Uy Qurilishi — boshqaruv'
admin.site.site_title = 'Uy Qurilishi admin'
admin.site.index_title = 'Boshqaruv paneli'


# ---------------------------------------------------------------------------
# Image thumbnails (cached, generated on demand)
# ---------------------------------------------------------------------------

_THUMB_MAX = 200
_THUMB_STYLE = (
    'width:72px;height:72px;object-fit:cover;border-radius:12px;'
    'box-shadow:0 2px 8px rgba(11,31,58,.18);border:1px solid rgba(11,31,58,.08)'
)


def _thumb_url(key: str) -> str:
    """Resolve a storage key/URL to a displayable URL, generating a cached
    thumbnail under media/.thumbs/ so big admin lists stay fast."""
    if not key:
        return ''
    if key.startswith(('http://', 'https://')):
        return key
    try:
        digest = hashlib.md5(key.encode()).hexdigest()[:16]
        thumb_key = f'.thumbs/{digest}.jpg'
        if not default_storage.exists(thumb_key):
            from PIL import Image
            with default_storage.open(key) as f:
                img = Image.open(f)
                img.thumbnail((_THUMB_MAX, _THUMB_MAX))
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                buf = io.BytesIO()
                img.save(buf, 'JPEG', quality=82)
            default_storage.save(thumb_key, ContentFile(buf.getvalue()))
        return default_storage.url(thumb_key)
    except Exception:
        return default_storage.url(key)


def _img_tag(key: str) -> str:
    """Render an admin thumbnail <img>, falling back to a dash if the file
    doesn't exist and to the original URL when it's an absolute URL."""
    if not key:
        return '<span style="color:#94a3b8">—</span>'
    if not key.startswith(('http://', 'https://')) and not default_storage.exists(key):
        return '<span style="color:#94a3b8">—</span>'
    src = _thumb_url(key)
    return format_html(
        '<a href="{}" target="_blank" title="Kattaroq ko\'rish">'
        '<img src="{}" style="{}"></a>',
        key if key.startswith(('http://', 'https://')) else default_storage.url(key),
        src,
        _THUMB_STYLE,
    )


@admin.register(CalculationProject)
class CalculationProjectAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'thumbnail',
        'area',
        'bricks',
        'cement',
        'sand',
        'rooms',
        'bathrooms',
        'has_pool',
        'has_garage',
        'has_terrace',
        'short_ai_summary',
        'source',
        'user_name',
        'created_at',
    )
    list_filter = ('source', 'has_pool', 'has_garage', 'has_terrace', 'created_at')
    search_fields = ('user_name',)
    readonly_fields = ('created_at', 'images_preview')

    def thumbnail(self, obj):
        return _img_tag(obj.images[0] if obj.images else '')

    thumbnail.short_description = 'Rasm'

    def images_preview(self, obj):
        if not obj.images:
            return 'Rasm yo\'q'
        parts = ''.join(_img_tag(url) for url in obj.images)
        return format_html('<div style="display:flex;flex-wrap:wrap;gap:10px">{}</div>', format_html(parts))

    images_preview.short_description = 'Rasmlar'

    def short_ai_summary(self, obj):
        if not obj.ai_summary:
            return '-'
        return obj.ai_summary[:60] + ('...' if len(obj.ai_summary) > 60 else '')

    short_ai_summary.short_description = 'AI summary'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'thumbnail', 'name', 'category', 'price', 'stock_quantity', 'created_at')
    list_display_links = ('id', 'thumbnail', 'name')
    list_filter = ('category',)
    search_fields = ('name', 'sku', 'category')
    readonly_fields = ('created_at', 'last_updated', 'images_preview')

    def thumbnail(self, obj):
        if obj.images:
            return _img_tag(obj.images[0])
        if obj.image:
            return _img_tag(obj.image.name)
        return '<span style="color:#94a3b8">—</span>'

    thumbnail.short_description = 'Rasm'

    def images_preview(self, obj):
        keys = list(obj.images or [])
        if obj.image:
            keys.append(obj.image.name)
        if not keys:
            return 'Rasm yo\'q'
        parts = ''.join(_img_tag(url) for url in keys)
        return format_html('<div style="display:flex;flex-wrap:wrap;gap:10px">{}</div>', format_html(parts))

    images_preview.short_description = 'Rasmlar'
