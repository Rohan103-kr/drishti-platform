import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import GateScannerModal from '../components/GateScannerModal';

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
  const [showScannerModal, setShowScannerModal] = useState(false);
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

  const handleVerifyPayment = async (id) => {
    setVerifying(true);
    try {
      const res = await axios.put(`${API_URL}/admin/verify-payment/${id}`, {}, authHeaders);
      setToast({ message: `✅ ${res.data.message || 'Payment verified & QR pass emailed!'}`, type: 'success' });
      setVerifyModal(null);
      fetchStats();
      fetchRegistrations();
    } catch (err) {
      const msg = err.response?.data?.error || 'Payment verification failed.';
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
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => setShowScannerModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }}
          >
            📷 Gate Camera Scanner
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            📥 Export CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid animate-fade-in-up stagger-1" style={{ opacity: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Registered</span>
            <div className="stat-card-icon total">📊</div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Payment Pending</span>
            <div className="stat-card-icon pending">⏳</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Payment Approved (QR Sent)</span>
            <div className="stat-card-icon verified">✉️</div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{stats.verified}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Gate Checked In (Goodies)</span>
            <div className="stat-card-icon" style={{ background: 'rgba(217, 70, 239, 0.15)', color: '#d946ef' }}>🎁</div>
          </div>
          <div className="stat-card-value" style={{ color: '#d946ef' }}>{stats.checked_in || 0}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="table-controls animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
        <div className="search-box">
          <span className="search-box-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, roll no, email, UTR or pass code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            { id: 'all', label: 'All' },
            { id: 'payment_pending', label: 'Pending Payment' },
            { id: 'payment_approved', label: 'Payment Approved' },
            { id: 'checked_in', label: 'Gate Checked In' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`filter-tab ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
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
                <th>UTR / Txn ID</th>
                <th>Payment Status</th>
                <th>Gate / Goodies</th>
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
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-primary)' }}>
                    {reg.utr_number || '—'}
                  </td>
                  <td>
                    {reg.payment_verified ? (
                      <span className="status-badge verified" title={`Approved at ${formatDate(reg.payment_verified_at)}`}>
                        ✅ Approved (QR Sent)
                      </span>
                    ) : (
                      <span className="status-badge pending">
                        ⏳ Pending Review
                      </span>
                    )}
                  </td>
                  <td>
                    {reg.gate_checked_in || reg.qr_expired ? (
                      <span className="status-badge" style={{ background: 'rgba(217, 70, 239, 0.15)', color: '#d946ef', border: '1px solid rgba(217, 70, 239, 0.3)' }}>
                        🎁 Given
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ⏳ Not Arrived
                      </span>
                    )}
                  </td>
                  <td>
                    {!reg.payment_verified ? (
                      <button
                        className="btn-verify"
                        onClick={() => setVerifyModal(reg)}
                        style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                      >
                        Review Payment
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setVerifyModal(reg)}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        View Pass
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

            <h3 className="modal-title">
              {!verifyModal.payment_verified ? '💳 Payment Verification' : 'Student Pass Details'}
            </h3>
            <p className="modal-subtitle">
              {!verifyModal.payment_verified
                ? 'Review payment proof. Approving will automatically generate and email the official Entry QR to the student.'
                : 'Payment is approved and Entry QR has been issued.'}
            </p>

            <div className="verify-modal-student">
              <div className="verify-modal-row">
                <span className="verify-modal-label">Student Name</span>
                <span className="verify-modal-value" style={{ fontWeight: 700 }}>{verifyModal.name}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Roll Number</span>
                <span className="verify-modal-value" style={{ fontFamily: 'monospace' }}>{verifyModal.roll_number}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Branch & Section</span>
                <span className="verify-modal-value">{verifyModal.branch} (Sec {verifyModal.section})</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Phone</span>
                <span className="verify-modal-value">{verifyModal.phone}</span>
              </div>
              <div className="verify-modal-row">
                <span className="verify-modal-label">Email (Recipient)</span>
                <span className="verify-modal-value" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{verifyModal.email}</span>
              </div>
              {verifyModal.utr_number && (
                <div className="verify-modal-row">
                  <span className="verify-modal-label">UTR / Txn ID</span>
                  <span className="verify-modal-value" style={{ color: 'var(--akgec-gold)', fontFamily: 'monospace', fontWeight: 700 }}>{verifyModal.utr_number}</span>
                </div>
              )}
            </div>

            {/* Payment Screenshot */}
            {verifyModal.payment_screenshot && (
              <div style={{ margin: '16px 0' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 }}>
                  💳 Uploaded Payment Screenshot (₹60)
                </div>
                <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '8px', display: 'inline-block', maxWidth: '100%' }}>
                  <img
                    src={`${verifyModal.payment_screenshot}`}
                    alt="Payment proof"
                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: 'var(--radius-sm)', objectFit: 'contain', cursor: 'pointer' }}
                    onClick={() => window.open(`${verifyModal.payment_screenshot}`, '_blank')}
                    title="Click image to view full size in new tab"
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Click image to inspect receipt full size
                </div>
              </div>
            )}

            {/* Pass Code Badge if already approved */}
            {verifyModal.payment_verified && (
              <div style={{ 
                background: 'rgba(250, 204, 21, 0.08)', 
                border: '1px solid rgba(250, 204, 21, 0.25)', 
                borderRadius: 'var(--radius-md)', 
                padding: '14px 18px', 
                margin: '16px 0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 600 }}>
                    Active Pass Code (Emailed)
                  </div>
                  <div style={{ fontSize: '1.3rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--akgec-gold)', letterSpacing: '1.5px', marginTop: '2px' }}>
                    {verifyModal.pass_code || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`status-badge ${verifyModal.gate_checked_in || verifyModal.qr_expired ? 'verified' : 'pending'}`}>
                    {verifyModal.gate_checked_in || verifyModal.qr_expired ? '🎁 Goodies Given' : '⏳ Gate Entry Pending'}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setVerifyModal(null)}
                disabled={verifying}
              >
                Close
              </button>

              {!verifyModal.payment_verified ? (
                <button
                  className="btn btn-success"
                  style={{ flex: 2, padding: '12px 18px', fontWeight: 700 }}
                  onClick={() => handleVerifyPayment(verifyModal.id)}
                  disabled={verifying}
                >
                  {verifying ? (
                    <>
                      <span className="spinner"></span>
                      <span>Sending QR Email...</span>
                    </>
                  ) : (
                    '✓ Approve Payment & Send QR Email'
                  )}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setVerifyModal(null);
                    setShowScannerModal(true);
                  }}
                >
                  📷 Gate Scanner
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gate Camera Scanner Modal */}
      <GateScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onVerified={() => {
          fetchStats();
          fetchRegistrations();
        }}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
