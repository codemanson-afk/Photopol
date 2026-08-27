"""Social + marketplace export size presets (Phase 3)."""

from __future__ import annotations

from typing import Dict, List, TypedDict


class SizePreset(TypedDict):
    id: str
    label: str
    width: int
    height: int
    fit: str  # cover | contain


SOCIAL_PRESETS: List[SizePreset] = [
    {"id": "ig-post", "label": "IG Post", "width": 1080, "height": 1080, "fit": "cover"},
    {"id": "ig-portrait", "label": "IG 4:5", "width": 1080, "height": 1350, "fit": "cover"},
    {"id": "ig-story", "label": "IG Story", "width": 1080, "height": 1920, "fit": "cover"},
    {"id": "tiktok", "label": "TikTok", "width": 1080, "height": 1920, "fit": "cover"},
    {"id": "yt-thumb", "label": "YT Thumb", "width": 1280, "height": 720, "fit": "cover"},
    {"id": "yt-short", "label": "YT Short", "width": 1080, "height": 1920, "fit": "cover"},
    {"id": "linkedin", "label": "LinkedIn", "width": 1200, "height": 627, "fit": "cover"},
    {"id": "x-post", "label": "X Post", "width": 1600, "height": 900, "fit": "cover"},
    {"id": "fb-cover", "label": "FB Cover", "width": 820, "height": 312, "fit": "cover"},
    {"id": "pinterest", "label": "Pinterest", "width": 1000, "height": 1500, "fit": "cover"},
]

MARKETPLACE_PRESETS: List[SizePreset] = [
    {"id": "amazon-main", "label": "Amazon Main", "width": 2000, "height": 2000, "fit": "contain"},
    {"id": "amazon-variant", "label": "Amazon Variant", "width": 1600, "height": 1600, "fit": "contain"},
    {"id": "shopify-square", "label": "Shopify", "width": 2048, "height": 2048, "fit": "contain"},
    {"id": "etsy-tall", "label": "Etsy", "width": 2000, "height": 2500, "fit": "contain"},
    {"id": "ebay-gallery", "label": "eBay", "width": 1600, "height": 1600, "fit": "contain"},
]

PRESET_GROUPS: Dict[str, List[SizePreset]] = {
    "social": SOCIAL_PRESETS,
    "marketplace": MARKETPLACE_PRESETS,
}


def get_preset_group(group: str) -> List[SizePreset]:
    return list(PRESET_GROUPS.get(group) or [])
