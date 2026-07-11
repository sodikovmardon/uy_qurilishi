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
    ai_summary = models.TextField(blank=True)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default=SOURCE_WEB)
    user_name = models.CharField(max_length=150, blank=True)
    telegram_id = models.BigIntegerField(null=True, blank=True)
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


class Product(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
