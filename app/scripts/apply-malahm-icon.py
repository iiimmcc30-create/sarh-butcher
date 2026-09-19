#!/usr/bin/env python3
"""Apply the provided ملاحم سرح icon across Expo, iOS, and Android assets."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_SET = ASSETS / "images" / "iOS" / "AppIcon.appiconset"
SOURCE = ASSETS / "malahm-icon-source.jpg"

# Sampled from the source interior (not the white wave).
BRAND = (88, 35, 41, 255)
BRAND_HEX = "#582329"

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
FG_DENSITIES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
SPLASH_DENSITIES = {
    "drawable-mdpi": 280,
    "drawable-hdpi": 420,
    "drawable-xhdpi": 560,
    "drawable-xxhdpi": 840,
    "drawable-xxxhdpi": 1120,
}


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGBA").save(path, format="PNG", optimize=True)


def main_body_mask(lum: np.ndarray, threshold: float = 18) -> np.ndarray:
    """Keep the centered rounded square; drop isolated sparkles on the black pad."""
    height, width = lum.shape
    seed_y, seed_x = height // 2, width // 2
    if lum[seed_y, seed_x] <= threshold:
        ys, xs = np.where(lum > threshold)
        seed_y, seed_x = int(ys[len(ys) // 2]), int(xs[len(xs) // 2])

    body = np.zeros((height, width), dtype=bool)
    seen = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque([(seed_y, seed_x)])
    seen[seed_y, seed_x] = True
    while queue:
        y, x = queue.popleft()
        if lum[y, x] <= threshold:
            continue
        body[y, x] = True
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and not seen[ny, nx]:
                    seen[ny, nx] = True
                    if lum[ny, nx] > threshold:
                        queue.append((ny, nx))
    return body


def crop_icon(src: Image.Image) -> Image.Image:
    rgb = src.convert("RGB")
    arr = np.asarray(rgb)
    lum = arr.mean(axis=2)
    body = main_body_mask(lum)
    if not body.any():
        ys, xs = np.where(lum > 18)
    else:
        ys, xs = np.where(body)
    pad = 2
    left = max(0, int(xs.min()) - pad)
    top = max(0, int(ys.min()) - pad)
    right = min(src.width, int(xs.max()) + pad + 1)
    bottom = min(src.height, int(ys.max()) + pad + 1)
    cropped = src.crop((left, top, right, bottom)).convert("RGBA")
    crop_body = body[top:bottom, left:right]
    rgba = np.asarray(cropped).copy()
    # Any leftover sparkle that survived the crop is painted brand.
    if crop_body.shape[:2] == rgba.shape[:2]:
        sparkle = ~crop_body
        rgba[sparkle, 0] = BRAND[0]
        rgba[sparkle, 1] = BRAND[1]
        rgba[sparkle, 2] = BRAND[2]
        rgba[sparkle, 3] = 255
        cropped = Image.fromarray(rgba, "RGBA")
    return cropped


def full_bleed(cropped: Image.Image, size: int) -> Image.Image:
    """Square icon with maroon corners so OS masks never show black."""
    canvas = Image.new("RGBA", (size, size), BRAND)
    fitted = cropped.resize((size, size), Image.Resampling.LANCZOS)
    # Replace near-black padding (sparkles / outside the squircle) with brand.
    arr = np.asarray(fitted).copy()
    lum = arr[..., :3].mean(axis=2)
    dark = lum < 18
    arr[dark, 0] = BRAND[0]
    arr[dark, 1] = BRAND[1]
    arr[dark, 2] = BRAND[2]
    arr[dark, 3] = 255
    filled = Image.fromarray(arr, "RGBA")
    canvas.paste(filled, (0, 0), filled)
    return canvas


def circle_mask(img: Image.Image) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def adaptive_foreground(bleed: Image.Image, size: int = 1024) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    emblem_size = int(size * 0.72)
    emblem = bleed.resize((emblem_size, emblem_size), Image.Resampling.LANCZOS)
    offset = (size - emblem_size) // 2
    canvas.paste(emblem, (offset, offset), emblem)
    return canvas


def splash_logo(bleed: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    emblem_size = max(1, int(size * (2 / 3)))
    emblem = circle_mask(bleed.resize((emblem_size, emblem_size), Image.Resampling.LANCZOS))
    offset = (size - emblem_size) // 2
    canvas.paste(emblem, (offset, offset), emblem)
    return canvas


def notification_glyph(bleed: Image.Image, size: int) -> Image.Image:
    small = bleed.resize((size, size), Image.Resampling.LANCZOS).convert("L")
    arr = np.asarray(small)
    # Keep the bright wave / diamond as a white silhouette.
    alpha = np.where(arr > 140, 255, 0).astype("uint8")
    out = np.zeros((size, size, 4), dtype=np.uint8)
    out[..., 0:3] = 255
    out[..., 3] = alpha
    return Image.fromarray(out, "RGBA")


def ios_pixel_size(entry: dict) -> int:
    side = float(entry["size"].split("x")[0])
    scale = int(str(entry.get("scale", "1x")).replace("x", ""))
    return max(1, int(round(side * scale)))


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    source = Image.open(SOURCE)
    cropped = crop_icon(source)
    bleed_1024 = full_bleed(cropped, 1024)
    bleed_512 = full_bleed(cropped, 512)
    adaptive = adaptive_foreground(bleed_1024)
    circle_512 = circle_mask(bleed_512)

    save_png(bleed_1024, ASSETS / "icon.png")
    save_png(adaptive, ASSETS / "adaptive-icon.png")
    save_png(bleed_512, ASSETS / "logo.png")
    save_png(circle_512, ASSETS / "logo-circle.png")
    save_png(splash_logo(bleed_1024, 1024), ASSETS / "splash-circle.png")
    save_png(splash_logo(bleed_1024, 512), ASSETS / "splash-icon.png")
    save_png(bleed_512.resize((120, 120), Image.Resampling.LANCZOS), ASSETS / "favicon.png")
    save_png(bleed_512, ASSETS / "Android" / "play_store_512.png")

    contents = json.loads((IOS_SET / "Contents.json").read_text())
    for entry in contents.get("images", []):
        name = entry.get("filename")
        if not name:
            continue
        save_png(full_bleed(cropped, ios_pixel_size(entry)), IOS_SET / name)

    for folder, size in DENSITIES.items():
        icon = full_bleed(cropped, size)
        src_dir = ASSETS / "Android" / folder
        res_dir = ANDROID_RES / folder
        for target in (src_dir, res_dir):
            save_png(icon, target / "ic_launcher.png")
            save_png(circle_mask(icon), target / "ic_launcher_round.png")

    for folder, size in FG_DENSITIES.items():
        save_png(adaptive_foreground(bleed_1024, size), ANDROID_RES / folder / "ic_launcher_foreground.png")

    for folder, size in SPLASH_DENSITIES.items():
        save_png(splash_logo(bleed_1024, size), ANDROID_RES / folder / "splashscreen_logo.png")
        save_png(notification_glyph(bleed_1024, max(24, size // 12)), ANDROID_RES / folder / "notification_icon.png")

    print(f"Applied ملاحم سرح icon. Brand {BRAND_HEX}")


if __name__ == "__main__":
    main()
