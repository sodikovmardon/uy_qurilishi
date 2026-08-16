"""Extra security response headers.

Django's SecurityMiddleware already handles HSTS, nosniff and referrer
policy via settings. This middleware adds a Content-Security-Policy for the
React SPA (bundle-only scripts, inline styles required by the CSS-in-JS /
Tailwind tooling) and defensive defaults for the rest of the site. The Django
admin panel is left without a CSP because third-party admin widgets use inline
scripts; it is already protected by its own login + X-Frame-Options.
"""

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
