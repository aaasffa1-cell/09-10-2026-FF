import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminStats, fetchAdminRegistrations } from '../../services/api';
import { 
  Trophy, 
  Users, 
  IndianRupee, 
  MailCheck, 
  Clock, 
  PlusCircle, 
  KeyRound, 
  ChevronRight, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAdminStats(),
      fetchAdminRegistrations({ status: 'CONFIRMED' }),
    ])
      .then(([statsData, regsData]) => {
        setStats(statsData);
        setRecentRegistrations(regsData.slice(0, 5));
      })
      .catch(err => console.error('Failed to load admin dashboard:', err))
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
            <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', color: '#ffffff' }}>
              TOURNAMENT OVERVIEW
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/admin/tournaments" className="btn btn-primary btn-sm">
              <PlusCircle size={16} /> Manage Tournaments
            </Link>
            <Link to="/admin/room-credentials" className="btn btn-secondary btn-sm">
              <KeyRound size={16} /> Room Credentials
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '40px',
        }}>
          {/* Stat 1: Total Tournaments */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Tournaments
              </span>
              <Trophy size={20} color="var(--accent-orange)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>
              {stats?.totalTournaments || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--accent-green)', marginTop: '4px' }}>
              {stats?.upcomingTournaments || 0} active / upcoming
            </div>
          </div>

          {/* Stat 2: Total Confirmed Squads */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Confirmed Squads
              </span>
              <Users size={20} color="var(--accent-cyan)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>
              {stats?.totalConfirmedSquads || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats?.pendingRegistrations || 0} in checkout / pending
            </div>
          </div>

          {/* Stat 3: Total Revenue */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Revenue Collected
              </span>
              <IndianRupee size={20} color="var(--accent-green)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-green)' }}>
              ₹{stats?.totalRevenue || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              From confirmed entry fees
            </div>
          </div>

          {/* Stat 4: Room Emails Sent */}
          <div className="ffa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Room Emails Sent
              </span>
              <MailCheck size={20} color="var(--accent-gold)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>
              {stats?.roomEmailsSent || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Automated scheduler logs
            </div>
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
            <h2 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '20px' }}>
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
                  background: '#0d0f17',
                  border: '1px solid #1f2336',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
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
                  background: '#0d0f17',
                  border: '1px solid #1f2336',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
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
                  background: '#0d0f17',
                  border: '1px solid #1f2336',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <KeyRound color="var(--accent-gold)" size={20} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>Custom Room Credentials</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Set Room ID & Pass for automated 10-min email dispatch</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-dim)" />
              </Link>
            </div>
          </div>

          {/* Recent Confirmed Squads */}
          <div className="ffa-card" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', color: '#ffffff' }}>
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
                      background: '#0d0f17',
                      border: '1px solid #1e2236',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
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
