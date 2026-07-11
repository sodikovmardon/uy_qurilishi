from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('house_calc', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='calculationproject',
            name='has_pool',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='calculationproject',
            name='rooms',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
