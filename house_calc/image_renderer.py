import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from house_calc.bot_visuals import generate_house_preview
from house_calc.layout_utils import estimate_storeys


IMAGE_API_URL = "https://api.openai.com/v1/images/generations"
PREVIEW_DIR = Path(__file__).resolve().parent.parent / "generated_previews"
PREVIEW_STYLE_VERSION = 3


def preview_path_for_project(project_id):
    PREVIEW_DIR.mkdir(exist_ok=True)
    return PREVIEW_DIR / f"house-project-{project_id}.png"


def preview_meta_path_for_project(project_id):
    PREVIEW_DIR.mkdir(exist_ok=True)
    return PREVIEW_DIR / f"house-project-{project_id}.json"


def preview_path_for_product(product_id):
    PREVIEW_DIR.mkdir(exist_ok=True)
    return PREVIEW_DIR / f"product-{product_id}.png"


def preview_meta_path_for_product(product_id):
    PREVIEW_DIR.mkdir(exist_ok=True)
    return PREVIEW_DIR / f"product-{product_id}.json"


def has_ai_render_capability():
    return bool(os.getenv("OPENAI_API_KEY"))


def build_render_prompt(project):
    storeys = estimate_storeys(project.area, project.rooms)
    style = "modern"  # Default, can be from project if added
    
    # Convert number to word for storeys
    storey_words = {1: "1-story", 2: "two-story", 3: "three-story", 4: "four-story", 5: "five-story"}
    storey_text = storey_words.get(storeys, f"{storeys}-story")
    
    # Determine house type based on size and stories
    house_type = "villa" if storeys >= 2 and project.area >= 1500 else "house"
    
    # Build feature description
    features = []
    
    # Pool description
    if project.has_pool:
        features.append("a luxury swimming pool")
    
    # Garage description
    if project.has_garage:
        features.append("an attached modern garage")
    
    # Terrace description
    if project.has_terrace:
        features.append("a covered terrace")
    
    features_text = ", ".join(features) if features else "professional landscaping"
    
    # Construct the prompt
    prompt = (
        f"Professional architectural visualization of a {storey_text} {style} {house_type} on a {project.area} sqm landscaped plot. "
        f"Features include {project.rooms} large windows with modern frames, {features_text}, elegant landscaping with trees and pathways. "
        "Photorealistic, high detail, cinematic lighting, golden hour, 8K resolution, high-end materials (glass, stone, wood), professional render, no people, beautiful sky --ar 16:9"
    )
    
    return prompt


def build_product_render_prompt(product_name):
    prompt = (
        f"A hyper-realistic professional product showcase of {product_name}, featuring three distinct orthographic views in a single frame: top view, front view, and back view. "
        "8k resolution, cinematic studio lighting, highly detailed textures, and photorealistic materials. "
        "Symmetrical composition on a clean, minimalist neutral background, high-end commercial photography style, ultra-sharp focus"
    )
    return prompt


def generate_realistic_house_image(project):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return generate_house_preview(
            project.area,
            project.rooms,
            project.bathrooms,
            project.has_pool,
            project.has_garage,
            project.has_terrace,
        ), "fallback"

    model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2")
    quality = os.getenv("OPENAI_IMAGE_QUALITY", "high")
    size = os.getenv("OPENAI_IMAGE_SIZE", "1536x1024")
    payload = {
        "model": model,
        "prompt": build_render_prompt(project),
        "size": size,
        "quality": quality,
        "background": "opaque",
    }
    request = urllib.request.Request(
        IMAGE_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
        image_base64 = data["data"][0]["b64_json"]
        return base64.b64decode(image_base64), "ai"
    except (KeyError, IndexError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        return generate_house_preview(
            project.area,
            project.rooms,
            project.bathrooms,
            project.has_pool,
            project.has_garage,
            project.has_terrace,
        ), "fallback"


def generate_product_image(product_name):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # No fallback for products, return None or raise error
        raise ValueError("OPENAI_API_KEY not set for product image generation")

    model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2")
    quality = os.getenv("OPENAI_IMAGE_QUALITY", "high")
    size = os.getenv("OPENAI_IMAGE_SIZE", "1536x1024")
    payload = {
        "model": model,
        "prompt": build_product_render_prompt(product_name),
        "size": size,
        "quality": quality,
        "background": "opaque",
    }
    request = urllib.request.Request(
        IMAGE_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
        image_base64 = data["data"][0]["b64_json"]
        return base64.b64decode(image_base64), "ai"
    except (KeyError, IndexError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError) as e:
        raise ValueError(f"Failed to generate product image: {e}")


def ensure_project_preview(project):
    preview_path = preview_path_for_project(project.pk)
    meta_path = preview_meta_path_for_project(project.pk)
    force_refresh = os.getenv("OPENAI_FORCE_RENDER") == "1"
    cached_source = None
    cached_style_version = None
    if meta_path.exists():
        try:
            cached_meta = json.loads(meta_path.read_text())
            cached_source = cached_meta.get("source")
            cached_style_version = cached_meta.get("style_version")
        except json.JSONDecodeError:
            cached_source = None
            cached_style_version = None

    should_regenerate = force_refresh or not preview_path.exists()
    if has_ai_render_capability() and cached_source != "ai":
        should_regenerate = True
    if cached_source != "ai" and cached_style_version != PREVIEW_STYLE_VERSION:
        should_regenerate = True

    if should_regenerate:
        image_bytes, source = generate_realistic_house_image(project)
        preview_path.write_bytes(image_bytes)
        meta_path.write_text(
            json.dumps(
                {"source": source, "style_version": PREVIEW_STYLE_VERSION},
                ensure_ascii=True,
            )
        )
        return preview_path, source

    return preview_path, cached_source or "fallback"


def ensure_product_preview(product):
    preview_path = preview_path_for_product(product.pk)
    meta_path = preview_meta_path_for_product(product.pk)
    force_refresh = os.getenv("OPENAI_FORCE_RENDER") == "1"
    cached_source = None
    cached_style_version = None
    if meta_path.exists():
        try:
            cached_meta = json.loads(meta_path.read_text())
            cached_source = cached_meta.get("source")
            cached_style_version = cached_meta.get("style_version")
        except json.JSONDecodeError:
            cached_source = None
            cached_style_version = None

    should_regenerate = force_refresh or not preview_path.exists()
    if has_ai_render_capability() and cached_source != "ai":
        should_regenerate = True
    if cached_source != "ai" and cached_style_version != PREVIEW_STYLE_VERSION:
        should_regenerate = True

    if should_regenerate:
        image_bytes, source = generate_product_image(product.name)
        preview_path.write_bytes(image_bytes)
        meta_path.write_text(
            json.dumps(
                {"source": source, "style_version": PREVIEW_STYLE_VERSION},
                ensure_ascii=True,
            )
        )
        return preview_path, source

    return preview_path, cached_source or "fallback"
