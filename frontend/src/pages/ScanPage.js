import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessGold } from '../utils/api';
import ScrollReveal from '../components/ScrollReveal';

const LOADING_MSGS = [
  'Sending image to Qwen2.5-VL…',
  'Extracting visual features…',
  'Running wav2vec2 on tap audio…',
  'XGBoost fusion in progress…',
  'Computing loan eligibility…',
];

export default function ScanPage() {
  const navigate  = useNavigate();
  const fileRef   = useRef();
  const audioRef  = useRef();
  const [file,      setFile]      = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [loadMsg,   setLoadMsg]   = useState(LOADING_MSGS[0]);
  const [loadPct,   setLoadPct]   = useState(0);
  const [error,     setError]     = useState('');
  const [form,      setForm]      = useState({
    customer_name:'', customer_id:'', jewelry_type:'Bangle',
    declared_weight:'20', declared_karat:'22',
    bill_description:'', bill_present:false, bill_consistent:false, notes:'',
  });

  useEffect(() => {
    if (!loading) { setLoadPct(0); return; }
    let i = 0, pct = 0;
    const iv = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      pct = Math.min(90, pct + 18);
      setLoadMsg(LOADING_MSGS[i]);
      setLoadPct(pct);
    }, 2500);
    return () => clearInterval(iv);
  }, [loading]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      const fd = new FormData();
      if (file)      fd.append('image', file);
      if (audioFile) fd.append('tap_audio', audioFile);
      Object.entries(form).forEach(([k,v]) => fd.append(k, v));
      const result = await assessGold(fd);
      setLoadPct(100);
      setTimeout(() => navigate('/result', { state: { result } }), 300);
    } catch (e) {
      setError(e.message || 'Assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const Label = ({ children }) => (
    <label className="form-label">{children}</label>
  );

  const pipeline = [
    { dot: 'var(--gold)',    label: 'Visual',   model: 'Qwen2.5-VL-7B',   active: !!file },
    { dot: 'var(--info)',    label: 'Acoustic', model: 'wav2vec2-base',    active: !!audioFile },
    { dot: 'var(--success)', label: 'Declared', model: 'Cross-validation', active: true },
    { dot: '#888',           label: 'Decision', model: 'XGBoost fusion',   active: true },
  ];

  return (
    <div style={{ paddingTop: 80, maxWidth: 920, margin: '0 auto', padding: '80px 2rem 80px' }}>
      <ScrollReveal>
        <div className="section-label">Jewelry Assessment</div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(32px,5vw,52px)',
          fontWeight:300, letterSpacing:'-0.5px', marginBottom:'2rem', lineHeight:1.1 }}>
          New <em className="gold-gradient">assessment</em>
        </h1>
      </ScrollReveal>

      <div className="scan-grid">
        {/* ── LEFT ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Customer info */}
          <ScrollReveal delay={40}>
            <div className="form-card">
              <Label>Customer Information</Label>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
                <div>
                  <Label>Full Name</Label>
                  <input className="form-input" placeholder="Customer name"
                    value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
                </div>
                <div>
                  <Label>Customer ID</Label>
                  <input className="form-input" placeholder="CUST-XXXX"
                    value={form.customer_id} onChange={e => set('customer_id', e.target.value)} />
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Photo */}
          <ScrollReveal delay={80}>
            <div className="form-card">
              <Label>Jewelry Photograph</Label>
              <div className={`upload-zone ${file ? 'has-file' : ''}`}
                style={{ marginTop:10 }}
                onClick={() => fileRef.current.click()}
                data-hover>
                {preview ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                    <img src={preview} alt="preview" style={{
                      maxHeight:130, maxWidth:'100%', borderRadius:8, objectFit:'cover',
                    }} />
                    <span style={{ color:'var(--gold)', fontSize:11, fontFamily:'var(--font-mono)' }}>
                      ✓ Ready for Qwen2.5-VL
                    </span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:28, marginBottom:8 }}>◈</div>
                    <div style={{ color:'var(--text-dim)', fontSize:12, marginBottom:4 }}>
                      Click to upload jewelry photo
                    </div>
                    <div style={{ color:'var(--text-faint)', fontSize:10, fontFamily:'var(--font-mono)' }}>
                      JPG · PNG · WEBP
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*"
                  onChange={handleFile} style={{ display:'none' }} />
              </div>
            </div>
          </ScrollReveal>

          {/* Audio */}
          <ScrollReveal delay={120}>
            <div className="form-card" style={{ borderColor: audioFile ? 'rgba(96,165,250,0.3)' : undefined }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <Label>Tap Recording</Label>
                <span className="badge badge-gold" style={{
                  color:'var(--info)', borderColor:'rgba(96,165,250,0.2)',
                  background:'rgba(96,165,250,0.06)',
                }}>wav2vec2-base</span>
              </div>

              <div className={`upload-zone ${audioFile ? 'has-file' : ''}`}
                style={{ borderColor: audioFile ? 'rgba(96,165,250,0.4)' : undefined }}
                onClick={() => audioRef.current.click()} data-hover>
                <div style={{ fontSize:24, marginBottom:8 }}>🎙</div>
                <div style={{ color: audioFile ? 'var(--info)' : 'var(--text-dim)', fontSize:12, marginBottom:4 }}>
                  {audioFile ? `✓ ${audioFile.name}` : 'Upload tap sound recording'}
                </div>
                <div style={{ color:'var(--text-faint)', fontSize:10, fontFamily:'var(--font-mono)' }}>
                  WAV · MP3 · OGG · 1–3 seconds
                </div>
                <input ref={audioRef} type="file" accept="audio/*"
                  onChange={e => { const f=e.target.files[0]; if(f) setAudioFile(f); }}
                  style={{ display:'none' }} />
              </div>

              <p style={{ marginTop:10, fontSize:11, color:'var(--text-faint)', lineHeight:1.6 }}>
                Tap the jewelry with a coin and record 1–3 seconds.
                Without audio, acoustic signals are inferred from visual structure.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* ── RIGHT ── */}
        <ScrollReveal delay={60}>
          <div className="form-card" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Label>Declared Data</Label>

            <div>
              <Label>Jewelry Type</Label>
              <select className="form-input" value={form.jewelry_type}
                onChange={e => set('jewelry_type', e.target.value)}>
                {['Bangle','Necklace','Ring','Chain','Earrings','Bracelet','Anklet','Pendant'].map(t =>
                  <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <Label>Weight (grams)</Label>
                <input className="form-input" type="number" min="0" step="0.1"
                  value={form.declared_weight} onChange={e => set('declared_weight', e.target.value)} />
              </div>
              <div>
                <Label>Karat</Label>
                <select className="form-input" value={form.declared_karat}
                  onChange={e => set('declared_karat', e.target.value)}>
                  {[14,18,20,22,24].map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Bill / Purchase Description</Label>
              <textarea className="form-input" rows={3}
                placeholder="Describe the purchase bill or receipt…"
                value={form.bill_description}
                onChange={e => set('bill_description', e.target.value)}
                style={{ resize:'vertical' }} />
            </div>

            {[
              { k:'bill_present',    l:'Bill of purchase present' },
              { k:'bill_consistent', l:'Bill matches declared attributes' },
            ].map(item => (
              <label key={item.k} style={{ display:'flex', alignItems:'center', gap:10, cursor:'none' }} data-hover>
                <input type="checkbox" checked={form[item.k]}
                  onChange={e => set(item.k, e.target.checked)}
                  style={{ width:'auto', accentColor:'var(--gold)' }} />
                <span style={{ color:'var(--text-dim)', fontSize:13 }}>{item.l}</span>
              </label>
            ))}

            <div>
              <Label>Additional Notes</Label>
              <textarea className="form-input" rows={2}
                placeholder="Any other observations…"
                value={form.notes} onChange={e => set('notes', e.target.value)}
                style={{ resize:'vertical' }} />
            </div>

            {/* Pipeline status */}
            <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'14px 16px',
              border:'1px solid var(--border)' }}>
              <div className="form-label" style={{ marginBottom:10 }}>Signal Pipeline</div>
              {pipeline.map(p => (
                <div key={p.label} className="pipeline-item">
                  <div className="pipeline-dot" style={{ color: p.active ? p.dot : '#333',
                    background: p.active ? p.dot : '#333' }}
                    className={`pipeline-dot ${p.active ? 'active' : ''}`} />
                  <span style={{ flex:1, fontSize:12, color: p.active ? 'var(--text-dim)' : 'var(--text-faint)' }}>
                    {p.label}
                  </span>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)',
                    color: p.active ? p.dot : 'var(--text-faint)' }}>
                    {p.model}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)',
                color:'var(--danger)', borderRadius:10, padding:'10px 14px', fontSize:12,
              }}>⚠ {error}</div>
            )}

            {/* Loading progress bar */}
            {loading && (
              <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:100, height:3, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:100,
                  background:'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                  width:`${loadPct}%`, transition:'width 0.6s ease',
                }} />
              </div>
            )}

            <button className="btn-magnetic btn-primary" data-hover
              onClick={handleSubmit} disabled={loading}
              style={{ width:'100%', padding:'13px', fontSize:14, borderRadius:12, justifyContent:'center' }}>
              {loading
                ? <span style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{
                      width:14, height:14, border:'2px solid #000', borderTopColor:'transparent',
                      borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite',
                    }} />
                    {loadMsg}
                  </span>
                : '⚡ Run Assessment'
              }
            </button>

            <p style={{ textAlign:'center', fontSize:10, color:'var(--text-faint)',
              fontFamily:'var(--font-mono)', lineHeight:1.7 }}>
              Vision: Qwen2.5-VL · Acoustic: wav2vec2-base (local)<br />
              Decision: XGBoost · No data leaves localhost
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
