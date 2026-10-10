import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestAdminOtp, verifyAdminOtp } from '../../services/api';
import { Lock, ShieldAlert, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!resendSeconds && !expiresInSeconds) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
      setExpiresInSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds, expiresInSeconds]);

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await requestAdminOtp(email.trim());
      setStep('otp');
      setResendSeconds(60);
      setExpiresInSeconds(result.expiresInSeconds || 300);
    } catch (requestError) {
      setError(requestError.message || 'Unable to send the sign-in code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading || resendSeconds > 0) return;
    setError(null);
    setLoading(true);
    try {
      const result = await requestAdminOtp(email.trim());
      setOtp('');
      setResendSeconds(60);
      setExpiresInSeconds(result.expiresInSeconds || 300);
    } catch (requestError) {
      setError(requestError.message || 'Unable to send a new code.');
      if (requestError.data?.retryAfterSeconds) setResendSeconds(requestError.data.retryAfterSeconds);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await verifyAdminOtp(email.trim(), otp.trim());
      sessionStorage.setItem('ffa_admin_user', JSON.stringify(result.admin));
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Unable to verify the sign-in code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="ffa-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px',
        border: '1px solid rgba(255, 85, 0, 0.3)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(255, 85, 0, 0.15)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ff5500, #ff2a4b)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 20px rgba(255, 85, 0, 0.4)',
          }}>
            <Lock size={26} />
          </div>

          <h1 style={{ fontSize: '24px', color: '#ffffff', marginBottom: '6px' }}>
            ADMINISTRATOR PORTAL
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
            Sign in with a one-time code sent to the authorized administrator email.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}

        {step === 'email' ? <form onSubmit={handleRequestOtp}>
          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="form-input"
                placeholder="admin@freefirearena.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {loading ? 'SENDING CODE...' : (
              <>
                SEND ONE-TIME CODE <ArrowRight size={18} />
              </>
            )}
          </button>
        </form> : <form onSubmit={handleVerifyOtp}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-otp">6-digit email code</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={17} style={{ position: 'absolute', left: 13, top: 14, color: 'var(--text-dim)' }} />
              <input id="admin-otp" inputMode="numeric" autoComplete="one-time-code" required
                pattern="[0-9]{6}" maxLength={6} className="form-input"
                style={{ paddingLeft: 40, letterSpacing: '0.25em' }} value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <small style={{ color: 'var(--text-dim)' }}>
              Sent to {email}. {expiresInSeconds > 0
                ? `Expires in ${Math.floor(expiresInSeconds / 60)}:${String(expiresInSeconds % 60).padStart(2, '0')}.`
                : 'This code has expired; request a new one.'}
            </small>
          </div>
          <button type="submit" disabled={loading || otp.length !== 6}
            className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            {loading ? 'VERIFYING...' : <><ShieldCheck size={18} /> VERIFY & SIGN IN</>}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }}
            disabled={loading || resendSeconds > 0} onClick={handleResendOtp}>
            {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }}
            disabled={loading} onClick={() => { setStep('email'); setOtp(''); setError(null); }}>
            Change email
          </button>
        </form>}

        <div style={{
          marginTop: '25px',
          paddingTop: '20px',
          borderTop: '1px solid #1c2033',
          fontSize: '11px',
          color: 'var(--text-dim)',
          textAlign: 'center',
        }}>
          Protected by single-use email codes and server-managed sessions.
        </div>
      </div>
    </div>
  );
}
