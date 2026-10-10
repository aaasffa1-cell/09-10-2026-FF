import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminStats, fetchAdminRegistrations } from '../../services/api';
import { 
  Trophy, 
  Users, 
  MailCheck, 
  Clock, 
  PlusCircle, 
  KeyRound, 
  ChevronRight, 
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchAdminStats(),
      fetchAdminRegistrations({ status: 'CONFIRMED' }),
    ])
      .then(([statsData, regsData]) => {
        setStats(statsData);
        setRecentRegistrations(regsData.slice(0, 5));
      })
      .catch(err => setLoadError(err.message || 'Failed to load admin dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading Admin Dashboard..." fullScreen />;

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Top Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '35px',
        }}>
          <div>
            <div className="badge badge-gold" style={{ marginBottom: '8px' }}>
              ADMINISTRATOR DASHBOARD
            </div>
            <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', color: 'var(--text-main)' }}>
              TOURNAMENT OVERVIEW
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/admin/tournaments" className="btn btn-primary btn-sm">
              <PlusCircle size={16} /> Manage Tournaments
            </Link>
            <Link to="/admin/room-credentials" className="btn btn-secondary btn-sm">
              <KeyRound size={16} /> Match Control
            </Link>
            <Link to="/admin/results" className="btn btn-secondary btn-sm">
              <Trophy size={16} /> Results
            </Link>
          </div>
        </div>

        {loadError && <div className="alert alert-error" role="alert">{loadError}</div>}

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '20px',
          marginBottom: '40px',
        }}>
          {/* Stat 1: Registered squads */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Registered Squads
              </span>
              <Trophy size={20} color="var(--accent-orange)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
              {stats?.totalTeams || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--accent-green)', marginTop: '4px' }}>
              Across all tournaments
            </div>
          </div>

          {/* Stat 2: Payments awaiting verification */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Awaiting Verification
              </span>
              <Clock size={20} color="var(--accent-cyan)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
              {stats?.pendingPayments || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              UTR submissions needing review
            </div>
          </div>

          {/* Stat 3: Confirmed slots */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Confirmed Slots
              </span>
              <Users size={20} color="var(--accent-green)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
              {stats?.totalConfirmedSquads || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Payment verified
            </div>
          </div>

          {/* Stat 4: Upcoming matches */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Upcoming Matches
              </span>
              <Trophy size={20} color="var(--accent-gold)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
              {stats?.upcomingMatches || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Active tournament dates
            </div>
          </div>

          {/* Stat 5: Match credential delivery */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Credential Emails
              </span>
              <MailCheck size={20} color="var(--accent-gold)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
              {stats?.roomEmailsSent || 0} sent
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
              {stats?.roomEmailsFailed || 0} failed · {stats?.roomEmailsPending || 0} pending
            </div>
          </div>
        </div>

        {/* Payment Management Summary */}
        <div className="ffa-card" style={{ padding: '24px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <div className="badge badge-gold" style={{ marginBottom: '6px' }}>PAYMENT MANAGEMENT</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Entry fees are set per tournament; prizes are separately organizer-funded.</div>
            </div>
            <Link to="/admin/registrations" className="btn btn-secondary btn-sm">View payment records</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            {[
              ['TOTAL TEAMS', stats?.totalTeams],
              ['PAID TEAMS', stats?.paidTeams],
              ['PENDING PAYMENTS', stats?.pendingPayments],
              ['FAILED PAYMENTS', stats?.failedPayments],
              ['TOTAL COLLECTED', `₹${stats?.totalCollected || 0}`],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg-card-hover)', padding: '14px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700 }}>{label}</div>
                <div style={{ color: 'var(--text-main)', fontSize: '23px', fontWeight: 900, marginTop: '5px' }}>{value || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Admin Actions & Recent Registrations */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.6fr)',
          gap: '30px',
        }} className="admin-grid">
          
          {/* Quick Management Navigation */}
          <div className="ffa-card" style={{ padding: '30px' }}>
            <h2 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '20px' }}>
              QUICK MODULES
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Link
                to="/admin/tournaments"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Trophy color="var(--accent-orange)" size={20} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>Tournaments Management</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Create, edit, and toggle registrations</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-dim)" />
              </Link>

              <Link
                to="/admin/registrations"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users color="var(--accent-cyan)" size={20} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>Squad Registrations</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>View 4-player rosters and payment verification</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-dim)" />
              </Link>

              <Link
                to="/admin/room-credentials"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <KeyRound color="var(--accent-gold)" size={20} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>Custom Room Credentials</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set room details and manually send to confirmed captains</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-dim)" />
              </Link>
            </div>
          </div>

          {/* Recent Confirmed Squads */}
          <div className="ffa-card" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)' }}>
                RECENT CONFIRMED SQUADS
              </h2>
              <Link to="/admin/registrations" style={{ fontSize: '12px', color: 'var(--accent-orange)', fontWeight: 700 }}>
                VIEW ALL
              </Link>
            </div>

            {recentRegistrations.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px' }}>
                No confirmed registrations yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentRegistrations.map(r => (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {r.captain_name} <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>(#{r.id})</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {r.tournament_name} • {r.captain_email}
                      </div>
                    </div>
                    <span className="badge badge-open">
                      ₹{r.entry_fee} PAID
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .admin-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
