from django import forms


class CalculationForm(forms.Form):
    text_input_attrs = {'class': 'text-input'}
    number_input_attrs = {'class': 'text-input', 'min': '1'}
    toggle_input_attrs = {'class': 'toggle-input'}

    user_name = forms.CharField(
        max_length=150,
        required=False,
        label='Ismingiz',
        widget=forms.TextInput(
            attrs={**text_input_attrs, 'placeholder': 'Ismingiz yoki mijoz nomi'}
        ),
    )
    area = forms.IntegerField(
        min_value=1,
        label='Uy maydoni (kv.m)',
        initial=120,
        widget=forms.NumberInput(
            attrs={**number_input_attrs, 'placeholder': 'Masalan: 120'}
        ),
    )
    rooms = forms.IntegerField(
        min_value=1,
        label="Xonalar soni",
        initial=4,
        widget=forms.NumberInput(
            attrs={**number_input_attrs, 'placeholder': 'Masalan: 4'}
        ),
    )
    bathrooms = forms.IntegerField(
        min_value=1,
        label="Vanna xonalari soni",
        initial=2,
        widget=forms.NumberInput(
            attrs={**number_input_attrs, 'placeholder': 'Masalan: 2'}
        ),
    )
    has_garage = forms.BooleanField(
        required=False,
        label='Garaj mavjudmi',
        widget=forms.CheckboxInput(attrs=toggle_input_attrs),
    )
    has_terrace = forms.BooleanField(
        required=False,
        label='Terrasa mavjudmi',
        widget=forms.CheckboxInput(attrs=toggle_input_attrs),
    )
    has_pool = forms.BooleanField(
        required=False,
        label='Basseyn mavjudmi',
        widget=forms.CheckboxInput(attrs=toggle_input_attrs),
    )
