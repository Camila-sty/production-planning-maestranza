"""
Generate MANUAL_USUARIO.pdf from MANUAL_USUARIO.md using ReportLab.
Run from any directory:
    python3 scripts/generate_manual_pdf.py
"""

import re
import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Paths ──────────────────────────────────────────────────────────────────
BASE = Path(__file__).resolve().parent.parent
MD_FILE = BASE / "MANUAL_USUARIO.md"
PDF_FILE = BASE / "MANUAL_USUARIO.pdf"

# ── Palette ────────────────────────────────────────────────────────────────
C_AMBER     = colors.HexColor("#F59E0B")
C_AMBER_DK  = colors.HexColor("#D97706")
C_DARK      = colors.HexColor("#18181B")
C_ZINC900   = colors.HexColor("#18181B")
C_ZINC800   = colors.HexColor("#27272A")
C_ZINC700   = colors.HexColor("#3F3F46")
C_ZINC500   = colors.HexColor("#71717A")
C_ZINC400   = colors.HexColor("#A1A1AA")
C_ZINC300   = colors.HexColor("#D4D4D8")
C_WHITE     = colors.white
C_TBL_HEAD  = colors.HexColor("#1C1C1E")
C_TBL_ALT   = colors.HexColor("#1F1F23")
C_TBL_BODY  = colors.HexColor("#27272A")
C_WARN_BG   = colors.HexColor("#451A03")
C_TIP_BG    = colors.HexColor("#1C2A1E")
C_NOTE_BG   = colors.HexColor("#1E2233")

# ── Styles ─────────────────────────────────────────────────────────────────
def build_styles():
    base = getSampleStyleSheet()

    def S(name, **kw):
        parent = kw.pop("parent", "Normal")
        return ParagraphStyle(name, parent=base[parent], **kw)

    return {
        "normal": S("body",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=C_ZINC300, spaceAfter=6, alignment=TA_JUSTIFY),

        "h1": S("H1",
            fontName="Helvetica-Bold", fontSize=20, leading=26,
            textColor=C_AMBER, spaceBefore=0, spaceAfter=6,
            alignment=TA_LEFT),

        "h2": S("H2",
            fontName="Helvetica-Bold", fontSize=14, leading=20,
            textColor=C_AMBER, spaceBefore=16, spaceAfter=4),

        "h3": S("H3",
            fontName="Helvetica-Bold", fontSize=11, leading=16,
            textColor=C_WHITE, spaceBefore=10, spaceAfter=3),

        "h4": S("H4",
            fontName="Helvetica-BoldOblique", fontSize=10, leading=14,
            textColor=C_ZINC400, spaceBefore=8, spaceAfter=2),

        "bullet": S("bullet",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=C_ZINC300, spaceAfter=3, leftIndent=14,
            bulletIndent=4),

        "code": S("code",
            fontName="Courier", fontSize=8.5, leading=13,
            textColor=colors.HexColor("#86EFAC"), backColor=C_ZINC800,
            spaceAfter=6, spaceBefore=4, leftIndent=10, rightIndent=6,
            borderPadding=(4, 6, 4, 6)),

        "quote": S("quote",
            fontName="Helvetica-Oblique", fontSize=9.5, leading=14,
            textColor=C_ZINC400, spaceAfter=4, leftIndent=14,
            borderPadding=(4, 0, 4, 10)),

        "warn": S("warn",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#FDE68A"), spaceAfter=6,
            leftIndent=10, rightIndent=6, backColor=C_WARN_BG,
            borderPadding=(5, 8, 5, 8)),

        "tip": S("tip",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#A7F3D0"), spaceAfter=6,
            leftIndent=10, rightIndent=6, backColor=C_TIP_BG,
            borderPadding=(5, 8, 5, 8)),

        "note": S("note",
            fontName="Helvetica-Oblique", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#BAE6FD"), spaceAfter=6,
            leftIndent=10, rightIndent=6, backColor=C_NOTE_BG,
            borderPadding=(5, 8, 5, 8)),

        "cover_title": S("cover_title",
            fontName="Helvetica-Bold", fontSize=28, leading=36,
            textColor=C_AMBER, alignment=TA_CENTER, spaceAfter=8),

        "cover_sub": S("cover_sub",
            fontName="Helvetica", fontSize=13, leading=18,
            textColor=C_WHITE, alignment=TA_CENTER, spaceAfter=4),

        "cover_meta": S("cover_meta",
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=C_ZINC400, alignment=TA_CENTER, spaceAfter=3),

        "toc_h1": S("toc_h1",
            fontName="Helvetica-Bold", fontSize=10, leading=14,
            textColor=C_AMBER, spaceAfter=2, leftIndent=0),

        "toc_h2": S("toc_h2",
            fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=C_ZINC300, spaceAfter=1, leftIndent=12),

        "numbered": S("numbered",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=C_ZINC300, spaceAfter=3, leftIndent=18,
            bulletIndent=4),
    }


