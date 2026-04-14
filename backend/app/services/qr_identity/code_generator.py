"""QR code generation utilities."""

import base64
import io
import secrets
import string

import qrcode  # type: ignore[import-untyped]

_ALPHABET = string.ascii_uppercase + string.digits


def generate_code() -> str:
    """Generate a unique XXXX-XXXX code using cryptographic randomness."""
    left = "".join(secrets.choice(_ALPHABET) for _ in range(4))
    right = "".join(secrets.choice(_ALPHABET) for _ in range(4))
    return f"{left}-{right}"


def generate_qr_image(url: str) -> str:
    """Generate a QR code PNG image as a base64-encoded string."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")
