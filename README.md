<p align="center">
  <strong>G</strong>
</p>

<h1 align="center">GoldSense AI v2.1</h1>

<p align="center">
  <em>AI-powered gold jewelry assessment system for NBFC lending decisions</em><br/>
  <strong>Poonawalla Fincorp AI Hackathon 2024</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vision-Qwen2.5--VL--7B-C9A84C?style=flat-square" />
  <img src="https://img.shields.io/badge/Acoustic-wav2vec2--base-60A5FA?style=flat-square" />
  <img src="https://img.shields.io/badge/Decision-XGBoost%202.0-4ADE80?style=flat-square" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square" />
  <img src="https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=flat-square" />
</p>

---

## Problem Statement

Indian NBFCs process **Rs 75,000 Cr+** in gold loans annually. Current assessment relies on expensive XRF machines, branch visits, and manual appraisal — slow, subjective, and fraud-prone. GoldSense AI replaces this with a **60-second, AI-powered assessment** using just a smartphone photo and an optional tap recording.

---

## How It Works

```
Customer uploads photo + optional tap recording + declared data
                          |
                    FastAPI /assess
                          |
          +---------------+----------------+
          |               |                |
   Qwen2.5-VL-7B    wav2vec2-base    Declared Data
   (OpenRouter)     (HuggingFace)    Cross-validation
          |               |                |
          +-------+-------+--------+-------+
                  |                 |
            24 Fused Features      |
                  |                 |
          XGBoost Ensemble (4 models)
          |       |        |        |
        Risk   Recommend  Conf.   Fraud
       (L/M/H) (PRE/MAN/  (0-97%) (Y/N)
                 REJ)
                  |
        Full Underwriter Report -> React UI
```

### Three AI Signal Streams

| Signal | Model | Input | Output |
|--------|-------|-------|--------|
| **Visual** | `Qwen2.5-VL-7B` via OpenRouter | Jewelry photo | Karat, hallmark, wear, plating, hollow detection |
| **Acoustic** | `facebook/wav2vec2-base` (HuggingFace local) | Tap recording (WAV/MP3/OGG, 1–3s) | Resonance frequency, decay time, spectral centroid, embedding norm, genuine score |
| **Declared** | Cross-validation logic | Customer-entered weight/karat/bill | Discrepancy detection against visual + acoustic |

---

## Acoustic Analysis — Deep Dive

> **Core Innovation:** GoldSense AI uses **acoustic tap analysis** as a second independent signal stream alongside vision. When a user taps gold jewelry with a coin and records 1–3 seconds of audio, the system runs a dual-path pipeline combining deep learning (wav2vec2-base) with physics-inspired feature extraction to estimate gold authenticity.

### Pipeline Architecture

```
Raw Audio (WAV/MP3/OGG)
        │
        ▼
  ┌─────────────┐
  │ Audio Loader │  soundfile → librosa fallback
  │  Resample    │  Any sample rate → 16 kHz mono
  │  Trim + Clip │  Remove silence, max 3 seconds
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────────────────────────────────┐
│wav2vec2│ │  Physics Feature Extraction         │
│ -base  │ │  (librosa — no GPU required)        │
│        │ │                                      │
│ 16kHz  │ │  • RMS energy envelope (10ms frames) │
│ mono   │ │  • Zero-crossing rate → tap freq     │
│   │    │ │  • Spectral centroid → brightness     │
│   ▼    │ │  • Spectral rolloff → energy decay    │
│ [T,768]│ │  • Peak-to-tail ratio → resonance     │
│ hidden │ └──────────────┬───────────────────────┘
│ states │                │
│   │    │                │
│ mean   │                │
│ pool   │                │
│   │    │     ┌──────────┴──────────┐
│   ▼    │     │  Physics Features   │
│ [768]  │     │  tap_frequency_hz   │
│ embed  │     │  decay_ms           │
│        │     │  resonance_clarity  │
└───┬────┘     │  spectral_centroid  │
    │          │  spectral_rolloff   │
    │          └──────────┬──────────┘
    │                     │
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────┐
    │  Scoring Engine  │
    │                  │
    │  embedding: 25%  │
    │  frequency: 25%  │
    │  decay:     30%  │
    │  resonance: 20%  │
    └────────┬─────────┘
             │
             ▼
    acoustic_genuine_score (0.05 – 0.97)
```

### Model: `facebook/wav2vec2-base`

