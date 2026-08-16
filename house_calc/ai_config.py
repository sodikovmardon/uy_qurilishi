"""
Central AI provider configuration.

Everything AI in the project reads from here so the whole stack can point at
Groq (or a Groq Tunnel / OpenAI-compatible endpoint) via a single place:

  GROQ_API_KEY    — Groq (or tunnel) API key
  GROQ_API_BASE   — OpenAI-compatible base URL (default: Groq hosted API)
  GROQ_MODEL      — chat/advisor model id

Image generation has no Groq endpoint, so it is configurable separately via
AI_IMAGE_* vars and defaults to OpenAI. When a tunneled image model is
available, set AI_IMAGE_API_URL / AI_IMAGE_API_KEY / AI_IMAGE_MODEL.
"""
import os


def groq_api_base():
    return os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1")


def groq_api_key():
    return os.getenv("GROQ_API_KEY") or None


def groq_model():
    return os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def image_api_url():
    return os.getenv("AI_IMAGE_API_URL", "https://api.openai.com/v1/images/generations")


def image_api_key():
    return os.getenv("AI_IMAGE_API_KEY") or os.getenv("OPENAI_API_KEY") or None


def image_model():
    return os.getenv("AI_IMAGE_MODEL", os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2"))


def has_image_capability():
    return bool(image_api_key())
