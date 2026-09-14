import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0 });
  const [registrations, setRegistrations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('drishti_admin_token');

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/stats`, authHeaders);
      setStats(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('drishti_admin_token');
        navigate('/admin', { replace: true });
      }
    }
  }, [token]);

  const fetchRegistrations = useCallback(async () => {
    try {
      const params = {};
      if (filter !== 'all') params.filter = filter;
      if (search.trim()) params.search = search.trim();

      const res = await axios.get(`${API_URL}/admin/registrations`, {
        ...authHeaders,
        params,
      });
      setRegistrations(res.data.registrations);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('drishti_admin_token');
        navigate('/admin', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [token, filter, search]);

  useEffect(() => {
    fetchStats();
    fetchRegistrations();
  }, [fetchStats, fetchRegistrations]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRegistrations();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleVerify = async (id) => {
    setVerifying(true);
    try {
      const res = await axios.put(`${API_URL}/admin/verify/${id}`, {}, authHeaders);
      setToast({ message: `✅ ${res.data.student.name} verified successfully!`, type: 'success' });
      setVerifyModal(null);
      fetchStats();
      fetchRegistrations();
    } catch (err) {
      const msg = err.response?.data?.error || 'Verification failed.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/export`, {
        ...authHeaders,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'drishti-registrations.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToast({ message: 'Export failed.', type: 'error' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('drishti_admin_token');
    navigate('/admin', { replace: true });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header animate-fade-in-up">
        <div>
          <h1 className="admin-title">
            Dashboard <span className="admin-title-sub">• Drishti Registrations</span>
          </h1>
        </div>
        <div className="admin-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            📥 Export CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total</span>
            <div className="stat-card-icon total">📊</div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Verified</span>
            <div className="stat-card-icon verified">✅</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{stats.verified}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Pending</span>
            <div className="stat-card-icon pending">⏳</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="table-controls animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
        <div className="search-box">
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, roll no, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {['all', 'pending', 'verified'].map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto', width: '32px', height: '32px', borderWidth: '3px' }}></div>
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading registrations...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No registrations found</div>
            <div className="empty-state-text">
              {search ? 'Try adjusting your search query.' : 'Registrations will appear here as students sign up.'}
            </div>
          </div>
        ) : (
          <table className="reg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Roll Number</th>
                <th>Branch</th>
                <th>Sec</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Registered</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((reg, idx) => (
                <tr key={reg.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reg.name}</td>
                  <td>{reg.roll_number}</td>
                  <td style={{ fontSize: '12px' }}>{reg.branch}</td>
                  <td>{reg.section}</td>
                  <td>{reg.phone}</td>
                  <td style={{ fontSize: '12px' }}>{reg.email}</td>
                  <td style={{ fontSize: '12px' }}>{formatDate(reg.created_at)}</td>
                  <td>
                    {reg.verified_at ? (
                      <span className="status-badge verified">✅ Verified</span>
                    ) : (
                      <span className="status-badge pending">⏳ Pending</span>
                    )}
                  </td>
                  <td>
                    {reg.verified_at ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatDate(reg.verified_at)}
                      </span>
                    ) : (
                      <button
                        className="btn-verify"
                        onClick={() => setVerifyModal(reg)}
                      >
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Verify Modal */}
      {verifyModal && (
        <div className="modal-overlay" onClick={() => !verifying && setVerifyModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !verifying && setVerifyModal(null)} disabled={verifying}>✕</button>

            <div className="modal-icon" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}>
              🔍
            </div>

            <h3 className="modal-title">Verify Registration</h3>
            <p className="modal-subtitle">Review student details & payment proof before verifying</p>

            <div className="verify-modal-student">
              <div className="verify-modal-row">
                <span className="verify-modal-label">Name</span>
                <span className="verify-modal-value">{verifyModal.name}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Roll Number</span>
                <span className="verify-modal-value">{verifyModal.roll_number}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Branch</span>
                <span className="verify-modal-value">{verifyModal.branch}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Section</span>
                <span className="verify-modal-value">{verifyModal.section}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Phone</span>
                <span className="verify-modal-value">{verifyModal.phone}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Email</span>
                <span className="verify-modal-value">{verifyModal.email}</span>
              </div>
              {verifyModal.utr_number && (
                <div className="verify-modal-row">
                  <span className="verify-modal-label">UTR / Txn ID</span>
                  <span className="verify-modal-value" style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{verifyModal.utr_number}</span>
                </div>
              )}
            </div>

            {/* Payment Screenshot */}
            {verifyModal.payment_screenshot && (
              <div style={{ margin: '16px 0' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 }}>
                  💳 Payment Screenshot
                </div>
                <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '8px', display: 'inline-block' }}>
                  <img
                    src={`${verifyModal.payment_screenshot}`}
                    alt="Payment proof"
                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: 'var(--radius-sm)', objectFit: 'contain', cursor: 'pointer' }}
                    onClick={() => window.open(`${verifyModal.payment_screenshot}`, '_blank')}
                    title="Click to view full size"
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Click image to view full size
                </div>
              </div>
            )}

            {verifyModal.qr_data_url && (
              <div className="modal-qr">
                <img src={verifyModal.qr_data_url} alt="Registration QR Code" />
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setVerifyModal(null)}
                disabled={verifying}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={() => handleVerify(verifyModal.id)}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <span className="spinner"></span>
                    <span>Verifying...</span>
                  </>
                ) : (
                  '✓ Verify & Expire QR'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
