import io
import logging
from typing import Optional, Tuple

from PIL import Image as PILImage

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

ASPECT_PRESETS = {
    "1:1": (1, 1),
    "4:5": (4, 5),
    "16:9": (16, 9),
    "9:16": (9, 16),
}


def _validate_dims(width: int, height: int) -> None:
    settings = get_settings()
    if (
        width < settings.MIN_IMAGE_DIMENSION
        or height < settings.MIN_IMAGE_DIMENSION
        or width > settings.MAX_IMAGE_DIMENSION
        or height > settings.MAX_IMAGE_DIMENSION
    ):
        raise AppError(
            f"Dimensions must be between {settings.MIN_IMAGE_DIMENSION} and {settings.MAX_IMAGE_DIMENSION}",
            code="invalid_dimensions",
        )


def resize_image(
    data: bytes,
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
    aspect_ratio: Optional[str] = None,
) -> Tuple[bytes, str, int, int]:
    with PILImage.open(io.BytesIO(data)) as img:
        img.load()
        src_w, src_h = img.size

        if aspect_ratio:
            if aspect_ratio not in ASPECT_PRESETS:
                raise AppError("Unsupported aspect ratio", code="invalid_aspect")
            ar_w, ar_h = ASPECT_PRESETS[aspect_ratio]
            # Fit within current image by cropping to aspect then optional resize
            target_ratio = ar_w / ar_h
            current_ratio = src_w / src_h
            if current_ratio > target_ratio:
                new_w = int(src_h * target_ratio)
                new_h = src_h
                left = (src_w - new_w) // 2
                box = (left, 0, left + new_w, new_h)
            else:
                new_w = src_w
                new_h = int(src_w / target_ratio)
                top = (src_h - new_h) // 2
                box = (0, top, new_w, top + new_h)
            img = img.crop(box)
            src_w, src_h = img.size

            if width or height:
                if width and height:
                    tw, th = width, height
                elif width:
                    tw = width
                    th = int(width / target_ratio)
                else:
                    th = height  # type: ignore
                    tw = int(height * target_ratio)  # type: ignore
                _validate_dims(tw, th)
                img = img.resize((tw, th), PILImage.Resampling.LANCZOS)
        else:
            if not width and not height:
                raise AppError("Provide width, height, or aspect_ratio", code="invalid_resize")
            if width and height:
                tw, th = width, height
            elif width:
                tw = width
                th = max(1, int(src_h * (width / src_w)))
            else:
                th = height  # type: ignore
                tw = max(1, int(src_w * (height / src_h)))  # type: ignore
            _validate_dims(tw, th)
            img = img.resize((tw, th), PILImage.Resampling.LANCZOS)

        out_w, out_h = img.size
        _validate_dims(out_w, out_h)

        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        buf = io.BytesIO()
        if has_alpha:
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png", out_w, out_h
        else:
            img = img.convert("RGB")
            img.save(buf, format="JPEG", quality=95, optimize=True)
            return buf.getvalue(), "image/jpeg", out_w, out_h


def crop_image(
    data: bytes,
    *,
    x: int,
    y: int,
    width: int,
    height: int,
) -> Tuple[bytes, str, int, int]:
    _validate_dims(width, height)
    with PILImage.open(io.BytesIO(data)) as img:
        img.load()
        src_w, src_h = img.size
        if x + width > src_w or y + height > src_h:
            raise AppError("Crop region exceeds image bounds", code="invalid_crop")
        cropped = img.crop((x, y, x + width, y + height))
        out_w, out_h = cropped.size
        has_alpha = cropped.mode in ("RGBA", "LA") or (
            cropped.mode == "P" and "transparency" in cropped.info
        )
        buf = io.BytesIO()
        if has_alpha:
            if cropped.mode != "RGBA":
                cropped = cropped.convert("RGBA")
            cropped.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png", out_w, out_h
        else:
            cropped = cropped.convert("RGB")
            cropped.save(buf, format="JPEG", quality=95, optimize=True)
            return buf.getvalue(), "image/jpeg", out_w, out_h


