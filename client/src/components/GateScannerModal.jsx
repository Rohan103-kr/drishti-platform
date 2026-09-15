import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RotateCw, 
  Upload, 
  KeyRound, 
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Web Audio API synthesized chimes for fast, offline feedback
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant high double chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'already_done') {
      // Warning double beep
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(349.23, now + 0.12);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Error low buzzer
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

export default function GateScannerModal({ isOpen, onClose, onVerified }) {
  const [scannerActive, setScannerActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isVerifyingRef = useRef(false);

  // Initialize and start scanner when opened
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setResult(null);
      setCameraError(null);
      return;
    }

    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          if (isMounted) {
            setCameras(devices);
            // Default to back/environment camera if available
            const backCam = devices.find((d) => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment')
            );
            const chosenId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(chosenId);
            startScannerWithCamera(chosenId);
          }
        } else {
          // Fallback to facingMode constraint
          startScannerWithConstraint();
        }
      } catch (err) {
        console.warn('Could not enumerate cameras, trying default constraint:', err);
        startScannerWithConstraint();
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const startScannerWithCamera = async (cameraId) => {
    try {
      await stopScanner();
      const qrReader = new Html5Qrcode('qr-reader-gate');
      scannerRef.current = qrReader;

      await qrReader.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {} // frame parse error ignored
      );

      setScannerActive(true);
      setCameraError(null);
    } catch (err) {
      console.error('Failed to start camera with ID:', err);
      // Fallback
      startScannerWithConstraint();
    }
  };

  const startScannerWithConstraint = async () => {
    try {
      await stopScanner();
      const qrReader = new Html5Qrcode('qr-reader-gate');
      scannerRef.current = qrReader;

      await qrReader.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {}
      );

      setScannerActive(true);
      setCameraError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setScannerActive(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera permissions in your browser or enter the code manually below.'
          : 'Unable to open camera on this device. You can upload a QR image or enter the Pass Code manually below.'
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  const handleScanSuccess = async (decodedText) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setProcessing(true);

    // Pause scanner visual
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.pause(true);
      }
    } catch (e) {}

    await verifyScanData(decodedText);
  };

  const verifyScanData = async (rawString) => {
    const token = localStorage.getItem('drishti_admin_token');
    try {
      const res = await axios.post(
        `${API_URL}/admin/verify-scan`,
        { scanData: rawString },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const resData = res.data;
      setResult(resData);

      if (resData.status === 'verified') {
        playSound('success');
        if (onVerified) onVerified();
      } else if (resData.status === 'already_done') {
        playSound('already_done');
        if (onVerified) onVerified();
      } else {
        playSound('error');
      }
    } catch (err) {
      console.error('Verify scan request failed:', err);
      setResult({
        status: 'not_matched',
        success: false,
        message: err.response?.data?.error || 'Verification server error. Please try again.',
        scanned: rawString,
      });
      playSound('error');
    } finally {
      setProcessing(false);
    }
  };

  const handleResumeScanning = async () => {
    setResult(null);
    isVerifyingRef.current = false;
    try {
      if (scannerRef.current) {
        scannerRef.current.resume();
      } else if (selectedCameraId) {
        startScannerWithCamera(selectedCameraId);
      } else {
        startScannerWithConstraint();
      }
    } catch (e) {
      if (selectedCameraId) startScannerWithCamera(selectedCameraId);
      else startScannerWithConstraint();
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualLoading(true);
    isVerifyingRef.current = true;
    await verifyScanData(manualCode.trim());
    setManualLoading(false);
    setManualCode('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setProcessing(true);
      const tempReader = new Html5Qrcode('qr-reader-temp');
      const decodedText = await tempReader.scanFile(file, true);
      tempReader.clear();
      await verifyScanData(decodedText);
    } catch (err) {
      setProcessing(false);
      setResult({
        status: 'not_matched',
        success: false,
        message: 'Could not detect a valid QR code in the uploaded image.',
      });
      playSound('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCameraSwitch = (newId) => {
    setSelectedCameraId(newId);
    startScannerWithCamera(newId);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal scanner-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', width: '95%', padding: '20px', borderRadius: 'var(--radius-lg)' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}>
              <Camera size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                Gate Camera Scanner
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Drishti • CSIT Seminar Hall Entry Pass Verification
              </div>
            </div>
          </div>
          <button 
            className="modal-close" 
            onClick={onClose}
            style={{ position: 'static', width: '32px', height: '32px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Hidden element for file scanning */}
        <div id="qr-reader-temp" style={{ display: 'none' }}></div>

        {/* ACTIVE SCAN RESULT BANNER (OVERLAY) */}
        {result ? (
          <div className={`scan-result-card result-${result.status} animate-fade-in-up`}>
            {/* Status Header */}
            {result.status === 'verified' && (
              <div className="scan-result-header header-verified">
                <div className="scan-icon-bubble bubble-verified">
                  <CheckCircle2 size={38} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="scan-badge badge-verified">✓ ENTRY & GOODIES ALLOWED</div>
                  <h2 className="scan-status-title">Verified Successfully!</h2>
                  
                  {/* Goodies & Snacks Action Callout */}
                  <div style={{
                    margin: '10px 0 6px',
                    background: 'rgba(250, 204, 21, 0.15)',
                    border: '1px solid rgba(250, 204, 21, 0.4)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#ffd700',
                    fontWeight: 700,
                    fontSize: '0.92rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>🎁🍿</span> 
                    <span>HAND OVER GOODIES & SNACKS PACKET</span>
                  </div>

                  <div className="scan-status-time">
                    Checked in at: {new Date(result.gate_checked_in_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            )}

            {result.status === 'already_done' && (
              <div className="scan-result-header header-already">
                <div className="scan-icon-bubble bubble-already">
                  <AlertTriangle size={38} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="scan-badge badge-already">⚠️ ALREADY CLAIMED</div>
                  <h2 className="scan-status-title">Already Checked In!</h2>
                  
                  <div style={{
                    margin: '10px 0 6px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fbbf24',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}>
                    ⚠️ Goodies & snacks were already collected on: {result.gate_checked_in_at ? new Date(result.gate_checked_in_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Earlier'}. Do NOT issue a second packet.
                  </div>
                </div>
              </div>
            )}

            {result.status === 'unverified_payment' && (
              <div className="scan-result-header header-already">
                <div className="scan-icon-bubble bubble-already">
                  <AlertTriangle size={38} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="scan-badge badge-already">⚠️ PAYMENT UNAPPROVED</div>
                  <h2 className="scan-status-title">Payment Review Pending</h2>
                  <div className="scan-status-time" style={{ color: '#fbbf24', marginTop: '6px' }}>
                    {result.message}
                  </div>
                </div>
              </div>
            )}

            {result.status === 'not_matched' && (
              <div className="scan-result-header header-error">
                <div className="scan-icon-bubble bubble-error">
                  <XCircle size={38} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="scan-badge badge-error">❌ FALSE / FAKE QR</div>
                  <h2 className="scan-status-title">Invalid Entry Pass</h2>
                  <div className="scan-status-time">{result.message}</div>
                </div>
              </div>
            )}

            {/* Student Info Card if matched */}
            {result.student && (
              <div className="scan-student-card">
                <div className="student-card-field">
                  <span className="field-label">Student Name</span>
                  <span className="field-val name-val">{result.student.name}</span>
                </div>
                <div className="student-card-field">
                  <span className="field-label">University Roll No</span>
                  <span className="field-val code-val">{result.student.roll_number}</span>
                </div>
                <div className="student-card-field">
                  <span className="field-label">Branch & Section</span>
                  <span className="field-val">{result.student.branch} (Sec {result.student.section})</span>
                </div>
                {result.student.pass_code && (
                  <div className="student-card-field">
                    <span className="field-label">Unique Pass Code</span>
                    <span className="field-val passcode-val">{result.student.pass_code}</span>
                  </div>
                )}
                {result.student.phone && (
                  <div className="student-card-field">
                    <span className="field-label">Phone</span>
                    <span className="field-val">{result.student.phone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleResumeScanning}
                style={{ flex: 1, padding: '14px', fontSize: '1rem', fontWeight: 700 }}
              >
                Scan Next Student Pass 📸
              </button>
            </div>
          </div>
        ) : (
          /* SCANNER VIEWFINDER VIEW */
          <div>
            {/* Viewfinder Frame */}
            <div className="scanner-viewfinder-box">
              <div id="qr-reader-gate" className="qr-video-viewport"></div>

              {/* Scanning visual overlay */}
              {scannerActive && !processing && (
                <div className="scanner-guide-overlay">
                  <div className="scanner-laser-line"></div>
                  <div className="scanner-crosshair-corners"></div>
                  <div className="scanner-hint-text">
                    Align QR code within frame
                  </div>
                </div>
              )}

              {/* Processing Overlay */}
              {processing && (
                <div className="scanner-processing-overlay">
                  <span className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }}></span>
                  <span style={{ marginTop: '12px', fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                    Verifying pass token...
                  </span>
                </div>
              )}

              {/* Camera Error / Denied Screen */}
              {cameraError && (
                <div className="scanner-error-fallback">
                  <AlertTriangle size={36} color="var(--akgec-gold)" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '12px 0 16px', lineHeight: 1.5 }}>
                    {cameraError}
                  </p>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    <Upload size={14} /> Upload QR Screenshot
                  </button>
                </div>
              )}
            </div>

            {/* Camera Controls Bar */}
            <div className="scanner-controls-bar">
              {cameras.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCw size={14} color="var(--text-muted)" />
                  <select 
                    className="scanner-cam-select"
                    value={selectedCameraId || ''}
                    onChange={(e) => handleCameraSwitch(e.target.value)}
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Camera ${c.id.substring(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                type="button" 
                className="scanner-alt-btn"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                title="Scan QR from gallery or file"
              >
                <Upload size={14} /> Upload Image
              </button>

              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                OR ENTER PASS CODE MANUALLY
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
            </div>

            {/* Manual Code Input Form */}
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <KeyRound 
                  size={16} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} 
                />
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. DRISHTI-7K2M9P or Roll Number"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  style={{ paddingLeft: '38px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '1px' }}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={!manualCode.trim() || manualLoading}
                style={{ padding: '0 18px', fontWeight: 600 }}
              >
                {manualLoading ? <span className="spinner"></span> : 'Verify'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
