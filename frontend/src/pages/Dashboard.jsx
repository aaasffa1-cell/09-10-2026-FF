import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchOwnedPaymentStatus,
  fetchUserDashboard,
  submitOwnedRegistrationUtr,
} from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function Status({ value }) {
  const color = value === 'CONFIRMED' || value === 'VERIFIED' || value === 'EMAIL_SENT' ? 'var(--accent-green)'
    : value === 'REJECTED' || value === 'EMAIL_FAILED' || value === 'CANCELLED' ? 'var(--accent-orange)'
      : 'var(--accent-gold)';
  const label = value === 'UTR_SUBMITTED' ? 'UNDER REVIEW'
    : value === 'VERIFIED' ? 'SLOT CONFIRMED'
      : value === 'REJECTED' ? 'PAYMENT REJECTED'
        : value || '—';
  return <span style={{ color, fontWeight: 800, fontSize: 12 }}>{label}</span>;
}

export default function Dashboard() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [correctingRegistrationId, setCorrectingRegistrationId] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [correctedUtr, setCorrectedUtr] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchUserDashboard()
      .then(setRegistrations)
      .catch((requestError) => setError(requestError.message || 'Unable to load your registrations.'))
      .finally(() => setLoading(false));
  }, []);

  const openUtrCorrection = async (registrationId) => {
    setError('');
    setNotice('');
    try {
      const payment = await fetchOwnedPaymentStatus(registrationId);
      setPaymentDetails(payment);
      setCorrectedUtr('');
      setCorrectingRegistrationId(registrationId);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load payment details.');
    }
  };

  const submitCorrection = async (event) => {
    event.preventDefault();
    if (!correctingRegistrationId || submittingUtr) return;
    setError('');
    setNotice('');
    setSubmittingUtr(true);
    try {
      await submitOwnedRegistrationUtr(correctingRegistrationId, correctedUtr.trim());
      setRegistrations(await fetchUserDashboard());
      setCorrectingRegistrationId(null);
      setPaymentDetails(null);
      setNotice('Your registration is under review. We will get you shortly.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit the corrected UTR.');
    } finally {
      setSubmittingUtr(false);
    }
  };

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
        {notice && <div className="alert alert-success">{notice}</div>}
        {!registrations.length && !error ? (
          <section className="ffa-card" style={{ textAlign: 'center', padding: 32 }}>
            <Users size={32} color="var(--accent-orange)" />
            <h2 style={{ color: '#fff', margin: '12px 0' }}>No squad registrations yet</h2>
            <p style={{ color: 'var(--text-muted)' }}>Choose a tournament and register your squad as captain.</p>
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
                    <span>Payment: <Status value={registration.payment_status_detail || registration.payment_status} /></span>
                    {registration.tournament_status === 'CANCELLED' && <span>Tournament: <Status value="CANCELLED" /></span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '18px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                  <span>Entry fee: ₹{registration.entry_fee}</span>
                  <span>Squad: <strong style={{ color: '#fff' }}>{registration.squad_number ? `Squad ${String(registration.squad_number).padStart(2, '0')}` : 'Pending verification'}</strong></span>
                  <span>Room email: <Status value={registration.room_email_status || 'EMAIL_PENDING'} /></span>
                  {registration.payment_submitted_at && <span><Clock3 size={14} style={{ verticalAlign: 'middle' }} /> UTR submitted {new Date(registration.payment_submitted_at).toLocaleString('en-IN')}</span>}
                </div>
                {registration.utr && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Your UTR: <strong style={{ color: '#fff' }}>{registration.utr}</strong></div>}
                <h3 style={{ color: 'var(--accent-orange)', fontSize: 13, marginBottom: 8 }}>CAPTAIN</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  {registration.players.map((player) => (
                    <div key={player.player_number} style={{ background: '#0d0f17', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13 }}>
                      {player.full_name}<br /><small style={{ color: 'var(--text-dim)' }}>UID: {player.free_fire_id}</small>
                    </div>
                  ))}
                </div>
                {registration.status === 'PAYMENT_PENDING' && registration.payment_status === 'UTR_SUBMITTED' && (
                  <p style={{ color: 'var(--accent-gold)', fontSize: 13, marginTop: 14 }}>
                    Your registration is under review. We will get you shortly.
                  </p>
                )}
                {registration.status === 'CONFIRMED' && <p style={{ color: 'var(--accent-green)', fontSize: 13, marginTop: 14 }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle' }} /> SLOT CONFIRMED. Match credentials are sent by the administrator.</p>}
                {registration.room_id && registration.room_password && (
                  <div className="ffa-card" style={{ padding: 16, marginTop: 14 }}>
                    <strong>Private match-room credentials</strong>
                    <div style={{ marginTop: 8 }}>Room ID: {registration.room_id}</div>
                    <div>Room password: {registration.room_password}</div>
                    <div>Join using your assigned squad number: {registration.squad_number}</div>
                  </div>
                )}
                {(registration.status === 'REJECTED' || registration.payment_status_detail === 'REJECTED') && (
                  <p style={{ color: 'var(--accent-orange)', fontSize: 13, marginTop: 14 }}>
                    PAYMENT REJECTED{registration.rejection_reason ? `: ${registration.rejection_reason}` : ''}. Submit a corrected UTR using the same registration.
                  </p>
                )}
                {(registration.status === 'REJECTED' || registration.payment_status_detail === 'REJECTED') && (
                  <div style={{ marginTop: 12 }}>
                    {correctingRegistrationId !== registration.id ? (
                      <button type="button" className="btn btn-primary"
                        onClick={() => openUtrCorrection(registration.id)}>
                        Submit corrected UTR
                      </button>
                    ) : (
                      <form onSubmit={submitCorrection} style={{ display: 'grid', gap: 12 }}>
                        {paymentDetails?.upiUri && (
                          <div className="ffa-card" style={{ padding: 16, textAlign: 'center' }}>
                            <p>Pay ₹{paymentDetails.amount} to {paymentDetails.displayName} using this tournament QR.</p>
                            <QRCodeSVG value={paymentDetails.upiUri} size={190} includeMargin
                              title={`UPI payment QR for ₹${paymentDetails.amount}`} />
                            <div>UPI ID: {paymentDetails.upiId}</div>
                          </div>
                        )}
                        <label htmlFor={`corrected-utr-${registration.id}`}>Corrected UTR / transaction reference</label>
                        <input id={`corrected-utr-${registration.id}`} className="form-input"
                          value={correctedUtr} minLength={8} maxLength={32}
                          pattern="[A-Za-z0-9-]{8,32}" autoComplete="off" required
                          onChange={(event) => setCorrectedUtr(event.target.value)} />
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button type="submit" className="btn btn-primary"
                            disabled={submittingUtr || correctedUtr.trim().length < 8}>
                            {submittingUtr ? 'Submitting...' : 'Submit for review'}
                          </button>
                          <button type="button" className="btn btn-secondary"
                            disabled={submittingUtr}
                            onClick={() => { setCorrectingRegistrationId(null); setPaymentDetails(null); }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
                {registration.squad_placement && (
                  <div className="dashboard-result">
                    <strong>Published result</strong>
                    <span>Placement {registration.squad_placement} · Prize ₹{registration.result_prize_amount}</span>
                    {registration.result_details && <span>{registration.result_details}</span>}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
