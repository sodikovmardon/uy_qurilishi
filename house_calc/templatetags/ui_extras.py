import json
import re

from django import template

register = template.Library()

EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\u2600-\u27BF"
    "]+",
    flags=re.UNICODE,
)


@register.filter
def clean_ai(value):
    if not value:
        return ""

    text = str(value)
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError):
        parsed = None

    if isinstance(parsed, dict):
        text = str(parsed.get("fallback") or "")
        if not text:
            text = "\n".join(
                str(item)
                for key, item in parsed.items()
                if key != "error" and item
            )
    elif isinstance(parsed, list):
        text = "\n".join(str(item) for item in parsed if item)

    text = EMOJI_RE.sub("", text)
    text = text.replace("**", "")
    text = text.replace("__", "")
    lines = []
    for line in text.splitlines():
        cleaned = re.sub(r"^\s*[-*#>]+\s*", "", line).strip()
        if re.match(r"^ArchAI Analysis:", cleaned, flags=re.I):
            continue
        if re.match(r"^Design Overview:?$", cleaned, flags=re.I):
            continue
        if cleaned:
            lines.append(cleaned)
    return "\n".join(lines).strip()
