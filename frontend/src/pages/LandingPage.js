import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const signals = [
  { icon: '◈', color: '#C9A84C', title: 'Visual Intelligence',
    desc: 'Qwen2.5-VL-7B analyzes jewelry photographs to detect karat, hallmarks, surface wear, and fraud indicators with sub-second latency.',
    tags: ['Qwen2.5-VL', 'Hallmark detection', 'Karat estimation', 'Fraud flags'] },
  { icon: '◎', color: '#60a5fa', title: 'Acoustic Analysis',
    desc: 'wav2vec2-base processes tap recordings to extract resonance frequency, decay time, and spectral features indicating gold purity.',
    tags: ['wav2vec2-base', 'Tap frequency', 'Decay time', 'Resonance'] },
  { icon: '◇', color: '#4ade80', title: 'Declared Data',
    desc: 'Cross-validates customer-declared weight, karat, and purchase bills against visual and acoustic signals to surface discrepancies.',
    tags: ['Weight check', 'Karat cross-check', 'Bill verification'] },
];

const steps = [
  { n: '01', title: 'Upload', desc: 'Customer photo + optional tap recording of the gold jewelry', icon: '📷' },
  { n: '02', title: 'Analyze', desc: 'Qwen2.5-VL vision model + wav2vec2 acoustic feature extraction', icon: '🔬' },
  { n: '03', title: 'Fuse', desc: 'XGBoost gradient boosting across 24 multimodal features', icon: '⚡' },
  { n: '04', title: 'Report', desc: 'Risk classification, loan range, confidence score, fraud detection', icon: '📊' },
];

const stats = [
  { value: '₹75K Cr', label: 'Gold Loan Market' },
  { value: '<60s', label: 'Assessment Time' },
  { value: '24', label: 'Fused Features' },
  { value: '75%', label: 'RBI LTV Cap' },
];

const models = [
  { label: 'Vision', name: 'Qwen2.5-VL-7B', desc: 'Multimodal LLM via OpenRouter API — karat, hallmarks, wear, fraud detection.', accent: '#C9A84C' },
  { label: 'Acoustic', name: 'wav2vec2-base', desc: 'HuggingFace local model — resonance frequency, decay time, spectral analysis.', accent: '#60a5fa' },
  { label: 'Fusion', name: 'XGBoost 2.0', desc: '4 gradient-boosted classifiers — risk, recommendation, confidence, fraud.', accent: '#4ade80' },
  { label: 'Infra', name: 'FastAPI + OpenRouter', desc: 'Async backend with graceful fallback chains — always returns a decision.', accent: '#a78bfa' },
];

function ScrollProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    const fn = () => {
      if (barRef.current) {
        const p = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        barRef.current.style.transform = `scaleX(${Math.min(p, 1)})`;
      }
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return <div className="gs-progress"><div ref={barRef} className="gs-progress-bar" /></div>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const mainRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Hero parallax fade
      gsap.to('.gs-hero-inner', {
        scale: 0.9, opacity: 0, y: -50, ease: 'none',
        scrollTrigger: { trigger: '.gs-hero', start: 'top top', end: 'bottom top', scrub: true },
      });

      // Reveal animations for each section
      gsap.utils.toArray('.gs-reveal').forEach(el => {
        gsap.from(el, {
          y: 40, opacity: 0, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
        });
      });

      // Stagger children
      gsap.utils.toArray('.gs-stagger').forEach(container => {
        const items = container.children;
        gsap.from(items, {
          y: 50, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out',
          scrollTrigger: { trigger: container, start: 'top 88%', toggleActions: 'play none none none' },
        });
      });

    }, mainRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={mainRef} className="gs-page">
      <ScrollProgress />

      {/* ═══ HERO ═══ */}
      <section className="gs-hero">
        <div className="gs-hero-orb gs-hero-orb-1" />
        <div className="gs-hero-orb gs-hero-orb-2" />
        <div className="gs-hero-orb gs-hero-orb-3" />
        <div className="gs-hero-grid-bg" />

        <div className="gs-hero-inner">
          <div className="gs-badge gs-reveal">
            <span className="gs-badge-dot" />
            Poonawalla Fincorp AI Hackathon 2024
          </div>
          <h1 className="gs-hero-title gs-reveal">
            Gold loans,<br />
            <span className="gs-accent">reimagined</span><br />
            by AI.
          </h1>
          <p className="gs-hero-sub gs-reveal">
            Upload a photo, tap a recording — get a confidence-calibrated
            NBFC lending decision in under 60&nbsp;seconds. Powered by vision AI,
            acoustic analysis, and gradient boosting.
          </p>
          <div className="gs-hero-btns gs-reveal">
            <button className="gs-btn gs-btn-gold" onClick={() => navigate('/scan')}>⚡ Start Assessment</button>
            <button className="gs-btn gs-btn-outline" onClick={() => navigate('/dashboard')}>View Dashboard →</button>
          </div>
        </div>

        <div className="gs-scroll-cue">
          <div className="gs-scroll-line" />
          <span>scroll</span>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="gs-section">
        <div className="gs-container">
          <div className="gs-stats-strip gs-stagger">
            {stats.map(s => (
              <div key={s.label} className="gs-stat">
                <div className="gs-stat-val">{s.value}</div>
                <div className="gs-stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SIGNALS ═══ */}
      <section className="gs-section">
        <div className="gs-container">
          <div className="gs-section-head gs-reveal">
            <span className="gs-label">Three Fused AI Signals</span>
            <h2 className="gs-h2">Every assessment fuses<br /><span className="gs-accent">three independent streams.</span></h2>
          </div>
          <div className="gs-cards-3 gs-stagger">
            {signals.map((s, i) => (
              <div key={s.title} className="gs-card gs-card-signal" style={{ '--c': s.color }}>
                <div className="gs-card-top-line" />
                <div className="gs-card-icon" style={{ color: s.color, borderColor: `${s.color}33` }}>{s.icon}</div>
                <h3 className="gs-card-title" style={{ color: s.color }}>{s.title}</h3>
                <p className="gs-card-desc">{s.desc}</p>
                <div className="gs-tags">
                  {s.tags.map(t => <span key={t} className="gs-tag">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="gs-section gs-section-alt">
        <div className="gs-container">
          <div className="gs-section-head gs-reveal">
            <span className="gs-label">How It Works</span>
            <h2 className="gs-h2">Four steps to<br /><span className="gs-accent">a lending decision.</span></h2>
          </div>
          <div className="gs-steps gs-stagger">
            {steps.map((s, i) => (
              <div key={s.n} className="gs-step">
                <div className="gs-step-left">
                  <div className="gs-step-badge">{s.icon}<span>{s.n}</span></div>
                  {i < steps.length - 1 && <div className="gs-step-connector" />}
                </div>
                <div className="gs-step-right">
                  <h3 className="gs-step-title">{s.title}</h3>
                  <p className="gs-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MODEL STACK ═══ */}
      <section className="gs-section">
        <div className="gs-container">
          <div className="gs-section-head gs-reveal">
            <span className="gs-label">Model Stack</span>
            <h2 className="gs-h2">State-of-the-art models,<br /><span className="gs-accent">locally and via API.</span></h2>
          </div>
          <div className="gs-cards-2 gs-stagger">
            {models.map(m => (
              <div key={m.name} className="gs-card gs-card-model" style={{ '--c': m.accent }}>
                <div className="gs-card-top-line" />
                <div className="gs-model-head">
                  <span className="gs-model-badge" style={{ background: `${m.accent}15`, color: m.accent, borderColor: `${m.accent}30` }}>{m.label}</span>
                </div>
                <h3 className="gs-card-title" style={{ fontSize: 20 }}>{m.name}</h3>
                <p className="gs-card-desc">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="gs-section">
        <div className="gs-container">
          <div className="gs-cta gs-reveal">
            <div className="gs-cta-glow" />
            <span className="gs-label" style={{ justifyContent: 'center' }}>Ready to assess</span>
            <h2 className="gs-cta-h2">Lend smarter.<br /><span className="gs-accent">Trust the signal.</span></h2>
            <p className="gs-cta-sub">No XRF machine. No branch visit. Just upload, tap, and decide.</p>
            <div className="gs-hero-btns" style={{ justifyContent: 'center' }}>
              <button className="gs-btn gs-btn-gold" onClick={() => navigate('/scan')}>⚡ Start First Assessment</button>
              <button className="gs-btn gs-btn-outline" onClick={() => navigate('/dashboard')}>View Dashboard →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="gs-footer">
        <div className="gs-container gs-footer-inner">
          <span>GoldSense AI v2.1 · Poonawalla Fincorp Hackathon 2024</span>
          <span>Vision: Qwen2.5-VL · Acoustic: wav2vec2-base · Decision: XGBoost</span>
        </div>
      </footer>
    </div>
  );
}
