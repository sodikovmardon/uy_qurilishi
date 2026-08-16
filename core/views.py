"""Core application views (health checks)."""

from django.db import connection
from django.http import JsonResponse


def health(request):
    """Liveness + DB connectivity check used by the hosting platform."""
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({'status': 'error', 'database': 'unreachable'}, status=503)
    return JsonResponse({'status': 'ok', 'database': 'ok'})
