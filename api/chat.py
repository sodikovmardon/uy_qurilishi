"""
Qurilish AI yordamchisi — server-side chat proxy.

Streams token-by-token (SSE) responses to the client. Uses Groq's
OpenAI-compatible API (function/tool calling) when GROQ_API_KEY is set, and
falls back to a deterministic offline engine otherwise (so the feature is
always demo-able). The API key never leaves the server.
"""
import json
import logging
import math
import os
import random
import re
import time
import urllib.error
import urllib.request

from django.core.cache import cache
from django.http import StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

from api.materials import calculate_materials as _calculate_materials
from house_calc.ai_config import groq_api_base, groq_api_key, groq_model
from house_calc.models import CalculationProject

logger = logging.getLogger(__name__)

MAX_TOKENS = 1024
HISTORY_LIMIT = 12
STREAM_DELAY = 0.012
MAX_MESSAGE_LEN = 2000
CHAT_RATE_LIMIT = 40            # requests per minute per IP
CHAT_RATE_WINDOW = 60

SYSTEM_PROMPT = (
    "Siz 'Uy Loyiha Studio' ilovasining AI yordamchisisiz. Sizning asosiy vazifangiz — "
    "foydalanuvchilarga qurilish materiallari hisobi, loyiha tanlash, narxlar va qurilish "
    "jarayoni bo'yicha yordam berish. Lekin siz do'stona, tabiiy suhbat qura oladigan "
    "yordamchisiz:\n"
    "- Agar foydalanuvchi salomlashsa (salom, assalomu alaykum, hi, va h.k.), iliq va "
    "tabiiy javob bering, keyin o'zingizni tanishtiring va qanday yordam bera "
    "olishingizni qisqa aytib bering.\n"
    "- Agar savol umuman aloqador bo'lmasa (masalan ob-havo, umumiy bilim savollari), "
    "buni to'g'ridan-to'g'ri javob bering — imkoningiz boricha yordam bering, keyin "
    "ohista qurilish mavzusiga qaytarishingiz mumkin, lekin bu majburiy emas.\n"
    "- Faqat suhbat butunlay nomaqbul yoki zararli bo'lsa, muloyimlik bilan rad eting.\n"
    "- Har bir javobni foydalanuvchining aniq xabariga moslang — hech qachon oldindan "
    "yozilgan shablon javobni takrorlamang.\n"
    "- Tabiiy, iliq, samimiy ohangda gapiring — robot emas, bilimdon do'st kabi."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "calculate_materials",
            "description": "Uy maydoni (m²) va xonalar soniga qarab g'isht, sement, qum "
                           "miqdori va qavatlar sonini hisoblaydi. Foydalanuvchi hisob-kitob "
                           "so'raganda shu funksiyani chaqiring.",
            "parameters": {
                "type": "object",
                "properties": {
                    "area": {"type": "number", "description": "Uy maydoni kvadrat metrda"},
                    "rooms": {"type": "number", "description": "Xonalar soni"},
                },
                "required": ["area"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_projects",
            "description": "Katalogdagi uy loyihalarini filtrlar bo'yicha qidiradi. "
                           "Foydalanuvchi loyiha tavsiya qilishni yoki ma'lum parametrlarga "
                           "mos loyihani topishni so'raganda shu funksiyani chaqiring.",
            "parameters": {
                "type": "object",
                "properties": {
                    "rooms": {"type": "number", "description": "Xonalar soni (ixtiyoriy)"},
                    "area_min": {"type": "number", "description": "Minimal maydon m² (ixtiyoriy)"},
                    "area_max": {"type": "number", "description": "Maksimal maydon m² (ixtiyoriy)"},
                    "limit": {"type": "number", "description": "Qaytariladigan loyihalar soni (default 3)"},
                },
                "additionalProperties": False,
            },
        },
    },
]


# --------------------------------------------------------------------------
# SSE helpers
# --------------------------------------------------------------------------

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# --------------------------------------------------------------------------
# Tool execution (real app data/logic)
# --------------------------------------------------------------------------