| Property | Value |
|----------|-------|
| Architecture | Wav2Vec 2.0 (self-supervised speech representation) |
| Parameters | 95M |
| Hidden size | 768 dimensions |
| Input | 16 kHz mono waveform |
| Pre-training | 960 hours of LibriSpeech (unlabeled) |
| Download size | ~360 MB |
| Execution | Local CPU (no GPU required, no data leaves localhost) |
| Source | `transformers.Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base")` |

**Why wav2vec2?** Unlike traditional audio classification models trained on speech, wav2vec2's self-supervised pre-training learns general acoustic representations from raw waveforms. These representations capture timbral, spectral, and temporal patterns that transfer well to non-speech domains like metallic resonance analysis — without requiring labeled gold-audio datasets.

### Physics-Inspired Feature Extraction

Five interpretable features are extracted directly from the raw waveform using `librosa`:

| Feature | Extraction Method | Gold Signature | Fraud Indicator |
|---------|------------------|----------------|-----------------|
| **Tap Frequency** (Hz) | Zero-crossing rate × sr/2 | 250–400 Hz (bright, high-pitched ring) | <150 Hz (dull, hollow sound) |
| **Decay Time** (ms) | RMS envelope — frames above 10% of peak | 100–250 ms (sustained resonance) | <75 ms (dies quickly — hollow/plated) |
| **Resonance Clarity** | 1 − (tail energy / peak energy) | 0.70–0.97 (clean ring, low background) | <0.40 (muddy, dampened) |
| **Spectral Centroid** (Hz) | Energy-weighted mean frequency | High centroid = bright metallic sound | Low centroid = dull, non-metallic |
| **Spectral Rolloff** (Hz) | Frequency below which 85% energy lies | High rolloff = rich harmonics | Low rolloff = narrow spectrum |

### The Science Behind Gold Tap Testing

Gold's acoustic properties are directly related to its purity and structure:

```
┌────────────────────────────────────────────────────────────┐
│                   GOLD TAP RESPONSE                        │
├──────────┬──────────────┬──────────────┬──────────────────┤
│  Karat   │  Frequency   │  Decay Time  │  Resonance       │
├──────────┼──────────────┼──────────────┼──────────────────┤
│  24K     │  300-400 Hz  │  150-250 ms  │  0.80-0.97       │
│  22K     │  250-400 Hz  │  100-250 ms  │  0.70-0.96       │
│  18K     │  180-300 Hz  │   70-160 ms  │  0.55-0.80       │
│  14K     │  120-230 Hz  │   40-120 ms  │  0.30-0.65       │
├──────────┼──────────────┼──────────────┼──────────────────┤
│  Hollow  │   60-150 Hz  │   20-75 ms   │  0.10-0.40       │
│  Plated  │  110-200 Hz  │   30-85 ms   │  0.20-0.50       │
└──────────┴──────────────┴──────────────┴──────────────────┘

Higher karat → softer metal → longer ring → higher resonance clarity
Hollow → air gap → short decay → low frequency → low clarity
Plated → density mismatch → dampened resonance → medium frequency
```

### Acoustic Genuine Score Formula

The final `acoustic_genuine_score` combines wav2vec2 embeddings with physics features:

**With wav2vec2 embeddings available:**
```
score = (embedding_norm / 30.0) × 0.25     # Signal richness
      + (tap_freq / 400.0)      × 0.25     # Frequency indicator
      + (decay_ms / 250.0)      × 0.30     # Decay duration
      + resonance_clarity       × 0.20     # Ring quality

score = clip(score, 0.05, 0.97)
```

**Physics-only mode (wav2vec2 unavailable):**
```
score = (tap_freq / 400.0)      × 0.35     # Higher weight
      + (decay_ms / 250.0)      × 0.40     # Primary indicator
      + resonance_clarity       × 0.25     # Ring quality

score = clip(score, 0.05, 0.97)
```

### Acoustic Output Features

The acoustic pipeline returns these features for XGBoost fusion:

```json
{
  "tap_frequency_hz": 346.0,
  "decay_ms": 198.5,
  "resonance_clarity": 0.82,
  "spectral_centroid_hz": 2847.3,
  "spectral_rolloff_hz": 4521.0,
  "acoustic_genuine_score": 0.77,
  "wav2vec2_embedding_norm": 24.31,
  "source": "wav2vec2",
  "model": "facebook/wav2vec2-base"
}
```

### Acoustic Fallback Strategy

```
Tap audio provided?
├── YES → Load audio (soundfile → librosa fallback)
│         ├── wav2vec2-base available?
│         │   ├── YES → Full pipeline (embedding + physics) → source: "wav2vec2"
│         │   └── NO  → Physics-only features (librosa) → source: "physics_only"
│         └── Audio processing error? → Error fallback (score: 0.15)
│
└── NO  → Visual inference from jewelry structure → source: "visual_inference"
          (Infers acoustic properties from karat, hollow/plating detection)
```

