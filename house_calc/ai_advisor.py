import json
import os
import urllib.error
import urllib.request


OPENAI_API_URL = "https://api.openai.com/v1/responses"


def fallback_house_advice(area, rooms, bathrooms, has_pool, has_garage, has_terrace, floor_count=1, interior_style='Modern'):
    """
    ArchAI - Expert Architectural Assistant for Home Building Analysis

    Provides comprehensive architectural feedback including:
    - Bathroom-to-room ratio analysis with warnings
    - Cost-saving material suggestions
    - Energy efficiency pro tips based on house size
    """

    # Calculate bathroom-to-room ratio
    ratio = bathrooms / rooms if rooms > 0 else 0

    # Determine ratio warning level
    ratio_warning = ""
    if ratio < 0.2:
        ratio_warning = f"⚠️ Bathroom Ratio Alert: Your current setup has {bathrooms} bathroom(s) for {rooms} rooms (ratio: {ratio:.2f}). This may cause significant inconvenience. Consider adding {max(1, int(rooms * 0.33) - bathrooms)} more bathroom(s) for optimal comfort."
    elif ratio < 0.25:
        ratio_warning = f"⚠️ Bathroom Ratio Alert: Your current setup has {bathrooms} bathroom(s) for {rooms} rooms (ratio: {ratio:.2f}). This may cause significant inconvenience. Consider adding 1 more bathroom for optimal comfort."

    # Cost-saving material suggestions based on project size
    material_suggestions = []

    if area <= 100:
        material_suggestions = [
            "• **Flooring**: Use luxury vinyl plank ($3-5/sqm) instead of hardwood ($8-12/sqm) - Save ~$500-900 (40-50%)\n  Durable, waterproof, and easier installation with similar aesthetic appeal",
            "• **Insulation**: Choose spray foam ($2-3/sqm) over fiberglass batts ($1-2/sqm) - Save ~$200-400 (20-30%)\n  Better thermal performance and fewer installation steps"
        ]
    elif area <= 200:
        material_suggestions = [
            "• **Roofing**: Opt for metal roofing ($5-7/sqm) instead of premium tiles ($12-18/sqm) - Save ~$1,200-2,400 (50-60%)\n  Longer lifespan, lower maintenance, and excellent durability",
            "• **Windows**: Select double-pane vinyl windows ($200-300 each) over wood frames ($400-600 each) - Save ~$800-1,200 (40-50%)\n  Better insulation and virtually maintenance-free"
        ]
    else:
        material_suggestions = [
            "• **Foundation**: Use concrete block foundation instead of poured concrete - Save ~$3,000-5,000 (25-35%)\n  Faster construction and easier to modify later if needed",
            "• **HVAC**: Install a high-efficiency heat pump ($8,000-12,000) over central air ($12,000-18,000) - Save ~$4,000-6,000 (30-40%)\n  Better energy efficiency and dual heating/cooling capability"
        ]

    # Energy efficiency pro tip based on house size
    energy_tip = ""
    if area < 100:
        energy_tip = "For a compact home, install LED smart bulbs with motion sensors throughout - can reduce lighting costs by 80-90% while adding convenience and security."
    elif area <= 200:
        energy_tip = "For a medium-sized home, orient the building to maximize southern exposure and add thermal mass materials like concrete or stone - can reduce heating costs by 15-25% through passive solar design."
    else:
        energy_tip = "For a large home, implement a zoned HVAC system with smart thermostats - can reduce energy costs by 20-30% through optimized temperature control in different areas."

    # Build the response
    response_parts = [
        f"🏠 **ArchAI Analysis: {area} sqm {'Compact' if area < 100 else 'Medium' if area <= 200 else 'Large'} Home**",
        "",
        "**Design Overview:**",
        f"This {area} sqm home with {rooms} rooms and {bathrooms} bathroom(s) offers {'excellent' if ratio >= 0.33 else 'good' if ratio >= 0.25 else 'basic'} space efficiency. {'The layout provides comfortable living for a small family.' if rooms <= 3 else 'The multi-room design supports family growth and privacy needs.'}",
        "",
        "**Bathroom Ratio Check:**",
        ratio_warning if ratio_warning else f"✅ Bathroom Ratio: {ratio:.2f} - This meets standard comfort guidelines for residential living.",
        "",
        "**💰 Cost-Saving Material Suggestions:**",
    ]

    response_parts.extend(material_suggestions)
    response_parts.extend([
        "",
        "**⚡ Pro Tip for Energy Efficiency:**",
        energy_tip,
        "",
        "**💡 Additional Recommendations:**",
        f"• Consider {'a compact design with multi-purpose rooms' if area < 100 else 'smart home integration for energy monitoring' if area <= 200 else 'modular construction methods for faster building'}",
        f"• {'Local climate considerations are crucial for small homes' if area < 100 else 'Natural ventilation strategies work well for this size' if area <= 200 else 'Professional architectural consultation recommended for large projects'}"
    ])

    return "\n".join(response_parts)


