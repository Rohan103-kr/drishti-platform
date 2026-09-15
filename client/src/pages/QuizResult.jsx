import { useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Trophy, Clock, CheckCircle, AlertTriangle, ArrowRight, Award } from 'lucide-react';

export default function QuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const { result, name, roll_number, violation } = state;

  useEffect(() => {
    if (!result) {
      navigate('/quiz', { replace: true });
      return;
    }

    // Trigger confetti if completed normally without violation
    if (!violation) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [result, violation, navigate]);

  if (!result) return null;

  const score = result.score ?? 0;
  const totalMarks = result.total_marks ?? 20;
  const formattedTime = result.formatted_time || '00:00';
  const rank = result.rank;

  return (
    <div className="quiz-page">
      <div className="quiz-container" style={{ maxWidth: '680px' }}>
        <div className="quiz-card" style={{ textAlign: 'center', padding: '48px 36px' }}>
          {violation ? (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--error-bg)',
              border: '2px solid var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--error)'
            }}>
              <AlertTriangle size={40} />
            </div>
          ) : (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--success)'
            }}>
              <Award size={40} />
            </div>
          )}

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', marginBottom: '8px' }}>
            {violation ? 'Test Auto-Submitted' : 'Competition Completed!'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '32px' }}>
            Well played, <strong>{name}</strong> ({roll_number}). Your response has been recorded.
          </p>

          {violation && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: '28px',
              color: 'var(--error)',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={18} />
              Reason: {violation}
            </div>
          )}

          {/* Stats Grid */}
          <div className="quiz-result-stats-grid">
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 14px'
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                Your Score
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>
                {score}/{totalMarks}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 14px'
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                Time Taken
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {formattedTime}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 14px'
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                Current Rank
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffd700', fontFamily: 'var(--font-display)' }}>
                {rank ? `#${rank}` : '-'}
              </div>
            </div>
          </div>

          <Link
            to="/quiz/leaderboard"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '1.05rem' }}
          >
            <Trophy size={20} /> View Live Leaderboard & Standings <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
