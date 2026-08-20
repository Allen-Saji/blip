"""Generate Blip favicon, apple-touch icon, and OG image in the Notion style."""
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = "/tmp/blip-fonts/extras/ttf"
BLUE = "#0075de"
PAPER = "#f6f5f4"
INK = "#000000"
GRAPHITE = "#615d59"
PEACH = "#f6d5b8"
MARIGOLD = "#ffb110"
CORAL = "#f64932"
SKY = "#62aef0"
MIDNIGHT = "#02093a"
WHITE = "#ffffff"


def blip_mark(draw, cx, cy, r, blue=BLUE):
    """Blue circle with a small white dot, like the nav logo."""
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=blue)
    dot_r = r * 0.28
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=WHITE)


def pill(draw, x, y, w, h, color, radius=None):
    """Rounded pill rectangle."""
    radius = radius if radius is not None else h // 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=color)


def favicon():
    """32x32 favicon as PNG (convert to ico via PIL save)."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # white circle backing
    d.ellipse([2, 2, 62, 62], fill=PAPER)
    # blue circle with white dot
    blip_mark(d, 32, 32, 24)
    img = img.resize((32, 32), Image.LANCZOS)
    img.save("/tmp/blip-favicon.png", format="PNG")
    # save as .ico with multiple sizes
    icon_img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(icon_img)
    d2.ellipse([2, 2, 62, 62], fill=PAPER)
    blip_mark(d2, 32, 32, 24)
    icon_img.save(
        "src/app/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("favicon.ico written")


def apple_touch():
    """180x180 apple-touch-icon with warm paper background."""
    img = Image.new("RGBA", (180, 180), PAPER)
    d = ImageDraw.Draw(img)
    blip_mark(d, 90, 90, 62)
    img.save("src/app/apple-icon.png", format="PNG")
    print("apple-icon.png written")


def og_image():
    """1200x630 OG image, Notion style."""
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # --- decorative character marks row (top right area) ---
    colors = [BLUE, CORAL, MARIGOLD, SKY]
    mark_radius = 22
    for i in range(7):
        cx = 610 + i * 55
        cy = 90
        color = colors[i % 4]
        d.ellipse(
            [cx - mark_radius - 2, cy - mark_radius - 2,
             cx + mark_radius + 2, cy + mark_radius + 2],
            outline=color, width=3, fill=WHITE,
        )
        # simple face: two eyes + smile
        eye_r = 3
        d.ellipse([cx - 9 - eye_r, cy - 8 - eye_r, cx - 9 + eye_r, cy - 8 + eye_r], fill=color)
        d.ellipse([cx + 9 - eye_r, cy - 8 - eye_r, cx + 9 + eye_r, cy - 8 + eye_r], fill=color)
        d.arc([cx - 9, cy - 4, cx + 9, cy + 12], start=20, end=160, fill=color, width=3)

    # --- headline: "You never miss a blip." with peach pill on "blip." ---
    font_display = ImageFont.truetype(f"{FONT_DIR}/Inter-SemiBold.ttf", 88)
    font_sub = ImageFont.truetype(f"{FONT_DIR}/Inter-Regular.ttf", 34)
    font_small = ImageFont.truetype(f"{FONT_DIR}/Inter-SemiBold.ttf", 26)

    text_pre = "You never miss a"
    text_hl = "blip."
    bbox_pre = d.textbbox((0, 0), text_pre, font=font_display)
    bbox_hl = d.textbbox((0, 0), text_hl, font=font_display)

    total_w = (bbox_pre[2] - bbox_pre[0]) + 30 + (bbox_hl[2] - bbox_hl[0])
    x_start = (W - total_w) // 2
    y_text = 300

    # pill behind "blip."
    pill_x = x_start + (bbox_pre[2] - bbox_pre[0]) + 30 - 10
    pill_w = (bbox_hl[2] - bbox_hl[0]) + 20
    pill_h = 104
    pill(d, pill_x, y_text - 8, pill_w, pill_h, PEACH)

    d.text((x_start, y_text), text_pre, font=font_display, fill=INK)
    d.text((pill_x + 10, y_text), text_hl, font=font_display, fill=INK)

    # --- subhead ---
    sub = "Paste any URL. Describe what matters. Get a clean diff when it changes."
    bbox_sub = d.textbbox((0, 0), sub, font=font_sub)
    d.text(((W - (bbox_sub[2] - bbox_sub[0])) // 2, 450), sub, font=font_sub, fill=GRAPHITE)

    # --- small footer: logo mark + wordmark + tagline ---
    mark_cx, mark_cy, mark_r = 70, H - 70, 22
    blip_mark(d, mark_cx, mark_cy, mark_r)
    d.text((110, H - 92), "Blip", font=ImageFont.truetype(f"{FONT_DIR}/Inter-SemiBold.ttf", 40), fill=INK)
    d.text((W - 70 - d.textbbox((0, 0), "Self-healing web scrapers", font=font_small)[2],
            H - 78), "Self-healing web scrapers", font=font_small, fill=GRAPHITE)

    img.convert("RGB").save("src/app/opengraph-image.png", format="PNG")
    print("opengraph-image.png written")


if __name__ == "__main__":
    favicon()
    apple_touch()
    og_image()
