import asyncio
import logging
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import BufferedInputFile, InlineKeyboardButton, InlineKeyboardMarkup

from house_calc.ai_advisor import generate_house_advice
from house_calc.image_renderer import ensure_project_preview
from house_calc.layout_utils import estimate_storeys, planning_note, summarize_room_program
from house_calc.pdf import build_project_pdf_bytes
from house_calc.utils import calculate_materials

# API Tokenni o'zgartirishni unutmang
API_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8645210389:AAHpwBLd6soVAwuo8-fpld2SCXylnk1dFD0')
DB_PATH = Path(__file__).resolve().parent / 'db.sqlite3'

# Loglarni sozlash
logging.basicConfig(level=logging.INFO)

# Bot va Dispatcher obyektlari
bot = Bot(token=API_TOKEN)
dp = Dispatcher()


@dataclass
class BotProject:
    pk: int
    area: int
    bricks: int
    cement: float
    sand: float
    rooms: int
    bathrooms: int
    has_pool: bool
    has_garage: bool
    has_terrace: bool
    ai_summary: str
    render_source: str
    source: str
    user_name: str
    telegram_id: int | None
    created_at: str

    def get_source_display(self):
        return 'Bot' if self.source == 'bot' else 'Web'


class CalcState(StatesGroup):
    waiting_for_area = State()
    waiting_for_rooms = State()
    waiting_for_bathrooms = State()
    waiting_for_garage = State()
    waiting_for_terrace = State()
    waiting_for_pool = State()


def main_menu():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Hisoblashni boshlash", callback_data="calc:start")],
            [InlineKeyboardButton(text="So'nggi natija", callback_data="calc:latest")],
            [InlineKeyboardButton(text="PDF olish", callback_data="calc:pdf")],
            [InlineKeyboardButton(text="Yordam", callback_data="calc:help")],
        ]
    )


def yes_no_menu(prefix: str):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Ha", callback_data=f"{prefix}:yes"),
                InlineKeyboardButton(text="Yo'q", callback_data=f"{prefix}:no"),
            ]
        ]
    )


def result_text(project):
    room_note = summarize_room_program(project.rooms, project.bathrooms, project.has_garage, project.has_terrace)
    pool_note = "Basseyn uchun alohida hovli zonasi tavsiya qilinadi." if project.has_pool else "Hovli standart ko'rinishda rejalashtiriladi."
    storeys = estimate_storeys(project.area, project.rooms)
    render_note = "rangli AI render" if project.render_source == "ai" else "rangli loyiha previewi"
    return (
        f"📊 {project.area} m² uchun hisob-kitob:\n\n"
        f"🛏 Xonalar soni: {project.rooms}\n"
        f"🚿 Vanna xonasi soni: {project.bathrooms}\n"
        f"🏢 Tavsiya qavat: {storeys} qavatli uy\n"
        f"🚗 Garaj: {'Ha' if project.has_garage else 'Yo`q'}\n"
        f"🪟 Terrasa: {'Ha' if project.has_terrace else 'Yo`q'}\n"
        f"🏊 Basseyn: {'Ha' if project.has_pool else 'Yo`q'}\n"
        f"🏠 Tavsiya etilgan reja: {room_note}\n"
        f"🧱 G'isht: {project.bricks} dona\n"
        f"⚪️ Sement: {project.cement} tonna\n"
        f"⏳ Qum: {project.sand} m³\n"
        f"📐 Izoh: {planning_note(project.area, project.rooms, project.bathrooms)}\n"
        f"🌿 Hovli: {pool_note}\n"
        f"🤖 AI tavsiya: {project.ai_summary}\n"
        f"🖼 Preview turi: {render_note}\n"
        f"🗂 Manba: {project.get_source_display()}\n\n"
        f"⚠️ Bu hisob-kitob taxminiydir."
    )


async def _save_bot_project(
    message: types.Message,
    area: int,
    rooms: int,
    bathrooms: int,
    has_pool: bool,
    has_garage: bool,
    has_terrace: bool,
    ai_summary: str,
):
    
    return await asyncio.to_thread(
        save_project_to_sqlite,
        area,
        message.from_user.full_name if message.from_user else '',
        message.from_user.id if message.from_user else None,
        rooms,
        bathrooms,
        has_pool,
        has_garage,
        has_terrace,
        ai_summary,
    )


async def _get_latest_bot_project(message: types.Message):
    telegram_id = message.from_user.id if message.from_user else None
    return await asyncio.to_thread(get_latest_project_from_sqlite, telegram_id)


async def send_project_preview(message: types.Message, project: BotProject):
    preview_path, render_source = await asyncio.to_thread(ensure_project_preview, project)
    photo = BufferedInputFile(preview_path.read_bytes(), filename=preview_path.name)
    project.render_source = render_source
    render_label = "Rangli AI render" if render_source == "ai" else "Rangli loyiha previewi"
    caption = (
        f"{project.area} m² rangli loyiha rasmi\n"
        f"Xonalar: {project.rooms}\n"
        f"Vanna xonasi: {project.bathrooms}\n"
        f"Qavat tavsiyasi: {estimate_storeys(project.area, project.rooms)} qavatli uy\n"
        f"Garaj: {'Ha' if project.has_garage else 'Yo`q'}\n"
        f"Terrasa: {'Ha' if project.has_terrace else 'Yo`q'}\n"
        f"Basseyn: {'Ha' if project.has_pool else 'Yo`q'}\n"
        f"Tur: {render_label}"
    )
    await message.answer_photo(photo, caption=caption)