def convert_format(data: bytes, fmt: str) -> Tuple[bytes, str]:
    return encode_export(data, fmt=fmt, quality=95, strip_metadata=True)


def encode_export(
    data: bytes,
    *,
    fmt: str = "png",
    quality: int = 92,
    strip_metadata: bool = True,
) -> Tuple[bytes, str]:
    from PIL import ImageOps

    fmt = fmt.lower()
    quality = max(40, min(100, int(quality)))
    with PILImage.open(io.BytesIO(data)) as img:
        img.load()
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        if strip_metadata:
            data_only = list(img.getdata())
            clean = PILImage.new(img.mode, img.size)
            clean.putdata(data_only)
            img = clean
        buf = io.BytesIO()
        if fmt == "png":
            if img.mode not in ("RGBA", "RGB", "L"):
                img = img.convert("RGBA")
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png"
        if fmt in ("jpg", "jpeg"):
            if img.mode in ("RGBA", "LA", "P"):
                background = PILImage.new("RGB", img.size, (255, 255, 255))
                rgba = img.convert("RGBA")
                background.paste(rgba, mask=rgba.split()[-1])
                img = background
            else:
                img = img.convert("RGB")
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            return buf.getvalue(), "image/jpeg"
        if fmt == "webp":
            img.save(buf, format="WEBP", quality=quality)
            return buf.getvalue(), "image/webp"
        raise AppError("Unsupported export format", code="invalid_format")


