"""
GoldSense AI — OpenRouter Vision Client
Calls Qwen2.5-VL via OpenRouter API for jewelry image analysis.
"""
import os, json, base64, asyncio, logging
import aiohttp

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
PRIMARY_MODEL   = os.getenv("VISION_MODEL", "qwen/qwen-2.5-vl-7b-instruct")
FALLBACK_MODEL  = "qwen/qwen-2.5-vl-3b-instruct"

SYSTEM_PROMPT = (
    "You are GoldSense AI, a specialized gold jewelry vision analyst "
    "for Indian NBFC lending. You analyze jewelry images with expert "
    "precision. You MUST respond with ONLY a valid JSON object — "
    "no markdown fences, no explanation, no preamble, no postamble. "
    "Any non-JSON output will break the system. Return ONLY JSON."
)

def _build_user_prompt(declared_weight, declared_karat, jewelry_type, bill_description, notes):
    return f"""Analyze this gold jewelry image for loan pre-qualification.

Customer declared:
- Jewelry type: {jewelry_type}
- Weight: {declared_weight}g
- Karat: {declared_karat}K
- Bill: {bill_description}
- Notes: {notes}

Return EXACTLY this JSON structure with no other text:
{{
  "jewelry_type_detected": "Bangle",
  "estimated_karat": 22,
  "karat_confidence": 0.85,
  "hallmark_present": true,
  "hallmark_clarity": "CLEAR",
  "hallmark_type": "BIS_916",
  "surface_condition": "GOOD",
  "wear_score": 3.2,
  "color_consistency": 0.82,
  "plating_indicators": false,
  "hollow_indicators": false,
  "image_quality": 3,
  "estimated_weight_visual": 19.5,
  "declared_vs_visual_match": "CONSISTENT",
  "visual_fraud_flags": [],
  "key_observations": ["obs1","obs2","obs3"],
  "acoustic_inference": "Dense solid construction suggests clear metallic resonance typical of 22K gold.",
  "visual_confidence_score": 0.82
}}

Rules: all numeric fields must be numbers; estimated_karat in [14,18,20,22,24];
image_quality 1-4; wear_score 0-10; 0.0-1.0 scores between 0.05 and 0.97;
key_observations 3-5 items; visual_fraud_flags empty array if none."""


def _pessimistic_defaults(jewelry_type, declared_weight, declared_karat):
    return {
        "jewelry_type_detected": jewelry_type or "Unknown",
        "estimated_karat": declared_karat,
        "karat_confidence": 0.20,
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
        "key_observations": ["Image analysis unavailable — API fallback"],
        "acoustic_inference": "Unable to infer — image not analyzed",
        "visual_confidence_score": 0.15,
        "_fallback": True,
    }


async def analyze_jewelry_image(
    image_bytes: bytes,
    mime_type: str,
    declared_weight: float,
    declared_karat: int,
    jewelry_type: str,
    bill_description: str,
    notes: str,
) -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set — returning pessimistic defaults")
        return _pessimistic_defaults(jewelry_type, declared_weight, declared_karat)

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
            {"type": "text", "text": _build_user_prompt(declared_weight, declared_karat, jewelry_type, bill_description, notes)},
        ]},
    ]
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "GoldSense AI",
    }
    raw = ""
    for model in [PRIMARY_MODEL, FALLBACK_MODEL]:
        payload = {"model": model, "max_tokens": 1024, "temperature": 0.1, "messages": messages}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{OPENROUTER_BASE}/chat/completions",
                    headers=headers, json=payload,
                    timeout=aiohttp.ClientTimeout(total=45),
                ) as resp:
                    if resp.status == 429:
                        await asyncio.sleep(2)
                        async with session.post(f"{OPENROUTER_BASE}/chat/completions",
                            headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=45)) as r2:
                            data = await r2.json()
                    elif resp.status == 503:
                        continue
                    else:
                        data = await resp.json()
            raw = data["choices"][0]["message"]["content"]
            clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            result = json.loads(clean)
            result["_model_used"] = model
            result["_fallback"] = False
            return result
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error from {model}: {e} | raw={raw[:300]}")
        except Exception as e:
            logger.error(f"OpenRouter call failed for {model}: {e}")

    return _pessimistic_defaults(jewelry_type, declared_weight, declared_karat)