def _materials_card(area, rooms):
    res = _calculate_materials(area, rooms)
    wall_length = round(math.sqrt(max(area, 1)), 2)
    return {
        "type": "materials",
        "data": {
            "area": area,
            "rooms": rooms,
            "wallLength": wall_length,
            "bricks": res["bricks"],
            "cement": res["cement"],
            "sand": res["sand"],
            "storeys": res["storeys"],
        },
    }


def _project_item(p):
    return {
        "id": p.id,
        "user_name": p.user_name,
        "area": p.area,
        "rooms": p.rooms,
        "bathrooms": p.bathrooms,
        "has_pool": p.has_pool,
        "has_garage": p.has_garage,
        "has_terrace": p.has_terrace,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "storeys": _calculate_materials(p.area, p.rooms)["storeys"],
    }


def _search_projects(filters):
    qs = CalculationProject.objects.all()
    rooms = filters.get("rooms")
    area_min = filters.get("area_min")
    area_max = filters.get("area_max")
    limit = int(filters.get("limit") or 3)
    limit = max(1, min(limit, 5))
    if rooms:
        qs = qs.filter(rooms__gte=max(int(rooms), 1), rooms__lte=int(rooms) + 1)
    if area_min:
        qs = qs.filter(area__gte=area_min)
    if area_max:
        qs = qs.filter(area__lte=area_max)
    qs = qs.order_by("-created_at")[:limit]
    return [_project_item(p) for p in qs]


def _execute_tool(name, arguments):
    if name == "calculate_materials":
        area = float(arguments.get("area") or 100)
        rooms = int(arguments.get("rooms") or 4)
        return _materials_card(area, rooms)
    if name == "search_projects":
        projects = _search_projects(arguments)
        if not projects:
            projects = [_project_item(p) for p in CalculationProject.objects.order_by("-created_at")[:3]]
        return {"type": "projects", "projects": projects}
    return None


# --------------------------------------------------------------------------
# Offline engine (no API key) — keyword/rule based, still streams
# --------------------------------------------------------------------------

def _extract_number(text):
    m = re.search(r"(\d+)(?:[.,]\d+)?", text.replace("m²", " ").replace("kv m", " "))
    return float(m.group(1)) if m else None


# --------------------------------------------------------------------------
# Offline conversation engine — varied, per-message replies.
# Pools are cycled so consecutive same-intent replies differ, making the
# assistant feel alive even without an LLM API key.
# --------------------------------------------------------------------------

_VARIATION = {"n": 0}


def _pick(pool):
    idx = _VARIATION["n"] % len(pool)
    _VARIATION["n"] += 1
    return pool[idx]


_GREETING_POOL = [
    "Salom! Xush kelibsiz. Men 'Uy Loyiha Studio'ning AI yordamchisiman — qurilish "
    "materiallari hisobi, loyiha tanlash va narxlar bo'yicha yordam bera olaman. "
    "Bugun nima bilan yordam bersam?",
    "Assalomu alaykum! Sizni ko'rganimdan xursandman. G'isht, sement hisobidan tortib "
    "loyiha tavsiyasigacha hamma narsada yordam beraman. Savolingizni yozing!",
    "Salom! Tanishganimdan mamnunman. Uyingiz uchun material hisobini qilishim yoki "
    "sizga mos loyiha topishim mumkin. Qayerdan boshlaymiz?",
    "Hayrli kun! Men 'Uy Loyiha Studio'ning AI yordamchisiman. Qurilish rejalaringiz "
    "bo'yicha maslahat bera olaman — masalan, 120 m² uyga qancha g'isht kerakligini "
    "hisoblab berishim mumkin. Qanday savol bor edi?",
]

