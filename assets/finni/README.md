# Finni website artwork

Original public website assets collected from https://www.finnihealth.com on November 16, 2026. Files in `originals/` retain their downloaded bytes; filenames have been simplified. `manifest.json` records the exact CDN URLs, discovery pages, file sizes, dimensions where available, and SHA-256 hashes.

The local `website-assets.png` contact sheet and `website-assets.html` layout are reference previews and are excluded from Git. The original artwork and provenance manifest are retained.

## Fox artwork

| File | Website name | Intended use |
| --- | --- | --- |
| `originals/fox-leaning.png` | fox-leaning.png | Main face reference for the Mini Deadpool replacement; smiling fox with both paws visible. |
| `originals/fox-running.avif` | running-fox.avif | Full-body action reference and prominent playfield illustration. |
| `originals/fox-peeking-down.png` | down-fox.png | Full-body pose for upper playfield or ramp-side artwork. |
| `originals/fox-sleeping.png` | sleepy fox.png | Closed-eye pose for quieter supporting illustrations. |
| `originals/fox-background.svg` | client's fox bg.svg | Older, visibly different vector fox; secondary reference. Use the current illustrated mascot as the main character. |

The first four assets share the current orange mascot's dark brown outlines, cream muzzle/chest/tail tip, large ears, and friendly expression. Keep those traits when adapting the fox into a table toy.

## Playfield direction

Feature the fox prominently: use the smiling face for the Mini Deadpool replacement and a large running fox as the main printed playfield illustration. Repeat the other current fox poses in supporting areas. Use flowers, bushes, butterflies, and hill shapes around the edges and beneath hardware so the character remains the focus.

Base the palette on website CSS: orange `#ED762F`, cream `#FBF7F0`, purple `#8272F5`, green `#4DB237`, thistle `#D1BCE7`, and dark slate `#4A3A54`. These are website variables, not a separate official brand guide.

JP Salas's Deadpool 7.0.0 has been downloaded and extracted locally. The table hardware uses its actual geometry and toy pivots. The current playfield also uses a generated, connected party illustration with registered insert windows and separate print/lens layers. See `design/decisions.md` and `design/current-assets.json` for the current direction; the early flat concept is superseded.

## Other collected files

- Scenery: bush, two flower illustrations, butterfly, green hill, orange section divider, resource contours.
- Branding: orange Finni logo and light Finni logo.
- Reference compositions: original home and provider hero images in AVIF format.

Discovery pages: homepage, `/providers`, `/our-providers`, `/careers`, and `/resources`. The legacy fox and color values were found in the site's linked stylesheet.

## Doorbell recording

`audio/doorbell.wav` is an excerpt of Dub’s public-domain household doorbell recording. It was trimmed, filtered, faded and converted to 32 kHz stereo PCM for the table. [Source recording and license](https://commons.wikimedia.org/wiki/File:Doorbell-classic-dingdong.ogg)