# ── Table style helpers ────────────────────────────────────────────────────
def make_table_style(nrows):
    cmds = [
        ("BACKGROUND",  (0, 0), (-1, 0),  C_TBL_HEAD),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  C_AMBER),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0),  8.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING",  (0, 0), (-1, 0),  6),
        ("GRID",        (0, 0), (-1, -1), 0.5, C_ZINC700),
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",    (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR",   (0, 1), (-1, -1), C_ZINC300),
        ("TOPPADDING",  (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_TBL_BODY, C_TBL_ALT]),
    ]
    return TableStyle(cmds)


# ── Inline markdown → HTML for Paragraph ──────────────────────────────────
def inline(text: str) -> str:
    """Convert inline **bold**, *italic*, `code` to ReportLab XML."""
    # Escape XML special chars first (except our own tags)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # Italic (single * not double)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    # Inline code
    text = re.sub(r"`([^`]+)`", r'<font name="Courier" color="#86EFAC">\1</font>', text)
    return text


# ── Page decorations ───────────────────────────────────────────────────────
def on_page(canvas, doc):
    """Draw header bar and page number on each page (except cover)."""
    if doc.page == 1:
        return
    w, h = A4
    # Top bar
    canvas.saveState()
    canvas.setFillColor(C_ZINC800)
    canvas.rect(0, h - 1.2*cm, w, 1.2*cm, fill=1, stroke=0)
    canvas.setFillColor(C_AMBER)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(2*cm, h - 0.75*cm, "MANUAL DE USUARIO — Sistema de Planificación ETP Spa")
    # Bottom bar
    canvas.setFillColor(C_ZINC800)
    canvas.rect(0, 0, w, 0.9*cm, fill=1, stroke=0)
    canvas.setFillColor(C_ZINC500)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2*cm, 0.3*cm, "ETP Spa — Uso interno y confidencial")
    canvas.setFillColor(C_ZINC400)
    canvas.drawRightString(w - 2*cm, 0.3*cm, f"Página {doc.page}")
    canvas.restoreState()


# ── Cover page ─────────────────────────────────────────────────────────────
def build_cover(styles):
    elems = []
    elems.append(Spacer(1, 3.5*cm))
    # Accent bar
    elems.append(Table([[""]], colWidths=[16*cm], rowHeights=[0.3*cm],
                        style=TableStyle([("BACKGROUND", (0,0), (-1,-1), C_AMBER),
                                          ("TOPPADDING", (0,0), (-1,-1), 0),
                                          ("BOTTOMPADDING", (0,0), (-1,-1), 0)])))
    elems.append(Spacer(1, 0.6*cm))
    elems.append(Paragraph("MANUAL DE USUARIO", styles["cover_title"]))
    elems.append(Spacer(1, 0.3*cm))
    elems.append(Paragraph("Sistema de Planificación de Maestranza", styles["cover_sub"]))
    elems.append(Paragraph("ETP Spa — Plataforma Digital de Gestión de Producción", styles["cover_sub"]))
    elems.append(Spacer(1, 0.6*cm))
    elems.append(Table([[""]], colWidths=[16*cm], rowHeights=[0.3*cm],
                        style=TableStyle([("BACKGROUND", (0,0), (-1,-1), C_ZINC700),
                                          ("TOPPADDING", (0,0), (-1,-1), 0),
                                          ("BOTTOMPADDING", (0,0), (-1,-1), 0)])))
    elems.append(Spacer(1, 1.5*cm))
    meta = [
        ("Versión", "1.0"),
        ("Fecha de emisión", "Junio 2026"),
        ("Destinatario", "Equipo Operativo y de Gestión — ETP Spa"),
        ("Clasificación", "Confidencial — Uso interno"),
    ]
    tdata = [[Paragraph(f"<b><font color='#F59E0B'>{k}</font></b>", styles["cover_meta"]),
              Paragraph(v, styles["cover_meta"])] for k, v in meta]
    t = Table(tdata, colWidths=[5*cm, 11*cm],
              style=TableStyle([
                  ("TOPPADDING", (0,0), (-1,-1), 5),
                  ("BOTTOMPADDING", (0,0), (-1,-1), 5),
                  ("LEFTPADDING", (0,0), (-1,-1), 0),
                  ("RIGHTPADDING", (0,0), (-1,-1), 0),
                  ("ALIGN", (0,0), (-1,-1), "LEFT"),
                  ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
              ]))
    elems.append(t)
    elems.append(PageBreak())
    return elems


