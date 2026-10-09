import React, { useEffect, useState } from 'react';
import { 
  fetchAdminTournaments, 
  fetchRoomCredentials, 
  saveRoomCredentials, 
  triggerRoomEmails 
} from '../../services/api';
import { 
  KeyRound, 
  ShieldCheck, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminRoomCredentials() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedTournament, setSelectedTournament] = useState(null);

  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [sendWindow, setSendWindow] = useState(null);
  const [deliveries, setDeliveries] = useState([]);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchAdminTournaments()
      .then(data => {
        setTournaments(data);
        if (data.length > 0) {
          setSelectedTournamentId(String(data[0].id));
          setSelectedTournament(data[0]);
        }
      })
      .catch(err => setError(err.message || 'Failed to load tournaments.'))
      .finally(() => setLoading(false));
  }, []);

  // When tournament selection changes, load its room credentials
  useEffect(() => {
    if (!selectedTournamentId) return;
    const tourney = tournaments.find(t => String(t.id) === String(selectedTournamentId));
    setSelectedTournament(tourney || null);
    setError(null);
    setSuccess(null);

    fetchRoomCredentials(selectedTournamentId)
      .then(creds => {
        setSendWindow(creds.sendWindow || null);
        setDeliveries(creds.deliveries || []);
        if (creds.hasCredentials) {
          setRoomId(creds.roomId || '');
          setRoomPassword(creds.roomPassword || '');
        } else {
          setRoomId('');
          setRoomPassword('');
        }
      })
      .catch(() => {
        setRoomId('');
        setRoomPassword('');
      });
  }, [selectedTournamentId, tournaments]);

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    if (!selectedTournamentId) return;
    setError(null);
    setSuccess(null);

    if (!roomId.trim() || !roomPassword.trim()) {
      setError('Both Room ID and Room Password are required.');
      return;
    }

    setSaving(true);
    try {
      await saveRoomCredentials(selectedTournamentId, {
        roomId: roomId.trim(),
        roomPassword: roomPassword.trim(),
      });
      setSuccess('Room credentials saved securely on the server.');
      const latest = await fetchRoomCredentials(selectedTournamentId);
      setSendWindow(latest.sendWindow || null);
      setDeliveries(latest.deliveries || []);
      // Refresh tournament list to update status
      fetchAdminTournaments().then(setTournaments).catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to save room credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleDispatchEmails = async () => {
    if (!selectedTournamentId) return;
    if (!window.confirm('Send the saved room credentials to confirmed squad captains now? Verify the date, start time and recipients first. Failed deliveries may be retried; already-sent email is not resent.')) return;

    setError(null);
    setSuccess(null);
    setDispatching(true);

    try {
      const res = await triggerRoomEmails(selectedTournamentId);
      setSuccess(res.message || 'Room emails dispatch finished.');
      const latest = await fetchRoomCredentials(selectedTournamentId);
      setSendWindow(latest.sendWindow || null);
      setDeliveries(latest.deliveries || []);
    } catch (err) {
      setError(err.message || 'Failed to dispatch room emails.');
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading room credential manager..." fullScreen />;

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <div className="badge badge-gold" style={{ marginBottom: '8px' }}>
            PRIVATE MATCH CREDENTIALS
          </div>
          <h1 style={{ fontSize: '28px', color: '#ffffff' }}>
            ROOM CREDENTIALS MANAGEMENT
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Enter Custom Room ID and Password. Only confirmed squads are eligible; delivery is restricted to the configured 10-minute pre-match window.
          </p>
        </div>

        {/* Security Alert Banner */}
        <div style={{
          background: '#141724',
          border: '1px solid rgba(0, 255, 204, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          marginBottom: '25px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}>
          <ShieldCheck size={22} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: '#dddddd', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>Security Protocol Active:</strong> Room ID and Password are protected by strict server-side access controls. They will never be included in public APIs, tournament cards, or HTML source.
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <div>{success}</div>
          </div>
        )}

        {/* Form Card */}
        <div className="ffa-card" style={{ padding: '35px', marginBottom: '30px' }}>
          <form onSubmit={handleSaveCredentials}>
            {/* Tournament Selector */}
            <div className="form-group">
              <label className="form-label">Select Tournament *</label>
              <select
                className="form-select"
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                required
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Match: {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {t.startTime}) • {t.confirmedSlots} Confirmed Squads
                  </option>
                ))}
              </select>
            </div>

            {selectedTournament && (
              <div style={{
                background: '#0c0d14',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '25px',
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                fontSize: '13px',
              }}>
                <div>Match Date: <strong style={{ color: '#ffffff' }}>{new Date(selectedTournament.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</strong></div>
                <div>Start Time: <strong style={{ color: 'var(--accent-orange)' }}>{selectedTournament.startTime} (IST)</strong></div>
                <div>Confirmed Squads: <strong style={{ color: 'var(--accent-green)' }}>{selectedTournament.confirmedSlots} Squads</strong></div>
              </div>
            )}

            {sendWindow && (
              <div className={`alert ${sendWindow.allowed ? 'alert-success' : 'alert-error'}`} role="status">
                <Clock size={18} />
                <div>
                  {sendWindow.allowed
                    ? `Authorized send window is open. Target time: ${new Date(sendWindow.targetTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`
                    : sendWindow.warning}
                </div>
              </div>
            )}

            {/* Room ID and Password Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Custom Room ID *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 19283749"
                    className="form-input"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Room Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 8839"
                    className="form-input"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: 'var(--accent-orange)' }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
              >
                <KeyRound size={18} />
                {saving ? 'SAVING CREDENTIALS...' : 'SAVE ROOM CREDENTIALS'}
              </button>

              <button
                type="button"
                onClick={handleDispatchEmails}
                disabled={dispatching || !roomId.trim() || !roomPassword.trim() || !sendWindow?.allowed}
                className="btn btn-secondary btn-lg"
                title="Manually trigger room emails to confirmed players"
              >
                <Send size={18} />
                {dispatching ? 'SENDING...' : 'SEND ROOM ID & PASSWORD'}
              </button>
            </div>
          </form>
        </div>

        <div className="ffa-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#fff', fontSize: 17, marginBottom: 10 }}>EMAIL PREVIEW</h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.7 }}>
{`To: confirmed squad captain(s) only
Tournament: ${selectedTournament?.name || '—'}
Squad: each assigned squad number (01–13)
Match: ${selectedTournament?.date ? new Date(selectedTournament.date).toLocaleDateString('en-IN') : '—'} · ${selectedTournament?.startTime || '—'} IST
Room ID: ${roomId || '[not set]'}
Room password: ${roomPassword || '[not set]'}`}
          </pre>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0 }}>
            Until player email addresses are collected and verified, credentials are sent only to each confirmed captain's verified email.
          </p>
        </div>

        <div className="ffa-card" style={{ padding: 24, marginBottom: 24, overflowX: 'auto' }}>
          <h3 style={{ color: '#fff', fontSize: 17, marginBottom: 14 }}>SQUAD DELIVERY STATUS</h3>
          {deliveries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No confirmed squads to notify.</p>
          ) : (
            <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', color: 'var(--text-muted)', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: '#fff' }}>
                <th style={{ padding: 9 }}>Squad</th><th style={{ padding: 9 }}>Captain</th><th style={{ padding: 9 }}>Recipient</th><th style={{ padding: 9 }}>Status</th><th style={{ padding: 9 }}>Attempts / Audit</th>
              </tr></thead>
              <tbody>{deliveries.map((squad) => (
                <tr key={squad.id} style={{ borderTop: '1px solid var(--border-card)' }}>
                  <td style={{ padding: 9 }}>{squad.squad_number ? `Squad ${String(squad.squad_number).padStart(2, '0')}` : '—'}</td>
                  <td style={{ padding: 9 }}>{squad.captain_name}</td>
                  <td style={{ padding: 9 }}>{squad.captain_email}</td>
                  <td style={{ padding: 9, color: squad.email_status === 'EMAIL_SENT' ? 'var(--accent-green)' : squad.email_status === 'EMAIL_FAILED' ? 'var(--accent-orange)' : 'var(--accent-gold)' }}>{squad.email_status}</td>
                  <td style={{ padding: 9 }}>
                    {squad.attempts || 0}{squad.sent_at ? ` · ${new Date(squad.sent_at).toLocaleString('en-IN')}` : ''}
                    {squad.last_error ? <div style={{ color: 'var(--accent-orange)' }}>{squad.last_error}</div> : null}
                    {squad.attemptHistory?.map((attempt) => (
                      <div key={attempt.attempt_number} style={{ marginTop: 4, fontSize: 11 }}>
                        #{attempt.attempt_number} · {attempt.status} · {attempt.admin_email || 'Scheduler'} · {new Date(attempt.initiated_at).toLocaleString('en-IN')}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* Automatic Scheduler Information */}
        <div className="ffa-card" style={{ padding: '25px', background: '#0e1018' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-gold)', marginBottom: '10px' }}>
            <Clock size={20} />
            <h3 style={{ fontSize: '16px' }}>AUTOMATED 10-MINUTE SCHEDULER ACTIVE</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>
            The background cron scheduler runs every 60 seconds on the server. When any tournament reaches <strong>10 minutes before start time</strong>, room credentials will be dispatched automatically to all confirmed captains. All deliveries are logged in PostgreSQL to prevent duplicate messages across reboots.
          </p>
        </div>
      </div>
    </div>
  );
}
