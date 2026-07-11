from django.contrib import admin

from house_calc.models import CalculationProject, Product


admin.site.site_header = 'House Calculation Admin'
admin.site.site_title = 'HouseCalc Admin'
admin.site.index_title = 'Boshqaruv paneli'

@admin.register(CalculationProject)
class CalculationProjectAdmin(admin.ModelAdmin):
    list_display = (
        'id',
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
    readonly_fields = ('created_at',)

    def short_ai_summary(self, obj):
        if not obj.ai_summary:
            return '-'
        return obj.ai_summary[:60] + ('...' if len(obj.ai_summary) > 60 else '')

    short_ai_summary.short_description = 'AI summary'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_at')
    readonly_fields = ('created_at',)
