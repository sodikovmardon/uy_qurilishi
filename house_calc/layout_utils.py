def estimate_storeys(area: int, rooms: int) -> int:
    if area >= 2600 or rooms >= 14:
        return 3
    if area >= 900 or rooms >= 8:
        return 2
    return 1


def summarize_room_program(rooms: int, bathrooms: int, has_garage: bool, has_terrace: bool) -> str:
    if rooms <= 1:
        parts = ["studio uslubidagi ochiq reja"]
    else:
        remaining_rooms = rooms - 1
        guest_room = 1 if rooms >= 5 else 0
        family_hall = 1 if rooms >= 7 else 0
        extra_flex = max(0, rooms - 8)
        bedrooms = max(1, remaining_rooms - guest_room - family_hall - extra_flex)

        parts = ["1 ta mehmonxona", "1 ta oshxona-ovqatlanish zonasi", f"{bedrooms} ta yotoqxona"]
        if guest_room:
            parts.append("1 ta kabinet yoki mehmon xonasi")
        if family_hall:
            parts.append("1 ta family hall")
        if extra_flex:
            parts.append(f"{extra_flex} ta qo'shimcha universal xona")

    parts.append(f"{bathrooms} ta vanna xonasi")
    if has_garage:
        parts.append("garaj bloki")
    if has_terrace:
        parts.append("terrasa zonasi")
    return ", ".join(parts)


def planning_note(area: int, rooms: int, bathrooms: int):
    service_zones = 2 + bathrooms
    main_room_area = round(area / max(rooms + service_zones, 1), 1)
    if main_room_area < 18:
        return f"Asosiy xonalar uchun o'rtacha {main_room_area} m² chiqadi, ixcham va zich reja kerak bo'ladi."
    if main_room_area < 32:
        return f"Asosiy xonalar uchun o'rtacha {main_room_area} m² chiqadi, muvozanatli oilaviy reja qurish mumkin."
    return f"Asosiy xonalar uchun o'rtacha {main_room_area} m² chiqadi, katta formatdagi villa yoki hovli uyi mos keladi."