_HOWAREYOU_POOL = [
    "Rahmat, so'raganingiz uchun! Men doim ishlayman — hech qachon charchamayman. "
    "Yaxshimisiz? Qurilish bo'yicha biror savolingiz bo'lsa, yordam berishdan "
    "mamnunman!",
    "A'lo, rahmat! Texnologik AI yordamchi sifatida har doim tayyorman. Sizning "
    "ishlaringiz qalay? Uyingiz uchun biror narsa hisoblay boshladikmi?",
    "Juda yaxshi, tashvishlanmang! Asosiysi — sizning loyihangiz. Material hisobi "
    "yoki loyiha tanlashda yordam kerakmi?",
]

_THANKS_POOL = [
    "Arzimaydi, doim xursandmiz! Yana biror narsa kerak bo'lsa — masalan, narxlar "
    "yoki loyihalar haqida — shu yerda qidirib ko'ring.",
    "Bepul, xursand bo'ldim! Agar hisob-kitob yoki loyiha tanlashda yana savol "
    "tug'ilsa, bemalol yozing.",
    "Marhamat! Sizga yana qanday yordam bera olaman? Masalan, boshqa material "
    "narxlarini ham solishtirib berishim mumkin.",
]

_FAREWELL_POOL = [
    "Xayr! Sizga omad tilayman. Agar qurilishda savol tug'ilsa, doim shu yerdaman!",
    "Ko'rishguncha! 'Uy Loyiha Studio' bilan qurilishingiz osongina kechsin. Qaytib "
    "kelganingizda xursand bo'laman!",
    "Xayr, ehtiyot bo'ling! Loyihangiz bo'yicha istalgan vaqt maslahat olishingiz "
    "mumkin — men doim tayyorman.",
]

_WEATHER_POOL = [
    "Ob-havo haqida jonli ma'lumot bera olmayman — bu mening kuchimdan tashqarida. "
    "Lekin qurilish rejalashtirayotgan bo'lsangiz, mavsumga mos maslahat bera olaman: "
    "masalan, poydevor qo'yish uchun eng qulay vaqt bahor yoki kuz, issiq kunlarda "
    "betonni namlashni unutmang.",
    "Jonli ob-havo men uchun mavjud emas, kechirasiz. Ammo qurilish ishlari uchun "
    "foydali maslahat beraman: yomg'ir mavsumida g'isht va sementni namdan saqlang, "
    "qishda esa beton ishlarini kamaytiring. Yana biror savol bo'lsa, yozing!",
]

_CURRENCY_POOL = [
    "Valyuta kursi bo'yicha jonli ma'lumot bera olmayman. Lekin qurilish uchun "
    "material narxlarini hisoblashda yordam bera olaman — masalan, ilovadagi "
    "kalkulyator hududingizga mos narxlarni ko'rsatadi. Uyingiz qancha kvadrat metr?",
    "Kurslar har kuni o'zgaradi va ularni men kuzatmayman. Agar qurilish byudjetini "
    "hisoblamoqchi bo'lsangiz, material narxlari bo'yicha yordam beraman. Boshlash "
    "uchun uy maydonini ayting!",
]

_OFFTOPIC_POOL = [
    "Qiziqarli savol! Bu mavzu qurilishdan uzoqroq bo'lsa ham, iloji boricha "
    "yordam berishga harakat qilaman. Agar uyingiz yoki loyihangiz haqida gapirishni "
    "istasangiz, material hisobi va loyiha tanlashda ayniqsa kuchliman!",
    "Buni bilishim qiyin, kechirasiz — mening mutaxassisligim asosan qurilish. "
    "Lekin boshqa savollarga ham ochiqman. Masalan, qurilish rejalaringiz bo'lsa, "
    "qayerdan boshlashni birga ko'rib chiqamiz?",
    "Kechirasiz, bu borada aniq ma'lumot bera olmayman. Ammo do'stona tavsiya "
    "sifatida: qurilishda materiallarni oldindan hisoblab olish ko'p pulni tejaydi. "
    "Ilovamizdagi kalkulyator shu maqsadda. Sinab ko'rmoqchimisiz?",
]