# ── Parse markdown into flowables ──────────────────────────────────────────
def parse_md(text: str, styles: dict) -> list:
    lines = text.splitlines()
    elems = []
    i = 0
    in_code = False
    code_buf = []
    in_table = False
    table_rows = []

    def flush_table():
        nonlocal in_table, table_rows
        if not table_rows:
            in_table = False
            return
        # First row = header, skip separator rows (---|---)
        header = table_rows[0]
        data_rows = [r for r in table_rows[1:] if not all(
            re.match(r"^[-:]+$", c.strip()) for c in r)]
        all_rows = [header] + data_rows

        # Build paragraph cells
        def cell(txt, is_header=False):
            style_name = "h4" if is_header else "normal"
            s = ParagraphStyle("tc", parent=styles[style_name],
                               fontSize=8.5, leading=12,
                               spaceAfter=0, spaceBefore=0,
                               alignment=TA_LEFT)
            return Paragraph(inline(txt.strip()), s)

        pdf_rows = []
        for ri, row in enumerate(all_rows):
            pdf_rows.append([cell(c, is_header=(ri == 0)) for c in row])

        # Auto column widths
        ncols = max(len(r) for r in pdf_rows)
        available = 16 * cm
        col_w = [available / ncols] * ncols

        t = Table(pdf_rows, colWidths=col_w, repeatRows=1)
        t.setStyle(make_table_style(len(pdf_rows)))
        elems.append(Spacer(1, 0.2*cm))
        elems.append(t)
        elems.append(Spacer(1, 0.3*cm))
        table_rows = []
        in_table = False

    while i < len(lines):
        line = lines[i]

        # Code block
        if line.strip().startswith("```"):
            if in_code:
                # End code block
                code_text = "\n".join(code_buf)
                # Split into lines for the paragraph
                for cl in code_buf:
                    elems.append(Paragraph(cl.replace(" ", "&nbsp;") or "&nbsp;",
                                           styles["code"]))
                code_buf = []
                in_code = False
            else:
                in_code = True
                if in_table:
                    flush_table()
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # Horizontal rule
        if re.match(r"^---+\s*$", line):
            if in_table:
                flush_table()
            i += 1
            continue

        # Empty line
        if not line.strip():
            if in_table:
                flush_table()
            i += 1
            continue

        # Table row
        if line.strip().startswith("|"):
            cols = [c for c in line.strip().split("|") if c != ""]
            if all(re.match(r"^[-: ]+$", c) for c in cols):
                # separator row — skip
                i += 1
                in_table = True
                continue
            in_table = True
            table_rows.append(cols)
            i += 1
            continue
        else:
            if in_table:
                flush_table()

        # H1
        if line.startswith("# ") and not line.startswith("## "):
            elems.append(Paragraph(inline(line[2:].strip()), styles["h1"]))
            i += 1
            continue

        # H2
        if line.startswith("## ") and not line.startswith("### "):
            text_val = line[3:].strip()
            # Skip TOC lines (contain links)
            if "[" not in text_val:
                elems.append(Spacer(1, 0.3*cm))
                elems.append(HRFlowable(width="100%", thickness=1,
                                        color=C_ZINC700, spaceAfter=4))
                elems.append(Paragraph(inline(text_val), styles["h2"]))
            i += 1
            continue

        # H3
        if line.startswith("### ") and not line.startswith("#### "):
            elems.append(Paragraph(inline(line[4:].strip()), styles["h3"]))
            i += 1
            continue

        # H4
        if line.startswith("#### "):
            elems.append(Paragraph(inline(line[5:].strip()), styles["h4"]))
            i += 1
            continue

        # Blockquote
        if line.startswith("> "):
            content = line[2:].strip()
            if content.startswith("⚠️") or content.startswith("**Atención") or "Atención" in content:
                st = styles["warn"]
            elif content.startswith("💡") or content.startswith("*"):
                st = styles["tip"]
            else:
                st = styles["note"]
            # Strip leading emoji for cleaner render
            content = re.sub(r"^[⚠️💡]\s*", "", content)
            elems.append(Paragraph(inline(content), st))
            i += 1
            continue

        # Unordered list
        if re.match(r"^[-*]\s+", line):
            content = re.sub(r"^[-*]\s+", "", line).strip()
            p = Paragraph(f"• &nbsp;{inline(content)}", styles["bullet"])
            elems.append(p)
            i += 1
            continue

        # Numbered list
        if re.match(r"^\d+\.\s+", line):
            m = re.match(r"^(\d+)\.\s+(.*)", line)
            num, content = m.group(1), m.group(2)
            p = Paragraph(f"<b>{num}.</b>&nbsp;{inline(content)}", styles["numbered"])
            elems.append(p)
            i += 1
            continue

        # Bold-only line (FAQ question style)
        if re.match(r"^\*\*\d+\.", line) or re.match(r"^\*\*[A-Z]", line):
            elems.append(Spacer(1, 0.15*cm))
            elems.append(Paragraph(inline(line.strip()), styles["h3"]))
            i += 1
            continue

        # Normal paragraph
        elems.append(Paragraph(inline(line.strip()), styles["normal"]))
        i += 1

    if in_table:
        flush_table()

    return elems


