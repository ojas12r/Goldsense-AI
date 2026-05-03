#!/bin/bash
set -e
cd "$(dirname "$0")/backend"

[ ! -f .env ] && cp ../.env.example .env \
  && echo "⚠  Copied .env.example → .env — add your OPENROUTER_API_KEY!"

echo "📦 Installing Python dependencies..."
pip install -r requirements.txt -q

echo "🔊 Pre-downloading facebook/wav2vec2-base from HuggingFace..."
python -c "
from transformers import Wav2Vec2Processor, Wav2Vec2Model
Wav2Vec2Processor.from_pretrained('facebook/wav2vec2-base')
Wav2Vec2Model.from_pretrained('facebook/wav2vec2-base')
print('wav2vec2-base ready')
"

[ ! -f goldsense_xgb.pkl ] \
  && echo "🔨 Training XGBoost models (one-time, ~30s)..." \
  && python train_model.py

echo ""
echo "✅  Backend ready at   http://localhost:8000"
echo "📚  Swagger docs at    http://localhost:8000/docs"
echo "🎙  Acoustic model:    facebook/wav2vec2-base (local)"
echo "👁  Vision model:      qwen/qwen-2.5-vl-7b-instruct (OpenRouter)"
echo ""
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
