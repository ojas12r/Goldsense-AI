"""
GoldSense AI — Pillow Fallback Feature Extractor
Used when OpenRouter vision API is unavailable.
"""
from PIL import Image
import io, numpy as np


def extract_pillow_features(image_bytes: bytes, declared_karat: int = 22,
                             declared_weight: float = 20.0, jewelry_type: str = "Bangle") -> dict:
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.array(img, dtype=float)
        r, g, b = arr[:,:,0].mean(), arr[:,:,1].mean(), arr[:,:,2].mean()
        brightness = (r + g + b) / 3
        # Rough gold hue check: high R, medium G, low B
        gold_like = (r > 150 and g > 100 and b < 120)
        color_consistency = round(max(0.1, min(0.9, 1.0 - np.std(arr) / 128)), 2)
        image_quality = 3 if brightness > 80 else 2
        return {
            "jewelry_type_detected": jewelry_type,
            "estimated_karat": declared_karat,
            "karat_confidence": 0.30,
            "hallmark_present": False,
            "hallmark_clarity": "NONE",
            "hallmark_type": "UNCLEAR",
            "surface_condition": "FAIR",
            "wear_score": 4.0,
            "color_consistency": color_consistency,
            "plating_indicators": not gold_like,
            "hollow_indicators": False,
            "image_quality": image_quality,
            "estimated_weight_visual": declared_weight,
            "declared_vs_visual_match": "MINOR_GAP",
            "visual_fraud_flags": [],
            "key_observations": [
                "Pillow fallback analysis — vision API unavailable",
                f"Average brightness: {brightness:.1f}",
                f"Gold-like hue detected: {gold_like}",
            ],
            "acoustic_inference": "Pillow fallback — no structural inference available",
            "visual_confidence_score": 0.25,
            "_fallback": True,
        }
    except Exception as e:
        return {
            "jewelry_type_detected": jewelry_type,
            "estimated_karat": declared_karat,
            "karat_confidence": 0.15,
            "hallmark_present": False,
            "hallmark_clarity": "NONE",
            "hallmark_type": "NONE",
            "surface_condition": "FAIR",
            "wear_score": 5.0,
            "color_consistency": 0.40,
            "plating_indicators": False,
            "hollow_indicators": False,
            "image_quality": 1,
            "estimated_weight_visual": declared_weight,
            "declared_vs_visual_match": "MINOR_GAP",
            "visual_fraud_flags": [],
            "key_observations": [f"Image read error: {str(e)}"],
            "acoustic_inference": "Unable to infer",
            "visual_confidence_score": 0.15,
            "_fallback": True,
        }