---

### Four XGBoost Decision Models

| Model | Output | Features Used | Training |
|-------|--------|---------------|----------|
| Risk Classifier | `LOW` / `MEDIUM` / `HIGH` | All 24 (visual + acoustic + declared) | 5,000 synthetic samples |
| Recommendation Classifier | `PRE-APPROVE` / `MANUAL-REVIEW` / `REJECT` | All 24 (visual + acoustic + declared) | 5,000 synthetic samples |
| Confidence Regressor | `0.05` – `0.97` continuous score | All 24 (visual + acoustic + declared) | 5,000 synthetic samples |
| Fraud Classifier | Binary flag + specific fraud indicators | All 24 (visual + acoustic + declared) | 5,000 synthetic samples |

### 24 Fused Features (Input to XGBoost)

```
Visual (12):    estimated_karat, karat_confidence, hallmark_present,
                hallmark_clarity, hallmark_fake, wear_score,
                color_consistency, plating_indicators, hollow_indicators,
                image_quality, visual_confidence, visual_weight_estimate

Acoustic (4):   tap_frequency, decay_ms, resonance_clarity,
                acoustic_genuine_score

Declared (8):   jewelry_type_encoded, declared_weight, declared_karat,
                bill_present, bill_consistent, weight_discrepancy,
                karat_discrepancy, cross_signal_match
```

---

## Quick Start

