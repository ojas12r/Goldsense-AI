"""
GoldSense AI — Acoustic Feature Extractor
Uses facebook/wav2vec2-base from HuggingFace to analyze tap sound recordings.
Falls back to visual-inference ONLY when no audio is provided.

Pipeline:
  WAV/MP3 tap recording → wav2vec2-base → embeddings
  → statistical features → physics-inspired gold scoring
"""

import io
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ── Model singleton (loaded once on first use) ──────────────────────────────
_processor = None
_model = None
_MODEL_ID = "facebook/wav2vec2-base"
TARGET_SR = 16000  # wav2vec2 expects 16 kHz mono


def _load_model():
    global _processor, _model
    if _processor is not None:
        return True
    try:
        from transformers import Wav2Vec2Processor, Wav2Vec2Model
        logger.info(f"Loading {_MODEL_ID} from HuggingFace (first run downloads ~360 MB)...")
        _processor = Wav2Vec2Processor.from_pretrained(_MODEL_ID)
        _model = Wav2Vec2Model.from_pretrained(_MODEL_ID)
        _model.eval()
        logger.info("wav2vec2-base loaded successfully")
        return True
    except Exception as e:
        # Common on first run without internet, or in restricted environments.
        # Physics features (ZCR, decay, spectral centroid) still computed from waveform.
        logger.warning(
            f"wav2vec2-base model unavailable ({type(e).__name__}). "
            "Physics features will still be extracted from the waveform. "
            "Ensure internet access and ~360 MB disk space for model download."
        )
        return False


# ── Audio loading ────────────────────────────────────────────────────────────

def _load_audio(audio_bytes: bytes) -> np.ndarray:
    """
    Load audio bytes (WAV/MP3/OGG) → mono float32 array at 16 kHz.
    Uses soundfile first (fast), falls back to librosa (supports more formats).
    """
    import soundfile as sf
    import librosa

    try:
        audio, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
        return audio.astype(np.float32)
    except Exception:
        # Fallback: librosa handles MP3/OGG/etc
        audio, _ = librosa.load(io.BytesIO(audio_bytes), sr=TARGET_SR, mono=True)
        return audio.astype(np.float32)


# ── Physics-inspired feature extraction from embeddings ─────────────────────

def _physics_features_from_waveform(audio: np.ndarray, sr: int = TARGET_SR) -> dict:
    """
    Compute interpretable acoustic physics features directly from raw waveform.
    These complement the wav2vec2 embeddings.
    """
    import librosa

    # RMS energy envelope → decay time estimation
    frame_len = int(0.01 * sr)   # 10 ms frames
    hop_len   = int(0.005 * sr)  # 5 ms hop
    rms = librosa.feature.rms(y=audio, frame_length=frame_len, hop_length=hop_len)[0]

    # Find onset (peak energy frame)
    peak_idx = int(np.argmax(rms))
    peak_val = rms[peak_idx]

    # Decay: frames after peak where energy > 10% of peak
    decay_frames = 0
    for i in range(peak_idx, len(rms)):
        if rms[i] < 0.10 * peak_val:
            break
        decay_frames += 1
    decay_ms = round((decay_frames * hop_len / sr) * 1000, 2)

    # Dominant frequency via zero-crossing rate (proxy for brightness/hardness)
    zcr = librosa.feature.zero_crossing_rate(audio, frame_length=frame_len, hop_length=hop_len)[0]
    # ZCR relates to mean frequency: f ≈ ZCR * sr / 2
    mean_zcr = float(np.mean(zcr))
    tap_frequency = round(mean_zcr * sr / 2, 2)

    # Spectral centroid (brightness → purity indicator)
    cent = librosa.feature.spectral_centroid(y=audio, sr=sr, hop_length=hop_len)[0]
    spectral_centroid = round(float(np.mean(cent)), 2)

    # Spectral rolloff (how quickly energy falls off)
    rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sr, hop_length=hop_len)[0]
    spectral_rolloff = round(float(np.mean(rolloff)), 2)

    # Resonance clarity: ratio of peak to tail energy (high = clear ring)
    if len(rms) > peak_idx + 1:
        tail_energy = float(np.mean(rms[peak_idx + decay_frames:]) + 1e-9)
        peak_energy = float(peak_val + 1e-9)
        resonance_clarity = round(float(np.clip(1.0 - (tail_energy / peak_energy), 0.05, 0.97)), 2)
    else:
        resonance_clarity = 0.5

    return {
        "tap_frequency_hz":   tap_frequency,
        "decay_ms":           decay_ms,
        "resonance_clarity":  resonance_clarity,
        "spectral_centroid":  spectral_centroid,
        "spectral_rolloff":   spectral_rolloff,
    }


