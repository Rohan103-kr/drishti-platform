import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

const UPI_ID = '8188925616@ybl';
const PAYEE_NAME = 'VIJAY KUMAR';
const AMOUNT = 60;

export default function UpiPaymentGateway({
  rollNumber = '',
  studentName = '',
  utrNumber = '',
  onUtrChange,
  paymentScreenshot,
  onScreenshotChange,
  screenshotPreview,
  errors = {},
  isModal = false,
  onClose,
  onSubmit,
  loading = false,
}) {
  const [activeTab, setActiveTab] = useState('apps'); // 'apps' | 'qr'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile user agent
  useEffect(() => {
    const checkMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(checkMobile);
    // On desktop, default to QR view; on mobile, default to 1-tap apps
    if (!checkMobile) {
      setActiveTab('qr');
    }
  }, []);

  // Build clean transaction note
  const sanitizedRoll = rollNumber.trim().replace(/[^a-zA-Z0-9]/g, '');
  const transactionNote = sanitizedRoll ? `Drishti ${sanitizedRoll}` : 'Drishti Registration';

  // Base UPI intent URL standard (NPCI specification)
  const baseUpiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(
    PAYEE_NAME
  )}&am=${AMOUNT}&cu=INR&tn=${encodeURIComponent(transactionNote)}&mode=02&purpose=00`;

  // App-specific intent schemes
  const gpayUrl = `gpay://upi/pay?pa=${UPI_ID}&pn=${encodeURIComponent(
    PAYEE_NAME
  )}&am=${AMOUNT}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  const phonepeUrl = `phonepe://pay?pa=${UPI_ID}&pn=${encodeURIComponent(
    PAYEE_NAME
  )}&am=${AMOUNT}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  const paytmUrl = `paytmmp://pay?pa=${UPI_ID}&pn=${encodeURIComponent(
    PAYEE_NAME
  )}&am=${AMOUNT}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  // Generate dynamic QR code whenever roll number changes
  useEffect(() => {
    QRCode.toDataURL(baseUpiUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#080918',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate dynamic UPI QR:', err));
  }, [baseUpiUrl]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isUtrValid = utrNumber && utrNumber.trim().length >= 6;
  const isUtr12Digits = /^\d{12}$/.test(utrNumber.trim());

  return (
    <div className={`upi-gateway-container ${isModal ? 'is-modal' : ''}`}>
      {/* Gateway Header Badge */}
      <div className="upi-gateway-header">
        <div className="upi-gateway-brand">
          <div className="upi-gateway-logo-pill">
            <Zap size={14} className="upi-pulse-icon" />
            <span>DRISHTI PAY</span>
          </div>
          <span className="upi-secure-badge">
            <ShieldCheck size={13} /> 0% Fee • Direct UPI
          </span>
        </div>

        <div className="upi-amount-pill">
          <span className="upi-currency">₹</span>
          <span className="upi-val">{AMOUNT}</span>
          <span className="upi-entry-label">Registration</span>
        </div>
      </div>

      {/* Payee Info Banner */}
      <div className="upi-payee-card">
        <div className="upi-payee-info">
          <div className="upi-payee-label">Verified Payee:</div>
          <div className="upi-payee-name">{PAYEE_NAME} (Coordinator)</div>
          <div className="upi-id-row">
            <code className="upi-id-text">{UPI_ID}</code>
            <button
              type="button"
              className={`upi-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyUpi}
              title="Copy UPI ID"
            >
              {copied ? (
                <>
                  <Check size={13} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>
        </div>
        {studentName && (
          <div className="upi-student-tag">
            For: <strong>{studentName}</strong> {rollNumber ? `(${rollNumber})` : ''}
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="upi-tabs">
        <button
          type="button"
          className={`upi-tab-btn ${activeTab === 'apps' ? 'active' : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          <Smartphone size={16} />
          <span>⚡ Tap to Pay (UPI Apps)</span>
        </button>
        <button
          type="button"
          className={`upi-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          <QrCode size={16} />
          <span>📷 Scan Dynamic QR</span>
        </button>
      </div>

      {/* TAB 1: 1-Tap UPI Apps */}
      {activeTab === 'apps' && (
        <div className="upi-apps-pane animate-fade-in">
          <p className="upi-pane-hint">
            Tap your preferred UPI app below to auto-open with <strong>₹60</strong> & payee details filled in:
          </p>

          <div className="upi-app-grid">
            {/* Google Pay */}
            <a
              href={gpayUrl}
              className="upi-app-btn upi-gpay"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="upi-app-icon gpay-icon">G</div>
              <div className="upi-app-content">
                <span className="upi-app-title">Google Pay</span>
                <span className="upi-app-sub">Open GPay directly</span>
              </div>
              <ExternalLink size={14} className="upi-app-arrow" />
            </a>

            {/* PhonePe */}
            <a
              href={phonepeUrl}
              className="upi-app-btn upi-phonepe"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="upi-app-icon phonepe-icon">पे</div>
              <div className="upi-app-content">
                <span className="upi-app-title">PhonePe</span>
                <span className="upi-app-sub">Open PhonePe directly</span>
              </div>
              <ExternalLink size={14} className="upi-app-arrow" />
            </a>

            {/* Paytm */}
            <a
              href={paytmUrl}
              className="upi-app-btn upi-paytm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="upi-app-icon paytm-icon">P</div>
              <div className="upi-app-content">
                <span className="upi-app-title">Paytm</span>
                <span className="upi-app-sub">Open Paytm directly</span>
              </div>
              <ExternalLink size={14} className="upi-app-arrow" />
            </a>

            {/* Any UPI / BHIM */}
            <a
              href={baseUpiUrl}
              className="upi-app-btn upi-generic"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="upi-app-icon generic-icon">⚡</div>
              <div className="upi-app-content">
                <span className="upi-app-title">Any Other UPI App</span>
                <span className="upi-app-sub">BHIM, CRED, Navi, Bank Apps</span>
              </div>
              <ExternalLink size={14} className="upi-app-arrow" />
            </a>
          </div>

          {!isMobile && (
            <div className="upi-desktop-hint">
              💻 <em>On desktop?</em> Switch to the <strong>Scan Dynamic QR</strong> tab above to scan with your phone camera!
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Dynamic QR Code */}
      {activeTab === 'qr' && (
        <div className="upi-qr-pane animate-fade-in">
          <div className="upi-qr-frame">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Dynamic Drishti UPI QR"
                className="upi-qr-image"
              />
            ) : (
              <div className="upi-qr-loading">Generating secure QR...</div>
            )}
            <div className="upi-qr-badge">
              <span>SCAN WITH ANY UPI APP</span>
            </div>
          </div>

          <div className="upi-qr-instruction">
            <span>Scan with Google Pay, PhonePe, Paytm, or BHIM. Amount ₹60 is pre-set.</span>
          </div>
        </div>
      )}

      {/* STEP 2: Instant Transaction Reference (UTR) */}
      <div className="upi-verification-box">
        <div className="upi-verification-header">
          <div className="upi-step-circle">2</div>
          <div>
            <div className="upi-step-title">Enter UPI Transaction ID / UTR</div>
            <div className="upi-step-sub">
              Found in your UPI app payment receipt / SMS (12 digits)
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '12px' }}>
          <div className="upi-input-wrapper">
            <input
              type="text"
              name="utr_number"
              className={`form-input upi-utr-input ${isUtr12Digits ? 'is-valid' : ''}`}
              placeholder="e.g. 412345678901 (12 digits)"
              value={utrNumber}
              maxLength={22}
              onChange={(e) => onUtrChange && onUtrChange(e.target.value)}
            />
            {isUtr12Digits && (
              <span className="upi-utr-valid-badge" title="Valid 12-digit UTR length">
                <CheckCircle2 size={16} /> 12-Digit UTR
              </span>
            )}
          </div>
          {errors.utr_number && (
            <div className="form-error" style={{ marginTop: '4px' }}>
              {errors.utr_number}
            </div>
          )}
        </div>

        {/* Optional Screenshot upload toggle */}
        <div className="upi-screenshot-toggle">
          <label className="form-label" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            📎 Optional Screenshot Proof:
          </label>
          <div className="upi-screenshot-mini-drop">
            <input
              type="file"
              id="upi_mini_screenshot"
              accept="image/jpeg,image/png,image/webp"
              onChange={onScreenshotChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="upi_mini_screenshot" className="upi-mini-upload-btn">
              {screenshotPreview ? '✅ Screenshot Attached (Click to change)' : '📷 Attach Payment Screenshot (Optional)'}
            </label>
          </div>
        </div>
      </div>

      {/* Modal Actions */}
      {isModal && (
        <div className="upi-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Back to Form
          </button>
          <button
            type="button"
            className="btn btn-primary upi-submit-btn"
            onClick={onSubmit}
            disabled={loading || (!isUtrValid && !paymentScreenshot)}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>Confirming Registration...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Verify & Complete Registration</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
