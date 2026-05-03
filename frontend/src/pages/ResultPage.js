import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { getRiskColor, getRecColor, getConfLabel } from '../utils/api';
import ScrollReveal from '../components/ScrollReveal';

const recBg = rec =>
  rec === 'PRE-APPROVE'   ? 'rgba(74,222,128,0.06)'   :
  rec === 'MANUAL-REVIEW' ? 'rgba(245,158,11,0.06)'   : 'rgba(248,113,113,0.06)';
const recBorder = rec =>
  rec === 'PRE-APPROVE'   ? 'rgba(74,222,128,0.2)'    :
  rec === 'MANUAL-REVIEW' ? 'rgba(245,158,11,0.2)'    : 'rgba(248,113,113,0.2)';

function DRRow({ label, value, gold }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:12, color:'var(--text-faint)' }}>{label}</span>
      <span style={{
        fontSize:12, fontWeight: gold ? 600 : 400,
        color: gold ? 'var(--gold)' : 'var(--text-dim)',
        fontFamily: gold ? 'var(--font-mono)' : 'inherit',
      }}>{value}</span>
    </div>
  );
}

export default function ResultPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const r  = state?.result;
  const sig = r?.model_signals || {};

  useEffect(() => {
    if (!r) return;
    try {
      const h = JSON.parse(localStorage.getItem('gs_history') || '[]');
      h.unshift(r);
      localStorage.setItem('gs_history', JSON.stringify(h.slice(0,50)));
    } catch {}
  }, [r]);

  if (!r) return (
    <div style={{ paddingTop:120, textAlign:'center', color:'var(--text-faint)' }}>
      No result data.
      <button className="btn-magnetic btn-ghost" data-hover
        onClick={() => navigate('/scan')} style={{ marginLeft:12 }}>
        Run assessment
      </button>
    </div>
  );

  const isRealAcoustic = sig.acoustic_source === 'wav2vec2';
  const recColor = getRecColor(r.recommendation);

  const signals8 = [
    { label:'Image Quality',   value:`${sig.image_quality}/4`, color: sig.image_quality >= 3 ? 'var(--success)' : 'var(--warning)' },
    { label:'Vision Conf.',    value:`${((sig.vision_confidence||0)*100).toFixed(0)}%`, color:'var(--gold)' },
    { label:'Acoustic Score',  value:`${((sig.acoustic_genuine_score||0)*100).toFixed(0)}%`, color: isRealAcoustic ? 'var(--info)' : 'var(--gold)' },
    { label:'Resonance',       value: sig.resonance_clarity != null ? `${(sig.resonance_clarity*100).toFixed(0)}%` : '—', color: isRealAcoustic ? 'var(--info)' : 'var(--text-faint)' },
    { label:'Hallmark',        value: sig.hallmark_detected ? sig.hallmark_type : 'NONE', color: sig.hallmark_detected ? 'var(--success)' : 'var(--warning)' },
    { label:'Plating',         value: sig.plating_detected ? 'DETECTED' : 'CLEAR', color: sig.plating_detected ? 'var(--danger)' : 'var(--success)' },
    { label:'Hollow',          value: sig.hollow_detected  ? 'DETECTED' : 'SOLID', color: sig.hollow_detected  ? 'var(--danger)' : 'var(--success)' },
    { label:'Tap Freq.',       value: sig.tap_frequency_hz ? `${Number(sig.tap_frequency_hz).toFixed(0)} Hz` : '—', color: isRealAcoustic ? 'var(--info)' : 'var(--gold)' },
  ];

  return (
    <div style={{ paddingTop:80, maxWidth:920, margin:'0 auto', padding:'80px 2rem 80px' }}>

      {/* Header */}
      <ScrollReveal>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--gold)', marginBottom:6 }}>
              ASSESSMENT #{r.assessment_id} · {new Date(r.timestamp).toLocaleString()}
            </div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(30px,4vw,48px)',
              fontWeight:300, letterSpacing:'-0.5px', lineHeight:1.1 }}>
              GoldSense <em className="gold-gradient">report</em>
            </h1>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
            <span style={{
              padding:'4px 12px', borderRadius:100, fontSize:10, fontWeight:500,
              fontFamily:'var(--font-mono)', border:'1px solid',
              background: r.vision_api_success ? 'rgba(201,168,76,0.08)' : 'rgba(245,158,11,0.08)',
              color:       r.vision_api_success ? 'var(--gold)'           : 'var(--warning)',
              borderColor: r.vision_api_success ? 'rgba(201,168,76,0.25)':'rgba(245,158,11,0.2)',
            }}>
              {r.vision_api_success ? '● Qwen2.5-VL' : '● Vision fallback'}
            </span>
            <span style={{
              padding:'4px 12px', borderRadius:100, fontSize:10, fontFamily:'var(--font-mono)',
              background: isRealAcoustic ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.04)',
              color:       isRealAcoustic ? 'var(--info)' : 'var(--text-faint)',
              border:     `1px solid ${isRealAcoustic ? 'rgba(96,165,250,0.2)' : 'var(--border)'}`,
            }}>
              {isRealAcoustic ? '● wav2vec2-base' : '○ visual inference'}
            </span>
          </div>
        </div>
      </ScrollReveal>

      {/* Recommendation banner */}
      <ScrollReveal delay={60}>
        <div className="result-banner" style={{
          background: recBg(r.recommendation),
          border: `1px solid ${recBorder(r.recommendation)}`,
        }}>
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)', marginBottom:6 }}>
              LENDING RECOMMENDATION
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:300, color: recColor }}>
              {r.recommendation}
            </div>
          </div>
          <div style={{ display:'flex', gap:32 }}>
            {[
              { label:'RISK',       value: r.risk_level,  color: getRiskColor(r.risk_level) },
              { label:'CONFIDENCE', value:`${(r.confidence_score*100).toFixed(0)}%`, color:'var(--gold)' },
              { label:'FRAUD',      value: r.is_fraud_flagged ? 'FLAGGED':'CLEAR',
                color: r.is_fraud_flagged ? 'var(--danger)' : 'var(--success)' },
            ].map(m => (
              <div key={m.label} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-faint)',
                  textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{m.label}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:300, color: m.color }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* 2-col */}
      <ScrollReveal delay={80}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div className="form-card">
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)',
              textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Jewelry Assessment</div>
            <DRRow label="Type"           value={r.jewelry_type} />
            <DRRow label="Karat"          value={r.estimated_karat} gold />
            <DRRow label="Weight Range"   value={r.weight_range} />
            <DRRow label="Purity Band"    value={r.purity_band} />
            <DRRow label="Declared Check" value={r.declared_data_check} />
          </div>

          <div className="form-card">
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)',
              textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Loan Eligibility</div>
            <div style={{
              background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.2)',
              borderRadius:10, padding:'14px', textAlign:'center', marginBottom:14,
            }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-faint)',
                marginBottom:6, textTransform:'uppercase', letterSpacing:'0.1em' }}>Loan Range</div>
              <div className="gold-gradient" style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:300 }}>
                {r.loan_eligibility}
              </div>
            </div>
            <DRRow label="Market Value" value={r.market_value} />
            <DRRow label="LTV"          value={r.ltv} />
            <DRRow label="Confidence"   value={getConfLabel(r.confidence_score)} />
            <div style={{ marginTop:12 }}>
              <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:100, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:100,
                  width:`${r.confidence_score*100}%`,
                  background:'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                  transition:'width 0.8s var(--ease-out)',
                }} />
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Signal grid */}
      <ScrollReveal delay={100}>
        <div className="signal-grid-8" style={{ marginBottom:16 }}>
          {signals8.map(s => (
            <div key={s.label} className="sig-cell">
              <div className="sig-val" style={{ color: s.color }}>{s.value}</div>
              <div className="sig-label">{s.label}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* wav2vec2 detail */}
      {isRealAcoustic && (
        <ScrollReveal delay={110}>
          <div className="form-card" style={{ borderColor:'rgba(96,165,250,0.2)', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)',
                textTransform:'uppercase', letterSpacing:'0.1em' }}>wav2vec2 Acoustic Analysis</div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--info)',
                background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)',
                padding:'3px 10px', borderRadius:100 }}>facebook/wav2vec2-base · local</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                { l:'Tap Frequency',    v: sig.tap_frequency_hz ? `${Number(sig.tap_frequency_hz).toFixed(1)} Hz` : '—' },
                { l:'Decay Time',       v: sig.decay_ms ? `${Number(sig.decay_ms).toFixed(1)} ms` : '—' },
                { l:'Resonance',        v: sig.resonance_clarity ? `${(sig.resonance_clarity*100).toFixed(0)}%` : '—' },
                { l:'Embedding Norm',   v: sig.wav2vec2_embedding_norm ? Number(sig.wav2vec2_embedding_norm).toFixed(2) : '—' },
                { l:'Spectral Centroid',v: sig.spectral_centroid_hz ? `${Number(sig.spectral_centroid_hz).toFixed(0)} Hz` : '—' },
                { l:'Genuine Score',    v: `${((sig.acoustic_genuine_score||0)*100).toFixed(0)}%` },
                { l:'Source',           v: 'Tap Recording' },
                { l:'Model',            v: 'wav2vec2-base' },
              ].map(item => (
                <div key={item.l}>
                  <div style={{ fontSize:9, color:'var(--text-faint)', textTransform:'uppercase',
                    letterSpacing:'0.08em', marginBottom:4 }}>{item.l}</div>
                  <div style={{ fontSize:12, color:'var(--info)', fontFamily:'var(--font-mono)' }}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Provenance */}
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-faint)',
        textAlign:'center', marginBottom:16 }}>
        Visual: Qwen2.5-VL-7B (OpenRouter) ·
        Acoustic: {isRealAcoustic ? 'wav2vec2-base (local HuggingFace)' : 'visual inference'} ·
        Decision: XGBoost 2.0
      </div>

      {/* Fraud */}
      <ScrollReveal delay={120}>
        <div className="form-card" style={{
          borderColor: r.fraud_flags?.length ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)',
          background:  r.fraud_flags?.length ? 'rgba(248,113,113,0.04)' : 'rgba(74,222,128,0.04)',
          marginBottom:16,
        }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Fraud Analysis</div>
          {r.fraud_flags?.length
            ? r.fraud_flags.map((f,i) => (
                <div key={i} style={{ color:'var(--danger)', fontSize:12, marginBottom:6 }}>⚠ {f}</div>
              ))
            : <div style={{ color:'var(--success)', fontSize:12 }}>✓ No fraud indicators detected</div>
          }
        </div>
      </ScrollReveal>

      {/* Visual findings */}
      {r.visual_findings?.length > 0 && (
        <ScrollReveal delay={130}>
          <div className="form-card" style={{ marginBottom:16 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)',
              textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Visual Findings</div>
            {r.visual_findings.map((f,i) => (
              <div key={i} style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6,
                paddingLeft:12, borderLeft:'2px solid rgba(201,168,76,0.3)' }}>{f}</div>
            ))}
          </div>
        </ScrollReveal>
      )}

      {/* Assessor note */}
      <ScrollReveal delay={140}>
        <div className="form-card" style={{ marginBottom:24 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-faint)',
            textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Assessor Note</div>
          <p style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.7 }}>{r.assessor_note}</p>
          <div style={{ marginTop:14, borderLeft:'2px solid var(--gold-dim)',
            background:'rgba(201,168,76,0.03)', borderRadius:'0 8px 8px 0', padding:'10px 14px' }}>
            <p style={{ fontSize:11, color:'var(--text-faint)', fontStyle:'italic', lineHeight:1.65 }}>
              {r.acoustic_note}
            </p>
          </div>
        </div>
      </ScrollReveal>

      <div style={{ display:'flex', gap:12 }}>
        <button className="btn-magnetic btn-ghost" data-hover onClick={() => navigate('/scan')}>
          ← New assessment
        </button>
        <button className="btn-magnetic btn-primary" data-hover onClick={() => navigate('/dashboard')}>
          View dashboard →
        </button>
      </div>
    </div>
  );
}
