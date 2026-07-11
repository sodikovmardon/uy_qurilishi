import struct
import zlib

from house_calc.layout_utils import estimate_storeys


FONT = {
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "10000", "10000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
}

PALETTES = (
    {
        "sky_top": (135, 206, 250),
        "sky_bottom": (255, 255, 255),
        "lawn": (50, 205, 50),
        "panel": (255, 255, 255),
        "line": (0, 0, 0),
        "wall": (255, 255, 255),
        "roof": (105, 105, 105),
        "window": (176, 224, 230),
        "accent": (255, 140, 0),
        "room_fill": (240, 248, 255),
        "stripe": (255, 250, 205),
        "pool": (0, 191, 255),
        "ok_bg": (144, 238, 144),
        "no_bg": (255, 160, 122),
        "tree_leaf": (34, 139, 34),
        "tree_trunk": (139, 69, 19),
        "path": (245, 245, 220),
    },
    {
        "sky_top": (173, 216, 230),
        "sky_bottom": (255, 250, 250),
        "lawn": (60, 179, 113),
        "panel": (255, 255, 255),
        "line": (25, 25, 112),
        "wall": (255, 228, 196),
        "roof": (70, 130, 180),
        "window": (135, 206, 235),
        "accent": (255, 69, 0),
        "room_fill": (255, 240, 245),
        "stripe": (255, 218, 185),
        "pool": (30, 144, 255),
        "ok_bg": (152, 251, 152),
        "no_bg": (255, 99, 71),
        "tree_leaf": (0, 128, 0),
        "tree_trunk": (101, 67, 33),
        "path": (222, 184, 135),
    },
    {
        "sky_top": (176, 196, 222),
        "sky_bottom": (255, 255, 255),
        "lawn": (107, 142, 35),
        "panel": (255, 255, 255),
        "line": (47, 79, 79),
        "wall": (245, 245, 245),
        "roof": (112, 128, 144),
        "window": (173, 216, 230),
        "accent": (255, 165, 0),
        "room_fill": (248, 248, 255),
        "stripe": (255, 239, 213),
        "pool": (65, 105, 225),
        "ok_bg": (144, 238, 144),
        "no_bg": (255, 182, 193),
        "tree_leaf": (46, 139, 87),
        "tree_trunk": (92, 64, 51),
        "path": (210, 180, 140),
    },
    {
        "sky_top": (255, 228, 181),
        "sky_bottom": (255, 255, 255),
        "lawn": (154, 205, 50),
        "panel": (255, 255, 255),
        "line": (85, 107, 47),
        "wall": (255, 250, 240),
        "roof": (169, 169, 169),
        "window": (135, 206, 250),
        "accent": (255, 140, 0),
        "room_fill": (255, 245, 238),
        "stripe": (255, 228, 196),
        "pool": (0, 206, 209),
        "ok_bg": (152, 251, 152),
        "no_bg": (255, 160, 122),
        "tree_leaf": (34, 139, 34),
        "tree_trunk": (139, 90, 43),
        "path": (238, 232, 170),
    },
)


