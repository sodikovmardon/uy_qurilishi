"""Attach real, on-topic product photos to store products.

Each product is matched by SKU to a verified photo — either a remote URL
(already hand-verified Wikimedia Commons / Flickr / Unsplash) or a local
candidate file that passed title verification (descriptive filename matching
the product exactly). Unlisted products keep their clean category icon.

Photos are processed into 900x900 JPEGs and stored in Django media, so the
running site never depends on an external host. The first entry in `images`
is the card thumbnail; extras become gallery images.

Usage: python manage.py seed_product_photos [--force]
"""
import io
import os
import time
import urllib.request

from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from house_calc.models import Product

UA = {'User-Agent': 'uy-qurilishi-seed/1.0 (demo product photography)'}

# ---------------------------------------------------------------------------
# SKU -> ordered list of photo sources. A source is either an http(s) URL or a
# local path (title-verified candidate). First source = primary card photo.
# Only images whose source describes the product exactly are listed here;
# anything uncertain is deliberately left out (icon fallback).
# ---------------------------------------------------------------------------
POOL = '/tmp/opencode/imgpool'
POOL2 = '/tmp/opencode/imgpool2'
POOL3 = '/tmp/opencode/imgpool3'
POOL4 = '/tmp/opencode/imgpool4'
GAPFILL = '/tmp/opencode/gapfill'
GAPFILL2 = '/tmp/opencode/gapfill2'