_IDENTITY_POOL = [
    "Men 'Uy Loyiha Studio' ilovasining AI yordamchisiman. Qurilish materiallarini "
    "hisoblash, loyiha tanlash, narxlar va qurilish jarayoni bo'yicha savollaringizga "
    "javob beraman. Bir yozuv bilan hisob-kitobni boshlashimiz mumkin!",
    "Men sizning qurilish bo'yicha AI maslahatchingizman! G'isht, sement, qum "
    "miqdorini hisoblay olaman va katalogdagi loyihalar bo'yicha tavsiyalar beraman. "
    "Savolingizni yozing — misol uchun: '150 m² uy uchun hisoblang'.",
]

_CAPABILITIES_POOL = [
    "Men quyidagilarda yordam bera olaman:\n"
    "• Materiallar hisobi — g'isht, sement, qum (masalan: '120 m² uy uchun hisoblang')\n"
    "• Loyiha tanlash — xonalar va maydon bo'yicha (masalan: '3 xonali loyiha toping')\n"
    "• Qurilish jarayoni va narxlar bo'yicha maslahatlar\n"
    "Nimadan boshlaymiz?",
    "Qisqasi: g'isht va sement hisobi, loyiha tavsiyasi, qurilish muddati va narxlar. "
    "Istalgan savolni bemalol yozing — masalan, uy maydoningizni aytib bersangiz, "
    "darhol hisoblab beraman.",
]

_CALC_INTRO_POOL = [
    "Tayyor! Quyidagi natijaga ko'z tashlang:",
    "Hisob-kitobni bajarib bo'ldim, natijasi:",
    "Mana, taxminiy hisob-kitob tayyor:",
    "Hisoblab chiqdim, shunday chiqdi:",
]

_CALC_NEED_POOL = [
    "Hisob-kitob qilishim uchun uy maydonini bilishim kerak. Masalan, "
    "'120 m² uy uchun necha g'isht kerak?' deb yozing. Xonalar sonini ham "
    "aytishingiz mumkin — natija aniqroq bo'ladi.",
    "Maydonisiz hisoblab bo'lmaydi! Uyingiz qancha kvadrat metr bo'ladi? "
    "Masalan: '90 m² uy uchun material hisobla'. Qancha xona bo'lishini ham "
    "ayting.",
]

_PROJECT_FOUND_POOL = [
    "Ajoyib, sizga mos loyihalarni topdim! Har bir kartani bosib to'liq ma'lumot "
    "va AI tavsiyasini ko'rishingiz mumkin.",
    "Shunday loyihalar borkan! Quyidagi kartalarni tekshirib ko'ring — istagani "
    "kerakli detallarini oching.",
]

_PROJECT_NONE_POOL = [
    "Hozircha aynan mos loyiha topilmadi, lekin katalogdagi eng so'nggi loyihalarni "
    "ko'rsatishim mumkin. Quyidagi kartalarga teging — to'liq ma'lumot ochiladi.",
    "Aniq mos keladiganini topa olmadim, afsuski. Yaqinda qo'shilgan loyihalarni "
    "ko'rsataman — qarabsizki, o'zingizga yoqqani chiqar.",
]

_CEMENT_OPENERS = [
    "Sement qorishmasi haqida: standart nisbat 1:3 — 1 qism sementga 3 qism qum. "
    "Mustahkamlangan qismlar uchun 1:2 ishlatiladi.",
    "Qorishma nisbati bo'yicha oddiy qoida: 1:3 (sement:qum) oddiy devor uchun, "
    "1:2 esa yuk ko'taruvchi qismlar uchun.",
]
_CEMENT_TIPS = [
    " Sementni quruq joyda saqlang — namlangan qop sifatini yo'qotadi.",
    " Eslatma: qorishmani ko'p miqdorda tayyorlamang, 30-40 daqiqada ishlatib "
    "bo'lmasa, sifati pasayadi.",
]

