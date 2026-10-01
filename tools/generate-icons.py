#!/usr/bin/env python3
"""
Gera os icones PNG da PWA a partir do logo atual do site.

O logo atual (index.html + css/style.css) e':
    .logo    -> 42x42 px, border-radius 12px
                background: linear-gradient(135deg, #e53935, #ff6b6b)
    .logo svg-> 22x22 px, centralizado
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>

Este script apenas reimplementa essas medidas em PNG. Nao inventa um
design novo. A fonte da verdade e' o proprio site: o bloco .logo em
css/style.css e o <svg> do relampago em index.html. Se voce mudar o
logo no CSS/HTML, ajuste as constantes acima e rode o script de novo.

Uso:  python3 tools/generate-icons.py
Requer: Pillow  (pip install Pillow)
"""

import os
import math

try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("Pillow nao encontrado. Instale com: pip3 install Pillow")

# --- Medidas extraidas do CSS/SVG atual do site -------------------------
LOGO_BOX = 42.0          # .logo { width:42px; height:42px }
LOGO_RADIUS = 12.0       # .logo { border-radius:12px }
BOLT_RENDER = 22.0       # .logo svg { width:22px; height:22px }
BOLT_VIEWBOX = 24.0      # <svg viewBox="0 0 24 24">
BOLT_STROKE = 2.0        # stroke-width="2"
GRADIENT_ANGLE = 135.0   # linear-gradient(135deg, ...)
GRADIENT_START = (0xE5, 0x39, 0x35)   # var(--primary)  #e53935
GRADIENT_END = (0xFF, 0x6B, 0x6B)     # #ff6b6b
BOLT_COLOR = (255, 255, 255)         # .logo svg { color: white }
BOLT_POINTS = [(13, 2), (3, 14), (12, 14), (11, 22), (21, 10), (12, 10), (13, 2)]

SS = 4  # supersampling para antialias

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "icons")


def css_gradient(size, angle_deg, start, end):
    """Replica um linear-gradient() do CSS em um array RGBHxW."""
    theta = math.radians(angle_deg)
    dx, dy = math.sin(theta), -math.cos(theta)
    cx = cy = size / 2.0
    length = abs(size * math.sin(theta)) + abs(size * math.cos(theta))

    img = Image.new("RGB", (size, size), start)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = ((x - cx) * dx + (y - cy) * dy) / length + 0.5
            t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
            px[x, y] = (
                int(round(start[0] + (end[0] - start[0]) * t)),
                int(round(start[1] + (end[1] - start[1]) * t)),
                int(round(start[2] + (end[2] - start[2]) * t)),
            )
    return img


def draw_bolt(size, render_px):
    """Desenha o raio de 24x24 na escala pedida, centralizado, em branco."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    scale = render_px / BOLT_VIEWBOX
    offset = (size - render_px) / 2.0
    pts = [(offset + px * scale, offset + py * scale) for px, py in BOLT_POINTS]
    pts.append(pts[0])

    draw.line(pts, fill=BOLT_COLOR + (255,), width=max(1, int(round(BOLT_STROKE * scale))),
              joint="curve")
    for cx, cy in (pts[0], pts[-1]):
        r = BOLT_STROKE * scale / 2.0
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BOLT_COLOR + (255,))
    return layer


def render(size, rounded, bolt_render_px=None):
    hi = size * SS
    base = css_gradient(hi, GRADIENT_ANGLE, GRADIENT_START, GRADIENT_END).convert("RGBA")

    if rounded:
        mask = Image.new("L", (hi, hi), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, hi - 1, hi - 1], radius=LOGO_RADIUS / LOGO_BOX * hi, fill=255
        )
        base.putalpha(mask)

    if bolt_render_px is None:
        bolt_render_px = BOLT_RENDER / LOGO_BOX * size
    base.alpha_composite(draw_bolt(hi, bolt_render_px * SS))
    return base.convert("RGB").resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, True, None),
        ("icon-512.png", 512, True, None),
        ("icon-maskable-192.png", 192, False, 192 * 0.45),
        ("icon-maskable-512.png", 512, False, 512 * 0.45),
        ("apple-touch-icon.png", 180, False, None),
        ("favicon-32.png", 32, True, None),
    ]
    for name, size, rounded, bolt in jobs:
        path = os.path.join(OUT_DIR, name)
        render(size, rounded, bolt).save(path, "PNG", optimize=True)
        print("gerado: icons/%s (%dx%d)" % (name, size, size))


if __name__ == "__main__":
    main()