PRODUCT_PHOTOS = {
    # -- existing hand-verified remote photos (unchanged) --
    'BRI-SIL-250': ['https://live.staticflickr.com/2889/11202414384_df19741bcf_b.jpg'],  # lime bricks
    'BRI-KER-250': ['https://live.staticflickr.com/6173/6186285060_048f4af0af_b.jpg'],  # red brick wall
    'BRI-BOS-250': ['https://upload.wikimedia.org/wikipedia/commons/8/85/Perforated_brick_2.jpg'],  # perforated brick
    'CEM-M400-50': ['https://upload.wikimedia.org/wikipedia/commons/8/83/Cement_bags.jpg'],  # cement bags
    'CEM-M500-50': ['https://live.staticflickr.com/65535/50550618521_ef7e0414bf_b.jpg'],  # stacked cement bags
    'SAN-RIV-1': ['https://upload.wikimedia.org/wikipedia/commons/3/33/Sand_heap%2C_Campsie_Playing_Fields_-_geograph.org.uk_-_5829969.jpg'],  # sand heap
    'GRV-5-20': ['https://live.staticflickr.com/7382/16313806919_2535a39fb4_b.jpg'],  # gravel pile
    'MET-ARM-12': ['https://live.staticflickr.com/4041/4433483933_ac78366dfe_b.jpg'],  # reinforcement bars
    'MET-ARM-8': ['https://live.staticflickr.com/1106/1387142898_f700c104de.jpg'],  # framed rebar
    'TLS-MIX-160': ['https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2Zyd29ya19jcmFmdF9jb25jcmV0ZV9taXhlci1pbWFnZS1reWJhNmU3Ni5qcGc.jpg'],  # concrete mixer
    'TLS-MOL-T': ['https://upload.wikimedia.org/wikipedia/commons/9/93/Masons_trowel.jpg'],  # mason trowel
    'TLS-KUR-1': ['https://upload.wikimedia.org/wikipedia/commons/5/57/Shovels.jpg'],  # shovels
    'TLS-CHE-10': ['https://live.staticflickr.com/4029/4378675576_38ac9b699c_b.jpg'],  # red plastic bucket
    'PNT-AKR-1': ['https://live.staticflickr.com/3543/3413845072_5a9fda8bc9_b.jpg'],  # paint cans
    'PNT-FAS-1': ['https://upload.wikimedia.org/wikipedia/commons/e/e8/Paint_roller_3.jpg'],  # paint roller
    'GLU-KAF-25': ['https://live.staticflickr.com/308/19838198570_3fe998d9b5_b.jpg'],  # ceramic tiles
    'HYD-RUL-1': ['https://live.staticflickr.com/3731/10585937815_8c6b26261b.jpg'],  # roofing felt

    # -- pass 1 pool (title-verified local candidates that downloaded) --
    'FBS-20-40': [f'{POOL}/1_3.jpg'],  # Foundation Wall Construction
    'GRV-20-40': [f'{POOL}/1_6.jpg'],  # Gravel Stones
    'BOG-KLY-1': [f'{POOL}/14_1.jpg'],  # fixing mantle with glue
    'ICH-KAF-1': ['https://live.staticflickr.com/308/19838198570_3fe998d9b5_b.jpg'],  # ceramic tiles

    # -- second pass (title-verified Wikimedia Commons) --
    'DVE-ICH-1': [f'{POOL2}/8_3.jpg'],  # interior wooden door with glass
    'DVE-AYN-1': [f'{POOL2}/8_6.jpg'],  # aluminum window
    'ELE-AVT-1': [f'{POOL2}/9_2.jpg'],  # circuit breaker on DIN rail
    'SAN-MIX-1': [f'{POOL2}/10_2.jpg'],  # faucet
    'SAN-BOI-1': [f'{POOL2}/10_3.jpg'],  # water heater tank
    'HV-RAD-1': [f'{POOL2}/11_1.jpg'],  # heat radiator
    'HV-GAZ-1': [f'{POOL2}/11_2.jpg'],  # condensing boiler
    'HV-SPL-1': [f'{POOL2}/11_3.jpg'],  # air conditioner
    'HV-TRU-1': [f'{POOL2}/11_4.jpg'],  # air duct pipes
    'ICH-LAM-1': [f'{POOL2}/12_2.jpg'],  # laminate floor assembly
    'PNT-FAS-1': ['https://upload.wikimedia.org/wikipedia/commons/e/e8/Paint_roller_3.jpg',
                 f'{POOL2}/13_1.jpg'],  # paint roller + painter at work on a house wall
    'TAS-SID-1': [f'{POOL2}/13_2.jpg'],  # house with vinyl siding
    'TAS-SHP-1': [f'{POOL2}/13_3.jpg'],  # decorative clay plaster texture
    'TAS-KLN-1': [f'{POOL2}/13_5.jpg'],  # clinker facade
    'BOG-VIN-1': [f'{POOL2}/14_1.jpg'],  # screws and bolts in hardware store
    'ASB-PAY-1': [f'{POOL2}/15_1.jpg'],  # CO2 welding machine
    'BS-TOS-2': [f'{POOL2}/16_2.jpg'],  # patio paving stones

    # -- third pass (title-verified, direct-file) --
    'PUS-200-1': [f'{POOL3}/3_2.jpg'],  # concrete block wall (Japan)
    'MET-TO-R': [f'{POOL3}/4_2.jpg'],  # construction site rebar framework
    'MET-LST-2': [f'{POOL3}/4_4.jpg'],  # galvanized steel metal sheet
    'MET-ARM-12': ['https://live.staticflickr.com/4041/4433483933_ac78366dfe_b.jpg',
                   f'{POOL3}/4_1.jpg'],  # reinforcement bars + rebar closeup
    'BS-TOS-1': [f'{POOL3}/16_1.jpg'],  # wooden fence (Holzzaun)

    # -- fourth pass (Special:FilePath by exact title) --
    'YOG-TXT-50': [f'{POOL4}/taxta.jpg'],  # men stacking wood lumber
    'YOG-BRS-100': [f'{POOL4}/brus.jpg'],  # stacked wood planks
    'YOG-FAN-12': [f'{POOL4}/fanera.jpg'],  # plywood
    'YOG-OSB-1': [f'{POOL4}/osb.jpg'],  # oriented strand board
    'TOM-MCH-1': [f'{POOL4}/tom-mch.jpg'],  # red metal roof tile

    # -- fourth pass (retry batch; skipped gracefully if still missing) --
    'TOM-SER-1': [f'{POOL4}/tom-ser.jpg'],  # Japanese (ceramic) roof tiles
    'TOM-GOF-1': [f'{POOL4}/tom-gof.jpg'],  # zinc corrugated roofing
    'IZL-EPS-50': [f'{POOL4}/izl-eps.jpg'],  # EPS insulation board
    'IZL-PIR-1': [f'{POOL4}/izl-pir.jpg'],  # polyisocyanurate insulation boards
    'QUM-TUL-1': [f'{POOL4}/qum.jpg'],  # pile of Sand
    'ASB-ROL-1': [f'{POOL4}/rolik.jpg'],  # Farbroller (paint roller)
    'BS-MOZ-1': [f'{POOL4}/bs-moz.jpg', f'{POOL4}/bs-moz-b.jpg'],  # pool mosaic tiles (+texture)

    # -- per-product gap fill (Commons search API, title-reviewed) --
    'ASB-ROL-1': [f'{GAPFILL}/ASB-ROL-1.jpg'],  # paint roller nap
    'ASB-DAR-1': [f'{GAPFILL}/ASB-DAR-1.jpg'],  # cube spirit level
    'BS-DEK-1': [f'{GAPFILL}/BS-DEK-1.jpg'],  # wooden deck boards
    'BET-M200-1': [f'{GAPFILL}/BET-M200-1.jpg'],  # concrete mixer truck
    'BOG-MON-1': [f'{GAPFILL}/BOG-MON-1.jpg'],  # polyurethane foam
    'GAZ-600-200': [f'{GAPFILL}/GAZ-600-200.jpg'],  # aerated concrete block wall
    'ELE-ROZ-1': [f'{GAPFILL}/ELE-ROZ-1.jpg'],  # electrical power outlet
    'ELE-SHT-1': [f'{GAPFILL}/ELE-SHT-1.jpg'],  # circuit breaker panel
    'ICH-GKL-1': [f'{GAPFILL}/ICH-GKL-1.jpg'],  # drywall and tools
    'IZL-MIN-1': [f'{GAPFILL}/IZL-MIN-1.jpg'],  # mineral wool insulation
    'IZL-GID-1': [f'{GAPFILL}/IZL-GID-1.jpg'],  # membrane roofing
    'SV-TAL-1': [f'{GAPFILL}/SV-TAL-1.jpg'],  # arc welding electrodes
    'GEO-TEX-1': [f'{GAPFILL}/GEO-TEX-1.jpg'],  # nonwoven geotextile
    'SAN-PPR-1': [f'{GAPFILL}/SAN-PPR-1.jpg'],  # hdpe pipe installation
    'SAN-UNT-1': [f'{GAPFILL}/SAN-UNT-1.jpg'],  # toilet bowl in bathroom

    # -- per-product gap fill, second pass (title-reviewed) --
    'DVE-OYN-1': [f'{GAPFILL2}/DVE-OYN-1.jpg'],  # house bay windows
    'DVE-KIR-1': [f'{GAPFILL2}/DVE-KIR-1.jpg'],  # building front door
    'ELE-KAB-1': [f'{GAPFILL2}/ELE-KAB-1.jpg'],  # pulling electrical cables
    'SAN-MOY-1': [f'{GAPFILL2}/SAN-MOY-1.jpg'],  # white pedestal sink
    'ICH-SHP-1': [f'{GAPFILL2}/ICH-SHP-1.jpg'],  # applying drywall joint compound
}

