import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function VerifyQR() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(null);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('drishti_admin_token'));
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/register/verify-qr/${token}`);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('not-found');
      } else {
        setError('error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [token]);

  const handleVerifyEntry = async () => {
    if (!adminToken) {
      setShowLoginModal(true);
      return;
    }

    setVerifying(true);
    try {
      const res = await axios.put(
        `${API_URL}/admin/verify-token/${token}`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setVerifySuccess(res.data);
      // Refresh status to reflect expiration
      await fetchStatus();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('drishti_admin_token');
        setAdminToken(null);
        setShowLoginModal(true);
      } else {
        alert(err.response?.data?.error || 'Verification failed.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, loginForm);
      localStorage.setItem('drishti_admin_token', res.data.token);
      setAdminToken(res.data.token);
      setShowLoginModal(false);
      // Auto verify after login
      try {
        setVerifying(true);
        const verifyRes = await axios.put(
          `${API_URL}/admin/verify-token/${token}`,
          {},
          { headers: { Authorization: `Bearer ${res.data.token}` } }
        );
        setVerifySuccess(verifyRes.data);
        await fetchStatus();
      } catch (verErr) {
        alert(verErr.response?.data?.error || 'Failed to verify QR after login.');
      } finally {
        setVerifying(false);
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Invalid admin credentials');
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
      </div>
    );
  }

  return (
    <div className="verify-page">
      {error === 'not-found' ? (
        <div className="verify-card">
          <div className="verify-icon not-found">⚠️</div>
          <h2 className="modal-title">QR Code Not Found</h2>
          <p className="modal-subtitle">This QR code is invalid or does not exist in our records.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Go to Homepage
          </Link>
        </div>
      ) : error ? (
        <div className="verify-card">
          <div className="verify-icon not-found">❌</div>
          <h2 className="modal-title">Verification Error</h2>
          <p className="modal-subtitle">Something went wrong. Please try again later.</p>
        </div>
      ) : data?.expired ? (
        <div className="verify-card expired">
          <div className="verify-icon expired">🚫</div>
          <h2 className="modal-title">QR Code Expired</h2>
          <p className="modal-subtitle">This QR code has already been verified and used for event entry.</p>

          <div className="verify-modal-student" style={{ textAlign: 'left', marginTop: '16px' }}>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Name</span>
              <span className="verify-modal-value">{data.student?.name}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Roll Number</span>
              <span className="verify-modal-value">{data.student?.roll_number}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Branch</span>
              <span className="verify-modal-value">{data.student?.branch}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Section</span>
              <span className="verify-modal-value">{data.student?.section}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Verified At</span>
              <span className="verify-modal-value" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                {data.verified_at ? new Date(data.verified_at).toLocaleString('en-IN') : 'Already Expired'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link to="/admin" className="btn btn-secondary btn-sm">
              Admin Portal
            </Link>
            <Link to="/" className="btn btn-primary btn-sm">
              Home
            </Link>
          </div>
        </div>
      ) : data?.valid ? (
        <div className="verify-card valid">
          <div className="verify-icon valid">✅</div>
          <h2 className="modal-title">Valid Registration Pass</h2>
          <p className="modal-subtitle">This QR code is valid. Verify attendee entry below.</p>

          <div className="verify-modal-student" style={{ textAlign: 'left', marginTop: '16px' }}>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Name</span>
              <span className="verify-modal-value">{data.student?.name}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Roll Number</span>
              <span className="verify-modal-value">{data.student?.roll_number}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Branch</span>
              <span className="verify-modal-value">{data.student?.branch}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Section</span>
              <span className="verify-modal-value">{data.student?.section}</span>
            </div>
            <div className="verify-modal-row">
              <span className="verify-modal-label">Status</span>
              <span className="badge badge-pending">Pending Entry</span>
            </div>
          </div>

          {verifySuccess && (
            <div className="alert-box" style={{ background: 'var(--success-bg)', borderColor: 'var(--success)', color: 'var(--success)', marginTop: '16px' }}>
              🎉 Verified entry for {verifySuccess.student?.name} at {new Date(verifySuccess.verified_at).toLocaleTimeString('en-IN')}!
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              onClick={handleVerifyEntry}
              disabled={verifying}
            >
              {verifying ? 'Verifying Entry...' : '🎟️ Confirm Entry & Expire QR'}
            </button>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <Link to="/admin" className="btn btn-secondary btn-sm">
                Admin Panel
              </Link>
              <Link to="/" className="btn btn-secondary btn-sm">
                Home
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Admin Login Modal for Gate Verifiers */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <button className="modal-close" onClick={() => setShowLoginModal(false)}>✕</button>
            <div className="modal-icon" style={{ background: 'var(--accent-primary-dim)', borderColor: 'var(--accent-primary)' }}>
              🔐
            </div>
            <h3 className="modal-title">Admin Authentication</h3>
            <p className="modal-subtitle">Login with admin credentials to verify entry and expire this QR</p>

            {loginError && (
              <div className="alert-box alert-error" style={{ marginBottom: '14px' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Admin Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. rohann@123"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loggingIn}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {loggingIn ? 'Authenticating...' : 'Login & Verify Attendee'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
