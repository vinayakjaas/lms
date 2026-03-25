import os
import uuid
from datetime import date
from io import BytesIO
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import qrcode
from app.config import settings


def generate_qr_code(data: str) -> BytesIO:
    """Generate a QR code image from data."""
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


async def generate_certificate_pdf(
    student_name: str,
    course_name: str,
    semester: str,
    college_name: str,
    roll_number: str,
    reg_number: str,
    internship_title: str,
    duration: str,
    grade: str,
    certificate_id: str,
    issue_date: date,
) -> str:
    """Generate a professional certificate PDF and return the file URL (R2 or local)."""
    # We generate to a BytesIO buffer so we can upload to R2 if enabled.
    cert_buffer = BytesIO()
    filename = f"{certificate_id}.pdf"
    
    # Create landscape A4 PDF
    width, height = landscape(A4)
    c = canvas.Canvas(cert_buffer, pagesize=landscape(A4))
    
    # Background
    c.setFillColor(HexColor("#FAFBFF"))
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Decorative border
    c.setStrokeColor(HexColor("#4F46E5"))
    c.setLineWidth(3)
    c.rect(20, 20, width - 40, height - 40, fill=False, stroke=True)
    
    c.setStrokeColor(HexColor("#7C3AED"))
    c.setLineWidth(1)
    c.rect(30, 30, width - 60, height - 60, fill=False, stroke=True)
    
    # Top decorative line
    c.setFillColor(HexColor("#4F46E5"))
    c.rect(30, height - 45, width - 60, 15, fill=True, stroke=False)
    c.setFillColor(HexColor("#7C3AED"))
    c.rect(30, height - 50, width - 60, 5, fill=True, stroke=False)
    
    # Bottom decorative line
    c.setFillColor(HexColor("#4F46E5"))
    c.rect(30, 30, width - 60, 15, fill=True, stroke=False)
    c.setFillColor(HexColor("#7C3AED"))
    c.rect(30, 45, width - 60, 5, fill=True, stroke=False)
    
    # Organizations
    c.setFillColor(HexColor("#374151"))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, height - 80, "TADRI (Training and Development Research Institute)")
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 95, "& AIC Bihar Vidyapeet")
    
    # Title
    c.setFillColor(HexColor("#4F46E5"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height - 140, "CERTIFICATE OF COMPLETION")
    
    # Subtitle
    c.setFillColor(HexColor("#6B7280"))
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 165, "All India Undergraduate Internship Program (AIUGIP)")
    
    # Divider
    c.setStrokeColor(HexColor("#E5E7EB"))
    c.setLineWidth(1)
    c.line(width / 2 - 150, height - 180, width / 2 + 150, height - 180)
    
    # Body text
    c.setFillColor(HexColor("#374151"))
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2, height - 210, "This is to certify that")
    
    # Student name
    c.setFillColor(HexColor("#1F2937"))
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 240, student_name)
    
    # Underline for name
    name_width = c.stringWidth(student_name, "Helvetica-Bold", 22)
    c.setStrokeColor(HexColor("#4F46E5"))
    c.setLineWidth(1.5)
    c.line(width / 2 - name_width / 2 - 10, height - 245, width / 2 + name_width / 2 + 10, height - 245)
    
    # Details
    c.setFillColor(HexColor("#4B5563"))
    c.setFont("Helvetica", 11)
    y_pos = height - 275
    
    details_lines = [
        f"Roll No: {roll_number}  |  Reg. No: {reg_number}",
        f"College: {college_name}",
        f"Course: {course_name}  |  Semester: {semester}",
        f"",
        f"has successfully completed the internship program",
        f'"{internship_title}"',
        f"Duration: {duration}",
    ]
    
    for line in details_lines:
        if line.startswith('"'):
            c.setFont("Helvetica-Bold", 12)
            c.setFillColor(HexColor("#4F46E5"))
        else:
            c.setFont("Helvetica", 11)
            c.setFillColor(HexColor("#4B5563"))
        c.drawCentredString(width / 2, y_pos, line)
        y_pos -= 18
    
    # Grade box
    y_pos -= 10
    grade_box_x = width / 2 - 60
    c.setFillColor(HexColor("#EEF2FF"))
    c.roundRect(grade_box_x, y_pos - 10, 120, 35, 5, fill=True, stroke=False)
    c.setFillColor(HexColor("#4F46E5"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y_pos, f"Grade: {grade}")
    
    # QR Code
    verify_url = f"{settings.BASE_URL}/api/certificates/{certificate_id}/verify"
    qr_buffer = generate_qr_code(verify_url)
    qr_image = ImageReader(qr_buffer)
    c.drawImage(qr_image, width - 150, 60, width=80, height=80)
    c.setFillColor(HexColor("#9CA3AF"))
    c.setFont("Helvetica", 7)
    c.drawCentredString(width - 110, 55, "Scan to Verify")
    
    # Certificate ID
    c.setFillColor(HexColor("#9CA3AF"))
    c.setFont("Helvetica", 8)
    c.drawString(50, 75, f"Certificate ID: {certificate_id}")
    c.drawString(50, 62, f"Issue Date: {issue_date.strftime('%d %B %Y')}")
    
    # Signatures
    sig_y = 105
    c.setStrokeColor(HexColor("#9CA3AF"))
    c.setLineWidth(0.5)
    
    # Left signature
    c.line(120, sig_y, 300, sig_y)
    c.setFillColor(HexColor("#374151"))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(210, sig_y - 15, "TADRI")
    c.setFont("Helvetica", 8)
    c.drawCentredString(210, sig_y - 28, "Training & Development Research Institute")
    
    # Right signature
    c.line(width - 300, sig_y, width - 120, sig_y)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width - 210, sig_y - 15, "AIC Bihar Vidyapeet")
    c.setFont("Helvetica", 8)
    c.drawCentredString(width - 210, sig_y - 28, "Akhil Bharatiya Internship Council")
    
    c.save()

    # Upload to R2 if enabled, otherwise save locally
    from app.services.r2_storage import is_r2_enabled, upload_file as r2_upload

    pdf_bytes = cert_buffer.getvalue()

    if is_r2_enabled():
        url = await r2_upload(
            file_contents=pdf_bytes,
            original_filename=filename,
            prefix="certificates",
            content_type="application/pdf",
        )
        return url
    else:
        cert_dir = settings.CERTIFICATE_DIR
        os.makedirs(cert_dir, exist_ok=True)
        filepath = os.path.join(cert_dir, filename)
        with open(filepath, "wb") as f:
            f.write(pdf_bytes)
        return f"/uploads/certificates/{filename}"


def generate_certificate_id() -> str:
    """Generate a unique certificate ID."""
    return f"AIUGIP-{uuid.uuid4().hex[:8].upper()}-{date.today().strftime('%Y')}"