def _chunk(tag, data):
    return (
        struct.pack("!I", len(data))
        + tag
        + data
        + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def _clamp_channel(value):
    return max(0, min(255, int(value)))


def _shift(color, red=0, green=0, blue=0):
    return (
        _clamp_channel(color[0] + red),
        _clamp_channel(color[1] + green),
        _clamp_channel(color[2] + blue),
    )


def _mix(color_a, color_b, numerator, denominator):
    if denominator <= 0:
        return color_b
    return tuple(
        _clamp_channel(color_a[index] + (color_b[index] - color_a[index]) * numerator / denominator)
        for index in range(3)
    )


def build_preview_spec(area, rooms, bathrooms, has_pool, has_garage, has_terrace):
    storeys = estimate_storeys(area, rooms)
    variant_key = area * 3 + rooms * 29 + bathrooms * 17
    if has_pool:
        variant_key += 5
    if has_garage:
        variant_key += 7
    if has_terrace:
        variant_key += 11

    palette = dict(PALETTES[variant_key % len(PALETTES)])
    if has_pool:
        palette["pool"] = _shift(palette["pool"], 6, 8, 4)
    if has_terrace:
        palette["accent"] = _shift(palette["accent"], 10, 6, 0)
    if bathrooms >= 3:
        palette["stripe"] = _shift(palette["stripe"], -10, -6, -4)
    if storeys >= 2:
        palette["wall"] = _shift(palette["wall"], -4, -3, -2)

    return {
        "storeys": storeys,
        "roof_style": "pitched" if variant_key % 2 else "flat",
        "garage_side": "left" if variant_key % 3 == 0 else "right",
        "window_columns": max(2, min(5, rooms // max(storeys, 1) + 1)),
        "setback": 14 + (variant_key % 4) * 10,
        "tree_count": min(4, 1 + area // 700 + (1 if has_pool else 0)),
        "pool_shape": "wide" if has_pool and (area >= 260 or variant_key % 2) else "compact",
        "terrace_style": "pergola" if has_terrace and variant_key % 2 else "deck",
        "plan_variant": variant_key % 3,
        "badge_style": variant_key % 3,
        "path_width": 36 + min(22, bathrooms * 6),
        "palette": palette,
    }


def _draw_rect(pixels, width, x1, y1, x2, y2, color):
    for y in range(max(0, y1), min(len(pixels), y2)):
        row = pixels[y]
        for x in range(max(0, x1), min(width, x2)):
            row[x] = color


def _draw_border(pixels, width, x1, y1, x2, y2, color, thickness=3):
    _draw_rect(pixels, width, x1, y1, x2, y1 + thickness, color)
    _draw_rect(pixels, width, x1, y2 - thickness, x2, y2, color)
    _draw_rect(pixels, width, x1, y1, x1 + thickness, y2, color)
    _draw_rect(pixels, width, x2 - thickness, y1, x2, y2, color)


def _draw_circle(pixels, width, center_x, center_y, radius, color):
    for y in range(max(0, center_y - radius), min(len(pixels), center_y + radius + 1)):
        delta_y = y - center_y
        delta_x = int((radius * radius - delta_y * delta_y) ** 0.5)
        row = pixels[y]
        for x in range(max(0, center_x - delta_x), min(width, center_x + delta_x + 1)):
            row[x] = color


def _draw_text(pixels, width, x, y, text, color, scale=3):
    cursor = x
    for char in text.upper():
        glyph = FONT.get(char, FONT[" "])
        for row_index, row in enumerate(glyph):
            for col_index, bit in enumerate(row):
                if bit == "1":
                    _draw_rect(
                        pixels,
                        width,
                        cursor + col_index * scale,
                        y + row_index * scale,
                        cursor + (col_index + 1) * scale,
                        y + (row_index + 1) * scale,
                        color,
                    )
        cursor += (len(glyph[0]) + 1) * scale


def _draw_tree(pixels, width, center_x, ground_y, trunk_color, leaf_color):
    _draw_rect(pixels, width, center_x - 5, ground_y - 30, center_x + 5, ground_y, trunk_color)
    _draw_circle(pixels, width, center_x, ground_y - 42, 18, leaf_color)
    _draw_circle(pixels, width, center_x - 14, ground_y - 34, 14, _shift(leaf_color, -8, 10, -6))
    _draw_circle(pixels, width, center_x + 14, ground_y - 34, 14, _shift(leaf_color, 6, 8, -4))


def _draw_windows_row(pixels, width, x1, y1, x2, y2, columns, window_color, line_color):
    usable_width = max(40, x2 - x1 - 28)
    columns = max(1, min(columns, max(1, usable_width // 48)))
    gap = usable_width // columns
    for index in range(columns):
        window_x1 = x1 + 14 + gap * index
        window_x2 = min(x2 - 12, window_x1 + max(24, gap - 14))
        _draw_rect(pixels, width, window_x1, y1, window_x2, y2, window_color)
        _draw_border(pixels, width, window_x1, y1, window_x2, y2, line_color, thickness=2)
        mullion_x = window_x1 + (window_x2 - window_x1) // 2
        _draw_rect(pixels, width, mullion_x - 1, y1 + 2, mullion_x + 1, y2 - 2, line_color)
        highlight = _shift(window_color, 40, 40, 60)
        _draw_rect(pixels, width, window_x1 + 6, y1 + 4, min(window_x2 - 6, window_x1 + 14), y1 + 18, highlight)
        # Add horizontal mullion for panes
        mullion_y = y1 + (y2 - y1) // 2
        _draw_rect(pixels, width, window_x1 + 2, mullion_y - 1, window_x2 - 2, mullion_y + 1, line_color)


def _draw_roof(pixels, width, x1, y1, x2, color, roof_style):
    if roof_style == "flat":
        _draw_rect(pixels, width, x1 - 8, y1 - 16, x2 + 8, y1 - 4, color)
        return

    for step in range(8):
        left = x1 - 12 + step * 6
        right = x2 + 12 - step * 6
        top = y1 - 30 + step * 3
        _draw_rect(pixels, width, left, top, right, top + 3, color)


def _draw_house_panel(
    pixels,
    width,
    x1,
    y1,
    x2,
    y2,
    area,
    rooms,
    bathrooms,
    has_pool,
    has_garage,
    has_terrace,
    spec,
):
    palette = spec["palette"]
    line = palette["line"]
    wall = palette["wall"]
    roof = palette["roof"]
    window = palette["window"]
    accent = palette["accent"]
    lawn = palette["lawn"]
    pool = palette["pool"]
    tree_leaf = palette["tree_leaf"]
    tree_trunk = palette["tree_trunk"]
    path = palette["path"]

    _draw_rect(pixels, width, x1, y1, x2, y2, _shift(palette["panel"], -4, -2, -2))
    _draw_border(pixels, width, x1, y1, x2, y2, line, thickness=4)
    _draw_text(pixels, width, x1 + 18, y1 + 16, "UY KO'RINISHI", line, scale=3)

    sun_x = x1 + 86 + spec["badge_style"] * 60
    sun_y = y1 + 74 + spec["badge_style"] * 6
    _draw_circle(pixels, width, sun_x, sun_y, 18 + spec["badge_style"] * 4, _shift(palette["sky_bottom"], 8, 4, -10))

    _draw_rect(pixels, width, x1 + 24, y2 - 88, x2 - 24, y2 - 24, lawn)

    tree_positions = [x1 + 56, x1 + 96, x2 - 116, x2 - 72]
    if spec["garage_side"] == "left":
        tree_positions = [x2 - 72, x2 - 116, x1 + 56, x1 + 96]
    for index in range(spec["tree_count"]):
        _draw_tree(pixels, width, tree_positions[index], y2 - 88, tree_trunk, tree_leaf)

    storeys = spec["storeys"]
    floor_height = 88 if storeys == 1 else 76 if storeys == 2 else 64
    body_bottom = y2 - 88
    main_width = min(x2 - x1 - 196, 252 + rooms * 26 + storeys * 20)
    house_left = x1 + 108
    house_right = min(x2 - 92, house_left + main_width)
    house_left = house_right - main_width

    floors = []
    for floor_index in range(storeys):
        floor_y2 = body_bottom - floor_index * (floor_height + 8)
        floor_y1 = floor_y2 - floor_height
        inset = max(0, (storeys - floor_index - 1) * (spec["setback"] // 2))
        floor_left = house_left + inset
        floor_right = house_right - inset
        _draw_rect(pixels, width, floor_left, floor_y1, floor_right, floor_y2, wall)
        _draw_border(pixels, width, floor_left, floor_y1, floor_right, floor_y2, line, thickness=3)
        _draw_windows_row(
            pixels,
            width,
            floor_left,
            floor_y1 + 18,
            floor_right,
            floor_y1 + 52,
            spec["window_columns"] + (1 if floor_index == 0 and rooms >= 7 else 0),
            window,
            line,
        )
        _draw_rect(pixels, width, floor_left + 8, floor_y2 - 12, floor_right - 8, floor_y2, _shift(wall, -28, -28, -28))
        if floor_index == 0 and rooms >= 6:
            if spec["badge_style"] == 2:
                band_x1 = floor_right - 44
            else:
                band_x1 = floor_left + 10
            _draw_rect(pixels, width, band_x1, floor_y1, band_x1 + 24, floor_y2, accent)
        floors.append((floor_left, floor_y1, floor_right, floor_y2))

    ground_left, ground_top, ground_right, ground_bottom = floors[0]
    top_left, top_y1, top_right, _ = floors[-1]
    _draw_roof(pixels, width, top_left, top_y1, top_right, roof, spec["roof_style"])

    # Add chimney for pitched roofs
    if spec["roof_style"] == "pitched":
        chimney_x = top_left + (top_right - top_left) // 2 + 20
        chimney_y = top_y1 - 40
        _draw_rect(pixels, width, chimney_x, chimney_y, chimney_x + 8, chimney_y + 20, roof)
        _draw_rect(pixels, width, chimney_x - 2, chimney_y - 4, chimney_x + 10, chimney_y, roof)

    if rooms >= 5:
        wing_width = min(156, 104 + max(0, rooms - 5) * 10)
        wing_height = floor_height + (16 if storeys >= 2 else 0)
        if spec["garage_side"] == "left":
            wing_x2 = ground_left + 28
            wing_x1 = max(x1 + 30, wing_x2 - wing_width)
        else:
            wing_x1 = ground_right - 28
            wing_x2 = min(x2 - 30, wing_x1 + wing_width)
        wing_y1 = ground_bottom - wing_height
        _draw_rect(pixels, width, wing_x1, wing_y1, wing_x2, ground_bottom, _shift(wall, -8, -8, -6))
        _draw_border(pixels, width, wing_x1, wing_y1, wing_x2, ground_bottom, line, thickness=3)
        _draw_windows_row(pixels, width, wing_x1, wing_y1 + 18, wing_x2, wing_y1 + 50, 2, window, line)

    if has_garage:
        garage_width = 124 + spec["badge_style"] * 12
        garage_height = floor_height + 6
        if spec["garage_side"] == "left":
            garage_x1 = max(x1 + 26, ground_left - garage_width + 36)
        else:
            garage_x1 = min(x2 - garage_width - 26, ground_right - 36)
        garage_x2 = garage_x1 + garage_width
        garage_y1 = ground_bottom - garage_height
        _draw_rect(pixels, width, garage_x1, garage_y1, garage_x2, ground_bottom, _shift(wall, -16, -14, -12))
        _draw_border(pixels, width, garage_x1, garage_y1, garage_x2, ground_bottom, line, thickness=3)
        for offset in range(garage_x1 + 10, garage_x2 - 8, 20):
            _draw_rect(pixels, width, offset, garage_y1 + 18, offset + 6, ground_bottom - 10, _shift(line, 70, 70, 70))

    door_width = 42
    door_x1 = ground_left + (ground_right - ground_left) // 2 - door_width // 2
    if has_garage and spec["garage_side"] == "left":
        door_x1 += 24
    elif has_garage:
        door_x1 -= 24
    door_y1 = ground_bottom - 56
    _draw_rect(pixels, width, door_x1, door_y1, door_x1 + door_width, ground_bottom, accent)
    _draw_border(pixels, width, door_x1, door_y1, door_x1 + door_width, ground_bottom, line, thickness=2)
    # Add door handle
    door_handle_x = door_x1 + door_width - 8
    door_handle_y = ground_bottom - 48
    _draw_rect(pixels, width, door_handle_x, door_handle_y, door_handle_x + 4, door_handle_y + 4, line)

    path_x1 = door_x1 + door_width // 2 - spec["path_width"] // 2
    _draw_rect(pixels, width, path_x1, ground_bottom, path_x1 + spec["path_width"], y2 - 24, path)
    _draw_rect(pixels, width, path_x1 + spec["path_width"] // 4, ground_bottom + 8, path_x1 + spec["path_width"] * 3 // 4, y2 - 32, _shift(path, 18, 18, 18))

    if has_terrace:
        terrace_width = 152 + spec["badge_style"] * 12
        if spec["garage_side"] == "left":
            terrace_x1 = min(x2 - terrace_width - 28, ground_right - terrace_width // 2)
        else:
            terrace_x1 = max(x1 + 28, ground_left - 8)
        terrace_x2 = terrace_x1 + terrace_width
        terrace_y1 = ground_bottom + 8
        terrace_y2 = y2 - 24
        _draw_rect(pixels, width, terrace_x1, terrace_y1, terrace_x2, terrace_y2, _shift(path, 10, 6, 0))
        _draw_border(pixels, width, terrace_x1, terrace_y1, terrace_x2, terrace_y2, line, thickness=2)
        if spec["terrace_style"] == "pergola":
            for offset in range(terrace_x1 + 12, terrace_x2 - 12, 26):
                _draw_rect(pixels, width, offset, terrace_y1, offset + 4, terrace_y1 + 30, roof)

    if has_pool:
        if spec["pool_shape"] == "wide":
            pool_width = 148
            pool_height = 62
        else:
            pool_width = 100
            pool_height = 82
        if spec["garage_side"] == "right":
            pool_x1 = x1 + 38
        else:
            pool_x1 = x2 - pool_width - 44
        pool_x2 = pool_x1 + pool_width
        pool_y2 = y2 - 34
        pool_y1 = pool_y2 - pool_height
        _draw_rect(pixels, width, pool_x1, pool_y1, pool_x2, pool_y2, pool)
        _draw_border(pixels, width, pool_x1, pool_y1, pool_x2, pool_y2, line, thickness=3)
        _draw_rect(pixels, width, pool_x1 + 8, pool_y1 + 8, pool_x2 - 8, pool_y1 + 14, _shift(pool, 26, 24, 18))
        _draw_rect(pixels, width, pool_x1 + 12, pool_y1 + 22, pool_x2 - 12, pool_y1 + 28, _shift(pool, 50, 50, 80))


def _draw_plan_panel(pixels, width, x1, y1, x2, y2, rooms, bathrooms, has_pool, has_garage, has_terrace, spec):
    palette = spec["palette"]
    line = palette["line"]
    room_fill = palette["room_fill"]
    accent = palette["stripe"]
    pool = palette["pool"]

    _draw_rect(pixels, width, x1, y1, x2, y2, palette["panel"])
    _draw_border(pixels, width, x1, y1, x2, y2, line, thickness=4)
    _draw_text(pixels, width, x1 + 18, y1 + 16, "REJA", line, scale=3)
    _draw_rect(pixels, width, x2 - 114, y1 + 16, x2 - 20, y1 + 46, accent)
    _draw_text(pixels, width, x2 - 102, y1 + 24, f"QVT {spec['storeys']}", line, scale=2)

    px1 = x1 + 32
    py1 = y1 + 70
    px2 = x2 - 32
    py2 = y2 - 32
    _draw_border(pixels, width, px1, py1, px2, py2, line, thickness=4)

    plan_variant = spec["plan_variant"]
    if plan_variant == 0:
        top_height = 88
        _draw_rect(pixels, width, px1 + 4, py1 + 4, px1 + 124, py1 + top_height, room_fill)
        _draw_rect(pixels, width, px1 + 128, py1 + 4, px2 - 4, py1 + top_height, accent)
        _draw_border(pixels, width, px1 + 4, py1 + 4, px1 + 124, py1 + top_height, line, thickness=3)
        _draw_border(pixels, width, px1 + 128, py1 + 4, px2 - 4, py1 + top_height, line, thickness=3)
        _draw_text(pixels, width, px1 + 20, py1 + 34, "ZAL", line, scale=2)
        _draw_text(pixels, width, px1 + 180, py1 + 34, "YASHASH", line, scale=2)
        service_y1 = py1 + top_height + 8
        service_y2 = service_y1 + 62
        kitchen_x2 = px1 + 164
        _draw_rect(pixels, width, px1 + 4, service_y1, kitchen_x2, service_y2, room_fill)
        _draw_border(pixels, width, px1 + 4, service_y1, kitchen_x2, service_y2, line, thickness=3)
        _draw_text(pixels, width, px1 + 18, service_y1 + 20, "OSHXONA", line, scale=2)
        room_area_y1 = service_y2 + 10
        room_area_y2 = py2 - 64
        bath_area_x1 = kitchen_x2 + 6
        bath_area_x2 = px2 - 4
        bath_y1 = service_y1
        bath_y2 = service_y2
    elif plan_variant == 1:
        left_width = 142
        _draw_rect(pixels, width, px1 + 4, py1 + 4, px1 + left_width, py2 - 120, accent)
        _draw_rect(pixels, width, px1 + left_width + 8, py1 + 4, px2 - 4, py1 + 96, room_fill)
        _draw_rect(pixels, width, px1 + left_width + 8, py1 + 104, px2 - 4, py1 + 180, accent)
        _draw_border(pixels, width, px1 + 4, py1 + 4, px1 + left_width, py2 - 120, line, thickness=3)
        _draw_border(pixels, width, px1 + left_width + 8, py1 + 4, px2 - 4, py1 + 96, line, thickness=3)
        _draw_border(pixels, width, px1 + left_width + 8, py1 + 104, px2 - 4, py1 + 180, line, thickness=3)
        _draw_text(pixels, width, px1 + 20, py1 + 44, "ZAL", line, scale=2)
        _draw_text(pixels, width, px1 + left_width + 34, py1 + 36, "YASHASH", line, scale=2)
        if spec["storeys"] >= 2:
            _draw_text(pixels, width, px1 + 20, py1 + 82, "ZINALI", line, scale=2)
        _draw_text(pixels, width, px1 + left_width + 24, py1 + 132, "OSHXONA", line, scale=2)
        room_area_y1 = py1 + 192
        room_area_y2 = py2 - 64
        bath_area_x1 = px1 + 4
        bath_area_x2 = px1 + left_width
        bath_y1 = py2 - 112
        bath_y2 = py2 - 8
    else:
        top_height = 74
        _draw_rect(pixels, width, px1 + 4, py1 + 4, px2 - 4, py1 + top_height, accent)
        _draw_border(pixels, width, px1 + 4, py1 + 4, px2 - 4, py1 + top_height, line, thickness=3)
        _draw_text(pixels, width, px1 + 110, py1 + 28, "YASHASH", line, scale=2)
        _draw_rect(pixels, width, px1 + 4, py1 + top_height + 8, px1 + 140, py1 + top_height + 90, room_fill)
        _draw_rect(pixels, width, px1 + 148, py1 + top_height + 8, px2 - 4, py1 + top_height + 90, accent)
        _draw_border(pixels, width, px1 + 4, py1 + top_height + 8, px1 + 140, py1 + top_height + 90, line, thickness=3)
        _draw_border(pixels, width, px1 + 148, py1 + top_height + 8, px2 - 4, py1 + top_height + 90, line, thickness=3)
        _draw_text(pixels, width, px1 + 26, py1 + top_height + 38, "ZAL", line, scale=2)
        _draw_text(pixels, width, px1 + 186, py1 + top_height + 38, "OSHXONA", line, scale=2)
        room_area_y1 = py1 + top_height + 106
        room_area_y2 = py2 - 64
        bath_area_x1 = px2 - 118
        bath_area_x2 = px2 - 4
        bath_y1 = py1 + top_height + 98
        bath_y2 = py2 - 8

    bath_slots = max(1, min(4, bathrooms))
    bath_total_width = bath_area_x2 - bath_area_x1
    bath_width = max(52, bath_total_width // bath_slots)
    for index in range(bath_slots):
        bath_x1 = bath_area_x1 + bath_width * index
        bath_x2 = min(bath_area_x2, bath_x1 + bath_width - 4)
        _draw_rect(pixels, width, bath_x1, bath_y1, bath_x2, bath_y2, room_fill)
        _draw_border(pixels, width, bath_x1, bath_y1, bath_x2, bath_y2, line, thickness=2)
        _draw_text(pixels, width, bath_x1 + 8, bath_y1 + 18, f"HM{index + 1}", line, scale=2)

    visible_rooms = max(1, min(12, rooms))
    columns = 3 if visible_rooms <= 9 else 4
    if spec["storeys"] >= 2 and columns > 2:
        columns -= 1
    rows = (visible_rooms + columns - 1) // columns
    gap = 6
    cell_width = (px2 - px1 - gap * (columns + 1)) // columns
    cell_height = (room_area_y2 - room_area_y1 - gap * (rows + 1)) // max(rows, 1)

    room_names = ["YASHASH", "OSHXONA", "YOTOQ 1", "YOTOQ 2", "YOTOQ 3", "VANNA XONASI", "VANNA XONASI2", "GARAJ", "TERRASA", "BASSEYN", "ZAL", "OFIS"]

    for index in range(visible_rooms):
        column = index % columns
        row = index // columns
        room_x1 = px1 + gap + column * (cell_width + gap)
        room_y1 = room_area_y1 + gap + row * (cell_height + gap)
        room_x2 = room_x1 + cell_width
        room_y2 = room_y1 + cell_height
        fill = room_fill if (index + plan_variant) % 2 == 0 else accent
        _draw_rect(pixels, width, room_x1, room_y1, room_x2, room_y2, fill)
        _draw_border(pixels, width, room_x1, room_y1, room_x2, room_y2, line, thickness=2)
        label = room_names[index] if index < len(room_names) else f"XONA {index + 1}"
        _draw_text(pixels, width, room_x1 + 10, room_y1 + 12, label, line, scale=2)

    if has_pool:
        _draw_rect(pixels, width, x2 - 112, y1 + 18, x2 - 28, y1 + 52, pool)
        _draw_border(pixels, width, x2 - 112, y1 + 18, x2 - 28, y1 + 52, line, thickness=2)
    if has_garage:
        _draw_rect(pixels, width, px1 + 4, py2 - 58, px1 + 104, py2 - 4, accent)
        _draw_border(pixels, width, px1 + 4, py2 - 58, px1 + 104, py2 - 4, line, thickness=2)
        _draw_text(pixels, width, px1 + 14, py2 - 42, "AVTO", line, scale=2)
    if has_terrace:
        _draw_rect(pixels, width, px2 - 120, py2 - 58, px2 - 4, py2 - 4, _shift(accent, 8, 6, 0))
        _draw_border(pixels, width, px2 - 120, py2 - 58, px2 - 4, py2 - 4, line, thickness=2)
        _draw_text(pixels, width, px2 - 112, py2 - 42, "TERRASA", line, scale=2)


def _draw_metrics_panel(
    pixels,
    width,
    x1,
    y1,
    x2,
    y2,
    area,
    rooms,
    bathrooms,
    has_pool,
    has_garage,
    has_terrace,
    spec,
):
    palette = spec["palette"]
    line = palette["line"]
    stripe = palette["stripe"]
    ok_bg = palette["ok_bg"]
    no_bg = palette["no_bg"]

    _draw_rect(pixels, width, x1, y1, x2, y2, palette["panel"])
    _draw_border(pixels, width, x1, y1, x2, y2, line, thickness=4)
    _draw_text(pixels, width, x1 + 18, y1 + 18, "LOYIHA KARTASI", line, scale=3)
    _draw_rect(pixels, width, x2 - 118, y1 + 18, x2 - 22, y1 + 52, stripe)
    _draw_text(pixels, width, x2 - 104, y1 + 28, f"QVT {spec['storeys']}", line, scale=2)

    _draw_rect(pixels, width, x1 + 22, y1 + 74, x2 - 22, y1 + 126, stripe)
    _draw_rect(pixels, width, x1 + 22, y1 + 142, x2 - 22, y1 + 194, stripe)
    _draw_rect(pixels, width, x1 + 22, y1 + 210, x2 - 22, y1 + 262, stripe)
    _draw_rect(pixels, width, x1 + 22, y1 + 278, x2 - 22, y1 + 330, stripe)

    _draw_text(pixels, width, x1 + 36, y1 + 90, f"MAYDON: {area} M2", line, scale=3)
    _draw_text(pixels, width, x1 + 36, y1 + 158, f"XONALAR: {rooms}", line, scale=3)
    _draw_text(pixels, width, x1 + 36, y1 + 226, f"VANNA XONASI: {bathrooms}", line, scale=3)
    _draw_text(pixels, width, x1 + 36, y1 + 294, f"GARAJ: {'HA' if has_garage else 'YOQ'}", line, scale=3)

    pool_bg = ok_bg if has_pool else no_bg
    terrace_bg = ok_bg if has_terrace else no_bg
    _draw_rect(pixels, width, x1 + 22, y1 + 346, x1 + 292, y1 + 400, pool_bg)
    _draw_rect(pixels, width, x1 + 310, y1 + 346, x2 - 22, y1 + 400, terrace_bg)
    _draw_text(pixels, width, x1 + 36, y1 + 364, f"BASSEYN: {'HA' if has_pool else 'YOQ'}", line, scale=2)
    _draw_text(pixels, width, x1 + 320, y1 + 364, f"TERRASA: {'HA' if has_terrace else 'YOQ'}", line, scale=2)


def generate_house_preview(area, rooms, bathrooms, has_pool, has_garage, has_terrace):
    width = 1200
    height = 720
    spec = build_preview_spec(area, rooms, bathrooms, has_pool, has_garage, has_terrace)
    palette = spec["palette"]

    horizon = int(height * 0.58)
    lawn_end = _shift(palette["lawn"], -28, -24, -18)
    pixels = []
    for y in range(height):
        if y < horizon:
            row_color = _mix(palette["sky_top"], palette["sky_bottom"], y, max(1, horizon - 1))
        else:
            row_color = _mix(palette["lawn"], lawn_end, y - horizon, max(1, height - horizon - 1))
        pixels.append([row_color for _ in range(width)])

    _draw_rect(pixels, width, 32, 32, width - 32, height - 32, _shift(palette["panel"], 1, 1, 0))
    _draw_border(pixels, width, 32, 32, width - 32, height - 32, palette["line"], thickness=5)

    _draw_house_panel(
        pixels,
        width,
        66,
        78,
        694,
        430,
        area,
        rooms,
        bathrooms,
        has_pool,
        has_garage,
        has_terrace,
        spec,
    )
    _draw_plan_panel(
        pixels,
        width,
        726,
        78,
        1134,
        620,
        rooms,
        bathrooms,
        has_pool,
        has_garage,
        has_terrace,
        spec,
    )
    _draw_metrics_panel(
        pixels,
        width,
        66,
        460,
        694,
        620,
        area,
        rooms,
        bathrooms,
        has_pool,
        has_garage,
        has_terrace,
        spec,
    )

    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for red, green, blue in row:
            raw.extend((red, green, blue))

    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack("!2I5B", width, height, 8, 2, 0, 0, 0))
        + _chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
        + _chunk(b"IEND", b"")
    )
