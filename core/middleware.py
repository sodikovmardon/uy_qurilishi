"""Extra security response headers.

Django's SecurityMiddleware already handles HSTS, nosniff and referrer
policy via settings. This middleware adds a Content-Security-Policy for the
React SPA (bundle-only scripts, inline styles required by the CSS-in-JS /
Tailwind tooling) and defensive defaults for the rest of the site. The Django
admin panel is left without a CSP because third-party admin widgets use inline
scripts; it is already protected by its own login + X-Frame-Options.
"""

from django.http import HttpResponse

CSP_SPA = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https: http:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none'"
)


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('X-Frame-Options', 'DENY')
        response.setdefault(
            'Referrer-Policy',
            'strict-origin-when-cross-origin',
        )
        response.setdefault(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=()',
        )

        path = request.path
        is_spa = not path.startswith('/admin') and not path.startswith('/api')
        if is_spa and response.get('Content-Type', '').startswith('text/html'):
            response.setdefault('Content-Security-Policy', CSP_SPA)

        return response

class MaintenanceModeMiddleware:
    """Shows a simple maintenance page to non-staff users while maintenance
    mode is enabled in SiteSettings. Admin (/admin), API, static/media assets
    and staff sessions remain fully accessible so site owners can fix things."""

    BLOCKED_PREFIXES = ('/api/', '/static/', '/media/', '/health/', '/admin/')
    ALLOWED_PATHS = ('/admin', '/api', '/static', '/media', '/health')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method != 'GET':
            return self.get_response(request)

        # Never block admin or API access.
        if request.path.startswith(self.BLOCKED_PREFIXES):
            return self.get_response(request)

        # Staff can always pass.
        if getattr(request.user, 'is_authenticated', False) and request.user.is_staff:
            return self.get_response(request)

        try:
            from house_calc.models import SiteSettings
            settings = SiteSettings.objects.filter(pk=1).first()
            maintenance = settings.maintenance_mode if settings else False
        except Exception:
            maintenance = False

        if not maintenance:
            return self.get_response(request)

        return HttpResponse(
            _maintenance_html(),
            content_type='text/html; charset=utf-8',
            status=503,
        )


def _maintenance_html():
    return (
        '<!doctype html><html lang="uz">'
        '<head><meta charset="utf-8"><meta name="viewport" '
        'content="width=device-width,initial-scale=1">'
        '<title>Texnik xizmat — Uy Loyiha Studio</title>'
        '<style>'
        'body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
        'background:#eef2fa;color:#0f172a;display:flex;align-items:center;'
        'justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}'
        'h1{font-size:22px}a{font-size:13px;display:inline-block;margin-top:8px;color:#2563eb}'
        '</style></head><body>'
        '<div><h1>Sayt vaqtincha texnik xizmat ko\'rsatilmoqda</h1>'
        '<p>Tizimni yaxshilash bo\'yicha ishlar olib borilmoqda. '
        'Tez orada qaytamiz.</p></div></body></html>'
    )
