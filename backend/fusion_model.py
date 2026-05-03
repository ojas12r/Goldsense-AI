"""
GoldSense AI — XGBoost Fusion Model + Business Logic
"""
import numpy as np
import pickle, os, logging

logger = logging.getLogger(__name__)

GOLD_RATE_PER_GRAM = {14: 3500, 18: 4500, 20: 5000, 22: 5500, 24: 6200}
JEWELRY_TYPES = ["Bangle","Necklace","Ring","Chain","Earrings","Bracelet","Anklet","Pendant"]
MODEL_BUNDLE = None


def load_model():
    global MODEL_BUNDLE
    path = os.path.join(os.path.dirname(__file__), "goldsense_xgb.pkl")
    if not os.path.exists(path):
        logger.warning("goldsense_xgb.pkl not found")
        return False
    with open(path, "rb") as f:
        MODEL_BUNDLE = pickle.load(f)
    logger.info(f"Model bundle loaded — version {MODEL_BUNDLE.get('version','?')}")
    return True


def build_feature_vector(vision: dict, acoustic: dict, declared: dict) -> np.ndarray:
    def f(val, default=0.0):
        try:
            return float(val) if val is not None else float(default)
        except:
            return float(default)

    clarity_map = {"CLEAR": 1.0, "PARTIAL": 0.5, "NONE": 0.0}
    jewelry_type_str = declared.get("jewelry_type", "Bangle")
    try:
        jewelry_enc = JEWELRY_TYPES.index(jewelry_type_str)
    except ValueError:
        jewelry_enc = 0

    decl_w  = f(declared.get("declared_weight", 20), 20)
    decl_k  = f(declared.get("declared_karat", 22), 22)
    vis_w   = f(vision.get("estimated_weight_visual", decl_w), decl_w)
    vis_k   = f(vision.get("estimated_karat", decl_k), decl_k)

    weight_disc = abs(decl_w - vis_w) / max(decl_w, 1e-6)
    karat_disc  = abs(decl_k - vis_k)
    cross_match = 1 if (karat_disc < 3 and weight_disc < 0.15
                        and not vision.get("hollow_indicators", False)) else 0

    feats = [
        f(vision.get("estimated_karat", 22)),
        f(vision.get("karat_confidence", 0.5)),
        1.0 if vision.get("hallmark_present") else 0.0,
        f(clarity_map.get(vision.get("hallmark_clarity","NONE"), 0.0)),
        1.0 if vision.get("hallmark_type") == "FAKE" else 0.0,
        np.clip(f(vision.get("wear_score", 5)), 0, 10),
        np.clip(f(vision.get("color_consistency", 0.5)), 0.05, 0.97),
        1.0 if vision.get("plating_indicators") else 0.0,
        1.0 if vision.get("hollow_indicators") else 0.0,
        np.clip(f(vision.get("image_quality", 2)), 1, 4),
        np.clip(f(vision.get("visual_confidence_score", 0.3)), 0.05, 0.97),
        np.clip(f(vis_w), 2, 60),
        np.clip(f(acoustic.get("tap_frequency_hz", 200)), 50, 500),
        np.clip(f(acoustic.get("decay_ms", 100)), 10, 300),
        np.clip(f(acoustic.get("resonance_clarity", 0.5)), 0.05, 0.97),
        np.clip(f(acoustic.get("acoustic_genuine_score", 0.5)), 0.05, 0.97),
        float(jewelry_enc),
        np.clip(f(decl_w), 2, 60),
        float(decl_k),
        1.0 if declared.get("bill_present") else 0.0,
        1.0 if declared.get("bill_consistent") else 0.0,
        np.clip(float(weight_disc), 0, 1),
        float(karat_disc),
        float(cross_match),
    ]
    return np.array(feats, dtype=float).reshape(1, -1)


def run_inference(feature_vec: np.ndarray) -> dict:
    if MODEL_BUNDLE is None:
        return {
            "risk_level": "MEDIUM",
            "recommendation": "MANUAL-REVIEW",
            "confidence_score": 0.40,
            "is_fraud_flagged": False,
            "_model_fallback": True,
        }
    b = MODEL_BUNDLE
    risk_idx  = b["risk_model"].predict(feature_vec)[0]
    risk_lvl  = b["risk_classes"][risk_idx]
    rec_idx   = b["rec_model"].predict(feature_vec)[0]
    rec_lvl   = b["rec_classes"][rec_idx]
    conf      = float(np.clip(b["conf_model"].predict(feature_vec)[0], 0.05, 0.97))
    fraud     = bool(b["fraud_model"].predict(feature_vec)[0])
    return {
        "risk_level":       risk_lvl,
        "recommendation":   rec_lvl,
        "confidence_score": round(conf, 2),
        "is_fraud_flagged": fraud,
        "_model_fallback":  False,
    }


def compute_loan_eligibility(karat_value: float, weight_grams: float) -> dict:
    karat_key = min(GOLD_RATE_PER_GRAM.keys(),
                    key=lambda k: abs(k - karat_value))
    rate = GOLD_RATE_PER_GRAM[karat_key]
    market_value = weight_grams * rate
    ltv          = 0.75
    loan_min     = int(market_value * ltv * 0.85)
    loan_max     = int(market_value * ltv)
    def inr(n):
        return f"₹{n:,.0f}".replace(",", ",")
    return {
        "market_value":   inr(market_value),
        "loan_eligibility": f"{inr(loan_min)} – {inr(loan_max)}",
        "ltv":            "75% LTV applicable",
        "rate_used":      rate,
    }


def generate_fraud_flags(vision: dict, declared: dict, xgb_fraud: bool) -> list:
    flags = []
    if vision.get("hallmark_type") == "FAKE":
        flags.append("FAKE hallmark detected in image")
    if vision.get("plating_indicators") and declared.get("declared_karat", 0) > 18:
        flags.append("Plating indicators inconsistent with declared high karat")
    if vision.get("hollow_indicators") and declared.get("declared_karat", 0) >= 22:
        flags.append("Hollow structure detected — weight claim suspect")
    decl_w = declared.get("declared_weight", 20) or 20
    vis_w  = vision.get("estimated_weight_visual", decl_w) or decl_w
    if abs(decl_w - vis_w) / max(decl_w, 1) > 0.25:
        flags.append("Weight discrepancy >25% between declared and visual estimate")
    decl_k = declared.get("declared_karat", 22) or 22
    vis_k  = vision.get("estimated_karat", decl_k) or decl_k
    if abs(decl_k - vis_k) > 4:
        flags.append(f"Karat discrepancy: declared {decl_k}K vs visual {vis_k}K")
    if xgb_fraud:
        flags.append("XGBoost fraud model flagged this submission")
    if vision.get("declared_vs_visual_match") == "MAJOR_GAP":
        flags.append("Major gap between declared attributes and visual analysis")
    return flags


def generate_assessor_note(risk, rec, conf, fraud_flags, loan_str) -> str:
    conf_label = "high" if conf >= 0.70 else ("moderate" if conf >= 0.45 else "low")
    fraud_txt = (
        "No fraud indicators detected." if not fraud_flags
        else f"Fraud flags raised: {'; '.join(fraud_flags[:2])}."
    )
    return (
        f"This assessment was completed with {conf_label} confidence ({conf:.0%}). "
        f"The jewelry has been classified as {risk} risk and the system recommends "
        f"{rec.replace('-', ' ').lower()}. "
        f"Estimated loan eligibility is {loan_str}. "
        f"{fraud_txt} "
        f"The NBFC officer should {'proceed with standard verification' if rec == 'PRE-APPROVE' else 'conduct manual inspection before proceeding'}."
    )