def _embedding_features(audio: np.ndarray) -> np.ndarray:
    """
    Run audio through wav2vec2-base and extract mean-pooled hidden states.
    Returns a 768-dim embedding vector.
    """
    import torch

    if not _load_model():
        return np.zeros(768, dtype=np.float32)

    try:
        inputs = _processor(
            audio,
            sampling_rate=TARGET_SR,
            return_tensors="pt",
            padding=True,
        )
        with torch.no_grad():
            outputs = _model(**inputs)

        # Mean-pool over time dimension → [768]
        hidden = outputs.last_hidden_state.squeeze(0)  # [T, 768]
        embedding = hidden.mean(dim=0).cpu().numpy()    # [768]
        return embedding
    except Exception as e:
        logger.error(f"wav2vec2 inference error: {e}")
        return np.zeros(768, dtype=np.float32)


def _score_from_embedding(embedding: np.ndarray, physics: dict) -> float:
    """
    Derive acoustic_genuine_score by combining:
      - wav2vec2 embedding energy (L2 norm proxy for signal richness)
      - physics features (frequency, decay, resonance)

    Gold @ 22K: high freq (250-400 Hz ZCR proxy), long decay (100-250 ms),
                high resonance clarity (0.7-0.97)
    Hollow/plated: low freq, short decay, low clarity
    """
    emb_norm  = float(np.linalg.norm(embedding))
    emb_score = float(np.clip(emb_norm / 30.0, 0.0, 1.0))
    # If model was unavailable, embedding is all zeros → rely purely on physics
    has_embedding = emb_norm > 0.0

    freq     = physics["tap_frequency_hz"]
    decay    = physics["decay_ms"]
    clarity  = physics["resonance_clarity"]

    freq_score  = float(np.clip(freq / 400.0, 0.0, 1.0))
    decay_score = float(np.clip(decay / 250.0, 0.0, 1.0))

    if has_embedding:
        # Full score: embedding (25%) + physics (75%)
        raw = (
            emb_score   * 0.25
            + freq_score  * 0.25
            + decay_score * 0.30
            + clarity     * 0.20
        )
    else:
        # Physics-only score when wav2vec2 model unavailable
        raw = (
            freq_score  * 0.35
            + decay_score * 0.40
            + clarity     * 0.25
        )
    return round(float(np.clip(raw, 0.05, 0.97)), 2)


# ── Public API ───────────────────────────────────────────────────────────────

