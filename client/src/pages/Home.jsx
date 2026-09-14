import { useState, useRef } from 'react';
import axios from 'axios';
import Toast from '../components/Toast';

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
    if (!paymentScreenshot) errs.payment_screenshot = 'Payment screenshot is required';
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
      // Use FormData for file upload
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
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          <span>VE Cell • AKGEC Ghaziabad</span>
        </div>

        <h1 className="hero-title">DRISHTI</h1>

        <p className="hero-subtitle">
          A transformative event by the Value Education Cell, fostering individual growth and societal consciousness through shared learning experiences.
        </p>

        <div className="hero-cta">
          <a href="#register" className="btn btn-primary btn-lg">
            Register Now — ₹60
          </a>
          <a href="https://www.akgec.ac.in/ve-cell/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg">
            About VE Cell ↗
          </a>
        </div>

        <div className="hero-info-grid">
          <div className="hero-info-card">
            <div className="hero-info-icon">📍</div>
            <div className="hero-info-label">Venue</div>
            <div className="hero-info-value">AKGEC Campus</div>
          </div>
          <div className="hero-info-card">
            <div className="hero-info-icon">💰</div>
            <div className="hero-info-label">Entry Fee</div>
            <div className="hero-info-value">₹60 Only</div>
          </div>
          <div className="hero-info-card">
            <div className="hero-info-icon">🎓</div>
            <div className="hero-info-label">For</div>
            <div className="hero-info-value">All Students</div>
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section className="register-section" id="register">
        <div className="section-header animate-fade-in-up">
          <div className="section-tag">Registration</div>
          <h2 className="section-title">Register for Drishti</h2>
          <p className="section-subtitle">Pay via UPI, upload screenshot, and fill in your details to secure your spot.</p>
        </div>

        <div className="register-container">
          {/* Form Card */}
          <div className="form-card animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
            <h3 className="form-card-title">Student Details</h3>
            <p className="form-card-subtitle">Enter your information as per university records</p>

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
                <label className="form-label" htmlFor="phone">Phone Number</label>
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

              {/* Payment Proof Section */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '24px 0 20px', paddingTop: '24px' }}>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--accent-primary)' }}>
                  💳 Payment Proof
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  After paying ₹60 via UPI, upload the payment screenshot
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="payment_screenshot">Payment Screenshot *</label>
                <div
                  className="file-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${errors.payment_screenshot ? 'var(--error)' : screenshotPreview ? 'var(--success)' : 'var(--border-medium)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: screenshotPreview ? '12px' : '28px',
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
                          maxHeight: '200px',
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
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📤</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Click to upload payment screenshot
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        JPG, PNG or WebP • Max 5MB
                      </div>
                    </>
                  )}
                </div>
                {errors.payment_screenshot && <div className="form-error">{errors.payment_screenshot}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="utr_number">UPI Transaction ID / UTR Number (optional)</label>
                <input
                  id="utr_number"
                  type="text"
                  name="utr_number"
                  className="form-input"
                  placeholder="e.g. 412345678901 (from payment confirmation)"
                  value={formData.utr_number}
                  onChange={handleChange}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  💡 Find this in your UPI app's transaction history
                </div>
              </div>

              <button type="submit" className="btn btn-primary form-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Registering...</span>
                  </>
                ) : (
                  'Complete Registration'
                )}
              </button>
            </form>
          </div>

          {/* Payment Card */}
          <div className="payment-card animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
            <h3 className="payment-card-title">Payment</h3>
            <p className="payment-card-subtitle">Scan the QR code to pay via UPI</p>

            <div className="payment-amount">
              <span className="payment-amount-currency">₹</span>
              <span className="payment-amount-value">60</span>
            </div>

            <div className="payment-qr-container">
              <img
                src="/payment-qr.png"
                alt="UPI Payment QR Code"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="payment-qr-placeholder" style={{ display: 'none' }}>
                <span style={{ fontSize: '32px', marginBottom: '8px' }}>📱</span>
                <span>Payment QR</span>
                <span style={{ fontSize: '11px', marginTop: '4px' }}>Coming Soon</span>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Pay to: <strong style={{ color: 'var(--text-primary)' }}>VIJAY KUMAR</strong>
            </div>

            <div className="payment-steps">
              <div className="payment-step">
                <span className="payment-step-number">1</span>
                <span className="payment-step-text">Open any UPI app (Google Pay, PhonePe, Paytm, etc.)</span>
              </div>
              <div className="payment-step">
                <span className="payment-step-number">2</span>
                <span className="payment-step-text">Scan the QR code above and pay <strong>₹60</strong></span>
              </div>
              <div className="payment-step">
                <span className="payment-step-number">3</span>
                <span className="payment-step-text"><strong>Take a screenshot</strong> of the payment confirmation</span>
              </div>
              <div className="payment-step">
                <span className="payment-step-number">4</span>
                <span className="payment-step-text">Fill in your details, <strong>upload the screenshot</strong>, and submit</span>
              </div>
              <div className="payment-step">
                <span className="payment-step-number">5</span>
                <span className="payment-step-text">You'll receive a confirmation email with your <strong>entry QR code</strong></span>
              </div>
            </div>

            <div className="payment-note">
              💡 Your payment will be verified by the admin team using the screenshot. Once verified, your QR code becomes your entry pass!
            </div>
          </div>
        </div>
      </section>

      {/* Success Modal */}
      {showSuccess && successData && (
        <div className="modal-overlay" onClick={() => setShowSuccess(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSuccess(false)}>✕</button>
            <div className="modal-icon">✓</div>
            <h3 className="modal-title">Registration Successful!</h3>
            <p className="modal-subtitle">
              Your entry QR code has been sent to <strong>{successData.email}</strong>
            </p>

            {successData.qr_code && (
              <div className="modal-qr">
                <img src={successData.qr_code} alt="Your Entry QR Code" />
              </div>
            )}

            <div className="modal-info">
              📧 Check your email for the QR code. Your payment will be verified by the admin team. Show the QR at the venue for entry.
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
