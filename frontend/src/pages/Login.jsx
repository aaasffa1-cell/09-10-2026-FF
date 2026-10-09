import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { requestUserOtp, verifyUserOtp } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const nextPath = searchParams.get('next');

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await requestUserOtp(email.trim());
      setStep('otp');
      setMessage(result.message || 'Check your inbox for a sign-in code.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to send your code.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyUserOtp(email.trim(), otp.trim());
      navigate(nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard', { replace: true });
    } catch (verifyError) {
      setError(verifyError.message || 'Unable to verify your code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '56px 0 80px' }}>
      <div className="container" style={{ maxWidth: '520px' }}>
        <section className="ffa-card" style={{ padding: 'clamp(24px, 6vw, 40px)' }}>
          <div className="badge badge-gold" style={{ marginBottom: '12px' }}>PASSWORDLESS SIGN IN</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(25px, 5vw, 34px)' }}>Your tournament account</h1>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '10px 0 24px' }}>
            Sign in or create an account with a one-time code sent to your email. No password is needed.
          </p>
          {error && <div className="alert alert-error"><AlertCircle size={18} />{error}</div>}
          {message && <div className="alert alert-success"><CheckCircle2 size={18} />{message}</div>}
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={17} style={{ position: 'absolute', left: 13, top: 14, color: 'var(--text-dim)' }} />
                  <input id="login-email" type="email" autoComplete="email" required maxLength={255}
                    className="form-input" style={{ paddingLeft: 40 }} value={email}
                    onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
                <ShieldCheck size={18} /> {busy ? 'SENDING CODE...' : 'SEND ONE-TIME CODE'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-otp">6-digit email code</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={17} style={{ position: 'absolute', left: 13, top: 14, color: 'var(--text-dim)' }} />
                  <input id="login-otp" inputMode="numeric" autoComplete="one-time-code" required
                    pattern="[0-9]{6}" maxLength={6} className="form-input"
                    style={{ paddingLeft: 40, letterSpacing: '0.25em' }} value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                </div>
                <small style={{ color: 'var(--text-dim)' }}>Sent to {email}. Expires in 10 minutes.</small>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy || otp.length !== 6}>
                <ShieldCheck size={18} /> {busy ? 'VERIFYING...' : 'VERIFY & SIGN IN'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }}
                disabled={busy} onClick={() => { setStep('email'); setOtp(''); setMessage(''); }}>
                Change email / request another code
              </button>
            </form>
          )}
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 22 }}>
            By signing in you can register squads and privately view your own payment and match updates.
          </p>
          <Link to="/tournaments" style={{ color: 'var(--accent-orange)', fontSize: 13 }}>Browse tournaments</Link>
        </section>
      </div>
    </div>
  );
}
