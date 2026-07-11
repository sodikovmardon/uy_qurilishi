import math


def calculate_materials(area):
    if area <= 0:
        raise ValueError("Area must be a positive number.")

    # Taxminiy hisob-kitoblar (120 m2 uchun o'rtacha ko'rsatkichlar asosida)
    # Uy kvadrat shaklida deb hisoblansa: tomoni = sqrt(area)
    side = math.sqrt(area)
    perimeter = side * 4
    wall_height = 3  # Devor balandligi 3 metr

    # Umumiy devor yuzasi (eshik va derazalar uchun 15% olib tashlanadi)
    total_wall_area = (perimeter * wall_height) * 0.85

    # 1.5 g'isht qalinlik uchun (1 m2 ga ~400 dona g'isht)
    bricks = int(total_wall_area * 400)

    # Sement (taxminan 1000 dona g'ishtga 0.5 tonna)
    cement = round((bricks / 1000) * 0.5, 1)

    # Qum (1 tonna sementga 3 m3 qum)
    sand = round(cement * 3, 1)

    return {
        "area": area,
        "bricks": bricks,
        "cement": cement,
        "sand": sand
    }