### Prerequisites
- **Python 3.10+** (tested on 3.12)
- **Node.js 16+** (tested on 18)
- **OpenRouter API Key** — get from [openrouter.ai/keys](https://openrouter.ai/keys)

### 1. Configure environment
```bash
cp .env.example backend/.env
```
Edit `backend/.env` and set your API key:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
VISION_MODEL=qwen/qwen-2.5-vl-7b-instruct
PORT=8000
```

### 2. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

> **Note:** The `requirements.txt` includes `torch`, `transformers`, and `torchaudio` for wav2vec2 acoustic analysis (~2GB). If you want a lighter install, the backend gracefully falls back to visual inference for acoustic features without these packages.

### 3. Train the XGBoost model
```bash
python train_model.py
# Generates goldsense_xgb.pkl (~6.5MB) with 4 trained models
```

### 4. Start the backend
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
# -> http://localhost:8000
# -> Swagger: http://localhost:8000/docs
```

### 5. Start the frontend (new terminal)
```bash
cd frontend
npm install
npm start
# -> http://localhost:3000
```

### Verify
Open `http://localhost:3000` — the navbar should show **● Online** and **QWEN-2.5-VL-7B**.

---

## Project Structure

```
goldsense-ai/
├── backend/
│   ├── main.py                  # FastAPI app — /assess, /health, /config endpoints
│   ├── openrouter_vision.py     # Qwen2.5-VL API client (OpenRouter)
│   ├── acoustic_features.py     # wav2vec2-base acoustic pipeline + fallback
│   ├── image_features.py        # Pillow-based vision fallback
│   ├── fusion_model.py          # XGBoost inference + loan/fraud logic
│   ├── train_model.py           # Synthetic data generation + model training
│   ├── requirements.txt         # Python dependencies
│   └── goldsense_xgb.pkl        # Trained model bundle (generated)
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.js   # GSAP ScrollTrigger animated landing
│   │   │   ├── ScanPage.js      # Photo + audio upload + declared data form
│   │   │   ├── ResultPage.js    # Full assessment report with 8 signal metrics
│   │   │   └── DashboardPage.js # Assessment history with filters + expandable rows
│   │   ├── components/
│   │   │   ├── Navbar.js        # Status-aware nav (Online/Offline + model badge)
│   │   │   ├── ScrollReveal.js  # Intersection Observer reveal animations
│   │   │   └── Cursor.js        # Custom cursor
│   │   ├── utils/
│   │   │   └── api.js           # Backend API client + helper functions
│   │   ├── igloo.css            # Landing page premium scroll styles
│   │   ├── index.css            # Global design system (dark theme + gold accents)
│   │   ├── App.js               # React Router setup
│   │   └── index.js             # Entry point
│   └── package.json
│
├── .env.example                 # Environment template
├── start_backend.sh             # Backend launch script
├── start_frontend.sh            # Frontend launch script
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check — models loaded, API key status |
| `GET` | `/config` | Model configuration |
| `GET` | `/model-info` | XGBoost model metadata |
| `POST` | `/assess` | **Main endpoint** — multimodal jewelry assessment |

### `POST /assess` — Request

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `image` | File (optional) | — | Jewelry photograph (JPG/PNG/WEBP) |
| `tap_audio` | File (optional) | — | Tap recording (WAV/MP3/OGG, 1-3s) |
| `jewelry_type` | string | `"Bangle"` | Type of jewelry |
| `declared_weight` | float | `20.0` | Customer-declared weight in grams |
| `declared_karat` | int | `22` | Customer-declared karat |
| `bill_present` | bool | `false` | Whether purchase bill is provided |
| `bill_consistent` | bool | `false` | Whether bill matches declared data |
| `customer_name` | string | `""` | Customer name |
| `customer_id` | string | `""` | Customer identifier |
| `notes` | string | `""` | Additional observations |

### `POST /assess` — Response

```json
{
  "assessment_id": "798DE325",
  "risk_level": "MEDIUM",
  "recommendation": "MANUAL-REVIEW",
  "confidence_score": 0.47,
  "is_fraud_flagged": false,
  "estimated_karat": "22K estimated",
  "weight_range": "22.0g - 27.0g",
  "loan_eligibility": "₹87,656 - ₹1,03,125",
  "market_value": "₹1,37,500",
  "ltv": "75% LTV applicable",
  "fraud_flags": [],
  "model_signals": {
    "image_quality": 1,
    "vision_confidence": 0.15,
    "acoustic_genuine_score": 0.77,
    "hallmark_detected": false,
    "plating_detected": false,
    "hollow_detected": false,
    "tap_frequency_hz": 346,
    "decay_ms": 198,
    "resonance_clarity": 0.77
  }
}
```

---

## Fallback Chain

GoldSense AI is designed to **always return a decision**, even when components fail:

```
Vision:   Qwen2.5-VL (OpenRouter) -> Pillow color analysis -> Pessimistic defaults
Acoustic: wav2vec2-base (local)    -> Visual inference       -> Zero fallback
Decision: XGBoost ensemble         -> Hardcoded MANUAL-REVIEW
```

| Scenario | Vision | Acoustic | Decision |
|----------|--------|----------|----------|
| Photo + Audio + API key | ✅ Qwen2.5-VL | ✅ wav2vec2-base | ✅ XGBoost |
| Photo + No audio | ✅ Qwen2.5-VL | 🔄 Visual inference | ✅ XGBoost |
| No photo + No audio | 🔄 Pessimistic defaults | 🔄 Visual inference | ✅ XGBoost |
| No API key | 🔄 Pillow analysis | 🔄 Visual inference | ✅ XGBoost |
| No model file | 🔄 Any available | 🔄 Any available | 🔄 MANUAL-REVIEW |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Vision AI** | Qwen2.5-VL-7B (OpenRouter) | Jewelry image analysis — karat, hallmark, wear, fraud |
| **Acoustic AI** | wav2vec2-base (HuggingFace) | Tap sound analysis — resonance, decay, purity scoring |
| **Decision** | XGBoost 2.0 | 4-model ensemble over 24 fused features |
| **Backend** | FastAPI + Uvicorn | Async API with CORS, file upload, graceful fallbacks |
| **Frontend** | React 18 + React Router v6 | SPA with 4 pages + scroll animations |
| **Animations** | GSAP ScrollTrigger | Landing page scroll-driven reveals |
| **Design** | Custom CSS (dark + gold) | Premium dark theme with gold accents, glassmorphism |

---

## Vision Models

| Model | Quality | Cost | Use Case |
|-------|---------|------|----------|
| `qwen/qwen-2.5-vl-7b-instruct` | Good | Low | Development / testing |
| `qwen/qwen2.5-vl-32b-instruct` | Better | Medium | Accuracy-sensitive |
| `qwen/qwen2.5-vl-72b-instruct` | Best | Higher | Demo day presentations |

Set `VISION_MODEL` in `backend/.env` to switch models.

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| **Landing** | `/` | Animated scroll-reveal landing with stats, signals, pipeline, and CTA |
| **Scan** | `/scan` | Upload photo + audio, fill declared data, run assessment |
| **Result** | `/result` | Full report — recommendation, risk, confidence, loan range, 8 signal metrics, fraud analysis |
| **Dashboard** | `/dashboard` | Assessment history with filters (All/Pre-Approve/Manual/Reject), expandable detail rows |

---

## License

Built for the **Poonawalla Fincorp AI Hackathon 2024**.