SIZE = (900, 900)


def _read(source: str) -> bytes | None:
    """Read photo bytes from a URL or a local path."""
    if source.startswith('/'):
        try:
            with open(source, 'rb') as f:
                return f.read()
        except Exception:
            return None
    for attempt in range(3):
        try:
            req = urllib.request.Request(source, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.read()
        except Exception:
            time.sleep(1 + attempt * 2)
    return None


def _to_square_jpeg(data: bytes) -> bytes:
    im = Image.open(io.BytesIO(data)).convert('RGB')
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize(SIZE, Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, format='JPEG', quality=88)
    return out.getvalue()


class Command(BaseCommand):
    help = 'Attaches a verified, on-topic photo per store product (by SKU).'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Re-download even if already set')

    def handle(self, *args, **options):
        force = options['force']
        done, skipped, failed = 0, 0, 0

        for product in Product.objects.all():
            sources = PRODUCT_PHOTOS.get(product.sku)
            if not sources:
                skipped += 1
                continue

            if product.images and not force:
                skipped += 1
                continue

            keys = []
            for source in sources:
                data = _read(source)
                if data is None:
                    self.stdout.write(self.style.ERROR(f'  source unavailable for {product.name} ({source[:60]})'))
                    continue
                try:
                    jpeg = _to_square_jpeg(data)
                except Exception as exc:
                    self.stdout.write(self.style.ERROR(f'  invalid image for {product.name}: {exc}'))
                    continue
                key = f'products/{product.sku.lower()}-{product.pk}-{len(keys)}.jpg'
                default_storage.save(key, ContentFile(jpeg))
                keys.append(key)

            if not keys:
                self.stdout.write(self.style.WARNING(f'  no photo for {product.name} — keeping icon fallback'))
                failed += 1
                continue

            product.images = keys
            product.image = None
            product.save(update_fields=['images', 'image'])
            done += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done: {done} updated, {skipped} skipped, {failed} without a photo.'
        ))
