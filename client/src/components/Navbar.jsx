import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="navbar-brand">
        <div className="navbar-brand-icon">D</div>
        <div className="navbar-brand-text">
          <span className="navbar-brand-title">DRISHTI</span>
          <span className="navbar-brand-subtitle">VE Cell • AKGEC</span>
        </div>
      </Link>

      <div className="navbar-actions">
        <Link 
          to="/quiz" 
          className="btn-admin nav-quiz-btn" 
          style={{ 
            background: location.pathname.startsWith('/quiz') ? 'rgba(233, 69, 96, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            borderColor: location.pathname.startsWith('/quiz') ? 'var(--accent-primary)' : 'var(--border-medium)'
          }}
        >
          <span>⚡</span>
          <span className="nav-btn-text">Quiz Arena</span>
        </Link>

        <Link 
          to="/quiz/leaderboard" 
          className="btn-admin nav-leaderboard-btn"
          style={{ 
            background: location.pathname === '/quiz/leaderboard' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            borderColor: location.pathname === '/quiz/leaderboard' ? '#ffd700' : 'var(--border-medium)'
          }}
        >
          <span>🏆</span>
          <span className="nav-btn-text">Leaderboard</span>
        </Link>

        {isAdmin ? (
          <>
            <Link to="/admin/quiz-host" className="btn-admin nav-host-btn" style={{ background: 'rgba(124, 58, 237, 0.2)', borderColor: 'var(--purple-accent)' }}>
              <span>🎯</span>
              <span className="nav-btn-text">Host Panel</span>
            </Link>
            <Link to="/admin/dashboard" className="btn-admin nav-reg-btn">
              <span>📊</span>
              <span className="nav-btn-text">Registrations</span>
            </Link>
          </>
        ) : (
          <Link to="/admin" className="btn-admin nav-admin-btn">
            <span>🔐</span>
            <span className="nav-btn-text">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
