import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreVertical, X, Trophy, Zap, Shield, LayoutDashboard, SlidersHorizontal } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Do not render global navbar during active quiz test to prevent header overlap
  if (location.pathname === '/quiz/play') {
    return null;
  }

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-left">
        {/* Three Dots Menu on Top Left */}
        <div className="nav-dropdown-wrapper" ref={menuRef}>
          <button
            type="button"
            className={`nav-kebab-btn ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Navigation Menu"
            title="Navigation Menu"
          >
            {menuOpen ? <X size={20} /> : <MoreVertical size={20} />}
          </button>

          {menuOpen && (
            <div className="nav-dropdown-menu">
              <div className="nav-dropdown-header">
                <span>QUICK NAVIGATION</span>
              </div>

              <Link 
                to="/quiz" 
                className={`nav-dropdown-item ${location.pathname === '/quiz' ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <div className="dropdown-item-icon quiz-icon">
                  <Zap size={16} />
                </div>
                <div className="dropdown-item-content">
                  <span className="dropdown-item-title">Quiz Arena</span>
                  <span className="dropdown-item-sub">Live speed test & entry</span>
                </div>
              </Link>

              <Link 
                to="/quiz/leaderboard" 
                className={`nav-dropdown-item ${location.pathname === '/quiz/leaderboard' ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <div className="dropdown-item-icon trophy-icon">
                  <Trophy size={16} />
                </div>
                <div className="dropdown-item-content">
                  <span className="dropdown-item-title">Leaderboard</span>
                  <span className="dropdown-item-sub">Live rankings & podium</span>
                </div>
              </Link>

              <div className="nav-dropdown-divider" />

              {isAdmin ? (
                <>
                  <Link 
                    to="/admin/quiz-host" 
                    className={`nav-dropdown-item ${location.pathname === '/admin/quiz-host' ? 'active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="dropdown-item-icon host-icon">
                      <SlidersHorizontal size={16} />
                    </div>
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">Host Panel</span>
                      <span className="dropdown-item-sub">Quiz room controls</span>
                    </div>
                  </Link>

                  <Link 
                    to="/admin/dashboard" 
                    className={`nav-dropdown-item ${location.pathname === '/admin/dashboard' ? 'active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="dropdown-item-icon reg-icon">
                      <LayoutDashboard size={16} />
                    </div>
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">Registrations</span>
                      <span className="dropdown-item-sub">Student data & verify</span>
                    </div>
                  </Link>
                </>
              ) : (
                <Link 
                  to="/admin" 
                  className={`nav-dropdown-item ${location.pathname === '/admin' ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="dropdown-item-icon admin-icon">
                    <Shield size={16} />
                  </div>
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Admin Portal</span>
                    <span className="dropdown-item-sub">Faculty & coordinator login</span>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        <Link to="/" className="navbar-brand">
          <div className="navbar-brand-icon">D</div>
          <div className="navbar-brand-text">
            <span className="navbar-brand-title">DRISHTI</span>
            <span className="navbar-brand-subtitle">VE Cell • AKGEC</span>
          </div>
        </Link>
      </div>
    </nav>
  );
}