def generate_house_advice(area, rooms, bathrooms, has_pool, has_garage, has_terrace, floor_count, interior_style='Modern'):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return fallback_house_advice(area, rooms, bathrooms, has_pool, has_garage, has_terrace, floor_count, interior_style)

    # System prompt for ArchAI
    system_prompt = """You are ArchAI, an expert AI architectural assistant integrated into a home building cost estimation app. You specialize in residential construction, architectural design principles, material science, and sustainable building practices.

CORE CAPABILITIES:
- Analyze user inputs: square footage, rooms, bathrooms, features
- Provide expert architectural feedback on design and functionality
- Calculate bathroom-to-room ratio and warn if below optimal levels
- Suggest cost-saving materials with specific savings estimates
- Provide energy efficiency tips based on house size

BATHROOM RATIO GUIDELINES:
- Optimal: 1 bathroom per 2-3 rooms (0.33-0.5 ratio)
- Warning: Below 0.25 ratio (1 bathroom per 4+ rooms)
- Critical: Below 0.2 ratio (1 bathroom per 5+ rooms)

RESPONSE FORMAT:
🏠 **ArchAI Analysis: [Size Category] Home**

**Design Overview:**
[2-3 sentence architectural assessment]

**Bathroom Ratio Check:**
[Ratio analysis with warning if applicable]

**💰 Cost-Saving Material Suggestions:**
• **[Category]**: [Alternative vs Standard] - Save ~$[X] ([Y]%)
  [Brief justification]

• **[Category]**: [Alternative vs Standard] - Save ~$[X] ([Y]%)
  [Brief justification]

**⚡ Pro Tip for Energy Efficiency:**
[One specific tip based on house size with savings estimate]

**💡 Additional Recommendations:**
[1-2 relevant suggestions]

Keep responses professional, informative, and actionable. Always prioritize safety and building codes."""

    user_prompt = f"""Analyze this home design:
- Area: {area} sqm
- Rooms: {rooms}
- Bathrooms: {bathrooms}
- Pool: {'Yes' if has_pool else 'No'}
- Garage: {'Yes' if has_garage else 'No'}
- Terrace: {'Yes' if has_terrace else 'No'}
- Floors: {floor_count}
- Style: {interior_style}

Provide architectural feedback following the specified format."""

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.7,
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            data = json.loads(response.read().decode("utf-8"))
            ai_response = data["choices"][0]["message"]["content"].strip()
            return ai_response
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP Error: {e.code}", "details": e.read().decode("utf-8")}
    except Exception as e:
        return {"error": str(e)}


def generate_house_advice(area, rooms, bathrooms, has_pool, has_garage, has_terrace, floor_count, interior_style='Modern'):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return fallback_house_advice(area, rooms, bathrooms, has_pool, has_garage, has_terrace, floor_count, interior_style)

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    prompt = (
        "You are an expert AI Architect and Construction Estimator. Your task is to analyze the user's house requirements and provide a detailed construction plan.\n\n"
        "Input Parameters:\n\n"
        f"Land Area: {area} sqm\n\n"
        f"Number of Rooms: {rooms}\n\n"
        f"Floor Count: {floor_count}\n\n"
        f"Swimming Pool: {'Yes' if has_pool else 'No'}\n\n"
        f"Interior Style: {interior_style}\n\n"
        "Your Deliverables:\n\n"
        "Material Estimation: Calculate the approximate quantity of bricks, cement (bags), steel reinforcement (tons), and concrete needed.\n\n"
        "Technical Specifications: Suggest the best foundation type and wall thickness based on the floor count.\n\n"
        "Timeline: Provide an estimated construction duration from groundbreaking to finish.\n\n"
        "AI Recommendations: Suggest energy-efficient solutions (e.g., solar panels, smart glass).\n\n"
        "Output Format: Provide the response in a structured JSON format for web integration."
    )

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1000,
        "temperature": 0.7,
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            data = json.loads(response.read().decode("utf-8"))
            ai_response = data["choices"][0]["message"]["content"].strip()
            # Try to parse as JSON
            try:
                return json.loads(ai_response)
            except json.JSONDecodeError:
                return {"error": "Invalid JSON response", "raw": ai_response}
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP Error: {e.code}", "details": e.read().decode("utf-8")}
    except Exception as e:
        return {"error": str(e)}