# ── Build TOC (static) ─────────────────────────────────────────────────────
TOC_ENTRIES = [
    ("1", "Introducción"),
    ("2", "Flujo General de Trabajo"),
    ("3", "Sección \"Nuevo Registro\""),
    ("4", "Sección \"Historial de Planificación\""),
    ("5", "Gestión de Prioridades"),
    ("6", "Gestión de Atrasos — Buffer"),
    ("7", "Días Especiales de Trabajo"),
    ("8", "Motor de Planificación"),
    ("9", "Resultados de la Planificación"),
    ("10", "Descarga Excel"),
    ("11", "Buenas Prácticas"),
    ("12", "Limitaciones y Consideraciones"),
    ("13", "Preguntas Frecuentes"),
    ("14", "Conclusiones"),
]

def build_toc(styles):
    elems = []
    elems.append(Paragraph("ÍNDICE DE CONTENIDOS", styles["h2"]))
    elems.append(HRFlowable(width="100%", thickness=1, color=C_ZINC700, spaceAfter=8))
    elems.append(Spacer(1, 0.3*cm))
    for num, title in TOC_ENTRIES:
        row = Table(
            [[Paragraph(f"<b><font color='#F59E0B'>{num}.</font></b>  {inline(title)}",
                        styles["toc_h1"]),
              Paragraph(f"<font color='#71717A'>{'·' * 40}</font>", styles["toc_h2"])]],
            colWidths=[12*cm, 4*cm],
            style=TableStyle([
                ("LEFTPADDING", (0,0), (-1,-1), 0),
                ("RIGHTPADDING", (0,0), (-1,-1), 0),
                ("TOPPADDING", (0,0), (-1,-1), 2),
                ("BOTTOMPADDING", (0,0), (-1,-1), 2),
                ("VALIGN", (0,0), (-1,-1), "BOTTOM"),
            ])
        )
        elems.append(row)
    elems.append(PageBreak())
    return elems


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    styles = build_styles()

    doc = SimpleDocTemplate(
        str(PDF_FILE),
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=1.8*cm, bottomMargin=1.5*cm,
        title="Manual de Usuario — Sistema de Planificación ETP Spa",
        author="ETP Spa",
        subject="Manual de Usuario v1.0",
    )

    story = []
    story += build_cover(styles)
    story += build_toc(styles)

    md_text = MD_FILE.read_text(encoding="utf-8")
    # Skip the YAML front-matter / cover block at the top
    md_text = re.sub(r"^---\s*\n.*?---\s*\n", "", md_text, flags=re.DOTALL)
    # Skip the index block (## ÍNDICE … ---)
    md_text = re.sub(r"## ÍNDICE.*?---\s*\n---\s*\n", "", md_text, flags=re.DOTALL)

    story += parse_md(md_text, styles)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF generado: {PDF_FILE}")


if __name__ == "__main__":
    main()
