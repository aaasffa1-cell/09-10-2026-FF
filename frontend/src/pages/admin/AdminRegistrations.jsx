import React, { useEffect, useState } from 'react';
import { fetchAdminRegistrations, fetchAdminTournaments } from '../../services/api';
import { 
  Users, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  Mail, 
  Phone, 
  Calendar,
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

  useEffect(() => {
    fetchAdminTournaments().then(setTournaments).catch(() => {});
    loadRegistrations();
  }, [selectedTournament, selectedStatus]);

  const loadRegistrations = () => {
    setLoading(true);
    fetchAdminRegistrations({
      tournamentId: selectedTournament,
      status: selectedStatus,
      search: searchTerm,
    })
      .then(data => setRegistrations(data))
      .catch(err => console.error('Failed to load registrations:', err))
      .finally(() => setLoading(false));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadRegistrations();
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
              const isPaid = r.payment_status === 'PAID';

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
                      {r.razorpay_payment_id && (
                        <div style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                          Payment ID: {r.razorpay_payment_id}
                        </div>
                      )}
                    </div>
                  </div>

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
