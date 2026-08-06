#!/usr/bin/env python3
"""
Regenerates every app icon from the one source mark.

The icons in public/ were hand-cropped once and drifted: each had been zoomed
into the middle of the mark until the rounded tile was cropped away entirely
and the S bled off all four edges, and each had been flattened onto a
different background - one grey, one near-white, two dark. A favicon is not
something anyone looks at closely enough to catch that, so it stayed broken.

Deriving all of them from source here means the next change is a re-run rather
than four separate crops that can disagree again.

Usage:  python3 scripts/generate-icons.py
Requires Pillow.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "frontend" / "public"
SOURCE = PUBLIC / "sokin-icon.png"

# The app's dark surface. Icons that cannot carry transparency sit on this
# rather than on whatever the platform picks, which is usually black.
BRAND_DARK = (26, 26, 26, 255)


def load_mark() -> Image.Image:
    """The source with its transparent margin removed, so padding is ours to set."""
    mark = Image.open(SOURCE).convert("RGBA")
    bbox = mark.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit(f"{SOURCE} is fully transparent - nothing to generate from")
    return mark.crop(bbox)


def render(mark: Image.Image, size: int, coverage: float, background) -> Image.Image:
    """
    Fit the mark into a square canvas at `coverage` of its width.

    Aspect ratio is preserved: the source is 383x376, and stretching it to
    square is exactly the kind of thing that goes unnoticed at 32px and looks
    wrong at 512.
    """
    canvas = Image.new("RGBA", (size, size), background)

    target = max(1, int(round(size * coverage)))
    scale = min(target / mark.width, target / mark.height)
    scaled = mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.LANCZOS,
    )

    canvas.alpha_composite(
        scaled,
        ((size - scaled.width) // 2, (size - scaled.height) // 2),
    )
    return canvas


# Every icon gets an opaque plate rather than a transparent one. The mark is a
# light tile with the S knocked out of it, so on transparency it is invisible
# against any light surface - which is exactly what a browser tab is in light
# mode. The plate is the app's own dark surface, so the icon reads the same in
# a light tab, a dark tab, and on a home screen.
#
# coverage: how much of the canvas width the mark spans.
#   A tab favicon is never cropped, so the mark can sit close to the edge.
#   `maskable` icons are cropped to an OS-chosen shape and must keep their
#   content inside the central 80% safe zone; 0.66 leaves room for a circle
#   mask, which is the most aggressive one in use.
#   iOS applies its own squircle and discards alpha entirely.
TARGETS = [
    ("favicon.png", 32, 0.92, BRAND_DARK),
    ("icon-192.png", 192, 0.86, BRAND_DARK),
    ("icon-512.png", 512, 0.86, BRAND_DARK),
    # 0.64, not 0.66: at 0.66 the mark's widest point measures 205.3px from
    # centre against a 204.8px safe radius, so a circular mask would shave it.
    ("icon-maskable-512.png", 512, 0.64, BRAND_DARK),
    ("apple-touch-icon.png", 180, 0.78, BRAND_DARK),
]


def main() -> None:
    mark = load_mark()
    print(f"source mark: {mark.width}x{mark.height} (trimmed from {SOURCE.name})")

    for name, size, coverage, background in TARGETS:
        out = PUBLIC / name
        render(mark, size, coverage, background).save(out, "PNG", optimize=True)
        opaque = background[3] == 255
        print(f"  {name:24s} {size}x{size}  coverage={coverage:.2f}  "
              f"{'opaque ' + ('#%02x%02x%02x' % background[:3]) if opaque else 'transparent'}")


if __name__ == "__main__":
    main()
