import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTournaments } from '../services/api';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Clock, 
  IndianRupee, 
  Search, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Filter 
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = () => {
    setLoading(true);
    fetchTournaments()
      .then(data => setTournaments(data))
      .catch(err => console.error('Failed to load tournaments:', err))
      .finally(() => setLoading(false));
  };

  const filteredTournaments = tournaments.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus === 'OPEN') return matchesSearch && t.status === 'OPEN';
    if (filterStatus === 'FULL') return matchesSearch && t.status === 'SLOTS_FULL';
    if (filterStatus === 'CLOSED') return matchesSearch && t.status === 'REGISTRATION_CLOSED';
    return matchesSearch;
  });

  return (
    <div style={{ padding: '40px 0 70px' }}>
      <div className="container">
        {/* Header Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="badge badge-gold" style={{ marginBottom: '10px' }}>
            OFFICIAL BATTLE ROYALE SQUAD MATCHES
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', marginBottom: '10px' }}>
            ESPORTS TOURNAMENTS
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
            Browse squad BR tournaments. Entry fees and capacity are shown for each tournament. Room credentials are sent manually by the administrator.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '35px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
        }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            flex: '1 1 280px',
          }}>
            <Search size={18} color="var(--text-dim)" style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
            }} />
            <input
              type="text"
              placeholder="Search tournament name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '42px' }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'ALL MATCHES', value: 'ALL' },
              { label: 'OPEN SLOTS', value: 'OPEN' },
              { label: 'SLOTS FULL', value: 'FULL' },
              { label: 'CLOSED', value: 'CLOSED' },
            ].map(pill => (
              <button
                key={pill.value}
                onClick={() => setFilterStatus(pill.value)}
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: filterStatus === pill.value ? '1px solid var(--accent-orange)' : '1px solid #282c42',
                  background: filterStatus === pill.value ? 'rgba(255, 85, 0, 0.15)' : '#10121b',
                  color: filterStatus === pill.value ? '#ffffff' : 'var(--text-dim)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament Cards Grid */}
        {loading ? (
          <LoadingSpinner message="Loading tournament schedules..." fullScreen />
        ) : filteredTournaments.length === 0 ? (
          <div className="ffa-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <AlertCircle size={44} color="var(--accent-orange)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No Tournaments Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              No matches match your filter criteria. Try clearing search filters or check back soon.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '25px',
          }}>
            {filteredTournaments.map(t => {
              const isOpen = t.status === 'OPEN';
              const isFull = t.status === 'SLOTS_FULL';
              const isClosed = t.status === 'REGISTRATION_CLOSED';

              return (
                <div
                  key={t.id}
                  className="ffa-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: isOpen ? '1px solid rgba(255, 85, 0, 0.25)' : '1px solid var(--border-card)',
                  }}
                >
                  {/* Card Header */}
                  <div style={{
                    padding: '22px',
                    background: 'linear-gradient(180deg, rgba(255, 85, 0, 0.08) 0%, transparent 100%)',
                    borderBottom: '1px solid var(--border-card)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                      <h2 style={{ fontSize: '20px', color: '#ffffff', lineHeight: 1.2 }}>{t.name}</h2>
                      {isOpen ? (
                        <span className="badge badge-open">REGISTER NOW</span>
                      ) : isFull ? (
                        <span className="badge badge-full">SLOTS FULL</span>
                      ) : (
                        <span className="badge badge-closed">REGISTRATION CLOSED</span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'flex', gap: '15px' }}>
                      <span>Squad: <strong style={{ color: '#ffffff' }}>4 Players</strong></span>
                      <span>Map: <strong style={{ color: '#ffffff' }}>BR Bermuda</strong></span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '22px', flex: 1 }}>
                    {/* Schedule & Financials Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px',
                      background: '#0e1018',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #1f2336',
                      marginBottom: '20px',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          <Calendar size={13} color="var(--accent-orange)" /> Date
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                          {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          <Clock size={13} color="var(--accent-orange)" /> Start Time
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                          {t.startTime} (IST)
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          <IndianRupee size={13} color="var(--accent-green)" /> Entry Fee
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-green)' }}>
                          ₹{t.entryFee}
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          <Trophy size={13} color="var(--accent-gold)" /> Winner Prize
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-gold)' }}>
                          ₹{t.prizeAmount}
                        </div>
                      </div>
                    </div>

                    {/* Slots Gauge */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Confirmed Slots</span>
                        <span style={{ fontWeight: 800, color: isFull ? 'var(--accent-gold)' : '#ffffff' }}>
                          {t.confirmedSlots} / {t.maxSlots} Squads
                        </span>
                      </div>
                      <div style={{
                        height: '8px',
                        background: '#090a0f',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid #23273b',
                      }}>
                        <div style={{
                          width: `${Math.min(100, (t.confirmedSlots / t.maxSlots) * 100)}%`,
                          height: '100%',
                          background: isFull ? 'var(--accent-gold)' : 'linear-gradient(90deg, var(--accent-orange), var(--accent-red))',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>

                    {/* Rules Summary */}
                    {t.rules && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-dim)',
                        lineHeight: '1.5',
                        borderTop: '1px solid #1a1d2e',
                        paddingTop: '14px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        <Shield size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {t.rules}
                      </div>
                    )}
                  </div>

                  {/* Card Action Button */}
                  <div style={{ padding: '16px 22px', background: '#0e1018', borderTop: '1px solid var(--border-card)', display: 'flex', gap: '10px' }}>
                    <Link
                      to={`/tournament/${t.id}`}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      DETAILS
                    </Link>

                    {isOpen ? (
                      <Link
                        to={`/register/${t.id}`}
                        className="btn btn-primary"
                        style={{ flex: 1.5 }}
                      >
                        REGISTER (₹{t.entryFee})
                      </Link>
                    ) : isFull ? (
                      <button
                        disabled
                        className="btn btn-secondary"
                        style={{ flex: 1.5, opacity: 0.6 }}
                      >
                        SLOTS FULL
                      </button>
                    ) : (
                      <button
                        disabled
                        className="btn btn-secondary"
                        style={{ flex: 1.5, opacity: 0.6 }}
                      >
                        REG CLOSED
                      </button>
                    )}
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
