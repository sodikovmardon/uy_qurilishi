"""Seed demo imagery for projects and store products.

Downloads curated, free-to-use stock photos (Unsplash) into Django media
storage and attaches them to existing rows, so the catalog looks real without
any manual upload. The photos are PLACEHOLDER demo imagery — real users can
replace them at any time via the admin upload UI.

Usage: python manage.py seed_images [--force]
"""
import urllib.request

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from house_calc.models import CalculationProject, Product

# Free-to-use Unsplash photo IDs (verified reachable).
# PLACEHOLDER demo imagery — swap for real uploads through the admin UI.
HOUSE_PHOTOS = [
    'photo-1512917774080-9991f1c4c750',
    'photo-1600596542815-ffad4c1539a9',
    'photo-1564013799919-ab600027ffc6',
    'photo-1570129477492-45c003edd2be',
    'photo-1600585154340-be6161a56a0c',
    'photo-1581858726788-75bc0f6a952d',
]

# PLACEHOLDER demo imagery keyed by product category.
CATEGORY_PHOTOS = {
    "G'isht": 'photo-1523413651479-597eb2da0ad6',
    'Sement': 'photo-1518709268805-4e9042af9f23',
    'Qum': 'photo-1504917595217-d4dc5ebe6122',
    'Metall': 'photo-1531834685032-c34bf0d84c77',
    'Asbob-uskunalar': 'photo-1581092160562-40aa08e78837',
    "Bo'yoqlar": 'photo-1589939705384-5185137a7f0f',
    "Bog'lovchi materiallar": 'photo-1503387762-592deb58ef4e',
}
FALLBACK_PHOTO = 'photo-1541888946425-d81bb19240f5'


def _download(photo_id: str, width: int, height: int) -> bytes | None:
    url = (
        f'https://images.unsplash.com/{photo_id}'
        f'?w={width}&h={height}&q=75&auto=format&fit=crop'
    )
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'uy-qurilishi-seed/1.0'})
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.read()
    except Exception:
        return None


class Command(BaseCommand):
    help = 'Seeds placeholder demo imagery for projects and store products.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Re-download even if images exist')

    def handle(self, *args, **options):
        force = options['force']
        downloaded = 0

        projects = CalculationProject.objects.order_by('-created_at')
        for i, project in enumerate(projects):
            # Default feature tags for demo data: derived from booleans + a
            # modern-villa heuristic so the expanded material list shows up
            # without manual tagging. Only fills empty tags.
            if not project.features:
                features = []
                if project.has_pool:
                    features.append('pool')
                if project.has_garage:
                    features.append('garage')
                if project.has_terrace:
                    features.append('terrace')
                if project.area >= 300 and project.rooms >= 8:
                    features.extend(['modern_facade', 'garden'])
                project.features = features
            if project.images and not force:
                project.save(update_fields=['features'])
                continue
            photo_id = HOUSE_PHOTOS[i % len(HOUSE_PHOTOS)]
            key = f'projects/project-{project.pk}.jpg'
            if force or not default_storage.exists(key):
                data = _download(photo_id, 1200, 900)
                if data is None:
                    continue
                default_storage.save(key, ContentFile(data))
            project.images = [key]
            project.save(update_fields=['images', 'features'])
            downloaded += 1

        for product in Product.objects.all():
            if product.images and not force:
                continue
            photo_id = CATEGORY_PHOTOS.get(product.category, FALLBACK_PHOTO)
            slug = ''.join(c for c in product.category.lower() if c.isalnum()) or 'mahsulot'
            key = f'products/{slug}-{product.pk}.jpg'
            if force or not default_storage.exists(key):
                data = _download(photo_id, 900, 900)
                if data is None:
                    continue
                default_storage.save(key, ContentFile(data))
            product.images = [key]
            product.save(update_fields=['images'])
            downloaded += 1

        self.stdout.write(self.style.SUCCESS(f'Seeded demo images for {downloaded} rows.'))
