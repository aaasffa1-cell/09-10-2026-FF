import React, { useEffect, useState } from 'react';
import { 
  fetchAdminTournaments, 
  createAdminTournament, 
  updateAdminTournament, 
  deleteAdminTournament 
} from '../../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  KeyRound, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle2, 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00 PM');
  const [entryFee, setEntryFee] = useState(40);
  const [prizeAmount, setPrizeAmount] = useState(300);
  const [squadSize, setSquadSize] = useState(4);
  const [maxSlots, setMaxSlots] = useState(25);
  const [rules, setRules] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = () => {
    setLoading(true);
    fetchAdminTournaments()
      .then(data => setTournaments(data))
      .catch(err => setError(err.message || 'Failed to load tournaments.'))
      .finally(() => setLoading(false));
  };

  const openCreateModal = () => {
    setEditingTournament(null);
    setName('');
    setDescription('');
    // Default to tomorrow's date
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDate(tomorrow);
    setStartTime('08:00 PM');
    setEntryFee(40);
    setPrizeAmount(300);
    setSquadSize(4);
    setMaxSlots(25);
    setRules('1. Exactly 4 players per squad.\n2. Mobile devices only (No Emulators/iPads).\n3. Gun attributes disabled.\n4. Room ID & Password sent 10 minutes prior to match.');
    setRegistrationOpen(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (t) => {
    setEditingTournament(t);
    setName(t.name);
    setDescription(t.description || '');
    const formattedDate = new Date(t.date).toISOString().split('T')[0];
    setDate(formattedDate);
    setStartTime(t.startTime);
    setEntryFee(40);
    setPrizeAmount(t.prizeAmount);
    setSquadSize(t.squadSize);
    setMaxSlots(t.maxSlots);
    setRules(t.rules || '');
    setRegistrationOpen(t.registrationOpen);
    setError(null);
    setModalOpen(true);
  };

  const handleSaveTournament = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        date,
        startTime: startTime.trim(),
        entryFee: parseFloat(entryFee),
        prizeAmount: parseFloat(prizeAmount),
        squadSize: parseInt(squadSize, 10),
        maxSlots: parseInt(maxSlots, 10),
        rules: rules.trim(),
        registrationOpen,
      };

      if (editingTournament) {
        await updateAdminTournament(editingTournament.id, payload);
        setSuccess('Tournament updated successfully.');
      } else {
        await createAdminTournament(payload);
        setSuccess('Tournament created successfully.');
      }

      setModalOpen(false);
      loadTournaments();
    } catch (err) {
      setError(err.message || 'Failed to save tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete tournament "${name}"?`)) return;
    setError(null);
    try {
      await deleteAdminTournament(id);
      setSuccess(`Tournament "${name}" deleted.`);
      loadTournaments();
    } catch (err) {
      setError(err.message || 'Failed to delete tournament.');
    }
  };

  const handleToggleRegistration = async (t) => {
    try {
      await updateAdminTournament(t.id, { registrationOpen: !t.registrationOpen });
      loadTournaments();
    } catch (err) {
      setError(err.message || 'Failed to toggle registration.');
    }
  };

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '30px',
        }}>
          <div>
            <div className="badge badge-gold" style={{ marginBottom: '8px' }}>
              ADMINISTRATION
            </div>
            <h1 style={{ fontSize: '28px', color: '#ffffff' }}>
              TOURNAMENTS MANAGEMENT
            </h1>
          </div>

          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={18} /> CREATE NEW TOURNAMENT
          </button>
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

        {/* Tournaments Table */}
        {loading ? (
          <LoadingSpinner message="Loading tournaments list..." fullScreen />
        ) : tournaments.length === 0 ? (
          <div className="ffa-card" style={{ padding: '50px', textAlign: 'center' }}>
            <h3>No Tournaments Created</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '20px' }}>
              Click the button above to create your first Free Fire tournament.
            </p>
            <button onClick={openCreateModal} className="btn btn-primary">
              <Plus size={16} /> Create Tournament
            </button>
          </div>
        ) : (
          <div className="ffa-card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: '#0e1018', borderBottom: '1px solid var(--border-card)', color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <th style={{ padding: '16px 20px' }}>Tournament</th>
                  <th style={{ padding: '16px 15px' }}>Date & Time</th>
                  <th style={{ padding: '16px 15px' }}>Fee / Prize</th>
                  <th style={{ padding: '16px 15px' }}>Confirmed Slots</th>
                  <th style={{ padding: '16px 15px' }}>Reg Status</th>
                  <th style={{ padding: '16px 15px' }}>Room ID</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1a1d2e' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '15px' }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>ID: #{t.id} • {t.squadSize} Players</div>
                    </td>

                    <td style={{ padding: '16px 15px', fontSize: '13px' }}>
                      <div style={{ color: '#ffffff', fontWeight: 600 }}>
                        {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ color: 'var(--accent-orange)' }}>{t.startTime}</div>
                    </td>

                    <td style={{ padding: '16px 15px', fontSize: '13px' }}>
                      <div style={{ color: 'var(--accent-green)', fontWeight: 700 }}>₹{t.entryFee}</div>
                      <div style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>Winner Prize: ₹{t.prizeAmount}</div>
                    </td>

                    <td style={{ padding: '16px 15px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: t.confirmedSlots >= t.maxSlots ? 'var(--accent-gold)' : '#ffffff' }}>
                        {t.confirmedSlots} / {t.maxSlots}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {t.totalRegistrations} total requests
                      </div>
                    </td>

                    <td style={{ padding: '16px 15px' }}>
                      <button
                        onClick={() => handleToggleRegistration(t)}
                        className={`badge ${t.registrationOpen ? 'badge-open' : 'badge-closed'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Click to toggle registration"
                      >
                        {t.registrationOpen ? 'OPEN (CLICK TO CLOSE)' : 'CLOSED (CLICK TO OPEN)'}
                      </button>
                    </td>

                    <td style={{ padding: '16px 15px' }}>
                      {t.hasRoomCredentials ? (
                        <Link to="/admin/room-credentials" style={{ color: 'var(--accent-cyan)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                          <Check size={14} /> Ready ({t.roomId})
                        </Link>
                      ) : (
                        <Link to="/admin/room-credentials" style={{ color: 'var(--accent-orange)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <KeyRound size={14} /> Not Set
                        </Link>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openEditModal(t)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Tournament"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, t.name)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--accent-red)' }}
                          title="Delete Tournament"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Create / Edit Tournament */}
        {modalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 2000,
          }}>
            <div className="ffa-card" style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '30px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #22263d', paddingBottom: '15px' }}>
                <h2 style={{ fontSize: '20px', color: '#ffffff' }}>
                  {editingTournament ? 'EDIT TOURNAMENT' : 'CREATE NEW TOURNAMENT'}
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  <X size={22} />
                </button>
              </div>

              <form onSubmit={handleSaveTournament}>
                <div className="form-group">
                  <label className="form-label">Tournament Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. FREE FIRE BR #1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={2}
                    className="form-textarea"
                    placeholder="Official 4v4 squad battle royale clash..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label className="form-label">Match Date *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Start Time * (e.g. 08:00 PM)</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="08:00 PM"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
                  <div className="form-group">
                    <label className="form-label">Team Entry Fee (Fixed at ₹40)</label>
                    <input
                      type="number"
                      required
                      className="form-input"
                      value={40}
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Winner Prize (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="form-input"
                      value={prizeAmount}
                      onChange={(e) => setPrizeAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Squad Size *</label>
                    <input
                      type="number"
                      required
                      value={squadSize}
                      disabled
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Slots *</label>
                    <input
                      type="number"
                      required
                      min={editingTournament ? editingTournament.confirmedSlots : 1}
                      max="100"
                      className="form-input"
                      value={maxSlots}
                      onChange={(e) => setMaxSlots(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Match Rules</label>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    placeholder="Enter match specific rules..."
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="regOpen"
                    checked={registrationOpen}
                    onChange={(e) => setRegistrationOpen(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-orange)' }}
                  />
                  <label htmlFor="regOpen" style={{ fontSize: '14px', color: '#ffffff', cursor: 'pointer' }}>
                    Registration Open (Allow players to register)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ flex: 1.5 }}
                  >
                    {submitting ? 'SAVING...' : editingTournament ? 'UPDATE TOURNAMENT' : 'CREATE TOURNAMENT'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
