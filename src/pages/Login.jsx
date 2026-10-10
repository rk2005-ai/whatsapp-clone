import { useState } from 'react';
import { MessageCircle, Lock, ArrowLeft, Loader2, CheckCircle2, QrCode, Smartphone } from 'lucide-react';
import { api } from '../api/client.js';

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('phone'); // 'phone' | 'qr'
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [otp, setOtp] = useState('');
  const [serverOtp, setServerOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErr('');
    const trimmedName = name.trim();
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    if (trimmedName.length < 2) {
      return setErr('Please enter your full name (at least 2 characters).');
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) {
      return setErr('Enter a valid international phone number, e.g. +919876543210');
    }

    setLoading(true);
    try {
      const res = await api.requestOtp(cleanPhone, trimmedName);
      if (res.devOtp) {
        setServerOtp(res.devOtp);
        setOtp(res.devOtp); // Auto-fill convenience
      }
      setStep(2);
    } catch (error) {
      setErr(error.message || 'Failed to send verification code. Ensure server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErr('');
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    if (!/^\d{6}$/.test(otp)) {
      return setErr('Please enter the 6-digit verification code.');
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp(cleanPhone, otp);
      if (res.user) {
        onLogin(res.user);
      }
    } catch (error) {
      setErr(error.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <MessageCircle size={44} />
        </div>

        {step === 0 && (
          <>
            <h1>Welcome to WhatsApp Web</h1>
            <p>Connect and chat in real-time with verified phone authentication and live messaging.</p>

            <div className="login-tabs" style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
              <button
                type="button"
                className={`chip ${tab === 'phone' ? 'on' : ''}`}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                onClick={() => setTab('phone')}
              >
                <Smartphone size={16} /> Phone Number
              </button>
              <button
                type="button"
                className={`chip ${tab === 'qr' ? 'on' : ''}`}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                onClick={() => setTab('qr')}
              >
                <QrCode size={16} /> QR Code
              </button>
            </div>

            {tab === 'phone' ? (
              <button className="btn" onClick={() => setStep(1)}>
                Continue with Phone Number
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div
                  style={{
                    background: '#fff',
                    padding: '16px',
                    borderRadius: '12px',
                    display: 'inline-block',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=whatsapp-web-clone-auth"
                    alt="Scan QR code"
                    style={{ display: 'block', borderRadius: '4px' }}
                  />
                </div>
                <p style={{ fontSize: '13px', marginTop: '12px', color: 'var(--sub)' }}>
                  Point your phone camera to link quickly or use phone number.
                </p>
                <button className="btn" style={{ marginTop: '8px' }} onClick={() => setStep(1)}>
                  Log in with Phone Number
                </button>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <form onSubmit={handleRequestOtp} noValidate>
            <button
              type="button"
              className="icon-btn back"
              aria-label="Back"
              onClick={() => {
                setErr('');
                setStep(0);
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1>Enter your details</h1>
            <p>Enter your profile name and active phone number.</p>

            <label>
              Your Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohit Sharma"
                autoFocus
                required
              />
            </label>

            <label>
              Phone Number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
                required
              />
            </label>

            {err && (
              <div className="error" role="alert">
                {err}
              </div>
            )}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : 'Send Verification Code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} noValidate>
            <button
              type="button"
              className="icon-btn back"
              aria-label="Back"
              onClick={() => {
                setErr('');
                setStep(1);
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1>Verify your phone</h1>
            <p>Enter the 6-digit security code sent to <strong>{phone}</strong>.</p>

            {serverOtp && (
              <div
                style={{
                  background: 'rgba(0, 168, 132, 0.1)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '14px'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Verification code: <strong>{serverOtp}</strong></span>
              </div>
            )}

            <label>
              6-digit Code
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                required
              />
            </label>

            {err && (
              <div className="error" role="alert">
                {err}
              </div>
            )}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : 'Verify and Enter'}
            </button>
          </form>
        )}

        <div className="login-foot">
          <Lock size={13} /> Secured with JWT authentication and live real-time sockets
        </div>
      </div>
    </div>
  );
}