async def send_menu(message: types.Message, text: str):
    await message.answer(text, reply_markup=main_menu())


@dp.message(Command("start"))
async def send_welcome(message: types.Message, state: FSMContext):
    await state.clear()
    await send_menu(
        message,
        "Assalomu alaykum! Men uy qurilish materiallarini hisoblayman. Kerakli bo'limni tugmalar orqali tanlang.",
    )


@dp.callback_query(F.data == "calc:start")
async def prompt_for_area(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(CalcState.waiting_for_area)
    await state.update_data(
        area=None,
        rooms=None,
        bathrooms=None,
        has_garage=None,
        has_terrace=None,
        has_pool=None,
    )
    await callback.message.answer("Uy maydonini m² da kiriting. Masalan: 120")
    await callback.answer()


@dp.callback_query(F.data == "calc:help")
async def show_help(callback: types.CallbackQuery):
    await callback.message.answer(
        "Bot endi ketma-ket savollar beradi va yakunda batafsil natija chiqaradi.\n"
        "1. 'Hisoblashni boshlash' ni bosing.\n"
        "2. Maydonni yuboring.\n"
        "3. Xonalar sonini kiriting.\n"
        "4. Vanna xonasi sonini kiriting.\n"
        "5. Garaj, terrasa va basseynni tanlang.\n"
        "6. Natijani rasm, matn va PDF ko'rinishida oling.",
        reply_markup=main_menu(),
    )
    await callback.answer()


@dp.callback_query(F.data == "calc:latest")
async def show_latest(callback: types.CallbackQuery):
    project = await _get_latest_bot_project(callback.message)
    if not project:
        await callback.message.answer("Sizda hali saqlangan bot natijasi yo'q.", reply_markup=main_menu())
    else:
        await send_project_preview(callback.message, project)
        await callback.message.answer(result_text(project), reply_markup=main_menu())
    await callback.answer()


@dp.callback_query(F.data == "calc:pdf")
async def send_latest_pdf(callback: types.CallbackQuery):
    project = await _get_latest_bot_project(callback.message)
    if not project:
        await callback.message. answer("Avval hisob-kitob qiling, keyin PDF olishingiz mumkin.", reply_markup=main_menu())
        await callback.answer()
        return

    pdf_bytes = await asyncio.to_thread(build_project_pdf, project)
    document = BufferedInputFile(pdf_bytes, filename=f"house-project-{project.pk}.pdf")
    await callback.message.answer_document(document, caption=f"{project.area} m² loyiha PDF fayli")
    await callback.message.answer("Asosiy menyu:", reply_markup=main_menu())
    await callback.answer()


@dp.message(CalcState.waiting_for_area)
async def capture_area(message: types.Message, state: FSMContext):
    if not message.text or not message.text.isdigit() or int(message.text) <= 0:
        await message.answer("Iltimos, 0 dan katta butun son kiriting. Masalan: 100")
        return

    await state.update_data(area=int(message.text))
    await state.set_state(CalcState.waiting_for_rooms)
    await message.answer("Nechta xona kerak? Masalan: 4")


@dp.message(CalcState.waiting_for_rooms)
async def capture_rooms(message: types.Message, state: FSMContext):
    if not message.text or not message.text.isdigit():
        await message.answer("Iltimos, xonalar sonini butun son ko'rinishida kiriting. Masalan: 4")
        return

    rooms = int(message.text)
    if rooms <= 0 or rooms > 20:
        await message.answer("Xonalar soni 1 dan 20 gacha bo'lishi kerak.")
        return

    await state.update_data(rooms=rooms)
    await state.set_state(CalcState.waiting_for_bathrooms)
    await message.answer("Nechta vanna xonasi kerak? Masalan: 2")


@dp.message(CalcState.waiting_for_bathrooms)
async def capture_bathrooms(message: types.Message, state: FSMContext):
    if not message.text or not message.text.isdigit():
        await message.answer("Iltimos, vanna xonasi sonini butun son ko'rinishida kiriting. Masalan: 2")
        return

    bathrooms = int(message.text)
    if bathrooms <= 0 or bathrooms > 10:
        await message.answer("Vanna xonasi soni 1 dan 10 gacha bo'lishi kerak.")
        return

    await state.update_data(bathrooms=bathrooms)
    await state.set_state(CalcState.waiting_for_garage)
    await message.answer("Garaj kerakmi?", reply_markup=yes_no_menu("garage"))


@dp.callback_query(CalcState.waiting_for_garage, F.data.in_({"garage:yes", "garage:no"}))
async def capture_garage(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(has_garage=callback.data == "garage:yes")
    await state.set_state(CalcState.waiting_for_terrace)
    await callback.message.answer("Terrasa kerakmi?", reply_markup=yes_no_menu("terrace"))
    await callback.answer()


@dp.callback_query(CalcState.waiting_for_terrace, F.data.in_({"terrace:yes", "terrace:no"}))
async def capture_terrace(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(has_terrace=callback.data == "terrace:yes")
    await state.set_state(CalcState.waiting_for_pool)
    await callback.message.answer("Hovlida basseyn bo'lishi kerakmi?", reply_markup=yes_no_menu("pool"))
    await callback.answer()


@dp.callback_query(CalcState.waiting_for_pool, F.data.in_({"pool:yes", "pool:no"}))
async def finalize_calculation(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    area = data.get("area")
    rooms = data.get("rooms")
    bathrooms = data.get("bathrooms")
    has_garage = data.get("has_garage")
    has_terrace = data.get("has_terrace")
    has_pool = callback.data == "pool:yes"

    if not area or not rooms or not bathrooms:
        await state.clear()
        await callback.message.answer("Jarayon uzildi. Qaytadan boshlash uchun 'Hisoblashni boshlash' ni bosing.", reply_markup=main_menu())
        await callback.answer()
        return

    await callback.message.answer("AI tavsiya tayyorlanmoqda...")
    ai_summary = await asyncio.to_thread(
        generate_house_advice,
        area,
        rooms,
        bathrooms,
        has_pool,
        bool(has_garage),
        bool(has_terrace),
    )
    project = await _save_bot_project(
        callback.message,
        area,
        rooms,
        bathrooms,
        has_pool,
        bool(has_garage),
        bool(has_terrace),
        ai_summary,
    )
    await state.clear()
    await send_project_preview(callback.message, project)
    await callback.message.answer(result_text(project), reply_markup=main_menu())
    await callback.answer()


@dp.message()
async def fallback(message: types.Message):
    await send_menu(message, "Buyruqni tugmalar orqali tanlang yoki /start ni yuboring.")


# Botni ishga tushirish funksiyasi
async def main():
    print("Bot ishga tushdi...")
    await dp.start_polling(bot)


def save_project_to_sqlite(
    area,
    user_name='',
    telegram_id=None,
    rooms=1,
    bathrooms=1,
    has_pool=False,
    has_garage=False,
    has_terrace=False,
    ai_summary='',
):
    result = calculate_materials(area)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO house_calc_calculationproject
            (area, bricks, cement, sand, rooms, bathrooms, has_pool, has_garage, has_terrace, ai_summary, source, user_name, telegram_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                result['area'],
                result['bricks'],
                result['cement'],
                result['sand'],
                rooms,
                bathrooms,
                1 if has_pool else 0,
                1 if has_garage else 0,
                1 if has_terrace else 0,
                ai_summary,
                'bot',
                user_name,
                telegram_id,
            ),
        )
        project_id = cursor.lastrowid
        conn.commit()

    return get_project_by_id(project_id)


def get_latest_project_from_sqlite(telegram_id=None):
    query = """
        SELECT id, area, bricks, cement, sand, rooms, bathrooms, has_pool, has_garage, has_terrace, ai_summary, source, user_name, telegram_id, created_at
        FROM house_calc_calculationproject
        WHERE source = 'bot'
    """
    params = []
    if telegram_id is not None:
        query += " AND telegram_id = ?"
        params.append(telegram_id)
    query += " ORDER BY created_at DESC, id DESC LIMIT 1"

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(query, params).fetchone()
    return row_to_project(row)


def get_project_by_id(project_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT id, area, bricks, cement, sand, rooms, bathrooms, has_pool, has_garage, has_terrace, ai_summary, source, user_name, telegram_id, created_at
            FROM house_calc_calculationproject
            WHERE id = ?
            """,
            (project_id,),
        ).fetchone()
    return row_to_project(row)


def row_to_project(row):
    if row is None:
        return None
    return BotProject(
        pk=row['id'],
        area=row['area'],
        bricks=row['bricks'],
        cement=row['cement'],
        sand=row['sand'],
        rooms=row['rooms'],
        bathrooms=row['bathrooms'],
        has_pool=bool(row['has_pool']),
        has_garage=bool(row['has_garage']),
        has_terrace=bool(row['has_terrace']),
        ai_summary=row['ai_summary'] or '',
        render_source='unknown',
        source=row['source'],
        user_name=row['user_name'],
        telegram_id=row['telegram_id'],
        created_at=row['created_at'],
    )


def build_project_pdf(project):
    return build_project_pdf_bytes(
        project_id=project.pk,
        area=project.area,
        bricks=project.bricks,
        cement=project.cement,
        sand=project.sand,
        rooms=project.rooms,
        bathrooms=project.bathrooms,
        has_pool=project.has_pool,
        has_garage=project.has_garage,
        has_terrace=project.has_terrace,
        ai_summary=project.ai_summary,
        source_label=project.get_source_display(),
        user_name=project.user_name,
        created_at_text=project.created_at,
    )


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot to'xtatildi")

