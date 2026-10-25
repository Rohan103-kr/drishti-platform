import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import UpiPaymentGateway from '../components/UpiPaymentGateway';
import { 
  Film, 
  Calendar, 
  MapPin, 
  Ticket, 
  Phone, 
  ExternalLink, 
  Sparkles, 
  HeartHandshake, 
  Users,
  Compass,
  X,
  Zap,
  ShieldCheck
} from 'lucide-react';

function InstagramIcon({ size = 18, color = "#e1306c" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ size = 18, color = "#0a66c2" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

const BRANCHES = [
  'Computer Science and Engineering',
  'Information Technology',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electronics and Instrumentation Engineering',
  'Master of Computer Applications',
];

const SECTIONS = ['1', '2', '3', '4'];

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    roll_number: '',
    branch: '',
    section: '',
    phone: '',
    email: '',
    utr_number: '',
  });
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const fileInputRef = useRef(null);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.roll_number.trim()) errs.roll_number = 'Roll number is required';
    if (!formData.branch) errs.branch = 'Select your branch';
    if (!formData.section) errs.section = 'Select your section';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    else if (!/^[6-9]\d{9}$/.test(formData.phone)) errs.phone = 'Enter a valid 10-digit phone number';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Enter a valid email';
    
    // Either valid UTR number (min 6 digits) or screenshot proof
    const hasUtr = formData.utr_number && formData.utr_number.trim().length >= 6;
    if (!paymentScreenshot && !hasUtr) {
      errs.utr_number = 'Enter your 12-digit UPI UTR number or attach a payment screenshot';
    }
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, payment_screenshot: 'File must be under 5MB' }));
        return;
      }
      setPaymentScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, payment_screenshot: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('roll_number', formData.roll_number);
      submitData.append('branch', formData.branch);
      submitData.append('section', formData.section);
      submitData.append('phone', formData.phone);
      submitData.append('email', formData.email);
      submitData.append('utr_number', formData.utr_number);
      submitData.append('payment_screenshot', paymentScreenshot);

      const res = await axios.post(`${API_URL}/register`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessData(res.data.registration);
      setShowSuccess(true);
      setFormData({ name: '', roll_number: '', branch: '', section: '', phone: '', email: '', utr_number: '' });
      setPaymentScreenshot(null);
      setScreenshotPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setErrors({});
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="hero" id="hero">
        {/* Official Society & College Badge */}
        <div className="hero-society-badge">
          <img src="/akgec_logo.png" alt="AKGEC Crest" className="society-badge-logo" />
          <span className="society-badge-text">Ajay Kumar Garg Engineering College</span>
          <span className="society-badge-sep">•</span>
          <img src="/ve_cell_logo.png" alt="VE Cell Logo" className="society-badge-logo" />
          <span className="society-badge-text highlight">Value Education Cell</span>
        </div>

        <h1 className="hero-title">DRISHTI</h1>

        <div className="hero-tagline">
          🎬 A VALUE BASED SHORT FILM EVENT
        </div>

        <p className="hero-subtitle">
          "Small stories make a big difference • Stories that inspire change." Fostering individual growth, perspective shifts, and societal consciousness through shared cinematic learning experiences.
        </p>

        <div className="hero-motto-pills">
          <span>People</span>
          <span>•</span>
          <span>Values</span>
          <span>•</span>
          <span>Perspectives</span>
          <span>•</span>
          <span>A Brighter Tomorrow</span>
        </div>

        <div className="hero-cta">
          <a href="#register" className="btn btn-primary btn-lg">
            Register Now — ₹60
          </a>
          <Link to="/quiz" className="btn btn-secondary btn-lg">
            Speed Quiz Arena ⚡
          </Link>
        </div>

        <div className="hero-info-grid">
          <div className="hero-info-card">
            <div className="hero-info-icon">📍</div>
            <div className="hero-info-label">Venue</div>
            <div className="hero-info-value">CSIT Seminar Hall</div>
          </div>
          <div className="hero-info-card">
            <div className="hero-info-icon">⏰</div>
            <div className="hero-info-label">Date & Time</div>
            <div className="hero-info-value">10th Oct • 04:00 PM</div>
          </div>
          <div className="hero-info-card">
            <div className="hero-info-icon">🎟️</div>
            <div className="hero-info-label">Entry Ticket</div>
            <div className="hero-info-value">₹60 Only</div>
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section className="register-section" id="register">
        <div className="section-header animate-fade-in-up">
          <div className="section-tag">Secure Your Entry</div>
          <h2 className="section-title">Register for Drishti</h2>
          <p className="section-subtitle">Pay ₹60 via UPI, upload your payment confirmation screenshot, and receive your verified entry QR pass.</p>
        </div>

        <div className="register-container">
          {/* Form Card */}
          <div className="form-card animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
            <h3 className="form-card-title">Student Details</h3>
            <p className="form-card-subtitle">Enter your official AKGEC university credentials</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Rohan Kumar"
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="roll_number">University Roll Number</label>
                <input
                  id="roll_number"
                  type="text"
                  name="roll_number"
                  className="form-input"
                  placeholder="e.g. 2100270130001"
                  value={formData.roll_number}
                  onChange={handleChange}
                />
                {errors.roll_number && <div className="form-error">{errors.roll_number}</div>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="branch">Branch</label>
                  <select
                    id="branch"
                    name="branch"
                    className="form-select"
                    value={formData.branch}
                    onChange={handleChange}
                  >
                    <option value="">Select Branch</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {errors.branch && <div className="form-error">{errors.branch}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="section">Section</label>
                  <select
                    id="section"
                    name="section"
                    className="form-select"
                    value={formData.section}
                    onChange={handleChange}
                  >
                    <option value="">Select</option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.section && <div className="form-error">{errors.section}</div>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone Number (WhatsApp)</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={formData.phone}
                  onChange={handleChange}
                />
                {errors.phone && <div className="form-error">{errors.phone}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="e.g. rohan@email.com"
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && <div className="form-error">{errors.email}</div>}
              </div>

              {/* Payment Verification Section */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '24px 0 20px', paddingTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💳 Payment Details (₹60 Entry Fee) <span style={{ color: 'var(--accent-primary)' }}>*</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowGatewayModal(true)}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(217, 70, 239, 0.12)',
                      borderColor: 'rgba(217, 70, 239, 0.3)',
                      color: 'var(--accent-primary)',
                      fontWeight: 600
                    }}
                  >
                    <Zap size={12} />
                    <span>Open UPI Gateway</span>
                  </button>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                  Pay ₹60 using any UPI app (GPay, PhonePe, Paytm) and enter the <strong>12-digit UTR number</strong> below or attach screenshot.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="utr_number">
                  12-Digit UPI Transaction ID / UTR Number
                </label>
                <div className="upi-input-wrapper">
                  <input
                    id="utr_number"
                    type="text"
                    name="utr_number"
                    className={`form-input upi-utr-input ${/^\d{12}$/.test(formData.utr_number.trim()) ? 'is-valid' : ''}`}
                    placeholder="e.g. 412345678901 (from payment confirmation)"
                    value={formData.utr_number}
                    onChange={handleChange}
                    maxLength={22}
                  />
                  {/^\d{12}$/.test(formData.utr_number.trim()) && (
                    <span className="upi-utr-valid-badge" title="Valid 12-digit length">
                      ✓ 12 Digits
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  💡 Found in your UPI app receipt or bank SMS after paying
                </div>
                {errors.utr_number && <div className="form-error">{errors.utr_number}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="payment_screenshot">
                  Payment Screenshot (Optional if UTR entered)
                </label>
                <div
                  className="file-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${errors.payment_screenshot ? 'var(--error)' : screenshotPreview ? 'var(--success)' : 'var(--border-medium)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: screenshotPreview ? '12px' : '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--bg-glass)',
                    transition: 'var(--transition-normal)',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id="payment_screenshot"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {screenshotPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={screenshotPreview}
                        alt="Payment screenshot"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '160px',
                          borderRadius: 'var(--radius-sm)',
                          objectFit: 'contain',
                        }}
                      />
                      <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px', fontWeight: 600 }}>
                        ✅ Screenshot uploaded — click to change
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>📤</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Click to upload payment screenshot (optional)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        JPG, PNG or WebP • Max 5MB
                      </div>
                    </>
                  )}
                </div>
                {errors.payment_screenshot && <div className="form-error">{errors.payment_screenshot}</div>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary form-submit-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      <span>Registering...</span>
                    </>
                  ) : (
                    'Complete Registration (₹60)'
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGatewayModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    padding: '10px'
                  }}
                >
                  <Zap size={14} style={{ color: 'var(--akgec-gold)' }} />
                  <span>⚡ Pay with GPay / PhonePe / QR Code</span>
                </button>
              </div>
            </form>
          </div>

          {/* Dynamic Interactive UPI Gateway Card */}
          <div className="payment-card animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
            <UpiPaymentGateway
              rollNumber={formData.roll_number}
              studentName={formData.name}
              utrNumber={formData.utr_number}
              onUtrChange={(val) => {
                setFormData((prev) => ({ ...prev, utr_number: val }));
                if (errors.utr_number) setErrors((prev) => ({ ...prev, utr_number: '' }));
              }}
              paymentScreenshot={paymentScreenshot}
              onScreenshotChange={handleFileChange}
              screenshotPreview={screenshotPreview}
              errors={errors}
            />

            <div className="payment-note" style={{ marginTop: '16px' }}>
              💡 Once registered, the VE Cell admin team will approve your pass and dispatch your verified QR code directly to your email!
            </div>
          </div>
        </div>

        {/* DRISHTI PAY - Interactive Express Gateway Modal */}
        {showGatewayModal && (
          <div className="upi-modal-backdrop" onClick={() => setShowGatewayModal(false)}>
            <div className="upi-modal-window animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="upi-modal-close-btn"
                onClick={() => setShowGatewayModal(false)}
                title="Close Gateway"
              >
                <X size={18} />
              </button>

              <UpiPaymentGateway
                rollNumber={formData.roll_number}
                studentName={formData.name}
                utrNumber={formData.utr_number}
                onUtrChange={(val) => {
                  setFormData((prev) => ({ ...prev, utr_number: val }));
                  if (errors.utr_number) setErrors((prev) => ({ ...prev, utr_number: '' }));
                }}
                paymentScreenshot={paymentScreenshot}
                onScreenshotChange={handleFileChange}
                screenshotPreview={screenshotPreview}
                errors={errors}
                isModal={true}
                onClose={() => setShowGatewayModal(false)}
                onSubmit={(e) => {
                  setShowGatewayModal(false);
                  handleSubmit(e);
                }}
                loading={loading}
              />
            </div>
          </div>
        )}
      </section>

      {/* Society Coordinators & Footer */}
      <footer className="society-footer">
        <div className="footer-content">
          {/* Column 1: Organization & Logos */}
          <div className="footer-brand">
            <div className="footer-logos-group">
              <div className="footer-logo-circle" title="Ajay Kumar Garg Engineering College">
                <img src="/akgec_logo.png" alt="AKGEC Crest" />
              </div>
              <div className="footer-logo-circle" title="Value Education Cell AKGEC">
                <img src="/ve_cell_logo.png" alt="VE Cell Logo" />
              </div>
            </div>

            <div>
              <div className="footer-title">VALUE EDUCATION CELL</div>
              <div className="footer-subtitle">Ajay Kumar Garg Engineering College, Ghaziabad</div>
            </div>

            <p className="footer-motto">
              <em>"Existence is Co-Existence"</em> • Promoting universal human values, ethical leadership, and harmonious societal living.
            </p>

            <div className="footer-unai-badge">
              <span>🌐</span> Partnered with United Nations Academic Impact
            </div>
          </div>

          {/* Column 2: Event Coordinators (from Poster) */}
          <div>
            <div className="footer-heading">Student Coordinators</div>

            <div className="footer-coordinator-card">
              <div className="footer-coord-info">
                <span className="footer-coord-name">Rishabh Kanaujiya</span>
                <span className="footer-coord-role">Lead Coordinator • Drishti</span>
              </div>
              <a href="tel:7991905307" className="footer-coord-phone">
                7991905307
              </a>
            </div>

            <div className="footer-coordinator-card">
              <div className="footer-coord-info">
                <span className="footer-coord-name">Anchal Bijlani</span>
                <span className="footer-coord-role">Lead Coordinator • Drishti</span>
              </div>
              <a href="tel:9555829146" className="footer-coord-phone">
                9555829146
              </a>
            </div>

            <div style={{ marginTop: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              For queries regarding registration or screening pass, contact coordinators.
            </div>
          </div>

          {/* Column 3: Social Handles & Links */}
          <div>
            <div className="footer-heading">Connect With Us</div>

            <div className="footer-social-links">
              <a 
                href="https://instagram.com/vecell_akgec" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-social-link"
              >
                <InstagramIcon size={18} color="#e1306c" />
                <span>@vecell_akgec</span>
              </a>

              <a 
                href="https://linkedin.com/company/vecell-akgec" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-social-link"
              >
                <LinkedinIcon size={18} color="#0a66c2" />
                <span>VE Cell AKGEC</span>
              </a>

              <a 
                href="https://www.akgec.ac.in/ve-cell/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-social-link"
              >
                <ExternalLink size={18} color="var(--accent-primary)" />
                <span>Official VE Cell Portal</span>
              </a>

              <a 
                href="https://www.akgec.ac.in" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-social-link"
              >
                <ExternalLink size={18} color="var(--akgec-gold)" />
                <span>AKGEC University Website</span>
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            Ajay Kumar Garg Engineering College • 27th Km Milestone, Delhi-Meerut Expressway, Ghaziabad, UP 201009
          </div>
          <div style={{ color: 'var(--akgec-gold)', fontWeight: 600 }}>
            "Be The Change You See"
          </div>
        </div>
      </footer>



      {/* Registration Submitted Modal (Awaiting Admin Payment Verification) */}
      {showSuccess && successData && (
        <div className="modal-overlay" onClick={() => setShowSuccess(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'center' }}>
            <button className="modal-close" onClick={() => setShowSuccess(false)}>✕</button>
            <div className="modal-icon" style={{ background: 'rgba(250, 204, 21, 0.15)', color: 'var(--akgec-gold)', border: '2px solid rgba(250, 204, 21, 0.4)' }}>
              ⏳
            </div>
            <h3 className="modal-title">Registration Submitted!</h3>
            <div style={{ display: 'inline-block', background: 'rgba(250, 204, 21, 0.12)', color: 'var(--akgec-gold)', padding: '4px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, margin: '8px 0 14px' }}>
              Payment Verification Pending
            </div>

            <p className="modal-subtitle" style={{ fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Your details and payment receipt have been received. The Value Education Cell admin team will review your transaction.
            </p>

            <div style={{ 
              background: 'rgba(255, 255, 255, 0.04)', 
              border: '1px solid rgba(255, 255, 255, 0.08)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px', 
              textAlign: 'left',
              marginBottom: '20px',
              fontSize: '0.85rem'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📬</span> What happens next?
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <strong>Payment Review:</strong> Admin verifies your ₹60 payment screenshot and UTR.
                </li>
                <li>
                  <strong>Official QR Emailed:</strong> Once verified, your entry QR code and pass code will be sent to: <strong style={{ color: 'var(--accent-primary)' }}>{successData.email}</strong>.
                </li>
                <li>
                  <strong>Gate Entry & Goodies:</strong> Show the emailed QR code at the CSIT Seminar Hall gate to receive your official entry and snacks packet!
                </li>
              </ul>
            </div>

            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px' }}
              onClick={() => setShowSuccess(false)}
            >
              Got It!
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
