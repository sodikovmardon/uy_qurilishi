from rest_framework import serializers
from house_calc.models import CalculationProject

from api.drawings import drawing_entries
from api.images import to_absolute


class ProjectSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    technical_drawings = serializers.SerializerMethodField()

    class Meta:
        model = CalculationProject
        fields = [
            'id', 'user_name', 'area', 'rooms', 'bathrooms',
            'has_pool', 'has_garage', 'has_terrace',
            'features',
            'source', 'images', 'technical_drawings', 'created_at',
        ]
        read_only_fields = ['id', 'source', 'images', 'technical_drawings', 'created_at', 'features']

    def get_images(self, obj):
        request = self.context.get('request')
        return [to_absolute(request, url) for url in obj.images]

    def get_technical_drawings(self, obj):
        request = self.context.get('request')
        return drawing_entries(request, obj)


class ProjectCreateSerializer(serializers.Serializer):
    area = serializers.IntegerField(min_value=1)
    rooms = serializers.IntegerField(min_value=1)
    bathrooms = serializers.IntegerField(min_value=1)
    has_pool = serializers.BooleanField(default=False)
    has_garage = serializers.BooleanField(default=False)
    has_terrace = serializers.BooleanField(default=False)
    features = serializers.ListField(
        child=serializers.CharField(max_length=32),
        required=False,
        default=list,
    )
    user_name = serializers.CharField(max_length=100, default='')


class CalculateSerializer(serializers.Serializer):
    area = serializers.IntegerField(min_value=1)
    rooms = serializers.IntegerField(min_value=1)


class AuthSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128)


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(min_length=8, max_length=128)
