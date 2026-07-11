from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('house_calc', '0003_calculationproject_more_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='calculationproject',
            name='ai_summary',
            field=models.TextField(blank=True),
        ),
    ]
