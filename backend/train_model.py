"""
GoldSense AI — Synthetic Dataset Generation + XGBoost Training
Generates 5,000 synthetic jewelry assessments and trains 4 XGBoost models.
"""
import numpy as np
import pandas as pd
import pickle, os
from xgboost import XGBClassifier, XGBRegressor
from sklearn.preprocessing import LabelEncoder

np.random.seed(42)
N = 5000

FEATURE_COLS = [
    "estimated_karat", "karat_confidence", "hallmark_present",
    "hallmark_clarity_score", "hallmark_fake", "wear_score",
    "color_consistency", "plating_indicators", "hollow_indicators",
    "image_quality", "visual_confidence_score", "visual_weight_estimate",
    "tap_frequency", "decay_ms", "resonance_clarity", "acoustic_genuine_score",
    "jewelry_type_encoded", "declared_weight", "declared_karat",
    "bill_present", "bill_consistent", "weight_discrepancy",
    "karat_discrepancy", "cross_signal_match",
]

def generate_dataset():
    karat_choices = [14, 18, 20, 22, 24]
    jewelry_choices = list(range(8))

    est_karat        = np.random.choice(karat_choices, N)
    karat_conf       = np.clip(np.random.beta(5, 2, N), 0.05, 0.97)
    hallmark_present = np.random.binomial(1, 0.72, N)
    hallmark_clarity = np.where(hallmark_present,
                                np.random.choice([0.0, 0.5, 1.0], N, p=[0.1, 0.3, 0.6]),
                                0.0)
    hallmark_fake    = np.random.binomial(1, 0.04, N)
    wear_score       = np.clip(np.random.gamma(2, 1.5, N), 0, 10)
    color_consistency= np.clip(np.random.beta(6, 2, N), 0.05, 0.97)
    plating          = np.random.binomial(1, 0.12, N)
    hollow           = np.random.binomial(1, 0.10, N)
    image_quality    = np.random.choice([1, 2, 3, 4], N, p=[0.05, 0.15, 0.50, 0.30])
    vis_conf         = np.clip(np.random.beta(4, 2, N), 0.05, 0.97)
    vis_weight       = np.clip(np.random.normal(20, 5, N), 2, 60)

    # Acoustic (correlated with karat + hollow + plated)
    tap_freq = np.where(hollow, np.random.uniform(60, 150, N),
               np.where(plating, np.random.uniform(110, 200, N),
               np.where(est_karat >= 22, np.random.uniform(250, 400, N),
               np.where(est_karat >= 18, np.random.uniform(180, 300, N),
               np.random.uniform(120, 230, N)))))
    decay    = np.where(hollow, np.random.uniform(20, 75, N),
               np.where(plating, np.random.uniform(30, 85, N),
               np.where(est_karat >= 22, np.random.uniform(100, 250, N),
               np.where(est_karat >= 18, np.random.uniform(70, 160, N),
               np.random.uniform(40, 120, N)))))
    res_clar = np.clip(np.random.beta(4, 2, N), 0.05, 0.97)
    acou_score = np.clip(
        np.minimum(1.0, tap_freq / 300) * 0.40
        + np.minimum(1.0, decay / 200) * 0.35
        + res_clar * 0.25, 0.05, 0.97)

    jewelry_enc   = np.random.choice(jewelry_choices, N)
    decl_weight   = np.clip(vis_weight + np.random.normal(0, 1.5, N), 2, 60)
    decl_karat    = np.random.choice(karat_choices, N)
    bill_present  = np.random.binomial(1, 0.65, N)
    bill_consistent = np.where(bill_present, np.random.binomial(1, 0.88, N), 0)
    weight_disc   = np.abs(decl_weight - vis_weight) / (decl_weight + 1e-6)
    karat_disc    = np.abs(decl_karat - est_karat).astype(float)
    cross_match   = ((karat_disc < 3) & (weight_disc < 0.15) & (~hollow.astype(bool))).astype(int)

    df = pd.DataFrame({
        "estimated_karat": est_karat,
        "karat_confidence": karat_conf,
        "hallmark_present": hallmark_present,
        "hallmark_clarity_score": hallmark_clarity,
        "hallmark_fake": hallmark_fake,
        "wear_score": wear_score,
        "color_consistency": color_consistency,
        "plating_indicators": plating,
        "hollow_indicators": hollow,
        "image_quality": image_quality,
        "visual_confidence_score": vis_conf,
        "visual_weight_estimate": vis_weight,
        "tap_frequency": tap_freq,
        "decay_ms": decay,
        "resonance_clarity": res_clar,
        "acoustic_genuine_score": acou_score,
        "jewelry_type_encoded": jewelry_enc,
        "declared_weight": decl_weight,
        "declared_karat": decl_karat,
        "bill_present": bill_present,
        "bill_consistent": bill_consistent,
        "weight_discrepancy": weight_disc,
        "karat_discrepancy": karat_disc,
        "cross_signal_match": cross_match,
    })

    # Targets
    fraud_score = (
        hallmark_fake * 3
        + (plating & (decl_karat > 18).astype(int)) * 2
        + (hollow & (decl_karat >= 22).astype(int)) * 2
        + (karat_disc > 4).astype(int) * 2
        + (weight_disc > 0.25).astype(int)
    )
    df["fraud_label"] = (fraud_score >= 3).astype(int)

    risk_score = (
        (1 - acou_score) * 30
        + wear_score * 2
        + (1 - vis_conf) * 20
        + (1 - hallmark_present) * 15
        + df["fraud_label"] * 25
        + (1 - cross_match) * 10
    )
    df["risk_label"] = pd.cut(risk_score, bins=[-1, 30, 60, 200],
                               labels=["LOW", "MEDIUM", "HIGH"])

    rec_score = (
        acou_score * 25
        + vis_conf * 20
        + hallmark_present * 15
        + bill_consistent * 15
        + cross_match * 15
        - df["fraud_label"] * 40
        - wear_score * 2
    )
    df["rec_label"] = pd.cut(rec_score, bins=[-200, 20, 55, 200],
                              labels=["REJECT", "MANUAL-REVIEW", "PRE-APPROVE"])

    df["conf_target"] = np.clip(
        0.40 * vis_conf
        + 0.25 * acou_score
        + 0.15 * hallmark_present
        + 0.10 * cross_match
        + 0.10 * bill_consistent
        - 0.20 * df["fraud_label"],
        0.05, 0.97)

    return df


