"""Build icons from the approved DMD title-screen Finni artwork. Requires Pillow."""
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BROWSER = ROOT / 'browser'
OUTPUT = BROWSER / 'icons'
SOURCE = ROOT / 'assets/finni/dmd/approved-concepts.png'
BACKGROUND = '#10051d'


def finni():
    # Same first-row character used by the DMD title screen, at source resolution.
    image = Image.open(SOURCE).convert('RGB').crop((238, 6, 548, 196))
    # Separate the connected orange/cream/brown fox from the dark backdrop and
    # disconnected bunting. Fill interior holes to retain the original eyes/mouth.
    pixels = image.load()
    remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                 if pixels[x, y][0] > 60 and pixels[x, y][0] > pixels[x, y][2] * 1.2}
    largest = set()
    while remaining:
        seed = remaining.pop()
        component = {seed}
        pending = deque([seed])
        while pending:
            x, y = pending.popleft()
            for neighbor in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    pending.append(neighbor)
        if len(component) > len(largest):
            largest = component
    mask = Image.new('L', (image.width+2, image.height+2))
    for x, y in largest:
        mask.putpixel((x+1, y+1), 255)
    ImageDraw.floodfill(mask, (0, 0), 128)
    mask = mask.point(lambda value: 0 if value == 128 else 255).crop((1, 1, image.width+1, image.height+1))
    image = image.convert('RGBA')
    image.putalpha(mask)
    return image.crop(mask.getbbox())


def icon(size, fraction=.88):
    result = Image.new('RGBA', (size, size), BACKGROUND)
    art = finni()
    width = round(size*fraction)
    art = art.resize((width, round(width*art.height/art.width)), Image.Resampling.NEAREST)
    result.alpha_composite(art, ((size-art.width)//2, (size-art.height)//2))
    return result


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        icon(size).save(OUTPUT / f'icon-{size}.png')
    icon(180).save(OUTPUT / 'apple-touch-icon.png')
    icon(512, .68).save(OUTPUT / 'icon-maskable-512.png')
    icon(64).save(BROWSER / 'favicon.png')
    icon(48).save(BROWSER / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)],
                  append_images=[icon(16), icon(32)])


if __name__ == '__main__':
    main()
