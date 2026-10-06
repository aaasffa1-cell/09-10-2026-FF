import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../services/api';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await adminLogin(email.trim(), password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid administrator email or password.');
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
            Enter your credentials to manage tournaments and registrations
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleLogin}>
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

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {loading ? 'AUTHENTICATING...' : (
              <>
                SIGN IN TO DASHBOARD <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '25px',
          paddingTop: '20px',
          borderTop: '1px solid #1c2033',
          fontSize: '11px',
          color: 'var(--text-dim)',
          textAlign: 'center',
        }}>
          Protected by bcrypt encryption & session tokens.
        </div>
      </div>
    </div>
  );
}
