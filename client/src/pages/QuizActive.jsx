import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../utils/socket';
import { 
  Timer, 
  Maximize, 
  AlertOctagon, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Send, 
  ShieldAlert
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function QuizActive() {
  const navigate = useNavigate();

  // Participant credentials
  const name = localStorage.getItem('quiz_participant_name') || '';
  const rollNumber = localStorage.getItem('quiz_participant_roll') || '';

  // Questions and state
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(`quiz_answers_${rollNumber}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Timer state (seconds)
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [timeLeft, setTimeLeft] = useState(300);
  const startTimeRef = useRef(Date.now());

  // Proctoring & Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [violationOccurred, setViolationOccurred] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  // Guards against double submission
  const isSubmittedRef = useRef(false);

  // Redirect if no credentials
  useEffect(() => {
    if (!name || !rollNumber) {
      navigate('/quiz', { replace: true });
    }
  }, [name, rollNumber, navigate]);

  // Request Fullscreen helper
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(inFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Submit Handler
  const submitQuiz = useCallback(async (reason = null) => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;
    setSubmitting(true);

    const elapsedSeconds = Math.min(
      durationSeconds,
      Math.floor((Date.now() - startTimeRef.current) / 1000)
    );

    try {
      // Notify socket that quiz ended
      socket.emit('quiz_taking_ended');

      const res = await axios.post(`${API_URL}/quiz/submit`, {
        name,
        roll_number: rollNumber,
        answers,
        time_taken_seconds: elapsedSeconds,
        violation_reason: reason,
      });

      // Clear local storage answers
      localStorage.removeItem(`quiz_answers_${rollNumber}`);

      // Exit fullscreen if still active
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      // Navigate to results screen with payload
      navigate('/quiz/result', {
        replace: true,
        state: {
          result: res.data,
          name,
          roll_number: rollNumber,
          violation: reason,
        },
      });
    } catch (err) {
      console.error('Submission error:', err);
      // Fallback redirect even on failure
      navigate('/quiz/result', {
        replace: true,
        state: {
          result: { score: 0, total_marks: 20, formatted_time: '00:00' },
          name,
          roll_number: rollNumber,
          error: err.response?.data?.error || 'Submission recorded',
          violation: reason,
        },
      });
    }
  }, [name, rollNumber, answers, durationSeconds, navigate]);

  // Load questions and config
  useEffect(() => {
    let isMounted = true;

    async function loadQuizData() {
      try {
        const [configRes, questionsRes] = await Promise.all([
          axios.get(`${API_URL}/quiz/status`),
          axios.get(`${API_URL}/quiz/questions`),
        ]);

        if (!isMounted) return;

        const dur = configRes.data.duration_seconds || 300;
        setDurationSeconds(dur);
        setTimeLeft(dur);
        setQuestions(questionsRes.data.questions || []);

        // Tell socket that user started
        socket.emit('quiz_taking_started', { roll_number: rollNumber });
      } catch (err) {
        console.error('Failed to load quiz data:', err);
      }
    }

    loadQuizData();

    return () => {
      isMounted = false;
      socket.emit('quiz_taking_ended');
    };
  }, [rollNumber]);

  // Timer countdown hook
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitQuiz('Time expired (Auto-submitted at 0:00)');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitQuiz]);

  // Anti-Cheat: Visibility Change / Tab Switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittedRef.current) {
        setViolationOccurred(true);
        submitQuiz('Auto-submitted due to tab switch / minimize violation');
      }
    };

    const handleWindowBlur = () => {
      if (!isSubmittedRef.current) {
        // Small grace period check to avoid false positive when entering fullscreen
        setTimeout(() => {
          if (document.hidden && !isSubmittedRef.current) {
            setViolationOccurred(true);
            submitQuiz('Auto-submitted due to window blur / application switch');
          }
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [submitQuiz]);

  // Anti-Cheat: Browser Back Button Trapping
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      if (!isSubmittedRef.current) {
        setViolationOccurred(true);
        submitQuiz('Auto-submitted due to browser back button navigation attempt');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [submitQuiz]);

  // Auto-save choice on answer selection
  const handleSelectOption = (questionId, optionKey) => {
    const updated = { ...answers, [questionId]: optionKey };
    setAnswers(updated);
    localStorage.setItem(`quiz_answers_${rollNumber}`, JSON.stringify(updated));
  };

  // Format mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerClass = timeLeft < 60 ? 'critical' : timeLeft < 120 ? 'warning' : 'normal';

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="quiz-page" style={{ paddingTop: '0' }}>
      {/* Fullscreen Guard Gate Overlay */}
      {!isFullscreen && (
        <div className="fullscreen-gate">
          <div className="fullscreen-box">
            <ShieldAlert size={54} color="var(--accent-primary)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '12px' }}>
              Fullscreen Mode Required
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
              To ensure competition integrity and prevent unauthorized screen interactions, you must stay in fullscreen mode throughout the test.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1.05rem' }}
              onClick={enterFullscreen}
            >
              <Maximize size={18} /> Enter Fullscreen to Continue
            </button>
          </div>
        </div>
      )}

      {/* Violation Alert overlay if triggered */}
      {violationOccurred && (
        <div className="fullscreen-gate">
          <div className="fullscreen-box" style={{ borderColor: 'var(--error)' }}>
            <AlertOctagon size={54} color="var(--error)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--error)', marginBottom: '12px' }}>
              Proctoring Violation Detected
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              You switched tabs or left the active testing environment. Your responses are being automatically submitted.
            </p>
          </div>
        </div>
      )}

      {/* Sticky HUD Bar */}
      <div className="quiz-hud">
        <div className="hud-participant">
          <div className="hud-avatar">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.5px' }}>
              {rollNumber}
            </div>
          </div>
        </div>

        {/* 5-minute Countdown Timer */}
        <div className={`quiz-timer ${timerClass}`}>
          <Timer size={20} />
          <span>{formatTime(timeLeft)}</span>
        </div>

        <div className="hud-actions">
          <div className="hud-answered-stat">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Answered</div>
            <div style={{ fontWeight: '700', color: 'var(--success)', fontSize: '0.95rem' }}>
              {answeredCount} / {totalQuestions}
            </div>
          </div>

          <button
            className="btn btn-primary hud-submit-btn"
            onClick={() => setConfirmSubmitOpen(true)}
            disabled={submitting}
          >
            <Send size={16} /> <span>Submit</span>
          </button>
        </div>
      </div>

      {/* Main Quiz Area */}
      <div className="quiz-container" style={{ paddingBottom: '60px' }}>
        {/* Anti-Cheat Reminder Notice */}
        <div className="cheat-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={20} color="var(--error)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              <strong>Active Proctoring:</strong> Switching tabs or pressing browser back will auto-submit your test.
            </span>
          </div>
          <span className="cheat-badge-desktop" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Auto-save active
          </span>
        </div>

        {currentQuestion ? (
          <div className="quiz-main-grid">
            {/* Question Card */}
            <div className="question-card">
              <div className="question-meta">
                <span className="question-badge">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="marks-badge">
                  +{currentQuestion.marks} {currentQuestion.marks === 1 ? 'Mark' : 'Marks'}
                </span>
              </div>

              <h2 className="question-text">
                {currentQuestion.question_text}
              </h2>

              <div className="mcq-options">
                {[
                  { key: 'A', text: currentQuestion.option_a },
                  { key: 'B', text: currentQuestion.option_b },
                  { key: 'C', text: currentQuestion.option_c },
                  { key: 'D', text: currentQuestion.option_d },
                ].map((opt) => {
                  const isSelected = answers[currentQuestion.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={`mcq-option-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectOption(currentQuestion.id, opt.key)}
                    >
                      <span className="option-key">{opt.key}</span>
                      <span className="option-label">{opt.text}</span>
                      {isSelected && (
                        <CheckCircle2 size={20} color="var(--accent-primary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Prev / Next Bottom Controls */}
              <div className="question-bottom-nav">
                <button
                  className="btn btn-secondary"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => prev - 1)}
                  style={{ opacity: currentIndex === 0 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={18} /> Previous
                </button>

                {currentIndex < totalQuestions - 1 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCurrentIndex((prev) => prev + 1)}
                  >
                    Next <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setConfirmSubmitOpen(true)}
                  >
                    Finish & Submit <Send size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar Palette */}
            <div className="quiz-palette">
              <div className="palette-title">
                <span>Questions Overview</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {answeredCount}/{totalQuestions} Answered
                </span>
              </div>

              <div className="palette-grid">
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isActive = idx === currentIndex;

                  let cls = 'palette-num';
                  if (isActive) cls += ' active';
                  if (isAnswered) cls += ' answered';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={cls}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)' }} />
                  <span>Answered</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid var(--border-medium)', background: 'rgba(255, 255, 255, 0.05)' }} />
                  <span>Not Answered</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '2px solid var(--accent-primary)' }} />
                  <span>Current Question</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p>Loading questions...</p>
          </div>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {confirmSubmitOpen && (
        <div className="fullscreen-gate">
          <div className="fullscreen-box" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '12px' }}>
              Confirm Final Submission?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
              You have answered <strong>{answeredCount}</strong> out of <strong>{totalQuestions}</strong> questions.
              {answeredCount < totalQuestions && (
                <span style={{ display: 'block', color: 'var(--warning)', marginTop: '8px' }}>
                  ⚠️ You still have {totalQuestions - answeredCount} unanswered questions!
                </span>
              )}
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setConfirmSubmitOpen(false)}
              >
                Back to Test
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setConfirmSubmitOpen(false);
                  submitQuiz(null);
                }}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
