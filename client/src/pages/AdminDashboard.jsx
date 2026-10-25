import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import GateScannerModal from '../components/GateScannerModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to parse payment proof URLs (Google Drive links, external URLs, local uploads)
function parsePaymentProof(screenshot) {
  if (!screenshot) return { type: 'none' };
  const str = String(screenshot).trim();

  // Google Drive link detection
  if (str.includes('drive.google.com') || str.includes('docs.google.com')) {
    const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const fileId = idMatch ? idMatch[1] : null;
    return {
      type: 'drive',
      url: str,
      fileId,
      thumbnail: fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` : null,
      preview: fileId ? `https://drive.google.com/file/d/${fileId}/preview` : str,
    };
  }

  // External web URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return { type: 'url', url: str, thumbnail: str };
  }

  // Local uploaded image
  return {
    type: 'local',
    url: str,
    thumbnail: str,
  };
}

const BRANCH_OPTIONS = [
  'Computer Science and Engineering',
  'Information Technology',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electronics and Instrumentation Engineering',
  'Master of Computer Applications',
];

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

  // Excel / CSV Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Advanced Filter & Sort States
  const [branchFilter, setBranchFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Manual Add Student States
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [addFormData, setAddFormData] = useState({
    name: '',
    roll_number: '',
    branch: 'Computer Science and Engineering',
    section: '1',
    phone: '',
    email: '',
    utr_number: '',
    payment_screenshot: '',
    auto_verify: false,
  });

  // Edit Student States
  const [editModal, setEditModal] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    roll_number: '',
    branch: '',
    section: '1',
    phone: '',
    email: '',
    utr_number: '',
    payment_screenshot: '',
  });

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
      if (branchFilter !== 'all') params.branch = branchFilter;
      if (sectionFilter !== 'all') params.section = sectionFilter;
      if (sortOrder !== 'newest') params.sort = sortOrder;

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
  }, [token, filter, search, branchFilter, sectionFilter, sortOrder]);

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

  const handleImportSubmit = async (e) => {
    e?.preventDefault();
    if (!importFile) {
      setToast({ message: 'Please select an Excel or CSV file first.', type: 'error' });
      return;
    }

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await axios.post(`${API_URL}/admin/import-excel`, formData, {
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(res.data);
      setToast({ message: `✅ ${res.data.message}`, type: 'success' });
      fetchStats();
      fetchRegistrations();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to import spreadsheet.';
      setToast({ message: `❌ ${errorMsg}`, type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  // Manual Add Student Handler
  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (!addFormData.name.trim() || !addFormData.roll_number.trim() || !addFormData.email.trim()) {
      setToast({ message: 'Name, Roll Number, and Email are required.', type: 'error' });
      return;
    }

    setAddingStudent(true);
    try {
      const res = await axios.post(`${API_URL}/admin/registrations`, addFormData, authHeaders);
      setToast({ message: `✅ ${res.data.message}`, type: 'success' });
      setShowAddModal(false);
      setAddFormData({
        name: '',
        roll_number: '',
        branch: 'Computer Science and Engineering',
        section: '1',
        phone: '',
        email: '',
        utr_number: '',
        payment_screenshot: '',
        auto_verify: false,
      });
      fetchStats();
      fetchRegistrations();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add student.';
      setToast({ message: `❌ ${msg}`, type: 'error' });
    } finally {
      setAddingStudent(false);
    }
  };

  // Edit Student Handlers
  const openEditModal = (reg) => {
    setEditFormData({
      name: reg.name || '',
      roll_number: reg.roll_number || '',
      branch: reg.branch || 'General',
      section: reg.section || '1',
      phone: reg.phone || '',
      email: reg.email || '',
      utr_number: reg.utr_number || '',
      payment_screenshot: reg.payment_screenshot || '',
    });
    setEditModal(reg);
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim() || !editFormData.roll_number.trim() || !editFormData.email.trim()) {
      setToast({ message: 'Name, Roll Number, and Email are required.', type: 'error' });
      return;
    }

    setSavingEdit(true);
    try {
      const res = await axios.put(`${API_URL}/admin/registrations/${editModal.id}`, editFormData, authHeaders);
      setToast({ message: `✅ ${res.data.message}`, type: 'success' });
      setEditModal(null);
      fetchRegistrations();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update student.';
      setToast({ message: `❌ ${msg}`, type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Student Handler
  const handleDeleteStudent = async (id, name, roll_number) => {
    if (!window.confirm(`Are you sure you want to permanently delete registration for ${name} (${roll_number})?`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_URL}/admin/registrations/${id}`, authHeaders);
      setToast({ message: `🗑️ ${res.data.message}`, type: 'success' });
      fetchStats();
      fetchRegistrations();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete registration.';
      setToast({ message: `❌ ${msg}`, type: 'error' });
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
            className="btn btn-sm" 
            onClick={() => {
              setAddFormData({
                name: '',
                roll_number: '',
                branch: 'Computer Science and Engineering',
                section: '1',
                phone: '',
                email: '',
                utr_number: '',
                payment_screenshot: '',
                auto_verify: false,
              });
              setShowAddModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            ➕ Add Student
          </button>
          <button 
            className="btn btn-sm" 
            onClick={() => {
              setImportFile(null);
              setImportResult(null);
              setShowImportModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            📤 Import Excel / CSV
          </button>
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

      {/* Advanced Filter & Sorting Bar */}
      <div
        className="animate-fade-in-up stagger-2"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '18px',
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          opacity: 0,
        }}
      >
        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Branch:</span>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              maxWidth: '220px',
            }}
          >
            <option value="all">All Branches</option>
            {BRANCH_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Section Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Section:</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Sections</option>
            <option value="1">Section 1</option>
            <option value="2">Section 2</option>
            <option value="3">Section 3</option>
            <option value="4">Section 4</option>
          </select>
        </div>

        {/* Sort Order */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Sort By:</span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name (A → Z)</option>
            <option value="name_desc">Name (Z → A)</option>
            <option value="roll_asc">Roll Number (Asc)</option>
          </select>
        </div>

        {/* Clear Filters */}
        {(branchFilter !== 'all' || sectionFilter !== 'all' || sortOrder !== 'newest' || filter !== 'all' || search) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setBranchFilter('all');
              setSectionFilter('all');
              setSortOrder('newest');
              setFilter('all');
              setSearch('');
            }}
            style={{ fontSize: '11px', padding: '5px 12px', marginLeft: 'auto' }}
          >
            ↺ Reset Filters
          </button>
        )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {!reg.payment_verified ? (
                        <button
                          className="btn-verify"
                          onClick={() => setVerifyModal(reg)}
                          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', whiteSpace: 'nowrap' }}
                        >
                          Review Payment
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setVerifyModal(reg)}
                          style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                        >
                          View Pass
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(reg)}
                        title="Edit student details"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeleteStudent(reg.id, reg.name, reg.roll_number)}
                        title="Delete registration"
                        style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--error)' }}
                      >
                        🗑️
                      </button>
                    </div>
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

            {/* Payment Screenshot / Proof */}
            {verifyModal.payment_screenshot && (() => {
              const proof = parsePaymentProof(verifyModal.payment_screenshot);
              return (
                <div style={{ margin: '16px 0', textAlign: 'left' }}>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '8px',
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>💳 Payment Proof (₹60)</span>
                    {proof.type === 'drive' && (
                      <span style={{
                        fontSize: '11px',
                        color: '#60a5fa',
                        background: 'rgba(59, 130, 246, 0.12)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid rgba(59, 130, 246, 0.25)'
                      }}>
                        📁 Google Drive Link
                      </span>
                    )}
                  </div>

                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    {proof.type === 'drive' ? (
                      <div>
                        {proof.thumbnail && (
                          <div style={{ marginBottom: '10px' }}>
                            <img
                              src={proof.thumbnail}
                              alt="Google Drive Receipt"
                              style={{
                                maxHeight: '220px',
                                maxWidth: '100%',
                                borderRadius: 'var(--radius-sm)',
                                objectFit: 'contain',
                                cursor: 'pointer'
                              }}
                              onClick={() => window.open(proof.url, '_blank')}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              title="Click to open in Google Drive"
                            />
                          </div>
                        )}
                        <a
                          href={proof.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            textDecoration: 'none',
                            fontWeight: 600
                          }}
                        >
                          🔗 Open Receipt in Google Drive
                        </a>
                      </div>
                    ) : (
                      <div>
                        <img
                          src={`${proof.url}`}
                          alt="Payment proof"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '250px',
                            borderRadius: 'var(--radius-sm)',
                            objectFit: 'contain',
                            cursor: 'pointer'
                          }}
                          onClick={() => window.open(`${proof.url}`, '_blank')}
                          title="Click image to view full size in new tab"
                        />
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          Click image to view full size in new tab
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Direct UPI Notice if no screenshot was uploaded */}
            {!verifyModal.payment_screenshot && (
              <div style={{
                margin: '16px 0',
                padding: '16px',
                background: 'rgba(59, 130, 246, 0.08)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed rgba(59, 130, 246, 0.35)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  ⚡ Direct UPI Payment (No screenshot attached)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Verify against coordinator bank account / UPI statement with UTR:{' '}
                  <strong style={{ color: 'var(--akgec-gold)', fontFamily: 'monospace', fontSize: '13px' }}>
                    {verifyModal.utr_number || 'N/A'}
                  </strong>
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

      {/* Import Google Forms Excel / CSV Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal" style={{ maxWidth: '560px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !importing && setShowImportModal(false)} disabled={importing}>✕</button>

            <div className="modal-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: '#10b981', color: '#10b981' }}>
              📊
            </div>

            <h3 className="modal-title" style={{ textAlign: 'center' }}>
              Import Google Form Responses
            </h3>
            <p className="modal-subtitle" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Upload your Google Form responses as an Excel (<strong>.xlsx / .xls</strong>) or <strong>.csv</strong> file.
            </p>

            {/* Guide on Columns */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '20px'
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                💡 Auto-detected Column Headers:
              </div>
              <div style={{ lineHeight: '1.6' }}>
                • <strong>Name</strong> (or Student Name, Full Name)<br/>
                • <strong>Roll Number</strong> (or University Roll No, Roll No)<br/>
                • <strong>Branch</strong> & <strong>Section</strong><br/>
                • <strong>Phone</strong> (or WhatsApp Number, Mobile)<br/>
                • <strong>Email</strong> (recipient for the QR Pass)<br/>
                • <strong>UTR / Txn ID</strong> & <strong>Payment Screenshot</strong> (Google Drive file links supported)
              </div>
            </div>

            {/* Dropzone / File Picker */}
            {!importResult ? (
              <form onSubmit={handleImportSubmit}>
                <div
                  style={{
                    border: '2px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: importFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                    borderColor: importFile ? '#10b981' : 'var(--border-medium)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '20px'
                  }}
                  onClick={() => document.getElementById('excel-file-input').click()}
                >
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImportFile(e.target.files[0]);
                      }
                    }}
                  />
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                    {importFile ? '📄' : '📁'}
                  </div>
                  {importFile ? (
                    <div>
                      <div style={{ fontWeight: 700, color: '#10b981', fontSize: '15px' }}>
                        {importFile.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {(importFile.size / 1024).toFixed(1)} KB • Ready to import
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '10px', fontSize: '11px', padding: '4px 10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportFile(null);
                        }}
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        Click to select or drag & drop file here
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Supports .xlsx, .xls, or .csv (up to 15MB)
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowImportModal(false)}
                    disabled={importing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                    }}
                    disabled={!importFile || importing}
                  >
                    {importing ? (
                      <>
                        <span className="spinner"></span>
                        <span>Importing & Generating Passes...</span>
                      </>
                    ) : (
                      '⚡ Upload & Import Registrations'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {/* Result Screen */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✅</span> Import Completed!
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-primary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>Total Rows: <strong>{importResult.totalRows}</strong></div>
                    <div>Imported: <strong style={{ color: '#10b981' }}>{importResult.importedCount}</strong></div>
                    <div>Duplicates Skipped: <strong style={{ color: 'var(--warning)' }}>{importResult.skippedDuplicatesCount}</strong></div>
                    <div>Invalid Rows: <strong style={{ color: 'var(--error)' }}>{importResult.invalidRowsCount}</strong></div>
                  </div>
                </div>

                {importResult.skippedDuplicatesCount > 0 && (
                  <div style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '16px'
                  }}>
                    <strong style={{ color: 'var(--warning)' }}>Skipped Duplicates (Already in DB):</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {importResult.skippedDuplicates.map((dup, i) => (
                        <li key={i}>{dup.name} ({dup.roll_number}) - Row {dup.row}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setImportFile(null);
                      setImportResult(null);
                    }}
                  >
                    Import Another File
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => setShowImportModal(false)}
                  >
                    Done & View Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !addingStudent && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '560px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !addingStudent && setShowAddModal(false)} disabled={addingStudent}>✕</button>

            <div className="modal-icon" style={{ background: 'rgba(37, 99, 235, 0.12)', borderColor: '#3b82f6', color: '#3b82f6' }}>
              👤
            </div>

            <h3 className="modal-title" style={{ textAlign: 'center' }}>
              Manual Registration
            </h3>
            <p className="modal-subtitle" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Add a new student directly into the Drishti system.
            </p>

            <form onSubmit={handleAddStudentSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 220027010099"
                    value={addFormData.roll_number}
                    onChange={(e) => setAddFormData({ ...addFormData, roll_number: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Branch
                  </label>
                  <select
                    value={addFormData.branch}
                    onChange={(e) => setAddFormData({ ...addFormData, branch: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Section
                  </label>
                  <select
                    value={addFormData.section}
                    onChange={(e) => setAddFormData({ ...addFormData, section: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@akgec.ac.in"
                    value={addFormData.email}
                    onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    UTR / Txn ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI39482019"
                    value={addFormData.utr_number}
                    onChange={(e) => setAddFormData({ ...addFormData, utr_number: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Screenshot / Drive Link (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Drive URL or link"
                    value={addFormData.payment_screenshot}
                    onChange={(e) => setAddFormData({ ...addFormData, payment_screenshot: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Immediate verification option */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer'
              }}
              onClick={() => setAddFormData({ ...addFormData, auto_verify: !addFormData.auto_verify })}
              >
                <input
                  type="checkbox"
                  id="auto_verify_check"
                  checked={addFormData.auto_verify}
                  onChange={(e) => setAddFormData({ ...addFormData, auto_verify: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="auto_verify_check" style={{ fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                  ⚡ Approve payment & send Entry QR pass to email immediately
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                  disabled={addingStudent}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, fontWeight: 700 }}
                  disabled={addingStudent}
                >
                  {addingStudent ? (
                    <>
                      <span className="spinner"></span>
                      <span>Creating Registration...</span>
                    </>
                  ) : (
                    '✓ Add Student'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Details Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => !savingEdit && setEditModal(null)}>
          <div className="modal" style={{ maxWidth: '560px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !savingEdit && setEditModal(null)} disabled={savingEdit}>✕</button>

            <div className="modal-icon" style={{ background: 'rgba(234, 179, 8, 0.12)', borderColor: 'var(--warning)', color: 'var(--warning)' }}>
              ✏️
            </div>

            <h3 className="modal-title" style={{ textAlign: 'center' }}>
              Edit Student Details
            </h3>
            <p className="modal-subtitle" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Update registration details for <strong>{editModal.name}</strong> ({editModal.roll_number})
            </p>

            <form onSubmit={handleEditStudentSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.roll_number}
                    onChange={(e) => setEditFormData({ ...editFormData, roll_number: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Branch
                  </label>
                  <input
                    type="text"
                    value={editFormData.branch}
                    onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Section
                  </label>
                  <input
                    type="text"
                    value={editFormData.section}
                    onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    UTR / Txn ID
                  </label>
                  <input
                    type="text"
                    value={editFormData.utr_number}
                    onChange={(e) => setEditFormData({ ...editFormData, utr_number: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Screenshot / Drive Link
                  </label>
                  <input
                    type="text"
                    value={editFormData.payment_screenshot}
                    onChange={(e) => setEditFormData({ ...editFormData, payment_screenshot: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditModal(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, fontWeight: 700 }}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <>
                      <span className="spinner"></span>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    '✓ Save Changes'
                  )}
                </button>
              </div>
            </form>
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
