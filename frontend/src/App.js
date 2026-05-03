import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Cursor from './components/Cursor';
import LandingPage   from './pages/LandingPage';
import ScanPage      from './pages/ScanPage';
import ResultPage    from './pages/ResultPage';
import DashboardPage from './pages/DashboardPage';

/* Page transition wrapper */
function PageWrapper({ children }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0,0); }, [pathname]);
  return <div style={{ animation:'fadePageIn 0.35s ease-out' }}>{children}</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Cursor />
      <Navbar />
      <style>{`
        @keyframes fadePageIn {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .pipeline-dot { display:inline-block; }
      `}</style>
      <PageWrapper>
        <Routes>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/scan"      element={<ScanPage />} />
          <Route path="/result"    element={<ResultPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </PageWrapper>
    </BrowserRouter>
  );
}
