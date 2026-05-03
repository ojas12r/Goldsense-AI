import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskColor, getRecColor } from '../utils/api';
import ScrollReveal from '../components/ScrollReveal';

const JewelEmoji = { Bangle:'💍',Necklace:'📿',Ring:'💎',Chain:'⛓',Earrings:'💫',Bracelet:'🔗',Anklet:'✨',Pendant:'🪙' };

function Badge({ label, type }) {
  const cls = type==='PRE-APPROVE'||type==='LOW' ? 'badge-approve'
    : type==='MANUAL-REVIEW'||type==='MEDIUM'   ? 'badge-manual' : 'badge-reject';
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [history,  setHistory]  = useState([]);
  const [filter,   setFilter]   = useState('ALL');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('gs_history')||'[]')); } catch {}
  }, []);

  const filters  = ['ALL','PRE-APPROVE','MANUAL-REVIEW','REJECT'];
  const filtered = filter==='ALL' ? history : history.filter(r => r.recommendation===filter);

  const total    = history.length;
  const approved = history.filter(r => r.recommendation==='PRE-APPROVE').length;
  const manual   = history.filter(r => r.recommendation==='MANUAL-REVIEW').length;
  const rejected = history.filter(r => r.recommendation==='REJECT').length;
  const fraud    = history.filter(r => r.is_fraud_flagged).length;
  const avgConf  = total ? (history.reduce((s,r) => s+(r.confidence_score||0),0)/total*100).toFixed(0) : 0;
  const withAudio= history.filter(r => r.audio_provided).length;

  const statList = [
    { label:'Total',    value:total,    color:'var(--text)' },
    { label:'Approved', value:approved, color:'var(--success)' },
    { label:'Manual',   value:manual,   color:'var(--warning)' },
    { label:'Rejected', value:rejected, color:'var(--danger)' },
    { label:'Fraud',    value:fraud,    color:'var(--danger)' },
    { label:'Avg Conf', value:`${avgConf}%`, color:'var(--gold)' },
  ];

  return (
    <div style={{ paddingTop:80, maxWidth:960, margin:'0 auto', padding:'80px 2rem 80px' }}>

      <ScrollReveal>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28 }}>
          <div>
            <div className="section-label">NBFC Operations</div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(32px,4vw,52px)',
              fontWeight:300, letterSpacing:'-0.5px', lineHeight:1.1 }}>
              Assessment <em className="gold-gradient">dashboard</em>
            </h1>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {total > 0 && (
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--info)',
                background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)',
                padding:'4px 12px', borderRadius:100 }}>
                {withAudio} wav2vec2 · {total-withAudio} inferred
              </span>
            )}
            <button className="btn-magnetic btn-primary" data-hover onClick={() => navigate('/scan')}
              style={{ padding:'9px 20px', fontSize:13 }}>+ New Assessment</button>
          </div>
        </div>
      </ScrollReveal>

      {/* Stats */}
      <ScrollReveal delay={40}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:24 }}>
          {statList.map(s => (
            <div key={s.label} className="dash-stat">
              <div className="dash-stat-val" style={{ color:s.color }}>{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Filter tabs */}
      <ScrollReveal delay={60}>
        <div style={{ display:'flex', gap:6, marginBottom:20, alignItems:'center' }}>
          {filters.map(f => (
            <button key={f} data-hover onClick={() => setFilter(f)} style={{
              padding:'6px 16px', borderRadius:100, fontSize:11, fontWeight:500,
              border:'1px solid', cursor:'none',
              background:  filter===f ? 'rgba(201,168,76,0.1)' : 'transparent',
              color:       filter===f ? 'var(--gold)'           : 'var(--text-faint)',
              borderColor: filter===f ? 'rgba(201,168,76,0.3)' : 'var(--border)',
              fontFamily:'var(--font-body)',
              transition:'all 0.2s',
            }}>{f}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-faint)',
            fontFamily:'var(--font-mono)' }}>
            {filtered.length} record{filtered.length!==1?'s':''}
          </span>
        </div>
      </ScrollReveal>

      {filtered.length===0 ? (
        <ScrollReveal>
          <div style={{ textAlign:'center', color:'var(--text-faint)', padding:'80px 0',
            border:'1px dashed var(--border)', borderRadius:16 }}>
            <div style={{ fontSize:40, marginBottom:16 }}>◈</div>
            <div style={{ fontSize:13, marginBottom:16 }}>No assessments yet.</div>
            <button className="btn-magnetic btn-ghost" data-hover onClick={() => navigate('/scan')}>
              Run first assessment
            </button>
          </div>
        </ScrollReveal>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map((r,i) => {
            const isRealAcoustic = r.model_signals?.acoustic_source==='wav2vec2';
            const isExpanded = expanded===i;
            return (
              <ScrollReveal key={r.assessment_id||i} delay={i*30}>
                <div className="row-card">
                  <div className="row-header" onClick={() => setExpanded(isExpanded?null:i)} data-hover>
                    {/* Jewel thumb */}
                    <div style={{ width:36, height:36, borderRadius:8, flexShrink:0,
                      background:'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.2)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                      {JewelEmoji[r.jewelry_type]||'💍'}
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>
                        {r.customer_name||'Anonymous'}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-faint)', fontFamily:'var(--font-mono)' }}>
                        {r.customer_id||r.assessment_id}
                      </div>
                    </div>

                    <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:500,
                      color:'var(--gold)', minWidth:36 }}>{r.estimated_karat_value}K</div>

                    <div style={{ fontSize:12, color:'var(--text-dim)', minWidth:130 }}>{r.loan_eligibility}</div>

                    <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--gold)', minWidth:38 }}>
                      {((r.confidence_score||0)*100).toFixed(0)}%
                    </div>

                    {/* Dots */}
                    <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                      <span title={r.vision_api_success?'Qwen analyzed':'Fallback'} style={{
                        width:6, height:6, borderRadius:'50%',
                        background: r.vision_api_success ? 'var(--gold)' : '#333',
                        boxShadow: r.vision_api_success ? '0 0 6px var(--gold)' : 'none',
                      }} />
                      <span title={isRealAcoustic?'wav2vec2':'Visual inference'} style={{
                        width:6, height:6, borderRadius:'50%',
                        background: isRealAcoustic ? 'var(--info)' : '#333',
                        boxShadow: isRealAcoustic ? '0 0 6px var(--info)' : 'none',
                      }} />
                    </div>

                    <Badge label={r.risk_level}     type={r.risk_level} />
                    <Badge label={r.recommendation} type={r.recommendation} />

                    <span style={{ color:'var(--text-faint)', fontSize:12,
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition:'transform 0.3s', marginLeft:4 }}>↓</span>
                  </div>

                  {isExpanded && (
                    <div className="row-expanded">
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                        {[
                          { l:'Market Value',   v:r.market_value },
                          { l:'LTV',            v:r.ltv },
                          { l:'Declared Check', v:r.declared_data_check },
                          { l:'Hallmark',       v:r.model_signals?.hallmark_type||'N/A' },
                          { l:'Acoustic',       v:isRealAcoustic?'wav2vec2-base':'Inferred' },
                          { l:'Tap Freq.',      v:r.model_signals?.tap_frequency_hz ? `${Number(r.model_signals.tap_frequency_hz).toFixed(0)} Hz`:'—' },
                          { l:'Decay',          v:r.model_signals?.decay_ms ? `${Number(r.model_signals.decay_ms).toFixed(0)} ms`:'—' },
                          { l:'Fraud',          v:r.is_fraud_flagged?'FLAGGED':'CLEAR' },
                        ].map(item => (
                          <div key={item.l}>
                            <div style={{ fontSize:9, color:'var(--text-faint)', textTransform:'uppercase',
                              letterSpacing:'0.1em', marginBottom:4, fontFamily:'var(--font-mono)' }}>{item.l}</div>
                            <div style={{ fontSize:12, color:'var(--text-dim)' }}>{item.v}</div>
                          </div>
                        ))}
                      </div>
                      {r.assessor_note && (
                        <div style={{ marginTop:14, fontSize:11, color:'var(--text-faint)',
                          lineHeight:1.65, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                          {r.assessor_note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