def fit_resize(
    data: bytes,
    *,
    width: int,
    height: int,
    fit: str = "cover",
) -> Tuple[bytes, str, int, int]:
    """Resize to exact W×H using cover (crop) or contain (letterbox) or stretch."""
    _validate_dims(width, height)
    fit = (fit or "cover").lower()
    with PILImage.open(io.BytesIO(data)) as img:
        img.load()
        try:
            from PIL import ImageOps

            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA" if has_alpha else "RGB")
        src_w, src_h = img.size
        if fit == "stretch":
            out = img.resize((width, height), PILImage.Resampling.LANCZOS)
        elif fit == "contain":
            scale = min(width / src_w, height / src_h)
            nw, nh = max(1, int(src_w * scale)), max(1, int(src_h * scale))
            resized = img.resize((nw, nh), PILImage.Resampling.LANCZOS)
            canvas = PILImage.new(img.mode, (width, height), (255, 255, 255, 0) if has_alpha else (255, 255, 255))
            canvas.paste(resized, ((width - nw) // 2, (height - nh) // 2))
            out = canvas
        else:  # cover
            scale = max(width / src_w, height / src_h)
            nw, nh = max(1, int(src_w * scale)), max(1, int(src_h * scale))
            resized = img.resize((nw, nh), PILImage.Resampling.LANCZOS)
            left = (nw - width) // 2
            top = (nh - height) // 2
            out = resized.crop((left, top, left + width, top + height))
        buf = io.BytesIO()
        if has_alpha or out.mode == "RGBA":
            out = out.convert("RGBA")
            out.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png", width, height
        out = out.convert("RGB")
        out.save(buf, format="JPEG", quality=92, optimize=True)
        return buf.getvalue(), "image/jpeg", width, height


def enhance_manual(
    data: bytes,
    *,
    brightness: float = 0,
    contrast: float = 0,
    saturation: float = 0,
    sharpen: float = 0,
    warmth: float = 0,
) -> Tuple[bytes, str, int, int]:
    """Apply slider-based enhance. Sliders roughly -50..50 or 0..100 for sharpen."""
    from PIL import ImageEnhance, ImageFilter, ImageOps

    with PILImage.open(io.BytesIO(data)) as img:
        img.load()
        img = ImageOps.exif_transpose(img)
        has_alpha = img.mode in ("RGBA", "LA")
        alpha = img.split()[-1] if has_alpha else None
        base = img.convert("RGB")
        # map -50..50 → factor ~0.5..1.5
        def factor(v: float) -> float:
            return max(0.2, 1.0 + (float(v) / 100.0))

        if brightness:
            base = ImageEnhance.Brightness(base).enhance(factor(brightness))
        if contrast:
            base = ImageEnhance.Contrast(base).enhance(factor(contrast))
        if saturation:
            base = ImageEnhance.Color(base).enhance(factor(saturation))
        if warmth:
            r, g, b = base.split()
            warm = float(warmth) / 100.0
            r = r.point(lambda p: min(255, int(p * (1 + warm * 0.15))))
            b = b.point(lambda p: max(0, int(p * (1 - warm * 0.15))))
            base = PILImage.merge("RGB", (r, g, b))
        if sharpen and float(sharpen) > 0:
            pct = int(min(200, max(0, float(sharpen) * 2)))
            base = base.filter(ImageFilter.UnsharpMask(radius=1.2, percent=pct, threshold=2))
        if alpha is not None:
            base = base.convert("RGBA")
            base.putalpha(alpha)
            buf = io.BytesIO()
            base.save(buf, format="PNG", optimize=True)
            w, h = base.size
            return buf.getvalue(), "image/png", w, h
        buf = io.BytesIO()
        base.save(buf, format="JPEG", quality=92, optimize=True)
        w, h = base.size
        return buf.getvalue(), "image/jpeg", w, h


def geometry_transform(
    data: bytes,
    *,
    rotate: float = 0,
    flip_h: bool = False,
    flip_v: bool = False,
) -> Tuple[bytes, str, int, int]:
    from PIL import ImageOps

    with PILImage.open(io.BytesIO(data)) as img:
        img.load()
        img = ImageOps.exif_transpose(img)
        if flip_h:
            img = ImageOps.mirror(img)
        if flip_v:
            img = ImageOps.flip(img)
        if rotate:
            img = img.rotate(-float(rotate), expand=True, resample=PILImage.Resampling.BICUBIC)
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        buf = io.BytesIO()
        if has_alpha:
            img = img.convert("RGBA")
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png", img.size[0], img.size[1]
        img = img.convert("RGB")
        img.save(buf, format="JPEG", quality=95, optimize=True)
        return buf.getvalue(), "image/jpeg", img.size[0], img.size[1]


def composite_on_color(
    cutout_png: bytes,
    *,
    color: str = "#FFFFFF",
    drop_shadow: bool = False,
    subject_scale: float = 100,
    position: str = "center",
) -> Tuple[bytes, str, int, int]:
    """Place RGBA subject on solid color with optional shadow (Pillow)."""
    from PIL import ImageFilter

    fg = PILImage.open(io.BytesIO(cutout_png)).convert("RGBA")
    color = (color or "#FFFFFF").lstrip("#")
    if len(color) == 3:
        color = "".join(c * 2 for c in color)
    r, g, b = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)
    scale = max(50, min(120, float(subject_scale))) / 100.0
    if scale != 1.0:
        nw, nh = max(1, int(fg.width * scale)), max(1, int(fg.height * scale))
        fg = fg.resize((nw, nh), PILImage.Resampling.LANCZOS)
    canvas_w, canvas_h = max(fg.width + 80, fg.width), max(fg.height + 80, fg.height)
    # keep canvas at least subject size
    canvas_w = max(canvas_w, fg.width)
    canvas_h = max(canvas_h, fg.height)
    bg = PILImage.new("RGBA", (canvas_w, canvas_h), (r, g, b, 255))
    x = (canvas_w - fg.width) // 2
    if position == "lower":
        y = int((canvas_h - fg.height) * 0.72)
    elif position == "floor":
        y = canvas_h - fg.height - 10
    else:
        y = (canvas_h - fg.height) // 2
    if drop_shadow:
        alpha = fg.split()[-1]
        shadow = PILImage.new("RGBA", fg.size, (0, 0, 0, 0))
        shadow.putalpha(alpha.point(lambda v: int(v * 0.45)))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=12))
        bg.paste(shadow, (x + 8, y + 14), shadow)
    bg.paste(fg, (x, y), fg)
    out = bg.convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=92, optimize=True)
    return buf.getvalue(), "image/jpeg", out.size[0], out.size[1]
