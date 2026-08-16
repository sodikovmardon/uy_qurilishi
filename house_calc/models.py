from django.db import models

from house_calc.layout_utils import estimate_storeys


class CalculationProject(models.Model):
    SOURCE_WEB = 'web'
    SOURCE_BOT = 'bot'
    SOURCE_CHOICES = [
        (SOURCE_WEB, 'Web'),
        (SOURCE_BOT, 'Bot'),
    ]

    area = models.PositiveIntegerField()
    bricks = models.PositiveIntegerField()
    cement = models.DecimalField(max_digits=10, decimal_places=1)
    sand = models.DecimalField(max_digits=10, decimal_places=1)
    rooms = models.PositiveIntegerField(default=1)
    bathrooms = models.PositiveIntegerField(default=1)
    has_pool = models.BooleanField(default=False)
    has_garage = models.BooleanField(default=False)
    has_terrace = models.BooleanField(default=False)
    # Feature tags: "pool", "garage", "terrace", "modern_facade", "garden".
    # Manual tags at submission time drive the conditional material estimates
    # (pool/terrace/facade categories) shown in the project detail modal.
    features = models.JSONField(default=list, blank=True)
    ai_summary = models.TextField(blank=True)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default=SOURCE_WEB)
    user_name = models.CharField(max_length=150, blank=True)
    telegram_id = models.BigIntegerField(null=True, blank=True)
    # Ordered list of image URLs/storage keys; the first entry is the primary
    # image shown on cards and in galleries.
    images = models.JSONField(default=list, blank=True)
    # Ordered list of technical drawings (PDF / hi-res image / CAD source).
    # Each entry: {"type": "fasad|plan|kesim|kommunikatsiya|fundament",
    #   "subtype": ""|"elektr"|"vodoprovod", "title": str,
    #   "file_url": storage key (or absolute URL),
    #   "preview_url": storage key of the first-page thumbnail (PDF) or
    #     empty for direct-image previews, "file_ext": "pdf|jpg|png|dwg|dxf",
    #   "floor_number": int|null, "uploaded_date": ISO date}.
    technical_drawings = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.area} m2 - {self.rooms} xona - Veb"

    @property
    def display_source(self):
        return 'Veb'

    @property
    def recommended_storeys(self):
        return estimate_storeys(self.area, self.rooms)


STOCK_STATUS_IN = 'Mavjud'
STOCK_STATUS_LOW = 'Kam qoldi'
STOCK_STATUS_OUT = 'Tugagan'
LOW_STOCK_THRESHOLD = 10


class Product(models.Model):
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=80, default='Boshqa', db_index=True)
    unit = models.CharField(max_length=20, default='dona')
    price = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    stock_quantity = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to='store/products/', blank=True, null=True)
    # Ordered gallery: the first entry is the primary photo shown on cards.
    images = models.JSONField(default=list, blank=True)
    # Where the gallery came from: 'seed' (stock demo imagery from the seed
    # command — replace these with real uploads) or 'upload' (admin upload).
    image_source = models.CharField(max_length=20, default='seed', blank=True)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=64, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name

    @property
    def stock_status(self) -> str:
        if self.stock_quantity <= 0:
            return STOCK_STATUS_OUT
        if self.stock_quantity <= LOW_STOCK_THRESHOLD:
            return STOCK_STATUS_LOW
        return STOCK_STATUS_IN


class StoreOwner(models.Model):
    """Store-admin login, kept separate from the public storefront auth."""
    username = models.CharField(max_length=150, unique=True)
    password_hash = models.CharField(max_length=255)
    name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username


class ApiClient(models.Model):
    """Partner integrations holding an API key (X-API-Key header)."""
    name = models.CharField(max_length=100)
    key = models.CharField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ProductOrder(models.Model):
    """Inquiry-style order placed from the storefront (no online payment)."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='orders')
    quantity = models.PositiveIntegerField(default=1)
    customer_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} x{self.quantity} — {self.phone}"
