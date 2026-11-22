"""Render the vector favicon into install icons. Requires Pillow and CairoSVG."""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BROWSER = ROOT / 'browser'
OUTPUT = BROWSER / 'icons'


def render(size):
    return Image.open(BytesIO(cairosvg.svg2png(
        url=str(BROWSER / 'favicon.svg'), output_width=size, output_height=size,
    ))).convert('RGBA')


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    master = render(1024)
    for size in (192, 512):
        master.resize((size, size), Image.Resampling.LANCZOS).save(OUTPUT / f'icon-{size}.png')
    master.resize((180, 180), Image.Resampling.LANCZOS).save(OUTPUT / 'apple-touch-icon.png')
    # Keep the complete emblem inside the central safe circle for launcher masks.
    maskable = Image.new('RGBA', (1024, 1024), '#0c102a')
    maskable.alpha_composite(master.resize((640, 640), Image.Resampling.LANCZOS), (192, 192))
    maskable.resize((512, 512), Image.Resampling.LANCZOS).save(OUTPUT / 'icon-maskable-512.png')
    master.save(BROWSER / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == '__main__':
    main()