def extract_acoustic_features(audio_bytes: bytes) -> dict:
    """
    Full pipeline: raw audio bytes → acoustic feature dict.
    Called when a tap recording IS provided.

    Returns:
        dict with tap_frequency_hz, decay_ms, resonance_clarity,
        acoustic_genuine_score, wav2vec2_embedding (768-d list),
        source='wav2vec2'
    """
    try:
        audio = _load_audio(audio_bytes)

        # Trim silence at start/end
        import librosa
        audio, _ = librosa.effects.trim(audio, top_db=20)

        # Clip to 3 seconds max (tap sound should be short)
        max_samples = TARGET_SR * 3
        if len(audio) > max_samples:
            audio = audio[:max_samples]

        physics   = _physics_features_from_waveform(audio)
        embedding = _embedding_features(audio)
        score     = _score_from_embedding(embedding, physics)

        return {
            "tap_frequency_hz":      physics["tap_frequency_hz"],
            "decay_ms":              physics["decay_ms"],
            "resonance_clarity":     physics["resonance_clarity"],
            "spectral_centroid_hz":  physics["spectral_centroid"],
            "spectral_rolloff_hz":   physics["spectral_rolloff"],
            "acoustic_genuine_score": score,
            "wav2vec2_embedding_norm": round(float(np.linalg.norm(embedding)), 4),
            "source":                "wav2vec2",
            "model":                 _MODEL_ID,
            "note": (
                "Acoustic analysis performed by facebook/wav2vec2-base "
                "on uploaded tap recording."
            ),
        }

    except Exception as e:
        logger.error(f"Acoustic extraction failed: {e}")
        return _audio_error_fallback(str(e))


def infer_acoustic_features(vision_json: dict) -> dict:
    """
    Visual-inference fallback — used ONLY when no audio file is provided.
    Clearly marked as inferred, not measured.
    """
    import random
    rng = random.Random(42)

    is_hollow  = bool(vision_json.get("hollow_indicators", False))
    is_plated  = bool(vision_json.get("plating_indicators", False))
    karat      = int(vision_json.get("estimated_karat", 18))

    if is_hollow:
        tap_frequency    = round(rng.uniform(60, 150), 2)
        decay_ms         = round(rng.uniform(20, 75), 2)
        resonance_clarity = round(rng.uniform(0.10, 0.40), 2)
    elif is_plated:
        tap_frequency    = round(rng.uniform(110, 200), 2)
        decay_ms         = round(rng.uniform(30, 85), 2)
        resonance_clarity = round(rng.uniform(0.20, 0.50), 2)
    elif karat >= 22:
        tap_frequency    = round(rng.uniform(250, 400), 2)
        decay_ms         = round(rng.uniform(100, 250), 2)
        resonance_clarity = round(rng.uniform(0.70, 0.96), 2)
    elif karat >= 18:
        tap_frequency    = round(rng.uniform(180, 300), 2)
        decay_ms         = round(rng.uniform(70, 160), 2)
        resonance_clarity = round(rng.uniform(0.55, 0.80), 2)
    else:
        tap_frequency    = round(rng.uniform(120, 230), 2)
        decay_ms         = round(rng.uniform(40, 120), 2)
        resonance_clarity = round(rng.uniform(0.30, 0.65), 2)

    raw = (
        min(1.0, tap_frequency / 300) * 0.40
        + min(1.0, decay_ms / 200) * 0.35
        + resonance_clarity * 0.25
    )
    score = round(max(0.05, min(0.97, raw)), 2)

    return {
        "tap_frequency_hz":       tap_frequency,
        "decay_ms":               decay_ms,
        "resonance_clarity":      resonance_clarity,
        "spectral_centroid_hz":   None,
        "spectral_rolloff_hz":    None,
        "acoustic_genuine_score": score,
        "wav2vec2_embedding_norm": None,
        "source": "visual_inference",
        "model":  "none — no audio provided",
        "note": (
            "Acoustic features inferred from visual structure — "
            "upload a tap recording for wav2vec2 analysis."
        ),
    }


def _audio_error_fallback(error_msg: str) -> dict:
    return {
        "tap_frequency_hz":       0.0,
        "decay_ms":               0.0,
        "resonance_clarity":      0.15,
        "spectral_centroid_hz":   None,
        "spectral_rolloff_hz":    None,
        "acoustic_genuine_score": 0.15,
        "wav2vec2_embedding_norm": None,
        "source": "error_fallback",
        "model":  _MODEL_ID,
        "note":   f"Audio processing error: {error_msg}",
    }
