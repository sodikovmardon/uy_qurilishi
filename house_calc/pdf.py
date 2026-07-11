def _escape_pdf_text(value):
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _split_text_lines(text, max_chars=45):
    words = text.split()
    lines = []
    buffer = ''
    for word in words:
        if len(buffer) + len(word) + 1 <= max_chars:
            buffer = f"{buffer} {word}".strip()
        else:
            lines.append(buffer)
            buffer = word
    if buffer:
        lines.append(buffer)
    return lines


def build_project_pdf_bytes(
    project_id,
    area,
    bricks,
    cement,
    sand,
    rooms,
    bathrooms,
    has_pool,
    has_garage,
    has_terrace,
    ai_summary,
    source_label,
    user_name,
    created_at_text,
    image_bytes=None,
):
    project_info = [
        ("Project ID", str(project_id)),
        ("Created", created_at_text),
        ("Source", source_label),
        ("Client", user_name or 'Anonymous'),
        ("Area", f"{area} m²"),
        ("Rooms", str(rooms)),
        ("Bathrooms", str(bathrooms)),
        ("Garage", 'Yes' if has_garage else 'No'),
        ("Terrace", 'Yes' if has_terrace else 'No'),
        ("Pool", 'Yes' if has_pool else 'No'),
    ]

    material_rows = [
        ("Bricks", f"{bricks:,} pcs"),
        ("Cement", f"{cement} tons"),
        ("Sand", f"{sand} m³"),
    ]

    return render_report_pdf(
        title='House Construction Report',
        project_info=project_info,
        material_rows=material_rows,
        ai_summary=ai_summary,
        image_bytes=image_bytes,
    )


