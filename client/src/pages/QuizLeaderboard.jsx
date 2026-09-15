import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../utils/socket';
import { 
  Trophy, 
  Search, 
  Clock, 
  Sparkles, 
  ArrowLeft, 
  ShieldAlert, 
  CheckCircle2, 
  Flame,
  Radio
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function QuizLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentNotification, setRecentNotification] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${API_URL}/quiz/leaderboard`);
      setLeaderboard(res.data.leaderboard || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Listen for live updates over websocket
    socket.on('leaderboard_update', (updatedLeaderboard) => {
      setLeaderboard(updatedLeaderboard);
    });

    socket.on('submission_received', (data) => {
      setRecentNotification(`${data.name} just submitted with ${data.score}/${data.total_marks} in ${data.formatted_time}!`);
      setTimeout(() => setRecentNotification(null), 5000);
    });

    return () => {
      socket.off('leaderboard_update');
      socket.off('submission_received');
    };
  }, []);

  const filtered = leaderboard.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.roll_number.toLowerCase().includes(q);
  });

  const firstPlace = leaderboard[0];
  const secondPlace = leaderboard[1];
  const thirdPlace = leaderboard[2];

  return (
    <div className="quiz-page">
      <div className="quiz-container">
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <Link to="/quiz" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            <ArrowLeft size={16} /> Quiz Arena
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: '600' }}>
            <Radio size={16} className="pulse-icon" /> LIVE UPDATING
          </div>
        </div>

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
            marginBottom: '10px',
            background: 'linear-gradient(135deg, #ffd700 0%, #ffffff 50%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Drishti Quiz Leaderboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            Real-time rankings based on highest marks and fastest completion time.
          </p>
        </div>

        {/* Live Flash Toast Notification */}
        {recentNotification && (
          <div style={{
            background: 'rgba(233, 69, 96, 0.15)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 20px',
            maxWidth: '500px',
            margin: '0 auto 30px',
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            boxShadow: '0 0 20px rgba(233, 69, 96, 0.3)',
            animation: 'fadeIn 0.3s ease-in-out'
          }}>
            <Flame size={16} color="var(--accent-primary)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {recentNotification}
          </div>
        )}

        {/* PODIUM DISPLAY (TOP 3) */}
        {leaderboard.length > 0 && (
          <div className="leaderboard-podium">
            {/* Rank 2 - Silver */}
            <div className="podium-slot rank-2">
              {secondPlace ? (
                <>
                  <div className="podium-user">
                    <div className="podium-avatar" style={{ background: 'linear-gradient(135deg, #8a9ba8 0%, #486581 100%)' }}>
                      🥈
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#e2e8f0' }}>
                      {secondPlace.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {secondPlace.roll_number}
                    </div>
                  </div>
                  <div className="podium-pedestal">
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#cbd5e1' }}>
                      {secondPlace.score}/{secondPlace.total_marks}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <Clock size={13} /> {secondPlace.formatted_time}
                    </div>
                  </div>
                </>
              ) : (
                <div className="podium-pedestal" style={{ opacity: 0.3 }}>
                  <span style={{ fontSize: '1.5rem' }}>2</span>
                </div>
              )}
            </div>

            {/* Rank 1 - Gold (Champion) */}
            <div className="podium-slot rank-1">
              {firstPlace && (
                <>
                  <div className="podium-user">
                    <div className="podium-avatar" style={{ background: 'linear-gradient(135deg, #ffd700 0%, #b7791f 100%)' }}>
                      🥇
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#ffd700' }}>
                      {firstPlace.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {firstPlace.roll_number}
                    </div>
                  </div>
                  <div className="podium-pedestal">
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ffd700' }}>
                      {firstPlace.score}/{firstPlace.total_marks}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', color: '#fef08a', marginTop: '6px', fontWeight: '600' }}>
                      <Clock size={14} /> {firstPlace.formatted_time}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rank 3 - Bronze */}
            <div className="podium-slot rank-3">
              {thirdPlace ? (
                <>
                  <div className="podium-user">
                    <div className="podium-avatar" style={{ background: 'linear-gradient(135deg, #cd7f32 0%, #7b341e 100%)' }}>
                      🥉
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#fdba74' }}>
                      {thirdPlace.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {thirdPlace.roll_number}
                    </div>
                  </div>
                  <div className="podium-pedestal">
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fdba74' }}>
                      {thirdPlace.score}/{thirdPlace.total_marks}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <Clock size={13} /> {thirdPlace.formatted_time}
                    </div>
                  </div>
                </>
              ) : (
                <div className="podium-pedestal" style={{ opacity: 0.3 }}>
                  <span style={{ fontSize: '1.5rem' }}>3</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FULL LEADERBOARD TABLE */}
        <div className="quiz-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
              All Standings ({leaderboard.length} Participants)
            </h2>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search participant or roll..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '38px', paddingRight: '12px', height: '40px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Participant</th>
                  <th>Roll Number</th>
                  <th>Marks</th>
                  <th>Time Taken</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <tr key={item.id || item.roll_number}>
                      <td>
                        <span className="rank-pill">
                          {item.badge ? item.badge : `#${item.rank}`}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{item.name}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {item.roll_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>
                          {item.score} / {item.total_marks}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Clock size={14} />
                          {item.formatted_time}
                        </div>
                      </td>
                      <td>
                        {item.violation_reason ? (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: 'var(--error)', 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            padding: '4px 10px', 
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }} title={item.violation_reason}>
                            <ShieldAlert size={13} /> Disqualified / Violation
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: 'var(--success)', 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            padding: '4px 10px', 
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={13} /> Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      {loading ? 'Loading leaderboard...' : 'No submissions recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
