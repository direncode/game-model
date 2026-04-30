"""Capture screenshots of www.latentocean.com pages for the pitch deck."""
import sys
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

# avoid console encoding errors on Windows
sys.stdout.reconfigure(encoding="utf-8")

OUT = Path("scripts/site_shots")
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("home", "https://www.latentocean.com/"),
    ("platform", "https://www.latentocean.com/platform"),
    ("titan", "https://www.latentocean.com/titan"),
    ("live", "https://www.latentocean.com/live"),
]

VIEWPORT = {"width": 1600, "height": 1000}


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)

        for name, url in PAGES:
            page = await ctx.new_page()
            print(f"navigating {url}")
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as e:
                print(f"  load issue (continuing): {e}")
            await page.wait_for_timeout(2000)

            full = OUT / f"{name}_full.png"
            hero = OUT / f"{name}_hero.png"
            await page.screenshot(path=str(full), full_page=True)
            await page.screenshot(path=str(hero), full_page=False)
            print(f"  saved {full.name} ({full.stat().st_size // 1024} KB)")
            print(f"  saved {hero.name} ({hero.stat().st_size // 1024} KB)")

            meta = await page.evaluate(
                "() => ({"
                "  title: document.title,"
                "  h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()),"
                "  h2: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()).slice(0,8)"
                "})"
            )
            print(f"  title: {meta['title']!r}")
            print(f"  h1: {meta['h1']}")
            print(f"  h2: {meta['h2']}")

            await page.close()

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
