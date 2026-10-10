#!/usr/bin/env python3
"""Generate synthetic prescription fax fixtures for ScriptLens.

All content is fictional. Images are watermarked SYNTHETIC DEMO.
Created during Get Hired Hack NYC, Oct 10 2026.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)

MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
SANS_I = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

W, H = 1000, 1294
random.seed(42)


def base_page():
    img = Image.new("L", (W, H), 252)
    d = ImageDraw.Draw(img)
    return img, d


def header(d, clinic_line2="Tel (555) 010-0199  Fax (555) 010-0198"):
    f_b = ImageFont.truetype(MONO_B, 26)
    f = ImageFont.truetype(MONO, 20)
    d.text((60, 46), "*** SYNTHETIC DEMO - NOT A VALID PRESCRIPTION ***", font=ImageFont.truetype(MONO_B, 22), fill=60)
    d.text((60, 92), "DEMO FAMILY CLINIC (FICTIONAL)", font=f_b, fill=10)
    d.text((60, 124), "123 Example Ave, Testville, NJ 00000", font=f, fill=10)
    d.text((60, 150), clinic_line2, font=f, fill=10)
    d.line((60, 192, W - 60, 192), fill=10, width=3)
    d.text((60, 206), "FAX TRANSMISSION  -  TO: EXAMPLE PHARMACY (FICTIONAL)", font=f, fill=10)
    d.text((60, 232), "DATE: 10/10/2026    PAGES: 1", font=f, fill=10)
    d.line((60, 272, W - 60, 272), fill=10, width=1)


def body_lines(d, lines, y0=320, size=24, gap=46):
    f = ImageFont.truetype(MONO, size)
    y = y0
    for txt in lines:
        d.text((70, y), txt, font=f, fill=8)
        y += gap
    return y


def footer(d, y, prescriber="Dr. Riley Chen (fictional)", sig=True):
    f = ImageFont.truetype(MONO, 24)
    d.text((70, y + 20), f"PRESCRIBER: {prescriber}", font=f, fill=8)
    d.text((70, y + 66), "NPI: 0000000000 (synthetic)", font=f, fill=8)
    if sig:
        # fake cursive-ish squiggle signature, not a real signature
        sd = ImageDraw.Draw
        pts = []
        x = 420
        for i in range(60):
            pts.append((x + i * 4, y + 150 + 18 * math.sin(i / 3.5) * math.exp(-i / 55)))
        d.line(pts, fill=20, width=3)
        d.text((420, y + 180), "Signature (synthetic)", font=ImageFont.truetype(MONO, 16), fill=90)
    d.text((60, H - 110), "*** TRAINING / TEST ONLY - CONTAINS NO REAL PATIENT DATA ***",
           font=ImageFont.truetype(MONO_B, 20), fill=60)


def watermark(img):
    wm = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(wm)
    f = ImageFont.truetype(SANS_B, 90)
    d.text((140, 520), "SYNTHETIC DEMO", font=f, fill=36)
    wm = wm.rotate(28, resample=Image.BICUBIC)
    return Image.composite(Image.new("L", (W, H), 150), img, wm.point(lambda p: min(p, 60)))


def faxify(img, rot=0.7, blur=0.7, noise=14, drop_lines=True):
    img = img.rotate(rot, resample=Image.BICUBIC, fillcolor=250)
    # downscale/upscale for fax resolution loss
    img = img.resize((W // 2, H // 2), Image.BILINEAR).resize((W, H), Image.BILINEAR)
    img = img.filter(ImageFilter.GaussianBlur(blur))
    px = img.load()
    for _ in range(W * H // noise):
        x, y = random.randrange(W), random.randrange(H)
        px[x, y] = max(0, min(255, px[x, y] + random.randint(-70, 70)))
    if drop_lines:
        d = ImageDraw.Draw(img)
        for ly in random.sample(range(300, H - 200), 3):
            d.line((0, ly, W, ly), fill=235, width=2)
    # threshold-ish contrast like a 1-bit fax, softened
    img = img.point(lambda p: 255 if p > 200 else (0 if p < 90 else p))
    return img.convert("RGB")


def rx_clean():
    img, d = base_page()
    header(d)
    y = body_lines(d, [
        "PATIENT : Avery Morgan (fictional)",
        "DOB     : 01/14/1990 (fictional)",
        "ADDRESS : 45 Sample Rd, Testville, NJ 00000",
        "",
        "Rx",
        "MEDICATION : Lisinopril 10 mg tablet",
        "SIG        : Take 1 tablet by mouth once daily",
        "QUANTITY   : 30",
        "REFILLS    : 0",
    ])
    footer(d, y)
    faxify(watermark(img), rot=0.5, blur=0.6).save(OUT / "rx-clean.png", optimize=True)


def rx_ambiguous():
    img, d = base_page()
    header(d)
    y = body_lines(d, [
        "PATIENT : Jordan Blake (fictional)",
        "DOB     : 06/02/1985 (fictional)",
        "ADDRESS : 9 Placeholder Ln, Testville, NJ 00000",
        "",
        "Rx",
        "MEDICATION : Lisinopril 40 mg tablet",
        "SIG        : Take 1 tablet by mouth once daily",
        "QUANTITY   : 30",
        "REFILLS    : 1",
    ])
    footer(d, y)
    img = watermark(img)
    # Locate strength region ("40 mg" on medication line) and destroy legibility
    # of the NUMBER specifically: heavy blur + toner dropout + scan band.
    # Line y for MEDICATION = 320 + 5*46 = 550; "40" starts ~ x=70+13ch*14.4
    bx0, by0, bx1, by1 = 410, 544, 486, 586
    region = img.crop((bx0, by0, bx1, by1)).filter(ImageFilter.GaussianBlur(5.5))
    img.paste(region, (bx0, by0))
    d2 = ImageDraw.Draw(img)
    d2.line((bx0 - 20, (by0 + by1) // 2, bx1 + 30, (by0 + by1) // 2 - 3), fill=238, width=10)
    d2.line((bx0 - 10, by0 + 6, bx1 + 10, by1 - 8), fill=230, width=5)
    for _ in range(260):
        x, yy = random.randrange(bx0 - 8, bx1 + 8), random.randrange(by0, by1)
        d2.point((x, yy), fill=random.choice([245, 240, 60]))
    faxify(img, rot=0.9, blur=0.9, noise=10).save(OUT / "rx-ambiguous.png", optimize=True)


def rx_conflict():
    img, d = base_page()
    header(d)
    y = body_lines(d, [
        "PATIENT : Sam Rivera (fictional)",
        "DOB     : 11/30/1972 (fictional)",
        "ADDRESS : 2 Mock St, Testville, NJ 00000",
        "",
        "Rx",
        "MEDICATION : Atorvastatin 20 mg tablet",
        "SIG        : Take 1 tablet by mouth once daily",
        "QUANTITY   : 30",
        "REFILLS    : 2",
    ])
    # contradictory handwritten-style margin note
    fi = ImageFont.truetype(SANS_I, 27)
    note = ImageDraw.Draw(img)
    note.text((560, 790), "** corrected: take 2 tablets daily **", font=fi, fill=30)
    note.line((560, 826, 905, 830), fill=40, width=2)
    note.line((548, 782, 548, 836), fill=40, width=2)
    footer(d, y, prescriber="Dr. Casey Lane (fictional)")
    faxify(watermark(img), rot=-0.6, blur=0.7).save(OUT / "rx-conflict.png", optimize=True)


if __name__ == "__main__":
    rx_clean()
    rx_ambiguous()
    rx_conflict()
    for p in sorted(OUT.glob("*.png")):
        print(p.name, p.stat().st_size // 1024, "KB")
