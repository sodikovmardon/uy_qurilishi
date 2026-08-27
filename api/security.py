"""Shared security helpers for the API.

- ``csrf_protected``: enforces Django's CSRF machinery on DRF views. DRF's
  ``@api_view`` marks views ``csrf_exempt`` (relying on SessionAuthentication),
  which leaves session-cookie-driven endpoints (store admin, orders, auth)
  without CSRF protection. This decorator re-runs the standard CSRF check for
  unsafe methods and returns a 403 when the token/origin is invalid.
- ``login_lockout``: cache-based per-account brute-force protection.
- ``password_policy``: Django's password validators wrapped with Uzbek messages.
"""
from functools import wraps

from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework.throttling import SimpleRateThrottle

_csrf_middleware = CsrfViewMiddleware(lambda req: None)

SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS'}

LOCKOUT_WINDOW = 15 * 60          # seconds
MAX_FAILED_ATTEMPTS = 5


class IPOnlyThrottle(SimpleRateThrottle):
    """Rate limit keyed on the client IP address only.

    ScopedRateThrottle (DRF default) silently does nothing unless a view sets
    ``throttle_scope``, and ``@api_view`` never copies that attribute — so it
    never actually throttles. Subclasses pin a scope and always key on IP.
    """

    THROTTLE_MSG = 'Juda ko\'p so\'rov yuborildi. Iltimos, birozdan so\'ng qayta urinib ko\'ring'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

    def allow_request(self, request, view):
        allowed = super().allow_request(request, view)
        if not allowed:
            self.wait = lambda: None
        return allowed


class AuthThrottle(IPOnlyThrottle):
    scope = 'auth'
    THROTTLE_MSG = 'Kirish vaqtincha cheklandi. Iltimos, birozdan so\'ng qayta urinib ko\'ring'


class SignupThrottle(IPOnlyThrottle):
    scope = 'signup'
    THROTTLE_MSG = 'Ro\'yxatdan o\'tish vaqtincha cheklandi. Iltimos, birozdan so\'ng qayta urinib ko\'ring'


class ChatThrottle(IPOnlyThrottle):
    scope = 'chat'


class OrdersThrottle(IPOnlyThrottle):
    scope = 'orders'


class StoreThrottle(IPOnlyThrottle):
    scope = 'store'


class StoreAdminThrottle(IPOnlyThrottle):
    scope = 'store_admin'


class CalcThrottle(IPOnlyThrottle):
    scope = 'calc'


class FilesThrottle(IPOnlyThrottle):
    scope = 'files'


def csrf_protected(view_func):
    """Require a valid CSRF token/origin on unsafe methods.

    The token is read from the ``csrftoken`` cookie (set by
    ``ensure_csrf_cookie``) and must be echoed back via the ``X-CSRFToken``
    header or ``csrfmiddlewaretoken`` form field.
    """

    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if request.method in SAFE_METHODS:
            return view_func(request, *args, **kwargs)
        # process_view returns a 403 response when the check fails.
        rejection = _csrf_middleware.process_view(request, view_func, args, kwargs)
        if rejection is not None:
            return rejection
        return view_func(request, *args, **kwargs)

    return wrapped_view


def _client_ip(request):
    fwd = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _lockout_key(username: str, ip: str) -> str:
    return f'login_failures:{username.lower()}:{ip}'


def mark_failed_login(username: str, request) -> None:
    key = _lockout_key(username, _client_ip(request))
    count = int(cache.get(key) or 0) + 1
    cache.set(key, count, LOCKOUT_WINDOW)


def clear_failed_logins(username: str, request) -> None:
    cache.delete(_lockout_key(username, _client_ip(request)))


def login_blocked(username: str, request) -> bool:
    key = _lockout_key(username, _client_ip(request))
    return int(cache.get(key) or 0) >= MAX_FAILED_ATTEMPTS


def validate_password_policy(password: str, username: str = '') -> str | None:
    """Return an Uzbek error string when the password is too weak, else None.

    Enforces: >= 8 chars, not all-numeric, not a common password, not too
    similar to the username/phone.
    """
    if not password or len(password) < 8:
        return 'Parol kamida 8 belgidan iborat bo\'lishi kerak'
    try:
        validate_password(password)
        return None
    except Exception as exc:
        errors = list(getattr(exc, 'messages', [str(exc)]))
        return errors[0] if errors else 'Parol yetarli darajada mustahkam emas'