_BRICK_OPENERS = [
    "G'isht turlari haqida qisqacha:",
    "Tanlov bo'yicha foydali ma'lumot:",
]
_BRICK_TYPES = (
    "\n• Silikat g'isht — arzon va keng tarqalgan, ichki devorlar uchun yaxshi;\n"
    "• Keramik g'isht — bardoshliroq, tashqi devorlar uchun tavsiya etiladi;\n"
    "• Gazblok — yengil va tez quriladi, issiqlikni yaxshi saqlaydi."
)
_BRICK_ENDINGS = [
    " Narxlar hududga qarab farq qiladi — ilovamizdagi kalkulyator hududingizga mos "
    "narxlarni hisobga oladi.",
    " Aniq miqdorni bilish uchun kalkulyatorda uy maydonini kiriting.",
]

_TIME_OPENERS = [
    "Qurilish muddati bo'yicha taxminiy ko'rsatmalar:",
    "Odatda qurilish shuncha davom etadi:",
]
_TIME_BODY = (
    "\n• 1 qavatli uy — 3-5 oy\n"
    "• 2 qavatli uy — 6-9 oy\n"
    "• 3 qavatli uy — 10-14 oy"
)
_TIME_ENDINGS = [
    " Bu muddat ob-havo, material yetkazib berish va pudratchi jamoasiga qarab "
    "o'zgarishi mumkin.",
    " Aniq muddatni pudratchi bilan kelishib oling — bu ko'rsatkichlar o'rtacha.",
]

_PRICE_OPENERS = [
    "Narxlar hududga qarab farq qiladi:",
    "Hudud bo'yicha narx farqi haqida:",
]
_PRICE_BODY = (
    " Kalkulyator 14 ta hudud bo'yicha mintaqaviy narxlarni qo'llaydi. "
    "Toshkent shahri bazaviy (eng yuqori) narxlarda, qolgan viloyatlar esa "
    "odatda 5-15% arzonroq deb hisoblanadi."
)
_PRICE_ENDINGS = [
    " Ilovaning 'Sozlamalar' bo'limida hududingizni tanlasangiz, kalkulyator shu "
    "hudud narxlariga mos hisoblaydi.",
    " Shu sababli hisob-kitobdan oldin hududni tanlash muhim.",
]

_GENERIC_OPENERS = [
    "Qurilish bo'yicha barcha savollarga ochiqman: materiallar hisobi, loyiha "
    "tanlash, narxlar va muddatlar. Masalan, uy maydoningizni ayting — g'isht va "
    "sement miqdorini darhol hisoblab beraman!",
    "Men qurilish maslahatchisiman — g'isht, sement hisobi, loyiha tavsiyasi va "
    "qurilish jarayoni bo'yicha yordam beraman. Savolingizni aniqroq yozsangiz, "
    "aniqroq javob olasiz. Masalan: '100 m² uy uchun qancha sement kerak?'",
    "Istalgan savolni berishingiz mumkin! Men materiallar, loyihalar va narxlar "
    "bo'yicha kuchliman. Uy rejalaringiz qanday — katta xonali yoki ixchamroq?",
]