def render_report_pdf(title, project_info, material_rows, ai_summary, image_bytes=None):
    content_lines = []
    image_object = None
    image_width = image_height = 0

    if image_bytes is not None:
        from io import BytesIO
        from PIL import Image

        image = Image.open(BytesIO(image_bytes)).convert('RGB')
        width, height = image.size
        max_width = 230
        max_height = 200
        ratio = min(max_width / width, max_height / height, 1.0)
        image_width = int(width * ratio)
        image_height = int(height * ratio)

        buffer = BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        image_object = buffer.getvalue()

    # Header stripe
    content_lines.extend([
        '0.09 0.29 0.60 rg',
        '40 760 515 60 re',
        'f',
        '0.95 0.95 0.95 rg',
        'BT',
        '/F1 22 Tf',
        '1 0 0 1 50 790 Tm',
        f'({_escape_pdf_text(title)}) Tj',
        '/F1 10 Tf',
        '1 0 0 1 50 772 Tm',
        f'({_escape_pdf_text("Professional Construction Summary")}) Tj',
        'ET',
    ])

    # Project metadata columns
    content_lines.extend([
        '0.18 0.38 0.68 RG',
        '40 720 255 90 re',
        'S',
        '0.22 0.50 0.78 rg',
        '40 720 255 90 re',
        'f',
        '0 0 0 rg',
        'BT',
        '/F1 12 Tf',
        '1 0 0 1 50 792 Tm',
        '(_escape_pdf_text("Project Overview")) Tj'.replace('_escape_pdf_text("Project Overview")', _escape_pdf_text('Project Overview')),
    ])

    y = 774
    for key, value in project_info[:5]:
        content_lines.extend([
            f'1 0 0 1 50 {y} Tm',
            f'({_escape_pdf_text(key + ":")}) Tj',
            f'1 0 0 1 180 {y} Tm',
            f'({_escape_pdf_text(value)}) Tj',
        ])
        y -= 16

    content_lines.extend([
        '/F1 12 Tf',
        '1 0 0 1 50 700 Tm',
        f'({_escape_pdf_text("Materials & Details")}) Tj',
        'ET',
    ])

    # Image panel and summary panel
    if image_object is not None:
        content_lines.extend([
            '0.96 0.98 1 rg',
            '320 620 255 150 re',
            'f',
            '0.18 0.38 0.68 RG',
            '320 620 255 150 re',
            'S',
            '0 0 0 rg',
            'BT',
            '/F1 12 Tf',
            '1 0 0 1 330 758 Tm',
            f'({_escape_pdf_text("Visual Preview")}) Tj',
            'ET',
        ])
        content_lines.extend([
            'q',
            f'{image_width} 0 0 {image_height} {330} {628} cm',
            '/Im0 Do',
            'Q',
        ])
    else:
        content_lines.extend([
            '0.90 0.94 0.98 rg',
            '320 620 255 150 re',
            'f',
            '0.18 0.38 0.68 RG',
            '320 620 255 150 re',
            'S',
            '0 0 0 rg',
            'BT',
            '/F1 12 Tf',
            '1 0 0 1 330 748 Tm',
            f'({_escape_pdf_text("Visual preview unavailable")}) Tj',
            'ET',
        ])

    # Material cost table
    content_lines.extend([
        '0.18 0.38 0.68 RG',
        '40 540 255 110 re',
        'S',
        '0.22 0.50 0.78 rg',
        '40 540 255 110 re',
        'f',
        '0 0 0 rg',
        'BT',
        '/F1 12 Tf',
        '1 0 0 1 50 650 Tm',
        f'({_escape_pdf_text("Material Cost Summary")}) Tj',
    ])

    content_lines.extend([
        '1 0 0 1 40 636 Tm',
        '40 636 m',
        '295 636 l',
        'S',
    ])

    y = 620
    for label, value in material_rows:
        content_lines.extend([
            f'1 0 0 1 50 {y} Tm',
            f'({_escape_pdf_text(label)}) Tj',
            f'1 0 0 1 220 {y} Tm',
            f'({_escape_pdf_text(value)}) Tj',
        ])
        y -= 18

    content_lines.extend([
        'ET',
    ])

    # AI Summary panel
    content_lines.extend([
        '0.92 0.93 0.97 rg',
        '320 420 255 170 re',
        'f',
        '0.18 0.38 0.68 RG',
        '320 420 255 170 re',
        'S',
        '0 0 0 rg',
        'BT',
        '/F1 12 Tf',
        '1 0 0 1 330 572 Tm',
        f'({_escape_pdf_text("AI-Generated Summary")}) Tj',
    ])

    summary_lines = _split_text_lines(ai_summary or 'No AI summary available.', max_chars=48)
    y = 552
    for line in summary_lines:
        content_lines.extend([
            f'1 0 0 1 330 {y} Tm',
            f'({_escape_pdf_text(line)}) Tj',
        ])
        y -= 16

    content_lines.extend([
        'ET',
    ])

    # Footer
    content_lines.extend([
        '0.55 0.60 0.72 rg',
        'BT',
        '/F1 10 Tf',
        '1 0 0 1 40 80 Tm',
        f'({_escape_pdf_text("Generated by Uy Loyiha Studio – Professional construction reporting")}) Tj',
        'ET',
    ])

    stream = '\n'.join(content_lines).encode('latin-1', 'replace')
    page_resources = b'<< /Font << /F1 4 0 R >> >>'
    objects = [
        b'1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        b'2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    ]

    if image_object is not None:
        page_resources = b'<< /Font << /F1 4 0 R >> /XObject << /Im0 6 0 R >> >> /ProcSet [/PDF /Text /ImageC] >>'
        objects.append(
            b'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ' + page_resources + b' /Contents 5 0 R >> endobj'
        )
    else:
        objects.append(
            b'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ' + page_resources + b' /Contents 5 0 R >> endobj'
        )

    objects.append(b'4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj')

    if image_object is not None:
        objects.append(
            b'6 0 obj << /Type /XObject /Subtype /Image /Width ' + str(image_width).encode() +
            b' /Height ' + str(image_height).encode() +
            b' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
            str(len(image_object)).encode() + b' >> stream\n' + image_object + b'\nendstream endobj'
        )

    objects.append(b'5 0 obj << /Length ' + str(len(stream)).encode() + b' >> stream\n' + stream + b'\nendstream endobj')

    pdf = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)
        pdf.extend(b'\n')

    xref_offset = len(pdf)
    pdf.extend(f'xref\n0 {len(objects) + 1}\n'.encode())
    pdf.extend(b'0000000000 65535 f \n')
    for offset in offsets[1:]:
        pdf.extend(f'{offset:010d} 00000 n \n'.encode())
    pdf.extend(
        (
            f'trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n'
            f'startxref\n{xref_offset}\n%%EOF'
        ).encode()
    )
    return bytes(pdf)
