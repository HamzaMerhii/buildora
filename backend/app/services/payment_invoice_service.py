"""On-demand PDF generation for payment invoices.

Builds an A4 payment invoice in the Buildora visual language (navy +
amber on pale blue-gray cards) purely from already-validated database
entities. No invoice table, no persistence, no currency: amounts render
as plain numbers with two decimals.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Optional
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas


NAVY = HexColor("#1B2A4A")
AMBER = HexColor("#D97706")
MUTED = HexColor("#5B6B7F")
RULE = HexColor("#DBE2EC")
PANEL_BG = HexColor("#EEF3F8")
WHITE = HexColor("#FFFFFF")

PAGE_MARGIN = 18 * mm
CARD_RADIUS = 4 * mm
CARD_PAD = 5 * mm


@dataclass
class InvoiceCompany:
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None


@dataclass
class InvoiceProject:
    name: str
    location: Optional[str] = None


@dataclass
class InvoiceParty:
    name: str
    type_label: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


@dataclass
class InvoicePaymentData:
    reference: Optional[str]
    short_id: str
    payment_date: date
    category_name: Optional[str]
    amount: Decimal
    description: Optional[str]
    created_by_name: Optional[str]
    created_at: Optional[datetime]


def _clean(value: Optional[object]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _text(value: Optional[object], fallback: str = "—") -> str:
    return _clean(value) or fallback


def _amount(value: Decimal) -> str:
    return f"{value:,.2f}"


def _fetch_logo(url: str) -> Optional[BytesIO]:
    """Best-effort logo fetch. Any failure returns None (logo omitted)."""
    try:
        request = Request(url, headers={"User-Agent": "BuildoraInvoice/1.0"})
        with urlopen(request, timeout=5) as response:
            content_type = response.headers.get_content_type()
            if content_type not in ("image/png", "image/jpeg", "image/webp"):
                return None
            data = response.read(2 * 1024 * 1024)
            if not data:
                return None
            return BytesIO(data)
    except Exception:
        return None


class InvoiceCanvas:
    """Card-based invoice renderer with a guarded vertical cursor."""

    def __init__(self) -> None:
        self.buffer = BytesIO()
        self.canvas = Canvas(self.buffer, pagesize=A4)
        self.width, self.height = A4
        self.y = self.height - PAGE_MARGIN

    def _check(self, needed: float) -> None:
        if self.y - needed < PAGE_MARGIN + 12 * mm:
            self.canvas.showPage()
            self.y = self.height - PAGE_MARGIN

    def gap(self, amount_mm: float) -> None:
        self.y -= amount_mm * mm

    def card(self, x: float, width: float, height: float, fill=PANEL_BG) -> float:
        """Draw a rounded card; returns its top content Y."""
        self._check(height + 4 * mm)
        top = self.y
        self.canvas.setFillColor(fill)
        self.canvas.setStrokeColor(RULE)
        self.canvas.setLineWidth(0.5)
        self.canvas.roundRect(x, top - height, width, height, CARD_RADIUS, stroke=1, fill=1)
        return top - CARD_PAD

    def label(self, text: str, x: float, y: float) -> float:
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Helvetica", 7)
        self.canvas.drawString(x, y, text.upper())
        return y - 4 * mm

    def value(self, text: str, x: float, y: float, size: int = 11, bold: bool = True, max_chars: int = 60) -> float:
        self.canvas.setFillColor(NAVY)
        self.canvas.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        self.canvas.drawString(x, y, escape(text)[:max_chars])
        return y - (size * 0.45 * mm + 1.5 * mm)

    def body(self, text: str, x: float, y: float, max_chars: int = 80, lines: int = 8) -> float:
        self.canvas.setFillColor(NAVY)
        self.canvas.setFont("Helvetica", 9)
        for line in text.strip().splitlines()[:lines]:
            self.canvas.drawString(x, y, escape(line.strip())[:max_chars])
            y -= 4.5 * mm
        return y

    def finish(self) -> bytes:
        self.canvas.setStrokeColor(RULE)
        self.canvas.setLineWidth(0.5)
        self.canvas.line(PAGE_MARGIN, 20 * mm, self.width - PAGE_MARGIN, 20 * mm)
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Helvetica", 8)
        self.canvas.drawCentredString(self.width / 2, 15 * mm, "Generated from Buildora")
        self.canvas.showPage()
        self.canvas.save()
        return self.buffer.getvalue()


def _stat_block(doc: InvoiceCanvas, x: float, y: float, width: float, label: str, value: str, value_size: int = 12) -> None:
    doc.canvas.setFillColor(PANEL_BG)
    doc.canvas.setStrokeColor(RULE)
    doc.canvas.setLineWidth(0.5)
    height = 17 * mm
    doc.canvas.roundRect(x, y - height, width, height, CARD_RADIUS, stroke=1, fill=1)
    cx = x + 4 * mm
    cy = y - 4 * mm
    doc.canvas.setFillColor(MUTED)
    doc.canvas.setFont("Helvetica", 7)
    doc.canvas.drawString(cx, cy, label.upper())
    doc.canvas.setFillColor(NAVY)
    doc.canvas.setFont("Helvetica-Bold", value_size)
    doc.canvas.drawString(cx, cy - 5.5 * mm, escape(value)[:32])


def generate_payment_invoice_pdf(
    company: InvoiceCompany,
    project: InvoiceProject,
    party: InvoiceParty,
    payment: InvoicePaymentData,
) -> bytes:
    """Render the invoice PDF in memory and return the raw bytes."""
    doc = InvoiceCanvas()
    canvas = doc.canvas
    width = doc.width
    left = PAGE_MARGIN
    content_width = width - 2 * PAGE_MARGIN

    ref_label = payment.reference or f"PAY-{payment.short_id.upper()}"

    # -- Header: logo + company identity left, title block right. --
    logo = _fetch_logo(company.logo_url) if company.logo_url else None
    text_x = left
    if logo is not None:
        try:
            logo_size = 15 * mm
            canvas.drawImage(logo, left, doc.y - logo_size, width=logo_size, height=logo_size, preserveAspectRatio=True, mask="auto")
            text_x = left + logo_size + 4 * mm
        except Exception:
            pass
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(text_x, doc.y - 6 * mm, escape(company.name)[:48])
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8.5)
    contact = " · ".join(p for p in (_clean(company.email), _clean(company.phone), _clean(company.address)) if p)
    if contact:
        canvas.drawString(text_x, doc.y - 10.5 * mm, escape(contact)[:96])
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 20)
    canvas.drawRightString(width - PAGE_MARGIN, doc.y - 7 * mm, "PAYMENT INVOICE")
    canvas.setStrokeColor(AMBER)
    canvas.setLineWidth(1.2)
    bar_w = 34 * mm
    canvas.line(width - PAGE_MARGIN - bar_w, doc.y - 10.5 * mm, width - PAGE_MARGIN, doc.y - 10.5 * mm)
    doc.y -= 20 * mm

    # -- Summary strip: 4 stat blocks. --
    doc._check(20 * mm)
    stat_w = (content_width - 3 * 3 * mm) / 4
    stats = [
        ("Reference", ref_label, 10),
        ("Payment Date", payment.payment_date.strftime("%b %d, %Y"), 10),
        ("Project", project.name, 10),
        ("Amount", _amount(payment.amount), 13),
    ]
    for i, (label, value, size) in enumerate(stats):
        _stat_block(doc, left + i * (stat_w + 3 * mm), doc.y, stat_w, label, value, size)
    doc.y -= 17 * mm
    doc.gap(3)

    # -- Two-column: Paid To | Payment Details. --
    col_gap = 4 * mm
    col_w = (content_width - col_gap) / 2
    right_x = left + col_w + col_gap

    paid_rows = [("Name", _text(party.name)), ("Type", _text(party.type_label))]
    for label, key in (("Phone", party.phone), ("Email", party.email), ("Address", party.address)):
        cleaned = _clean(key)
        if cleaned:
            paid_rows.append((label, cleaned))
    detail_rows = [
        ("Category", _text(payment.category_name)),
        ("Amount", _amount(payment.amount)),
        ("Reference", ref_label),
    ]
    card_h = max(len(paid_rows), len(detail_rows)) * 9 * mm + 22 * mm
    doc._check(card_h)

    def draw_card(x: float, title: str, rows: list, amount_row: bool = False) -> None:
        top = doc.card(x, col_w, card_h)
        canvas.setFillColor(NAVY)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(x + CARD_PAD, top, title.upper())
        canvas.setStrokeColor(AMBER)
        canvas.setLineWidth(1)
        canvas.line(x + CARD_PAD, top - 2 * mm, x + CARD_PAD + 22 * mm, top - 2 * mm)
        ry = top - 8 * mm
        for label, val in rows:
            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica", 7)
            canvas.drawString(x + CARD_PAD, ry, label.upper())
            canvas.setFillColor(NAVY)
            if amount_row and label == "Amount":
                canvas.setFont("Helvetica-Bold", 14)
            else:
                canvas.setFont("Helvetica-Bold", 10)
            canvas.drawString(x + CARD_PAD, ry - 4.5 * mm, escape(val)[:44])
            ry -= 9 * mm

    draw_card(left, "Paid To", paid_rows)
    draw_card(right_x, "Payment Details", detail_rows, amount_row=True)
    doc.y -= card_h
    doc.gap(4)

    # -- Description inset (only when present). --
    description = _clean(payment.description)
    if description:
        lines = description.splitlines()[:8]
        block_h = 14 * mm + len(lines) * 4.5 * mm
        top = doc.card(left, content_width, block_h)
        canvas.setFillColor(NAVY)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(left + CARD_PAD, top, "DESCRIPTION")
        canvas.setStrokeColor(AMBER)
        canvas.setLineWidth(1)
        canvas.line(left + CARD_PAD, top - 2 * mm, left + CARD_PAD + 22 * mm, top - 2 * mm)
        ry = top - 8 * mm
        canvas.setFillColor(NAVY)
        canvas.setFont("Helvetica", 9)
        for line in lines:
            canvas.drawString(left + CARD_PAD, ry, escape(line.strip())[:95])
            ry -= 4.5 * mm
        doc.y -= block_h
        doc.gap(4)

    # -- Project block. --
    doc._check(24 * mm)
    top = doc.card(left, content_width, 22 * mm)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(left + CARD_PAD, top, "PROJECT")
    canvas.setStrokeColor(AMBER)
    canvas.setLineWidth(1)
    canvas.line(left + CARD_PAD, top - 2 * mm, left + CARD_PAD + 22 * mm, top - 2 * mm)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(left + CARD_PAD, top - 8 * mm, escape(project.name)[:70])
    location = _clean(project.location)
    if location:
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 9)
        canvas.drawString(left + CARD_PAD, top - 13 * mm, escape(location)[:80])
    doc.y -= 22 * mm
    doc.gap(4)

    # -- Record meta (secondary). --
    meta = " · ".join(
        part
        for part in (
            f"Recorded by {payment.created_by_name}" if _clean(payment.created_by_name) else None,
            payment.created_at.strftime("Created %b %d, %Y") if payment.created_at else None,
            f"ID {payment.short_id.upper()}",
        )
        if part
    )
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(left, doc.y, escape(meta)[:120])

    return doc.finish()