def _offline_reply(message, context):
    text = message.lower().strip()
    cards = []

    area = _extract_number(text)
    rooms_m = re.search(r"(\d+)\s*(?:xona|xonali)", text)
    calc_intent = any(k in text for k in
                      ["hisob", "g'isht", "sement", "qum", "xarajat", "material", "kerak"])
    project_intent = any(k in text for k in
                         ["loyiha", "tavsiya", "top", "ko'rsat", "loyihalar", "mos"])

    if re.match(r"^(salom|assalomu aleykum|assalomu alaykum|assalom|hayrli kun|"
                r"hayrli tong|xayrli kun|hayrli kech|hi|hello|hey)\b", text) \
            and len(text) <= 60:
        return _pick(_GREETING_POOL), []
    if re.search(r"\b(qandaysiz|qalaysiz|yaxshimisiz|yaxshimis|qanday yashayapsiz)\b", text):
        return _pick(_HOWAREYOU_POOL), []
    if re.search(r"\b(rahmat|tashakkur|tashakkur|katta rahmat)\b", text):
        return _pick(_THANKS_POOL), []
    if re.search(r"\b(xayr|ko'rishguncha|alvido|salomat bo'ling)\b", text):
        return _pick(_FAREWELL_POOL), []
    if re.search(r"\b(ob-havo|obhavo|yomg'ir|harorat|gradus|havo qanday)\b", text):
        return _pick(_WEATHER_POOL), []
    if re.search(r"\b(kurs|valyuta|dollar|yevro|evro|rubl)\b", text):
        return _pick(_CURRENCY_POOL), []
    if re.search(r"\b(sen kimsan|kim sizsiz|sen kim|siz kimsiz)\b", text):
        return _pick(_IDENTITY_POOL), []
    if re.search(r"\b(nima qila olasan|qanday yordam|nimada yordam|yordam bera olasanmi)\b", text):
        return _pick(_CAPABILITIES_POOL), []

    if calc_intent and area is not None:
        rooms = int(rooms_m.group(1)) if rooms_m else 4
        cards.append(_materials_card(area, rooms))
        res = _calculate_materials(area, rooms)
        bricks_fmt = f"{res['bricks']:,}".replace(",", " ")
        reply = (
            f"{_pick(_CALC_INTRO_POOL)} {area:.0f} m² va {rooms} xonadan iborat uy "
            f"uchun taxminiy:\n"
            f"• G'isht — {bricks_fmt} dona\n"
            f"• Sement — {res['cement']} qop\n"
            f"• Qum — {res['sand']} m³\n"
            f"Taxminiy {res['storeys']} qavatli qurilish uchun mos. Kartadagi tugmani "
            "bosib to'liq kalkulyatorda aniqroq hisoblashingiz mumkin."
        )
        return reply, cards

    if project_intent and (rooms_m or (area is not None and area >= 50)):
        rooms = int(rooms_m.group(1)) if rooms_m else None
        filters = {}
        if rooms:
            filters["rooms"] = rooms
        if area and area >= 50:
            filters["area_max"] = area + 50
            filters["area_min"] = max(area - 50, 40)
        projects = _search_projects(filters)
        if projects:
            cards.append({"type": "projects", "projects": projects})
            return _pick(_PROJECT_FOUND_POOL), cards
        return _pick(_PROJECT_NONE_POOL), []

    if any(k in text for k in ["sement", "nisbat", "qorishma", "eritma"]):
        return _pick(_CEMENT_OPENERS) + _pick(_CEMENT_TIPS), []
    if "g'isht" in text and ("turi" in text or "turlari" in text or "qaysi" in text):
        return _pick(_BRICK_OPENERS) + _BRICK_TYPES + _pick(_BRICK_ENDINGS), []
    if any(k in text for k in ["vaqt", "muddat", "qancha davom", "tez", "kun"]):
        return _pick(_TIME_OPENERS) + _TIME_BODY + _pick(_TIME_ENDINGS), []
    if any(k in text for k in ["narx", "arzon", "qimmat", "hudud", "viloyat"]):
        return _pick(_PRICE_OPENERS) + _PRICE_BODY + _pick(_PRICE_ENDINGS), []

    if calc_intent:
        return _pick(_CALC_NEED_POOL), []
    if project_intent:
        projects = _search_projects({"limit": 3})
        if projects:
            cards.append({"type": "projects", "projects": projects})
            return (
                f"Katalogdagi eng so'nggi {len(projects)} ta loyihani ko'rsatdim. "
                "Qaysi biri sizga yoqdi? Xonalar yoki maydon bo'yicha ham aytib "
                "bersangiz, yaxshiroq tanlashim mumkin.", cards
            )
        return (
            "Katalogda hozircha loyihalar yo'q, lekin o'zingiz yangi loyiha "
            "yaratishingiz mumkin — 'Yangi loyiha' bo'limini oching.", []
        )

    if len(text) < 4:
        return _pick(_HOWAREYOU_POOL), []
    return _pick(_OFFTOPIC_POOL if not any(k in text for k in
                                           ["uy", "qurilish", "qurish", "material", "hisob"]) else _GENERIC_OPENERS), []


