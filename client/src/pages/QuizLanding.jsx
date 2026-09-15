import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../utils/socket';
import { 
  Trophy, 
  Timer, 
  Maximize, 
  EyeOff, 
  ArrowLeftCircle, 
  AlertTriangle, 
  CheckCircle, 
  Sparkles, 
  Users,
  Play
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function QuizLanding() {
  const [name, setName] = useState(localStorage.getItem('quiz_participant_name') || '');
  const [rollNumber, setRollNumber] = useState(localStorage.getItem('quiz_participant_roll') || '');
  const [quizStatus, setQuizStatus] = useState({
    title: 'Drishti Speed Quiz Competition',
    status: 'draft',
    duration_seconds: 300,
    total_questions: 10,
    total_possible_marks: 20,
    total_submissions: 0,
  });
  const [stats, setStats] = useState({ online: 1, activeTakers: 0 });
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/quiz/status`);
      setQuizStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Socket listeners for real-time state changes
    socket.on('competition_status_changed', (data) => {
      setQuizStatus((prev) => ({ 
        ...prev, 
        status: data.status || prev.status,
        duration_seconds: data.duration_seconds || prev.duration_seconds
      }));
    });

    socket.on('duration_updated', (data) => {
      setQuizStatus((prev) => ({
        ...prev,
        duration_seconds: data.duration_seconds || prev.duration_seconds
      }));
    });

    socket.on('participant_stats', (data) => {
      setStats(data);
    });

    return () => {
      socket.off('competition_status_changed');
      socket.off('duration_updated');
      socket.off('participant_stats');
    };
  }, []);

  const handleStartQuiz = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!rollNumber.trim()) {
      setError('Please enter your roll / registration number');
      return;
    }
    if (!acceptedRules) {
      setError('You must accept the proctoring rules to begin');
      return;
    }

    if (quizStatus.status !== 'live') {
      setError('The competition has not been started by the host yet! Please wait.');
      return;
    }

    // Persist participant info
    localStorage.setItem('quiz_participant_name', name.trim());
    localStorage.setItem('quiz_participant_roll', rollNumber.trim().toUpperCase());
    localStorage.setItem('quiz_start_timestamp', Date.now().toString());

    // Navigate to active quiz
    navigate('/quiz/play');
  };

  const minutes = Math.floor(quizStatus.duration_seconds / 60);

  return (
    <div className="quiz-page">
      <div className="quiz-container">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="hero-society-badge" style={{ marginBottom: '16px' }}>
            <img src="/akgec_logo.png" alt="AKGEC Crest" className="society-badge-logo" />
            <span className="society-badge-text">AKGEC Ghaziabad</span>
            <span className="society-badge-sep">•</span>
            <img src="/ve_cell_logo.png" alt="VE Cell Logo" className="society-badge-logo" />
            <span className="society-badge-text highlight">Value Education Cell</span>
          </div>

          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '2.8rem', 
            fontWeight: '800', 
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #ffffff 0%, #38bdf8 30%, #d946ef 65%, #f43f5e 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {quizStatus.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '650px', margin: '0 auto' }}>
            Official Drishti speed quiz competition by VE Cell AKGEC. Test your speed, ethics, values, and comprehension.
          </p>

          <div className="quiz-landing-status-bar">
            <span className={`live-indicator ${quizStatus.status}`}>
              <span className="dot" />
              {quizStatus.status === 'live' ? 'Competition is Live' : quizStatus.status === 'ended' ? 'Competition Ended' : 'Competition Waiting / Draft'}
            </span>

            <span className="quiz-status-pill">
              <Users size={16} color="var(--purple-accent)" />
              {stats.online} online | {quizStatus.total_submissions} submitted
            </span>

            <Link 
              to="/quiz/leaderboard" 
              className="quiz-status-pill pill-leaderboard"
            >
              <Trophy size={16} /> View Leaderboard
            </Link>
          </div>
        </div>

        <div className="quiz-landing-grid">
          {/* Registration Box */}
          <div className="quiz-card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', marginBottom: '8px' }}>
              Participant Entry
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
              Enter your official student credentials to join the live round.
            </p>

            {error && (
              <div style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error)',
                color: 'var(--error)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.95rem'
              }}>
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleStartQuiz}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="rollNum">Student Roll / Registration No.</label>
                <input
                  id="rollNum"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2300270100050"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  required
                />
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={acceptedRules}
                    onChange={(e) => setAcceptedRules(e.target.checked)}
                    style={{ marginTop: '4px', accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    I acknowledge that full screen is required, and any tab switch or back navigation will trigger <strong style={{ color: 'var(--error)' }}>automatic submission</strong>.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '1.05rem', justifyContent: 'center' }}
                disabled={quizStatus.status !== 'live'}
              >
                <Play size={20} />
                {quizStatus.status === 'live' ? 'Enter Live Quiz Arena' : 'Waiting for Host to Start...'}
              </button>
            </form>

            {quizStatus.status !== 'live' && (
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                ⏳ The competition is currently on standby. The host will start it shortly!
              </p>
            )}
          </div>

          {/* Rules & Proctoring Specs */}
          <div className="quiz-card" style={{ background: 'rgba(15, 15, 30, 0.7)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} color="var(--warning)" /> Competition Rules & Proctoring
            </h3>

            <div className="rules-list">
              <div className="rule-item">
                <div className="rule-icon success">
                  <Timer size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{minutes}-Minute Strict Timer</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Auto-submits instantly when time hits 0:00. Time taken affects your rank tie-breaker.
                  </div>
                </div>
              </div>

              <div className="rule-item">
                <div className="rule-icon warning">
                  <Maximize size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Fullscreen Mandatory</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    The quiz must be attempted in fullscreen mode. Exiting fullscreen will prompt immediate re-entry.
                  </div>
                </div>
              </div>

              <div className="rule-item">
                <div className="rule-icon danger">
                  <EyeOff size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--error)' }}>
                    Tab Switch / Blur Detection
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Switching tabs, opening other windows, or Alt+Tab triggers immediate auto-submit with violation marked.
                  </div>
                </div>
              </div>

              <div className="rule-item">
                <div className="rule-icon danger">
                  <ArrowLeftCircle size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Browser Back Trapped</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Navigating away or clicking browser back button is prevented and triggers immediate submission.
                  </div>
                </div>
              </div>

              <div className="rule-item">
                <div className="rule-icon success">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Auto-Saved Answers</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Every click saves locally in real time so your choices are never lost.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
