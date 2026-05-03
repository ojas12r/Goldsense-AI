import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchHealth, fetchConfig } from '../utils/api';

/* Magnetic button hook */
export function useMagnetic(strength = 0.35) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = e => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 90) {
        el.style.transform = `translate(${dx*strength}px, ${dy*strength}px)`;
      }
    };
    const onLeave = () => { el.style.transform = 'translate(0,0)'; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [strength]);
  return ref;
}

export default function Navbar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [health,   setHealth]   = useState(null);
  const [config,   setConfig]   = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const btnRef = useMagnetic(0.3);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => {});
    fetchConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isOnline = health?.status === 'healthy';
  const modelShort = config?.vision_model
    ? config.vision_model.split('/').pop().replace('-instruct','').replace('qwen-','Qwen-').toUpperCase()
    : '—';

  const links = [
    { to: '/', label: 'Home' },
    { to: '/scan', label: 'Assess' },
    { to: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      {/* Logo */}
      <Link to="/" className="nav-logo" data-hover>
        <div className="nav-logo-mark">G</div>
        <span>GoldSense <span className="gold-gradient">AI</span></span>
      </Link>

      {/* Links */}
      <div className="nav-links">
        {links.map(l => (
          <Link key={l.to} to={l.to} data-hover
            className={`nav-link ${location.pathname === l.to ? 'active' : ''}`}>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Right */}
      <div className="nav-right">
        <span className={`status-pill ${isOnline ? 'status-online' : 'status-offline'}`}>
          <span className="status-dot" />
          {isOnline ? 'Online' : 'Offline'}
        </span>

        <span className="status-pill" style={{
          background: 'rgba(201,168,76,0.06)',
          color: 'var(--gold)', borderColor: 'rgba(201,168,76,0.2)',
        }}>
          {modelShort}
        </span>

        <div ref={btnRef} style={{ transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <button className="btn-magnetic btn-primary" data-hover
            onClick={() => navigate('/scan')}
            style={{ padding: '9px 22px', fontSize: 13 }}>
            Start Assessment ↗
          </button>
        </div>
      </div>
    </nav>
  );
}
