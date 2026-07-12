from rest_framework import serializers
from house_calc.models import CalculationProject


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculationProject
        fields = [
            'id', 'user_name', 'area', 'rooms', 'bathrooms',
            'has_pool', 'has_garage', 'has_terrace',
            'source', 'created_at',
        ]
        read_only_fields = ['id', 'source', 'created_at']


class ProjectCreateSerializer(serializers.Serializer):
    area = serializers.IntegerField(min_value=1)
    rooms = serializers.IntegerField(min_value=1)
    bathrooms = serializers.IntegerField(min_value=1)
    has_pool = serializers.BooleanField(default=False)
    has_garage = serializers.BooleanField(default=False)
    has_terrace = serializers.BooleanField(default=False)
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
    password = serializers.CharField(min_length=4, max_length=128)
