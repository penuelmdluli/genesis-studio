"""Draw analysis markers (TV telestration) as a transparent 1080x1920 PNG.

usage: python scripts/genesis_annotate.py <job.json> <out.png>

job.json:
  {"box": [x0, y0, w, h],            # where the footage sits in the reel (pixels)
   "marks": [                         # positions are fractions of the FOOTAGE box
     {"type": "ring",  "x": .4, "y": .7, "label": "No.10", "color": "gold"},
     {"type": "arrow", "x1": .3, "y1": .6, "x2": .6, "y2": .4, "label": "THE RUN", "dashed": true},
     {"type": "pass",  "x1": .2, "y1": .7, "x2": .5, "y2": .5},
     {"type": "zone",  "x": .5, "y": .3, "w": .2, "h": .2, "label": "SPACE"}
   ]}

Style: the broadcast look — a flattened ring under the player's feet with a
glow, bold arrows for runs (dashed) and passes (solid), a translucent zone
for space, each with a small label pill. Rendered at 2x and downsampled for
smooth edges.
"""

import json
import math
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, S = 1080, 1920, 2  # S = supersampling
COLORS = {"gold": (255, 200, 61), "cyan": (0, 220, 255), "red": (255, 70, 70), "white": (255, 255, 255), "green": (80, 255, 120)}


def font(px: int):
    for f in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/seguisb.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            pass
    return ImageFont.load_default()


def pill(d: ImageDraw.ImageDraw, x: float, y: float, text: str, color):
    if not text:
        return
    f = font(30 * S)
    tw = d.textlength(text, font=f)
    pad = 14 * S
    x0, y0 = x - tw / 2 - pad, y - 26 * S
    x0 = min(max(x0, 8 * S), W * S - tw - 2 * pad - 8 * S)
    d.rounded_rectangle([x0, y0, x0 + tw + 2 * pad, y0 + 52 * S], radius=26 * S, fill=(0, 0, 0, 200), outline=color + (255,), width=3 * S)
    d.text((x0 + pad, y0 + 8 * S), text, font=f, fill=color + (255,))


def arrow(d: ImageDraw.ImageDraw, p1, p2, color, dashed: bool):
    w = 9 * S
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    L = math.hypot(dx, dy) or 1
    ux, uy = dx / L, dy / L
    head = 34 * S
    end = (p2[0] - ux * head * 0.8, p2[1] - uy * head * 0.8)
    if dashed:
        seg, gap, t = 26 * S, 16 * S, 0.0
        tot = math.hypot(end[0] - p1[0], end[1] - p1[1])
        while t < tot:
            a = (p1[0] + ux * t, p1[1] + uy * t)
            t2 = min(t + seg, tot)
            b = (p1[0] + ux * t2, p1[1] + uy * t2)
            d.line([a, b], fill=color + (255,), width=w)
            t += seg + gap
    else:
        d.line([p1, end], fill=color + (255,), width=w)
    left = (p2[0] - ux * head - uy * head * 0.55, p2[1] - uy * head + ux * head * 0.55)
    right = (p2[0] - ux * head + uy * head * 0.55, p2[1] - uy * head - ux * head * 0.55)
    d.polygon([p2, left, right], fill=color + (255,))


def main() -> None:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    bx, by, bw, bh = job["box"]
    pt = lambda fx, fy: ((bx + fx * bw) * S, (by + fy * bh) * S)
    glow = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    g, d = ImageDraw.Draw(glow), ImageDraw.Draw(img)
    labels = []
    for m in job.get("marks", []):
        color = COLORS.get(m.get("color", ""), COLORS["gold"] if m["type"] == "ring" else COLORS["cyan"])
        t = m["type"]
        if t == "ring":
            x, y = pt(m["x"], m["y"])
            rx, ry = 46 * S, 17 * S  # flattened: a ring on the grass under the feet
            for dd in (g, d):
                dd.ellipse([x - rx, y - ry, x + rx, y + ry], outline=color + (255,), width=(16 if dd is g else 7) * S)
            d.line([(x, y - ry), (x, y - 120 * S)], fill=color + (230,), width=4 * S)
            labels.append((x, y - 140 * S, m.get("label", ""), color))
        elif t in ("arrow", "pass"):
            p1, p2 = pt(m["x1"], m["y1"]), pt(m["x2"], m["y2"])
            arrow(g, p1, p2, color, False)
            arrow(d, p1, p2, color if t == "arrow" else COLORS["white"], m.get("dashed", t == "arrow"))
            labels.append(((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 - 40 * S, m.get("label", ""), color))
        elif t == "zone":
            x, y = pt(m["x"], m["y"])
            x2, y2 = pt(m["x"] + m["w"], m["y"] + m["h"])
            d.rectangle([x, y, x2, y2], fill=color + (60,), outline=color + (230,), width=5 * S)
            labels.append(((x + x2) / 2, y - 30 * S, m.get("label", ""), color))
    glow = glow.filter(ImageFilter.GaussianBlur(10 * S))
    out = Image.alpha_composite(glow, img)
    dl = ImageDraw.Draw(out)
    placed: list[tuple[float, float]] = []
    for x, y, text, color in labels:
        # Nudge a label up until it clears the ones already placed.
        while any(abs(x - px) < 300 * S and abs(y - py) < 60 * S for px, py in placed):
            y -= 62 * S
        placed.append((x, y))
        pill(dl, x, y, str(text).upper()[:22], color)
    out.resize((W, H), Image.LANCZOS).save(sys.argv[2])
    print("ok")


if __name__ == "__main__":
    main()