def train():
    print("Generating synthetic dataset...")
    df = generate_dataset()
    X = df[FEATURE_COLS].values

    xgb_params = dict(n_estimators=300, max_depth=6, learning_rate=0.05,
                      subsample=0.8, colsample_bytree=0.8,
                      use_label_encoder=False, eval_metric="mlogloss",
                      random_state=42)

    print("Training risk classifier...")
    le_risk = LabelEncoder()
    y_risk = le_risk.fit_transform(df["risk_label"].astype(str))
    risk_model = XGBClassifier(**xgb_params)
    risk_model.fit(X, y_risk)

    print("Training recommendation classifier...")
    le_rec = LabelEncoder()
    y_rec = le_rec.fit_transform(df["rec_label"].astype(str))
    rec_model = XGBClassifier(**xgb_params, scale_pos_weight=2)
    rec_model.fit(X, y_rec)

    print("Training confidence regressor...")
    conf_model = XGBRegressor(n_estimators=200, max_depth=5,
                               learning_rate=0.05, random_state=42)
    conf_model.fit(X, df["conf_target"].values)

    print("Training fraud classifier...")
    fraud_model = XGBClassifier(**xgb_params, scale_pos_weight=8)
    fraud_model.fit(X, df["fraud_label"].values)

    bundle = {
        "risk_model":    risk_model,
        "rec_model":     rec_model,
        "conf_model":    conf_model,
        "fraud_model":   fraud_model,
        "feature_cols":  FEATURE_COLS,
        "risk_classes":  list(le_risk.classes_),
        "rec_classes":   list(le_rec.classes_),
        "version":       "2.0.0",
    }
    out = os.path.join(os.path.dirname(__file__), "goldsense_xgb.pkl")
    with open(out, "wb") as f:
        pickle.dump(bundle, f)
    print(f"Model bundle saved -> {out}")
    return bundle


if __name__ == "__main__":
    train()
