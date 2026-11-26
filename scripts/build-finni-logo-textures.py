"""Apply the existing Finni wordmark to the spinner plates and scoop sign."""
import argparse
from io import BytesIO
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/pydeps'))
from PIL import Image, ImageDraw
import resvg_py

LOGO = ROOT / 'assets/finni/originals/finni-logo.svg'


def place_logo(texture, logo, center, width, flip=False):
    # Preserve the supplied SVG's aspect ratio when fitting each face.
    mark = logo.resize((width, round(width * logo.height / logo.width)), Image.Resampling.LANCZOS)
    if flip:
        mark = mark.transpose(Image.Transpose.ROTATE_180)
    texture.alpha_composite(mark, (round(center[0] - mark.width / 2), round(center[1] - mark.height / 2)))


def install(table):
    logo = Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=LOGO.read_text(), width=640))).convert('RGBA')
    for name in ('spinner', 'spinnerw', 'hellhouse'):
        path = next((table / 'images').glob(name + '.*'))
        with Image.open(path) as source:
            width, height = source.size
        if name == 'hellhouse':
            texture = Image.new('RGBA', (width, height), 'white')
            place_logo(texture, logo, (width / 2, height / 2), round(width * .82))
        else:
            texture = Image.new('RGBA', (width, height), '#ed762f')
            # VPX maps the plate faces into the upper and lower halves of the
            # atlas. The lower face turns 180 degrees as it faces the player.
            ImageDraw.Draw(texture).rectangle((round(width * .17), 0, round(width * .83), height - 1), fill='white')
            place_logo(texture, logo, (width / 2, height / 4), round(width * .53))
            place_logo(texture, logo, (width / 2, height * 3 / 4), round(width * .53), flip=True)
        texture.convert('RGB').save(path, lossless=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('table', type=Path, help='Extracted VPX table directory')
    install(parser.parse_args().table)
