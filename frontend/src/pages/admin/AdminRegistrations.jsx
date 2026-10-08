import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminRegistrations,
  fetchAdminPaymentEvents,
  fetchAdminPayments,
  fetchAdminTournaments,
  verifyAdminPayment,
  rejectAdminPayment,
} from '../../services/api';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  Mail, 
  Phone, 
  AlertCircle 
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [registrationSearchFilter, setRegistrationSearchFilter] = useState('');
  const [paymentEvents, setPaymentEvents] = useState({});
  const [manualPayments, setManualPayments] = useState([]);
  const [paymentCounts, setPaymentCounts] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [paymentFilter, setPaymentFilter] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentSort, setPaymentSort] = useState('newest');
  const [paymentSearchInput, setPaymentSearchInput] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [paymentActionError, setPaymentActionError] = useState('');
  const [busyPaymentId, setBusyPaymentId] = useState(null);

  const loadRegistrations = useCallback(() => {
    setLoading(true);
    fetchAdminRegistrations({
      tournamentId: selectedTournament,
      status: selectedStatus,
      search: registrationSearchFilter,
    })
      .then(data => setRegistrations(data))
      .catch(err => console.error('Failed to load registrations:', err))
      .finally(() => setLoading(false));
  }, [selectedTournament, selectedStatus, registrationSearchFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setRegistrationSearchFilter(searchTerm.trim());
  };

  const loadManualPayments = useCallback(async () => {
    try {
      const result = await fetchAdminPayments({
        status: paymentFilter,
        search: paymentSearch,
        sort: paymentSort,
      });
      setManualPayments(result.payments || []);
      setPaymentCounts(result.counts || { pending: 0, verified: 0, rejected: 0 });
    } catch (err) {
      setPaymentActionError(err.message || 'Failed to load payment verification queue.');
    }
  }, [paymentFilter, paymentSearch, paymentSort]);

  useEffect(() => {
    fetchAdminTournaments().then(setTournaments).catch(() => {});
    loadRegistrations();
  }, [loadRegistrations]);

  useEffect(() => {
    loadManualPayments();
  }, [loadManualPayments]);

  const handlePaymentSearch = (event) => {
    event.preventDefault();
    setPaymentSearch(paymentSearchInput.trim());
  };

  const handlePaymentReview = async (payment, action) => {
    setPaymentActionError('');
    setBusyPaymentId(payment.payment_id);
    try {
      if (action === 'verify') {
        await verifyAdminPayment(payment.payment_id);
      } else {
        await rejectAdminPayment(payment.payment_id, rejectionReasons[payment.payment_id] || '');
        setRejectionReasons((current) => ({ ...current, [payment.payment_id]: '' }));
      }
      await loadManualPayments();
      await loadRegistrations();
    } catch (err) {
      setPaymentActionError(err.message || 'Payment review action failed.');
    } finally {
      setBusyPaymentId(null);
    }
  };

  const togglePaymentEvents = async (paymentId) => {
    if (paymentEvents[paymentId]) {
      setPaymentEvents((current) => ({ ...current, [paymentId]: null }));
      return;
    }
    try {
      const events = await fetchAdminPaymentEvents(paymentId);
      setPaymentEvents((current) => ({ ...current, [paymentId]: events }));
    } catch (err) {
      console.error('Failed to load payment event history:', err);
    }
  };

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <div className="badge badge-gold" style={{ marginBottom: '8px' }}>
            REGISTRATION DATABASE
          </div>
          <h1 style={{ fontSize: '28px', color: '#ffffff' }}>
            SQUAD REGISTRATIONS
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Search and view 4-player squad rosters, captain contact info, and payment statuses.
          </p>
        </div>

        <section className="ffa-card" style={{ padding: '24px', marginBottom: '30px' }}>
          <div style={{ marginBottom: '18px' }}>
            <div className="badge badge-gold" style={{ marginBottom: '8px' }}>PAYMENT VERIFICATION</div>
            <h2 style={{ color: '#ffffff', fontSize: '22px' }}>UPI PAYMENTS</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '5px' }}>
              Check the payment in your UPI/bank account before approving. UTR submission alone is not proof of payment.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              ['AWAITING UTR', paymentCounts.awaiting_utr || 0],
              ['PENDING VERIFICATION', paymentCounts.pending || 0],
              ['VERIFIED', paymentCounts.verified || 0],
              ['REJECTED', paymentCounts.rejected || 0],
            ].map(([label, count]) => (
              <div key={label} style={{ background: '#0d0f17', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{label}</div>
                <div style={{ color: '#ffffff', fontSize: '22px', fontWeight: 800 }}>{count}</div>
              </div>
            ))}
          </div>

          {paymentActionError && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: '16px' }}>
              <AlertCircle size={18} /> {paymentActionError}
            </div>
          )}

          <form onSubmit={handlePaymentSearch} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            alignItems: 'end',
            marginBottom: '18px',
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Search registration, captain, or UTR</label>
              <input
                className="form-input"
                value={paymentSearchInput}
                onChange={(event) => setPaymentSearchInput(event.target.value)}
                placeholder="Registration ID, captain name, UTR"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Payment Status</label>
              <select className="form-select" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="UTR_SUBMITTED">UTR Submitted</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Sort</label>
              <select className="form-select" value={paymentSort} onChange={(event) => setPaymentSort(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '44px' }}>
              <Search size={16} /> Search payments
            </button>
          </form>

          {manualPayments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: '18px 0' }}>No UPI payments match these filters.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {manualPayments.map((payment) => (
                <article key={payment.payment_id} style={{ background: '#0d0f17', border: '1px solid #1e2236', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#ffffff', fontWeight: 800 }}>
                        REG-{payment.registration_id} · {payment.captain_name}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                        {payment.tournament_name} · ₹{payment.amount} {payment.currency} · {payment.payment_method}
                      </div>
                      <div style={{ color: '#ffffff', fontFamily: 'monospace', marginTop: '7px', wordBreak: 'break-all' }}>
                        UTR: {payment.utr || 'Not submitted'}
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '5px' }}>
                        Submitted: {payment.submitted_at ? new Date(payment.submitted_at).toLocaleString('en-IN') : '—'}
                        {payment.verified_at && ` · Reviewed: ${new Date(payment.verified_at).toLocaleString('en-IN')}`}
                      </div>
                      {payment.rejection_reason && (
                        <div style={{ color: 'var(--accent-orange)', fontSize: '13px', marginTop: '5px' }}>
                          Rejection reason: {payment.rejection_reason}
                        </div>
                      )}
                    </div>
                    <span className={`badge ${payment.status === 'VERIFIED' ? 'badge-open' : payment.status === 'UTR_SUBMITTED' ? 'badge-gold' : 'badge-closed'}`}>
                      {payment.status}
                    </span>
                  </div>

                  {payment.status === 'UTR_SUBMITTED' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '14px' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyPaymentId === payment.payment_id}
                        onClick={() => handlePaymentReview(payment, 'verify')}
                      >
                        <CheckCircle2 size={16} /> {busyPaymentId === payment.payment_id ? 'SAVING...' : 'VERIFY PAYMENT'}
                      </button>
                      <input
                        className="form-input"
                        value={rejectionReasons[payment.payment_id] || ''}
                        onChange={(event) => setRejectionReasons((current) => ({ ...current, [payment.payment_id]: event.target.value }))}
                        placeholder="Reason if rejecting"
                        maxLength={500}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyPaymentId === payment.payment_id || (rejectionReasons[payment.payment_id] || '').trim().length < 3}
                        onClick={() => handlePaymentReview(payment, 'reject')}
                      >
                        REJECT PAYMENT
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '12px' }}
                    onClick={() => togglePaymentEvents(payment.payment_id)}
                  >
                    {paymentEvents[payment.payment_id] ? 'HIDE PAYMENT HISTORY' : 'VIEW PAYMENT HISTORY'}
                  </button>
                  {paymentEvents[payment.payment_id] && (
                    <div style={{ borderTop: '1px solid #1f2336', marginTop: '10px', paddingTop: '8px' }}>
                      {paymentEvents[payment.payment_id].map((event) => (
                        <div key={event.id} style={{ padding: '8px 0', borderBottom: '1px solid #1f2336', color: 'var(--text-muted)', fontSize: '12px' }}>
                          <strong style={{ color: '#ffffff' }}>{event.event_type}</strong>
                          {' · '}{new Date(event.created_at).toLocaleString('en-IN')}
                          <details style={{ marginTop: '5px' }}>
                            <summary style={{ cursor: 'pointer' }}>Review details</summary>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', marginTop: '6px' }}>
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Filter Controls */}
        <div className="ffa-card" style={{ padding: '20px', marginBottom: '30px' }}>
          <form onSubmit={handleSearchSubmit} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            alignItems: 'end',
          }}>
            {/* Search Input */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Search Captain / ID</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Name, email, phone, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            {/* Tournament Select */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tournament Filter</label>
              <select
                className="form-select"
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
              >
                <option value="">All Tournaments</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (#{t.id})</option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Registration Status</label>
              <select
                className="form-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="CONFIRMED">CONFIRMED (Paid)</option>
                <option value="PENDING">PENDING</option>
                <option value="OTP_VERIFIED">OTP_VERIFIED</option>
                <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
                <option value="PAYMENT_PROCESSING">PAYMENT_PROCESSING</option>
                <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
              </select>
            </div>

            {/* Search Button */}
            <button type="submit" className="btn btn-primary" style={{ height: '44px' }}>
              <Filter size={16} /> Filter Results
            </button>
          </form>
        </div>

        {/* Results List */}
        {loading ? (
          <LoadingSpinner message="Searching registrations..." fullScreen />
        ) : registrations.length === 0 ? (
          <div className="ffa-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <AlertCircle size={40} color="var(--accent-orange)" style={{ margin: '0 auto 15px' }} />
            <h3>No Registrations Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
              No squads match your current filters.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {registrations.map(r => {
              const isConfirmed = r.status === 'CONFIRMED';
              const isPaid = ['PAID', 'VERIFIED'].includes(r.payment_status);

              return (
                <div key={r.id} className="ffa-card" style={{ padding: '24px' }}>
                  {/* Top Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '15px',
                    borderBottom: '1px solid #1e2236',
                    paddingBottom: '16px',
                    marginBottom: '16px',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                          Squad #{r.id}: {r.captain_name}
                        </span>
                        {isConfirmed ? (
                          <span className="badge badge-open">CONFIRMED</span>
                        ) : (
                          <span className="badge badge-closed">{r.status}</span>
                        )}
                        {isPaid ? (
                          <span className="badge badge-gold">₹{r.entry_fee || '40'} PAID</span>
                        ) : (
                          <span className="badge badge-closed">PAYMENT {r.payment_status}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--accent-orange)', marginTop: '4px', fontWeight: 600 }}>
                        🏆 {r.tournament_name} (Match: {r.tournament_start_time})
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'right' }}>
                      Registered: {new Date(r.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>

                  {(r.payment_attempts || []).length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ color: 'var(--text-dim)', fontWeight: 700, fontSize: '12px', marginBottom: '8px' }}>
                        PAYMENT ATTEMPTS
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {r.payment_attempts.map((payment) => (
                          <div key={payment.payment_id} style={{ background: '#0d0f17', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', color: 'var(--text-muted)' }}>
                                <span>Internal order: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{payment.order_id}</strong></span>
                                {payment.provider_order_id && <span>Provider order: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{payment.provider_order_id}</strong></span>}
                                <span>Amount: <strong style={{ color: '#fff' }}>₹{payment.payment_amount} {payment.payment_currency}</strong></span>
                                <span>Status: <strong style={{ color: payment.payment_status_detail === 'SUCCESS' ? 'var(--accent-green)' : 'var(--text-muted)' }}>{payment.payment_status_detail}</strong></span>
                                {payment.utr && <span>UTR: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{payment.utr}</strong></span>}
                                {payment.submitted_at && <span>Submitted: {new Date(payment.submitted_at).toLocaleString('en-IN')}</span>}
                                {payment.rejection_reason && <span>Reason: {payment.rejection_reason}</span>}
                                {payment.provider_transaction_id && <span>Transaction: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{payment.provider_transaction_id}</strong></span>}
                                {payment.payment_created_at && <span>Created: {new Date(payment.payment_created_at).toLocaleString('en-IN')}</span>}
                                {payment.paid_at && <span>Paid: {new Date(payment.paid_at).toLocaleString('en-IN')}</span>}
                              </div>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => togglePaymentEvents(payment.payment_id)}
                              >
                                {paymentEvents[payment.payment_id] ? 'HIDE EVENTS' : 'VIEW EVENTS'}
                              </button>
                            </div>
                            {paymentEvents[payment.payment_id] && (
                              <div style={{ borderTop: '1px solid #1f2336', marginTop: '10px', paddingTop: '8px' }}>
                                {paymentEvents[payment.payment_id].length === 0 ? (
                                  <div style={{ color: 'var(--text-muted)' }}>No payment events recorded.</div>
                                ) : paymentEvents[payment.payment_id].map((event) => (
                                  <div key={event.id} style={{ padding: '8px 0', borderBottom: '1px solid #1f2336' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                      <span style={{ color: '#fff', fontWeight: 700 }}>{event.event_type}</span>
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {event.processed ? 'recorded' : 'not processed'} · {new Date(event.created_at).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                    <details style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
                                      <summary style={{ cursor: 'pointer' }}>Event details</summary>
                                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', marginTop: '6px' }}>
                                        {JSON.stringify(event.payload, null, 2)}
                                      </pre>
                                    </details>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Captain Info Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    background: '#0d0f17',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} color="var(--accent-orange)" />
                      <span style={{ color: '#ffffff' }}>{r.captain_email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} color="var(--accent-green)" />
                      <span style={{ color: '#ffffff' }}>{r.captain_phone}</span>
                    </div>
                    <div style={{ color: 'var(--text-dim)' }}>
                      Email OTP: <strong style={{ color: r.email_verified ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {r.email_verified ? 'VERIFIED ✓' : 'NOT VERIFIED ✗'}
                      </strong>
                    </div>
                  </div>

                  {/* 4 Players Roster Table */}
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                      4-PLAYER SQUAD ROSTER
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px',
                    }}>
                      {(r.players || []).map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: idx === 0 ? 'rgba(255, 85, 0, 0.08)' : '#101320',
                            border: idx === 0 ? '1px solid rgba(255, 85, 0, 0.3)' : '1px solid #1c2033',
                            borderRadius: '8px',
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ fontSize: '11px', color: idx === 0 ? 'var(--accent-orange)' : 'var(--text-dim)', fontWeight: 800 }}>
                            Player {idx + 1} {idx === 0 ? '(Captain)' : ''}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                            {p.full_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                            UID: {p.free_fire_id}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