# --------------------------------------------------------------------------
# Groq (OpenAI-compatible) streaming
# --------------------------------------------------------------------------

def _api_key():
    return groq_api_key()


def _groq_call(payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        groq_api_base() + "/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_api_key()}",
        },
    )
    return urllib.request.urlopen(req, timeout=60)


def _groq_stream(messages):
    """Yield ('text', str) and ('tool_use', {name, input}) and ('stop', None)."""
    payload = {
        "model": groq_model(),
        "max_tokens": MAX_TOKENS,
        "temperature": 0.7,
        "messages": messages,
        "tools": TOOLS,
        "stream": True,
    }
    tool_uses = {}
    text_acc = []
    with _groq_call(payload) as response:
        buffer = ""
        for raw in response:
            buffer += raw.decode("utf-8", "ignore")
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                payload_line = line[5:].strip()
                if payload_line == "[DONE]":
                    continue
                try:
                    chunk = json.loads(payload_line)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    text_acc.append(content)
                    yield ("text", content)
                for tc in delta.get("tool_calls") or []:
                    idx = tc["index"]
                    entry = tool_uses.setdefault(idx, {"name": "", "input": {}, "_json": ""})
                    fn = tc.get("function") or {}
                    if fn.get("name"):
                        entry["name"] = fn["name"]
                    if fn.get("arguments"):
                        entry["_json"] += fn["arguments"]
                finish = choices[0].get("finish_reason")
                if finish in ("tool_calls", "stop"):
                    for entry in tool_uses.values():
                        if entry["name"]:
                            try:
                                entry["input"] = json.loads(entry["_json"]) if entry["_json"] else {}
                            except json.JSONDecodeError:
                                entry["input"] = {}
    finished = [{"name": v["name"], "input": v["input"]} for v in tool_uses.values() if v["name"]]
    if finished:
        for tu in finished:
            yield ("tool_use", tu)
    else:
        if text_acc:
            yield ("stop", None)


def _groq_reply(message, history, context):
    """Generator. Yields ('text', str) chunks and ('tool', card) events."""
    messages = []
    for h in history[-HISTORY_LIMIT:]:
        role = "assistant" if h.get("role") == "assistant" else "user"
        content = str(h.get("content", ""))[:4000]
        if content.strip():
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    if context.get("project"):
        pr = context["project"]
        messages.append({
            "role": "user",
            "content": (
                f"[Kontekst: foydalanuvchi hozir {context.get('path') or '/'} sahifasida. "
                f"Tanlangan loyiha: #{pr.get('id')}, {pr.get('area')} m², {pr.get('rooms')} xona.]"
            ),
        })

    # Phase 1: stream; collect tool_use calls as they complete.
    tool_calls = []
    for kind, data in _groq_stream(messages):
        if kind == "text":
            yield ("text", data)
        elif kind == "tool_use":
            tool_calls.append(data)

    if not tool_calls:
        return

    # Execute tools against real app data and report cards.
    cards = []
    results = []
    assistant_tool_calls = []
    for i, c in enumerate(tool_calls):
        call_id = f"call_{i}"
        assistant_tool_calls.append({
            "id": call_id,
            "type": "function",
            "function": {
                "name": c["name"],
                "arguments": json.dumps(c["input"], ensure_ascii=False),
            },
        })
        result = _execute_tool(c["name"], c["input"])
        cards.append(result)
        results.append({
            "role": "tool",
            "tool_call_id": call_id,
            "content": json.dumps(result, ensure_ascii=False),
        })

    for c in cards:
        if c:
            yield ("tool", c)

    messages.append({"role": "assistant", "content": None, "tool_calls": assistant_tool_calls})
    messages.extend(results)

    # Phase 2: stream the final answer text.
    for kind, data in _groq_stream(messages):
        if kind == "text":
            yield ("text", data)


