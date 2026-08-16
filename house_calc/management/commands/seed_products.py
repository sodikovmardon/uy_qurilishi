"""Seed the store catalog across 16 construction categories.

Every product is keyed by a stable SKU so `seed_product_photos` can attach a
real, on-topic photo per product. SKUs of previously seeded products are kept
so their verified photos carry over.

Usage: python manage.py seed_products [--force]
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password

from house_calc.models import Product, StoreOwner


# (name, category, unit, price_uzs, stock, sku, description)
PRODUCTS = [
    # 1. Poydevor va tuproq ishlari
    ('FBS poydevor bloki (20×20×40)', 'Poydevor va tuproq ishlari', 'dona', 22000, 400, 'FBS-20-40',
     'Temir-beton poydevor bloki 20×20×40 sm. Lenta poydevori qurish uchun.'),
    ('Geotekstil (rulon 2×50 m)', 'Poydevor va tuproq ishlari', 'rulon', 75000, 12, 'GEO-TEX-1',
     'Filtrlash va qatlamlarni ajratish uchun geotekstil to\'qima.'),
    ('Shag\'al (fraksiya 20-40)', 'Poydevor va tuproq ishlari', 'm³', 145000, 7, 'GRV-20-40',
     'Poydevor yostig\'i va to\'ldirish ishlari uchun yirik fraksiyali shag\'al.'),
    ('Qum (to\'ldirish uchun)', 'Poydevor va tuproq ishlari', 'm³', 95000, 25, 'QUM-TUL-1',
     'Poydevor ostini tekislash va to\'ldirish uchun qurilish qumi.'),

    # 2. Beton va tarkibiy qismlari
    ('Portlendsement M400', 'Beton va tarkibiy qismlari', 'qop', 85000, 48, 'CEM-M400-50',
     'Portlendsement M400, 50 kg qop. Beton va qorishmalar tayyorlash uchun.'),
    ('Portlendsement M500', 'Beton va tarkibiy qismlari', 'qop', 95000, 0, 'CEM-M500-50',
     'Portlendsement M500, 50 kg qop. Yuqori mustahkamlikdagi beton uchun.'),
    ('Qurilish qumi', 'Beton va tarkibiy qismlari', 'm³', 120000, 30, 'SAN-RIV-1',
     'Yuvilgan daryo qumi, 1 m³. Qorishma va suvoq ishlari uchun.'),
    ('Shag\'al (fraksiya 5-20)', 'Beton va tarkibiy qismlari', 'm³', 150000, 3, 'GRV-5-20',
     'Beton uchun shag\'al, fraksiya 5-20 mm.'),
    ('Tayyor beton M200 (qorishma)', 'Beton va tarkibiy qismlari', 'm³', 380000, 0, 'BET-M200-1',
     'Qurilish maydonchasiga yetkaziladigan tayyor beton qorishmasi, M200.'),

    # 3. Devor materiallari
    ('Silikat g\'isht', 'Devor materiallari', 'dona', 1850, 12500, 'BRI-SIL-250',
     'Oddiy silikat g\'isht, 250×120×65 mm. Devor qurilishida asosiy material.'),
    ('Qizil keramik g\'isht', 'Devor materiallari', 'dona', 2400, 8000, 'BRI-KER-250',
     'Pishiq qizil g\'isht, yuqori mustahkamlik, binoning tashqi devorlari uchun.'),
    ('Bo\'shliqli g\'isht (45%)', 'Devor materiallari', 'dona', 2900, 5, 'BRI-BOS-250',
     'Bo\'shliqli issiqlik saqlovchi g\'isht, devorlarni yengillashtiradi.'),
    ('Gazbeton blok (600×300×200)', 'Devor materiallari', 'dona', 12000, 2500, 'GAZ-600-200',
     'Issiqlik saqlovchi gazbeton blok, yengil va oson ishlov beriladi.'),
    ('Pustoy blok (390×190×190)', 'Devor materiallari', 'dona', 8500, 1800, 'PUS-200-1',
     'Yordamchi xonalar va to\'siqlar uchun pustoy (tosh-beton) blok.'),

    # 4. Metall va armatura
    ('Armatura (d=12 mm)', 'Metall va armatura', 'tonna', 7800000, 2, 'MET-ARM-12',
     'Temir-beton konstruksiyalar uchun armatura sterjeni, 12 mm.'),
    ('Armatura (d=8 mm)', 'Metall va armatura', 'tonna', 7200000, 1, 'MET-ARM-8',
     'Qisqich va karkas uchun armatura, 8 mm.'),
    ('Po\'lat list (2 mm)', 'Metall va armatura', 'm²', 65000, 18, 'MET-LST-2',
     'Gofrlanmagan po\'lat list, qoplama va karkas elementlari uchun.'),
    ('Payvand to\'ri (karkas to\'ri)', 'Metall va armatura', 'dona', 95000, 10, 'MET-TO-R',
     'Devor va pol plitalarini mustahkamlash uchun payvandlangan armatura to\'ri.'),
    ('Payvandlash tala (d=1,2 mm)', 'Metall va armatura', 'kg', 28000, 4, 'SV-TAL-1',
     'Metall konstruksiyalarni payvandlash uchun elektrod tala.'),

    # 5. Yog'och materiallari
    ('Qirrali taxta (50×150)', 'Yog\'och materiallari', 'm³', 2800000, 3, 'YOG-TXT-50',
     'Qurilish ishlari uchun quritilgan qirrali taxta, 50×150 mm.'),
    ('Fanera (12 mm)', 'Yog\'och materiallari', 'm²', 45000, 28, 'YOG-FAN-12',
     'Qoliplar va ichki qoplama ishlarida ishlatiladigan flinta fanera.'),
    ('OSB plita (2440×1220 mm)', 'Yog\'och materiallari', 'dona', 95000, 22, 'YOG-OSB-1',
     'Yog\'och-strujka plitasi, devor va pol uchun mustahkam asos.'),
    ('Brus (100×100)', 'Yog\'och materiallari', 'm³', 3100000, 2, 'YOG-BRS-100',
     'Ramka va to\'sin konstruksiyalari uchun yog\'och brus, 100×100 mm.'),

    # 6. Tom yopish materiallari
    ('Metall cherepitsa', 'Tom yopish materiallari', 'm²', 62000, 140, 'TOM-MCH-1',
     'Polimer qoplamali metall cherepitsa, chidamli va oson o\'rnatiladi.'),
    ('Keramik cherepitsa', 'Tom yopish materiallari', 'm²', 72000, 90, 'TOM-SER-1',
     'Tabiiy pishiq keramik cherepitsa, uzoq xizmat muddati.'),
    ('Gofrirovka qatlami (proflist)', 'Tom yopish materiallari', 'm²', 38000, 190, 'TOM-GOF-1',
     'Sink qoplamali gofrirovka qilingan tom qatlami.'),
    ('Bitumli shifer (ondulin)', 'Tom yopish materiallari', 'list', 42000, 35, 'TOM-OND-1',
     'Yengil bitumli shifer qoplamasi, alohida listlarda.'),

    # 7. Izolyatsiya
    ('Penoplast (EPS 1000×500×50)', 'Izolyatsiya', 'dona', 18000, 280, 'IZL-EPS-50',
     'Ekstrudirlangan polistirol penoplast, devor va poydevor izolyatsiyasi.'),
    ('PIR izolyatsiya plitasi', 'Izolyatsiya', 'dona', 25000, 60, 'IZL-PIR-1',
     'Polizotsianurat (PIR) qattiq izolyatsiya plitasi, yuqori issiqlik samarasi.'),
    ('Mineral jun (rulon)', 'Izolyatsiya', 'm²', 22000, 110, 'IZL-MIN-1',
     'Mineral jun rulon izolyatsiyasi, tom va devorlar uchun.'),
    ('Gidroizolyatsiya membranasi', 'Izolyatsiya', 'rulon', 85000, 8, 'IZL-GID-1',
     'Diffuzion gidroizolyatsiya membranasi, tom tagi uchun.'),

    # 8. Deraza va eshiklar
    ('PVX oyna (100×120 sm)', 'Deraza va eshiklar', 'dona', 450000, 0, 'DVE-OYN-1',
     'Ikki kamerali PVX oyna bloki, 100×120 sm.'),
    ('Alyuminiy oyna (90×140 sm)', 'Deraza va eshiklar', 'dona', 680000, 3, 'DVE-AYN-1',
     'Alyuminiy profilli oyna, katta teshiklar uchun.'),
    ('Ichki eshik (shponli)', 'Deraza va eshiklar', 'dona', 320000, 5, 'DVE-ICH-1',
     'Shpon qoplamali ichki eshik, standart 80 sm.'),
    ('Kirish metall eshik', 'Deraza va eshiklar', 'dona', 1200000, 2, 'DVE-KIR-1',
     'Zanglamaydigan po\'latdan kirish eshigi, qo\'shimcha himoya.'),

    # 9. Elektr materiallari
    ('Kabel VVGng (3×2,5)', 'Elektr materiallari', 'm', 4800, 450, 'ELE-KAB-1',
     'Uy ichki simlari uchun mis kabel, 3×2,5 mm².'),
    ('Rozetka (ichki)', 'Elektr materiallari', 'dona', 15000, 70, 'ELE-ROZ-1',
     'Ichki o\'rnatish uchun ikki joyli rozetka, yevro standart.'),
    ('Avtomat (C16)', 'Elektr materiallari', 'dona', 38000, 25, 'ELE-AVT-1',
     'Elektr himoya avtomati, 16 A, o\'rnatish paneli uchun.'),
    ('Elektr shchit', 'Elektr materiallari', 'dona', 95000, 8, 'ELE-SHT-1',
     'Avtomatlar uchun ichki o\'rnatish elektr shchiti.'),

    # 10. Santexnika
    ('PPR truba (d=25)', 'Santexnika', 'm', 9000, 140, 'SAN-PPR-1',
     'Suv ta\'minoti uchun polipropilen truba, d=25 mm.'),
    ('Unitaz (kompakt)', 'Santexnika', 'dona', 480000, 3, 'SAN-UNT-1',
     'Kompakt unitaz, bak bilan to\'liq to\'plam.'),
    ('Moyka (raqovina)', 'Santexnika', 'dona', 220000, 5, 'SAN-MOY-1',
     'Hammom va oshxona uchun keramik raqovina.'),
    ('Suv isitgich (boiler 50 L)', 'Santexnika', 'dona', 950000, 2, 'SAN-BOI-1',
     'Elektr suv isitgich, 50 litr, devorga o\'rnatiladi.'),
    ('Mixer (krann)', 'Santexnika', 'dona', 120000, 6, 'SAN-MIX-1',
     'Raqovina uchun ikki qo\'lli mixer, keramik klapan.'),

    # 11. Isitish va shamollatish
    ('Radiator (alyuminiy)', 'Isitish va shamollatish', 'dona', 85000, 12, 'HV-RAD-1',
     'Alyuminiy radiator bo\'limi, markaziy isitish uchun.'),
    ('Gaz qozoni (24 kW)', 'Isitish va shamollatish', 'dona', 4200000, 0, 'HV-GAZ-1',
     'Ikki konturli devorga o\'rnatiladigan gaz qozoni, 24 kW.'),
    ('Konditsioner (split 9000 BTU)', 'Isitish va shamollatish', 'dona', 3500000, 1, 'HV-SPL-1',
     'Inverter split-konditsioner, sovutish va isitish rejimi.'),
    ('Shamollatish trubasi (d=125)', 'Isitish va shamollatish', 'm', 18000, 40, 'HV-TRU-1',
     'Havo almashinish tizimi uchun shamollatish trubasi.'),

    # 12. Ichki pardozlash
    ('Akril bo\'yoq (ichki)', 'Ichki pardozlash', 'kg', 38000, 60, 'PNT-AKR-1',
     'Ichki devorlar uchun akril bo\'yoq, oq rang.'),
    ('Shpaklevka (quruq aralashma)', 'Ichki pardozlash', 'qop', 55000, 20, 'ICH-SHP-1',
     'Devor va shiftlarni tekislash uchun quruq shpaklevka, 25 kg.'),
    ('Keramik kafel (300×300)', 'Ichki pardozlash', 'm²', 65000, 90, 'ICH-KAF-1',
     'Devorga yopishtiriladigan sirli keramik kafel, 300×300 mm.'),
    ('Laminat (32 sinf)', 'Ichki pardozlash', 'm²', 72000, 110, 'ICH-LAM-1',
     'Burg\'uli panelli laminat, suvga chidamli qatlam.'),
    ('Gipsokarton (GKL 12,5 mm)', 'Ichki pardozlash', 'dona', 68000, 35, 'ICH-GKL-1',
     'Shift va devor qoplamasi uchun gipsokarton plitasi.'),

    # 13. Tashqi pardozlash
    ('Fasad bo\'yog\'i', 'Tashqi pardozlash', 'kg', 52000, 15, 'PNT-FAS-1',
     'Tashqi fasadlar uchun suv o\'tkazmaydigan bo\'yoq.'),
    ('Dekorativ fasad shpaksi', 'Tashqi pardozlash', 'qop', 85000, 8, 'TAS-SHP-1',
     'Fasadlar uchun tayyor dekorativ qoplama aralashmasi.'),
    ('Siding panellari', 'Tashqi pardozlash', 'm²', 48000, 60, 'TAS-SID-1',
     'PVX siding panellari, uzoq xizmat muddati va oson tozalash.'),
    ('Klinker kafel', 'Tashqi pardozlash', 'm²', 78000, 40, 'TAS-KLN-1',
     'Poydevor va fasad qoplamasi uchun klinker kafel.'),

    # 14. Bog'lovchi materiallar
    ('Kafel yopishtiruvchi', 'Bog\'lovchi materiallar', 'qop', 42000, 9, 'GLU-KAF-25',
     'Kafel uchun yopishtiruvchi quruq aralashma, 25 kg.'),
    ('Suv o\'tkazmaydigan gidroizol', 'Bog\'lovchi materiallar', 'rulon', 95000, 6, 'HYD-RUL-1',
     'Rulonli gidroizolyatsiya, poydevor himoyasi uchun.'),
    ('Qurilish kleyi (universal)', 'Bog\'lovchi materiallar', 'qop', 48000, 10, 'BOG-KLY-1',
     'Devor va panellar uchun universal montaj kleyi.'),
    ('Vintlar (samorez, quti)', 'Bog\'lovchi materiallar', 'quti', 45000, 15, 'BOG-VIN-1',
     'Yog\'och va metallga burash uchun samorezlar to\'plami.'),
    ('Montaj penasi', 'Bog\'lovchi materiallar', 'ballon', 55000, 12, 'BOG-MON-1',
     'Teshiklarni to\'ldirish va o\'rnatish ishlari uchun montaj penasi.'),

    # 15. Asbob-uskunalar
    ('Beton aralashtirgich 160L', 'Asbob-uskunalar', 'dona', 4500000, 4, 'TLS-MIX-160',
     '160 litrli elektr beton aralashtirgich, qurilish maydonchalari uchun.'),
    ('Mol\'ka (tishli)', 'Asbob-uskunalar', 'dona', 65000, 7, 'TLS-MOL-T',
     'Plitka yopishtirish uchun tishli mol\'ka.'),
    ('Kurak', 'Asbob-uskunalar', 'dona', 45000, 22, 'TLS-KUR-1',
     'Qurilish kurak, po\'lat dastakli.'),
    ('Chevak (10 L)', 'Asbob-uskunalar', 'dona', 25000, 0, 'TLS-CHE-10',
     'Plastik chevak 10 litr, qurilish ishlarida qulay.'),
    ('Bo\'yoq roligi', 'Asbob-uskunalar', 'dona', 35000, 18, 'ASB-ROL-1',
     'Devor va shiftlarni bo\'yash uchun mo\'ynali rolik.'),
    ('Qurilish darajasi (1 m)', 'Asbob-uskunalar', 'dona', 185000, 9, 'ASB-DAR-1',
     'Sathni tekshirish uchun pufakli qurilish darajasi.'),
    ('Payvandlash apparati', 'Asbob-uskunalar', 'dona', 1250000, 1, 'ASB-PAY-1',
     'Uy sharoiti uchun elektr yoy payvandlash apparati.'),

    # 16. Basseyn va tashqi maydon
    ('Basseyn kafeli (mozaika)', 'Basseyn va tashqi maydon', 'm²', 120000, 25, 'BS-MOZ-1',
     'Basseyn uchun suvga chidamli mozaika kafel.'),
    ('Yog\'och terrasa taxtasi (deck)', 'Basseyn va tashqi maydon', 'm²', 95000, 30, 'BS-DEK-1',
     'Tashqi maydon uchun yog\'och deck taxta, namlikka chidamli.'),
    ('To\'siq panjarasi', 'Basseyn va tashqi maydon', 'm', 45000, 50, 'BS-TOS-1',
     'Yog\'och to\'siq panjarasi, bo\'limli.'),
    ('Poydevor tosh qoplamasi', 'Basseyn va tashqi maydon', 'm²', 110000, 20, 'BS-TOS-2',
     'Tashqi yo\'l va maydonlarni yotqizish uchun tosh plita.'),
]


class Command(BaseCommand):
    help = 'Seeds the 16-category store catalog and a default store owner.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Recreate even if products exist')

    def handle(self, *args, **options):
        if Product.objects.exists() and not options['force']:
            self.stdout.write('Products already exist. Use --force to re-seed.')
            return

        if options['force']:
            Product.objects.all().delete()

        for name, category, unit, price, stock, sku, desc in PRODUCTS:
            Product.objects.create(
                name=name,
                category=category,
                unit=unit,
                price=price,
                stock_quantity=stock,
                sku=sku,
                description=desc,
            )
        self.stdout.write(self.style.SUCCESS(f'Seeded {len(PRODUCTS)} products across '
                                             f'{Product.objects.values("category").distinct().count()} categories.'))

        if not StoreOwner.objects.filter(username='admin').exists():
            StoreOwner.objects.create(
                username='admin',
                password_hash=make_password('admin123'),
                name='Do\'kon egasi',
            )
            self.stdout.write(self.style.SUCCESS('Store owner created: admin / admin123'))
