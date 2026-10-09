import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Users } from 'lucide-react';
import { fetchUserDashboard } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function Status({ value }) {
  const color = value === 'CONFIRMED' || value === 'EMAIL_SENT' ? 'var(--accent-green)'
    : value === 'REJECTED' || value === 'EMAIL_FAILED' ? 'var(--accent-orange)'
      : 'var(--accent-gold)';
  return <span style={{ color, fontWeight: 800, fontSize: 12 }}>{value || '—'}</span>;
}

export default function Dashboard() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUserDashboard()
      .then(setRegistrations)
      .catch((requestError) => setError(requestError.message || 'Unable to load your registrations.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your tournament dashboard..." fullScreen />;

  return (
    <div style={{ padding: '42px 0 80px' }}>
      <div className="container" style={{ maxWidth: 1000 }}>
        <div style={{ marginBottom: 26 }}>
          <div className="badge badge-gold" style={{ marginBottom: 8 }}>PLAYER ACCOUNT</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(27px, 5vw, 38px)' }}>My tournament dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Your squad details and updates are visible only to your signed-in email.</p>
        </div>
        {error && <div className="alert alert-error"><AlertCircle size={18} />{error}</div>}
        {!registrations.length && !error ? (
          <section className="ffa-card" style={{ textAlign: 'center', padding: 32 }}>
            <Users size={32} color="var(--accent-orange)" />
            <h2 style={{ color: '#fff', margin: '12px 0' }}>No squad registrations yet</h2>
            <p style={{ color: 'var(--text-muted)' }}>Choose a tournament to register your four-player squad.</p>
            <Link to="/tournaments" className="btn btn-primary" style={{ marginTop: 12 }}>Browse tournaments</Link>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {registrations.map((registration) => (
              <article className="ffa-card" key={registration.id} style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ color: '#fff', fontSize: 21 }}>{registration.tournament_name}</h2>
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                      <span><CalendarDays size={14} style={{ verticalAlign: 'middle' }} /> {new Date(registration.tournament_date).toLocaleDateString('en-IN')} · {registration.tournament_start_time} IST</span>
                      <span>Registration REG-{registration.id}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span>Registration: <Status value={registration.status} /></span>
                    <span>Payment: <Status value={registration.payment_status} /></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '18px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                  <span>Entry fee: ₹{registration.entry_fee}</span>
                  <span>Squad: <strong style={{ color: '#fff' }}>{registration.squad_number ? `Squad ${String(registration.squad_number).padStart(2, '0')}` : 'Pending verification'}</strong></span>
                  <span>Room email: <Status value={registration.room_email_status || 'EMAIL_PENDING'} /></span>
                  {registration.payment_submitted_at && <span><Clock3 size={14} style={{ verticalAlign: 'middle' }} /> UTR submitted {new Date(registration.payment_submitted_at).toLocaleString('en-IN')}</span>}
                </div>
                {registration.utr && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Your UTR: <strong style={{ color: '#fff' }}>{registration.utr}</strong></div>}
                <h3 style={{ color: 'var(--accent-orange)', fontSize: 13, marginBottom: 8 }}>REGISTERED SQUAD</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  {registration.players.map((player) => (
                    <div key={player.player_number} style={{ background: '#0d0f17', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13 }}>
                      {player.full_name}<br /><small style={{ color: 'var(--text-dim)' }}>UID: {player.free_fire_id}</small>
                    </div>
                  ))}
                </div>
                {registration.status === 'PAYMENT_PENDING' && registration.payment_status === 'UTR_SUBMITTED' && (
                  <p style={{ color: 'var(--accent-gold)', fontSize: 13, marginTop: 14 }}>
                    Your UTR is awaiting manual verification. Registration is not confirmed until the admin verifies receipt of payment.
                  </p>
                )}
                {registration.status === 'CONFIRMED' && <p style={{ color: 'var(--accent-green)', fontSize: 13, marginTop: 14 }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle' }} /> Registration confirmed. Room credentials will be emailed to the captain in the authorized pre-match window.</p>}
                {registration.status === 'REJECTED' && <p style={{ color: 'var(--accent-orange)', fontSize: 13, marginTop: 14 }}>Payment was rejected. Contact support to resolve the issue.</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
