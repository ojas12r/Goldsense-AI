"""
GoldSense AI — FastAPI Backend v2.1
Acoustic: wav2vec2-base (HuggingFace) when audio provided,
          visual-inference fallback when no audio.
"""
import os, uuid, logging
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware

from openrouter_vision import analyze_jewelry_image, _pessimistic_defaults
from image_features import extract_pillow_features
from acoustic_features import extract_acoustic_features, infer_acoustic_features
import fusion_model
from fusion_model import (
    load_model, build_feature_vector, run_inference,
    compute_loan_eligibility, generate_fraud_flags, generate_assessor_note,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GoldSense AI", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
VISION_MODEL   = os.getenv("VISION_MODEL", "qwen/qwen-2.5-vl-7b-instruct")


@app.on_event("startup")
async def startup():
    ok = load_model()
    if not ok:
        logger.warning("XGBoost model not found — run train_model.py first")


@app.get("/")
def root():
    return {"service": "GoldSense AI", "version": "2.1.0",
            "vision_model": VISION_MODEL, "acoustic_model": "facebook/wav2vec2-base",
            "status": "running"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "models_loaded": fusion_model.MODEL_BUNDLE is not None,
        "vision_model":  VISION_MODEL,
        "acoustic_model": "facebook/wav2vec2-base",
        "openrouter_key_set": bool(OPENROUTER_KEY),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/config")
def config():
    return {
        "vision_model":    VISION_MODEL,
        "acoustic_model":  "facebook/wav2vec2-base",
        "fusion_model":    "XGBoost",
        "openrouter_key_set": bool(OPENROUTER_KEY),
        "fallback_available": True,
    }


@app.get("/model-info")
def model_info():
    if fusion_model.MODEL_BUNDLE is None:
        return {"status": "not_loaded"}
    return {
        "version":        fusion_model.MODEL_BUNDLE.get("version"),
        "feature_cols":   fusion_model.MODEL_BUNDLE.get("feature_cols"),
        "risk_classes":   fusion_model.MODEL_BUNDLE.get("risk_classes"),
        "rec_classes":    fusion_model.MODEL_BUNDLE.get("rec_classes"),
        "training_samples": 5000,
        "models": ["risk_classifier","recommendation_classifier",
                   "confidence_regressor","fraud_classifier"],
        "acoustic_model": "facebook/wav2vec2-base",
    }


@app.post("/assess")
async def assess(
    image:           Optional[UploadFile] = File(None),
    tap_audio:       Optional[UploadFile] = File(None),   # ← NEW: tap recording
    jewelry_type:    str   = Form("Bangle"),
    declared_weight: float = Form(20.0),
    declared_karat:  int   = Form(22),
    bill_present:    bool  = Form(False),
    bill_consistent: bool  = Form(False),
    customer_name:   str   = Form(""),
    customer_id:     str   = Form(""),
    notes:           str   = Form(""),
):
    assessment_id = uuid.uuid4().hex[:8].upper()
    ts = datetime.now(timezone.utc).isoformat()

    declared = {
        "jewelry_type":    jewelry_type,
        "declared_weight": declared_weight,
        "declared_karat":  declared_karat,
        "bill_present":    bill_present,
        "bill_consistent": bill_consistent,
    }

    # ── Step 1: Vision analysis ──────────────────────────────────────────────
    image_provided = image is not None
    vision_api_success = False

    if image_provided:
        image_bytes = await image.read()
        mime = image.content_type or "image/jpeg"
        try:
            vision = await analyze_jewelry_image(
                image_bytes, mime, declared_weight, declared_karat,
                jewelry_type, "", notes,
            )
            vision_api_success = not vision.get("_fallback", True)
        except Exception as e:
            logger.error(f"Vision error: {e}")
            vision = extract_pillow_features(image_bytes, declared_karat,
                                             declared_weight, jewelry_type)
    else:
        vision = _pessimistic_defaults(jewelry_type, declared_weight, declared_karat)

    # ── Step 2: Acoustic analysis ────────────────────────────────────────────
    audio_provided = tap_audio is not None
    acoustic_source = "visual_inference"

    if audio_provided:
        try:
            audio_bytes = await tap_audio.read()
            acoustic = extract_acoustic_features(audio_bytes)   # wav2vec2-base
            acoustic_source = acoustic.get("source", "wav2vec2")
            logger.info(f"Acoustic via wav2vec2: score={acoustic['acoustic_genuine_score']}")
        except Exception as e:
            logger.error(f"Acoustic wav2vec2 error: {e}")
            acoustic = infer_acoustic_features(vision)          # fallback
            acoustic_source = "visual_inference_fallback"
    else:
        acoustic = infer_acoustic_features(vision)              # no audio → visual inference
        acoustic_source = "visual_inference"

    # ── Steps 3-9: unchanged ────────────────────────────────────────────────
    feat_vec  = build_feature_vector(vision, acoustic, declared)
    inference = run_inference(feat_vec)

    vis_karat  = float(vision.get("estimated_karat", declared_karat))
    vis_weight = float(vision.get("estimated_weight_visual", declared_weight))
    loan_data  = compute_loan_eligibility(vis_karat, vis_weight)

    fraud_flags = generate_fraud_flags(vision, declared, inference["is_fraud_flagged"])

    obs = vision.get("key_observations", [])
    visual_findings = list(obs) if obs else []
    if vision.get("hallmark_present"):
        visual_findings.append(f"Hallmark detected: {vision.get('hallmark_type','UNCLEAR')}")
    if vision.get("plating_indicators"):
        visual_findings.append("Plating indicators observed")

    decl_match = vision.get("declared_vs_visual_match", "MINOR_GAP")
    check_map  = {"CONSISTENT":"CONSISTENT","MINOR_GAP":"MINOR-DISCREPANCY","MAJOR_GAP":"MAJOR-DISCREPANCY"}
    declared_data_check = check_map.get(decl_match, "MINOR-DISCREPANCY")

    note = generate_assessor_note(
        inference["risk_level"], inference["recommendation"],
        inference["confidence_score"], fraud_flags, loan_data["loan_eligibility"],
    )

    purity_low  = max(14, int(vis_karat) - 2)
    purity_high = min(24, int(vis_karat) + 2)

    return {
        "assessment_id":      assessment_id,
        "timestamp":          ts,
        "customer_name":      customer_name,
        "customer_id":        customer_id,
        "image_provided":     image_provided,
        "audio_provided":     audio_provided,
        "vision_model_used":  VISION_MODEL,
        "acoustic_model_used": "facebook/wav2vec2-base" if audio_provided else "visual_inference",
        "vision_api_success": vision_api_success,
        "acoustic_source":    acoustic_source,

        "jewelry_type":          vision.get("jewelry_type_detected", jewelry_type),
        "estimated_karat":       f"{int(vis_karat)}K estimated",
        "estimated_karat_value": vis_karat,
        "weight_range":          f"{vis_weight*0.88:.1f}g – {vis_weight*1.08:.1f}g",
        "purity_band":           f"{purity_low}K – {purity_high}K",

        "risk_level":       inference["risk_level"],
        "recommendation":   inference["recommendation"],
        "confidence_score": inference["confidence_score"],
        "is_fraud_flagged": len(fraud_flags) > 0,

        "loan_eligibility": loan_data["loan_eligibility"],
        "market_value":     loan_data["market_value"],
        "ltv":              loan_data["ltv"],

        "visual_findings":     visual_findings[:5],
        "acoustic_note":       acoustic.get("note", ""),
        "declared_data_check": declared_data_check,
        "fraud_flags":         fraud_flags,
        "assessor_note":       note,

        "model_signals": {
            "image_quality":          vision.get("image_quality", 1),
            "vision_confidence":      round(float(vision.get("visual_confidence_score", 0.15)), 2),
            "acoustic_genuine_score": acoustic.get("acoustic_genuine_score", 0.5),
            "acoustic_source":        acoustic_source,
            "wav2vec2_embedding_norm": acoustic.get("wav2vec2_embedding_norm"),
            "spectral_centroid_hz":   acoustic.get("spectral_centroid_hz"),
            "color_consistency":      round(float(vision.get("color_consistency", 0.4)), 2),
            "hallmark_detected":      bool(vision.get("hallmark_present", False)),
            "hallmark_type":          vision.get("hallmark_type", "NONE"),
            "plating_detected":       bool(vision.get("plating_indicators", False)),
            "hollow_detected":        bool(vision.get("hollow_indicators", False)),
            "tap_frequency_hz":       acoustic.get("tap_frequency_hz", 0),
            "decay_ms":               acoustic.get("decay_ms", 0),
            "resonance_clarity":      acoustic.get("resonance_clarity", 0),
            "karat_discrepancy":      abs(declared_karat - vis_karat),
            "vision_api_used":        vision_api_success,
        },
    }
