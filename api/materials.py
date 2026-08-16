"""Shared material-calculation engine used by /api/calculate and the chat assistant."""
import math


def calculate_materials(area: int, rooms: int) -> dict:
    perimeter = math.sqrt(area) * 4
    wall_area = perimeter * 3 * 0.85
    bricks = round(wall_area * 400)
    cement = math.ceil((bricks / 1000) * 0.5)
    sand = math.ceil(cement * 3)

    if area >= 2600 or rooms >= 14:
        storeys = 3
    elif area >= 900 or rooms >= 8:
        storeys = 2
    else:
        storeys = 1

    return {'bricks': bricks, 'cement': cement, 'sand': sand, 'storeys': storeys}