# --------------------------------------------------------------------------
# View
# --------------------------------------------------------------------------

def _client_ip(request):
    fwd = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _chat_rate_limited(request) -> bool:
    key = f'chat_rate:{_client_ip(request)}'
    count = int(cache.get(key) or 0)
    if count >= CHAT_RATE_LIMIT:
        return True
    cache.set(key, count + 1, CHAT_RATE_WINDOW)
    return False


def _sanitize_message(text: str) -> str:
    """Strip control characters and cap length. User input is untrusted."""
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text or '')
    return cleaned.strip()[:MAX_MESSAGE_LEN]


def _sanitize_context(context) -> dict:
    """Allow only a small, typed slice of the client-supplied context."""
    if not isinstance(context, dict):
        return {}
    result = {}
    path = str(context.get('path') or '')[:200]
    if path:
        result['path'] = path
    project = context.get('project')
    if isinstance(project, dict):
        safe = {}
        for key, maxlen in (('id', 12), ('area', 8), ('rooms', 4)):
            if key in project:
                safe[key] = str(project[key])[:maxlen]
        if safe:
            result['project'] = safe
    return result


@csrf_exempt
def chat(request):
    if request.method != "POST":
        return StreamingHttpResponse(
            [_sse("error", {"message": "POST so'rovi kerak"})],
            content_type="text/event-stream",
        )
    if _chat_rate_limited(request):
        return StreamingHttpResponse(
            [_sse("error", {"message": "Juda ko'p so'rov yuborildi. Bir ozdan keyin urinib ko'ring"})],
            content_type="text/event-stream",
            status=429,
        )
    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        body = {}
    message = _sanitize_message(str(body.get("message", "")))
    history = body.get("history") or []
    if not isinstance(history, list):
        history = []
    history = history[-HISTORY_LIMIT:]
    context = _sanitize_context(body.get("context"))

    def stream():
        yield _sse("start", {})
        if not message:
            yield _sse("error", {"message": "Xabar bo'sh bo'lmasin"})
            return
        cards = []
        try:
            if _api_key():
                try:
                    for kind, data in _groq_reply(message, history, context):
                        if kind == "text":
                            yield _sse("delta", {"text": data})
                        elif kind == "tool":
                            cards.append(data)
                            yield _sse("tool", data)
                            time.sleep(0.05)
                except urllib.error.HTTPError as e:
                    if e.code not in (401, 403, 429):
                        raise
                    reply_text, cards = _offline_reply(message, context)
                    for c in cards:
                        if c:
                            yield _sse("tool", c)
                            time.sleep(0.05)
                    for i in range(0, len(reply_text), 5):
                        yield _sse("delta", {"text": reply_text[i:i + 5]})
                        time.sleep(STREAM_DELAY)
            else:
                reply_text, cards = _offline_reply(message, context)
                for c in cards:
                    if c:
                        yield _sse("tool", c)
                        time.sleep(0.05)
                for i in range(0, len(reply_text), 5):
                    yield _sse("delta", {"text": reply_text[i:i + 5]})
                    time.sleep(STREAM_DELAY)
            yield _sse("done", {"cards": cards, "model": "groq" if _api_key() else "offline"})
        except urllib.error.HTTPError as e:
            # Log the details server-side; never expose them to the client.
            logger.warning('chat upstream HTTP error: %s', e.code)
            yield _sse("error", {"message": "AI xizmati vaqtincha mavjud emas. Iltimos keyinroq urinib ko'ring"})
        except Exception:
            logger.exception('chat error')
            yield _sse("error", {"message": "Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring"})

    return StreamingHttpResponse(
        stream(),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
