"""Generate QR code and crop screenshots for the pitch deck."""
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from PIL import Image

OUT = Path("scripts/site_shots")
OUT.mkdir(parents=True, exist_ok=True)

# ── QR code ──
qr = qrcode.QRCode(
    version=2,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=20,
    border=2,
)
qr.add_data("https://www.latentocean.com")
qr.make(fit=True)
img = qr.make_image(fill_color="#1E3A5F", back_color="#FDFCF8")
qr_path = OUT / "qr_latentocean.png"
img.save(qr_path)
print(f"QR: {qr_path} ({qr_path.stat().st_size // 1024} KB, {img.size})")

# ── Crop screenshots to drop the page header (nav bar) and focus on content ──
# Each hero is 1600x1000 at 2x device scale = effective 3200x2000 image
def crop(name, top_pct=0.06, bottom_pct=1.0):
    src = OUT / f"{name}_hero.png"
    if not src.exists():
        print(f"  skip {name}: not found")
        return
    im = Image.open(src)
    w, h = im.size
    box = (0, int(h * top_pct), w, int(h * bottom_pct))
    cropped = im.crop(box)
    dst = OUT / f"{name}_cropped.png"
    cropped.save(dst)
    print(f"  {name}: {im.size} -> {cropped.size}, saved {dst.name}")

print("\nCropping (drop top nav strip):")
crop("titan", top_pct=0.06)
crop("live", top_pct=0.06)
crop("home", top_pct=0.06)
crop("platform", top_pct=0.06)
