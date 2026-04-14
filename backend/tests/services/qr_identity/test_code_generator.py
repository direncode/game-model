import re
import base64
from app.services.qr_identity.code_generator import generate_code, generate_qr_image


def test_generate_code_format():
    code = generate_code()
    assert re.match(r"^[A-Z0-9]{4}-[A-Z0-9]{4}$", code)


def test_generate_code_uniqueness():
    codes = {generate_code() for _ in range(100)}
    assert len(codes) == 100


def test_generate_qr_image_returns_base64_png():
    url = "https://example.com/qr/ABCD-1234"
    img_b64 = generate_qr_image(url)
    raw = base64.b64decode(img_b64)
    assert raw[:4] == b"\x89PNG"
