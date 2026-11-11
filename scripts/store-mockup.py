"""Composes the store images: transparent cube captures (store/cutouts, from scripts/store-capture.mjs) over anime
backdrops (store/gen, from the Paradise project), each with a headline.
Writes store/promo/screenshot-*.png (1920x1080) and store/feature-1024x500.png.
The `store/` folder is not in the repository (it is git-ignored): `store/gen` holds the backdrops, copied from the Paradise project.
Usage: python scripts/store-mockup.py"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_B = "C:/Windows/Fonts/segoeuib.ttf"
FONT_L = "C:/Windows/Fonts/segoeuil.ttf"


def cover(img, w, h, blur=0):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    img = img.crop((x, y, x + w, y + h))
    return img.filter(ImageFilter.GaussianBlur(blur)) if blur else img


def backdrop(name, w, h, blur=2.5):
    # the portrait pictures are enlarged a lot: a little blur makes them read as a soft wallpaper
    return cover(Image.open(f"store/gen/bg-{name}.png").convert("RGB"), w, h, blur)


def shade(img, box, alpha_a, alpha_b, vertical=True):
    """A soft dark gradient over `box`, so white text stays readable on a bright picture."""
    x0, y0, x1, y1 = box
    n = (y1 - y0) if vertical else (x1 - x0)
    ramp = Image.linear_gradient("L").resize((1, n)) if False else None
    g = Image.new("L", (x1 - x0, y1 - y0))
    px = g.load()
    for i in range(n):
        a = round(alpha_a + (alpha_b - alpha_a) * i / max(1, n - 1))
        for j in range((x1 - x0) if vertical else (y1 - y0)):
            px[(j, i) if vertical else (i, j)] = a
    img.paste(Image.new("RGB", g.size, (6, 8, 20)), (x0, y0), g)


def text(d, xy, s, font, anchor="la", fill="white"):
    d.text((xy[0], xy[1] + 3), s, font=font, fill=(0, 0, 0), anchor=anchor)  # soft drop shadow
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


def font(path, size):
    return ImageFont.truetype(path, size)


def cutout(name, max_w, max_h):
    """The capture cropped to its content, with the faint leftovers of the afterimage removed, scaled to fit."""
    im = Image.open(f"store/cutouts/{name}.png").convert("RGBA")
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < 30 else v)  # 8-bit alpha keeps a faint residue of old frames; drop it
    im = Image.merge("RGBA", (r, g, b, a))
    im = im.crop(im.getbbox())
    s = min(max_w / im.width, max_h / im.height)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def put(base, im, cx, cy, shadow=False):
    x, y = round(cx - im.width / 2), round(cy - im.height / 2)
    if shadow:  # a soft contact shadow under the cube
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse((cx - im.width * 0.36, y + im.height * 0.93, cx + im.width * 0.36, y + im.height * 1.02), fill=(0, 0, 0, 110))
        layer = layer.filter(ImageFilter.GaussianBlur(16))
        base.paste(layer, (0, 0), layer)
    base.paste(im, (x, y), im)


def pill(d, xy, s, f):
    w = d.textlength(s, font=f) + 70
    x, y = xy
    d.rounded_rectangle((x, y, x + w, y + 74), 37, fill=(8, 10, 26, 150), outline=(255, 255, 255, 120), width=2)
    d.text((x + 35, y + 37), s, font=f, fill="white", anchor="lm")
    return w


def headline(img, head, sub, x, y, anchor="la", size=88):
    d = ImageDraw.Draw(img)
    text(d, (x, y), head, font(FONT_B, size), anchor)
    text(d, (x, y + size + 24), sub, font(FONT_L, round(size * 0.46)), anchor)


def save(img, name):
    img.convert("RGB").save(f"store/promo/{name}", optimize=True)
    print("wrote", name)


# 1. a cube on your desktop
img = backdrop("lagoon", W, H)
shade(img, (0, 0, 1000, H), 150, 0, vertical=False)
headline(img, "A cube on your desktop", "A tiny music player that floats like an icon", 110, 380, size=78)
put(img, cutout("wave-1", 840, 900), 1465, 540)
save(img, "screenshot-1-cube.png")

# 2. turn it any way you like
img = backdrop("moon", W, H)
shade(img, (0, 0, W, 330), 140, 0)
headline(img, "Turn it any way you like", "Drag to rotate. Every face is a button.", W // 2, 70, "ma")
for name, label, cx in [("face-play", "Play / pause", 400), ("face-gear", "Settings", 960), ("face-next", "Next track", 1520)]:
    put(img, cutout(name, 420, 480), cx, 610, shadow=True)
    text(ImageDraw.Draw(img), (cx, 905), label, font(FONT, 44), "ma")
save(img, "screenshot-2-rotate.png")

# 3. see your music
img = backdrop("aurora", W, H)
shade(img, (0, 0, W, 330), 140, 0)
headline(img, "See your music", "Bars, a wave, rings, an ocean and sand patterns", W // 2, 70, "ma")
for name, label, cx in [("mode-bars", "Bars", 192), ("wave-1", "Wave", 576), ("mode-rings", "Rings", 960), ("mode-ocean", "Ocean", 1344), ("mode-cymatics-1", "Cymatics", 1728)]:
    put(img, cutout(name, 360, 520), cx, 640)
    text(ImageDraw.Draw(img), (cx, 960), label, font(FONT, 46), "ma")
save(img, "screenshot-3-modes.png")

# 4. make it yours
img = backdrop("sunset", W, H)
shade(img, (0, 0, 1000, H), 150, 0, vertical=False)
headline(img, "Make it yours", "Colours, textures and embossed icons", 110, 120, size=80)
put(img, cutout("wave-2", 920, 720), 560, 700)
put(img, cutout("settings", 640, 960), 1510, 540)
save(img, "screenshot-4-settings.png")

# 5. music from anywhere
img = cover(Image.open("store/gen/bg-wide.png").convert("RGB"), W, H, 1.5)
shade(img, (0, 0, 1000, H), 150, 0, vertical=False)
headline(img, "Music from anywhere", "Pick a folder, a playlist or a YouTube link", 110, 300, size=76)
over = Image.new("RGBA", img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(over)
x = 110
for i, label in enumerate(["Local folder", "Playlist file", "YouTube"]):
    pill(d, (110 + i * 0, 560 + i * 100), label, font(FONT, 36))
img = Image.alpha_composite(img.convert("RGBA"), over)
put(img, cutout("wave-4", 840, 900), 1465, 540)
save(img, "screenshot-5-sources.png")

# 6. sand patterns (cymatics): one big picture and two more patterns
img = backdrop("moon", W, H)
shade(img, (0, 0, 1000, H), 150, 0, vertical=False)
headline(img, "Watch the sound take shape", "Sand gathers into patterns that follow the music", 110, 250, size=70)
put(img, cutout("mode-cymatics-1", 880, 880), 1440, 540)
for name, cx in [("mode-cymatics-3", 290), ("mode-cymatics-4", 640)]:
    put(img, cutout(name, 300, 300), cx, 790)
text(ImageDraw.Draw(img), (465, 985), "A new picture every few seconds", font(FONT, 34), "ma")
save(img, "screenshot-6-cymatics.png")

# Feature graphic 1024x500: title and tagline on the left, two cubes on the right.
FW, FH = 1024, 500
fg = cover(Image.open("store/gen/bg-wide.png").convert("RGB"), FW, FH, 0.5)
shade(fg, (0, 0, 560, FH), 150, 0, vertical=False)
d = ImageDraw.Draw(fg)
text(d, (50, 190), "MusicCube", font(FONT_B, 72), "lm")
text(d, (52, 262), "A tiny music cube", font(FONT_L, 34), "lm")
text(d, (52, 310), "for your desktop", font(FONT_L, 34), "lm")
shade(fg, (440, 0, FW, FH), 0, 110, vertical=False)  # a darker right side: the sand dots are bright
put(fg, cutout("wave-1", 270, 360), 595, 255)
put(fg, cutout("mode-cymatics-1", 330, 330), 860, 255)
fg.convert("RGB").save("store/feature-1024x500.png", optimize=True)
print("wrote feature")
