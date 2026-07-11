from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('house_calc', '0002_calculationproject_rooms_has_pool'),
    ]

    operations = [
        migrations.AddField(
            model_name='calculationproject',
            name='bathrooms',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='calculationproject',
            name='has_garage',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='calculationproject',
            name='has_terrace',
            field=models.BooleanField(default=False),
        ),
    ]
